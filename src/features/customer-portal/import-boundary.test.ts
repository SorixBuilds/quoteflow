import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Import-boundary guarantee (§12.12, §22.1, §25) — promoted to a first-class,
 * CI-enforced test, not a code-review convention. The three authentication planes
 * (staff session, portal session, API key) must be non-interchangeable:
 *
 *   1. The portal **session surface** (`session.ts`, `actions.ts`, `queries.ts`)
 *      never imports a staff auth helper (`requireSession`/`requireRole`/
 *      `@/lib/auth`/`@/lib/permissions`). A portal request therefore has no code
 *      path into an internal-app authorization decision.
 *   2. The staff plane (`@/lib/*`, `features/auth/*`) never imports
 *      `requirePortalSession` — a staff route can't accidentally authenticate as a
 *      customer.
 *
 * `staff-actions.ts` is the single, deliberate staff↔portal bridge (it issues/
 * revokes tokens under the staff session) and is asserted to use `requireRole`,
 * so the separation is intentional, not accidental.
 */

const ROOT = process.cwd();
const portalDir = join(ROOT, "src", "features", "customer-portal");

/**
 * The concatenated text of every `import ...` statement in a source file. We scan
 * imports ONLY — explanatory comments and prose legitimately *name* the forbidden
 * helpers (to document the boundary), so a raw substring scan would be a false
 * positive. The boundary we care about is the actual module graph.
 */
function importsOf(source: string): string {
  const matches = [
    ...source.matchAll(/import[\s\S]*?from\s*["'][^"']+["'];?/g),
    ...source.matchAll(/import\s+["'][^"']+["'];?/g),
  ];
  return matches.map((m) => m[0]).join("\n");
}

function readImports(relPath: string): string {
  return importsOf(readFileSync(join(portalDir, relPath), "utf8"));
}

const STAFF_AUTH_MARKERS = ["requireSession", "requireRole", "@/lib/auth", "@/lib/permissions"];

describe("portal ↔ staff import boundary (§12.12, §25)", () => {
  for (const file of ["session.ts", "actions.ts", "queries.ts"]) {
    it(`${file} imports no staff auth helper`, () => {
      const imports = readImports(file);
      for (const marker of STAFF_AUTH_MARKERS) {
        expect(imports, `${file} must not import ${marker}`).not.toContain(marker);
      }
    });
  }

  it("staff-actions.ts is the single, intentional staff bridge (imports requireRole)", () => {
    const imports = readImports("staff-actions.ts");
    expect(imports).toContain("requireRole");
    expect(imports).toContain("@/lib/permissions");
  });

  it("no staff-plane module (@/lib, features/auth) imports requirePortalSession", () => {
    const offenders: string[] = [];
    for (const dir of [join(ROOT, "src", "lib"), join(ROOT, "src", "features", "auth")]) {
      walk(dir, (file) => {
        if (importsOf(readFileSync(file, "utf8")).includes("requirePortalSession")) {
          offenders.push(file);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

/** Recursively visit every `.ts`/`.tsx` file under `dir`. */
function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, visit);
    } else if (/\.tsx?$/.test(entry)) {
      visit(full);
    }
  }
}
