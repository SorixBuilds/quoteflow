import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Import-boundary guarantee for the THIRD authentication plane (§21, §22.1,
 * §25) — the Public API analog of the portal's boundary test:
 *
 *   1. The API plane (`lib/api/*`, `app/api/v1/*`) never imports a staff or
 *      portal auth helper. An API key therefore has no code path into a staff
 *      authorization decision or a portal session.
 *   2. `requireApiKey` (`@/lib/api/auth`) is imported ONLY under `app/api/v1` —
 *      no staff feature, portal module, or server action can authenticate as an
 *      API caller.
 *
 * `features/api-keys/actions.ts`/`queries.ts` are the single, deliberate staff
 * management bridge (they mint/revoke keys under the staff session, §21.5) and
 * are asserted to use `requireRole` — intentional, not accidental.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function importsOf(source: string): string {
  const matches = [
    ...source.matchAll(/import[\s\S]*?from\s*["'][^"']+["'];?/g),
    ...source.matchAll(/import\s+["'][^"']+["'];?/g),
  ];
  return matches.map((m) => m[0]).join("\n");
}

/** Recursively visit every non-test `.ts`/`.tsx` file under `dir`. */
function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, visit);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      visit(full);
    }
  }
}

const STAFF_OR_PORTAL_MARKERS = [
  "@/lib/permissions",
  "@/lib/auth\"",
  "requireSession",
  "requireRole",
  "requirePortalSession",
];

describe("public API ↔ staff/portal import boundary (§22.1, §25)", () => {
  it("the API plane imports no staff or portal auth helper", () => {
    const offenders: string[] = [];
    for (const dir of [join(SRC, "lib", "api"), join(SRC, "app", "api", "v1")]) {
      walk(dir, (file) => {
        const imports = importsOf(readFileSync(file, "utf8"));
        for (const marker of STAFF_OR_PORTAL_MARKERS) {
          if (imports.includes(marker)) offenders.push(`${file} imports ${marker}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("requireApiKey is imported only under app/api/v1", () => {
    const offenders: string[] = [];
    walk(SRC, (file) => {
      if (file.includes(join("app", "api", "v1"))) return;
      if (file === join(SRC, "lib", "api", "auth.ts")) return; // the definition itself
      if (importsOf(readFileSync(file, "utf8")).includes("@/lib/api/auth")) {
        offenders.push(file);
      }
    });
    expect(offenders).toEqual([]);
  });

  it("api-keys management is the single, intentional staff bridge (uses requireRole)", () => {
    for (const file of ["actions.ts", "queries.ts"]) {
      const imports = importsOf(
        readFileSync(join(SRC, "features", "api-keys", file), "utf8"),
      );
      expect(imports).toContain("@/lib/permissions");
      expect(imports).not.toContain("@/lib/api/auth");
    }
  });
});
