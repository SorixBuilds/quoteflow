import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §21.12 / §25 equivalence guarantee, CI-enforced: a Public API write and its
 * staff server action call the SAME business-core function from the SAME
 * `features/<entity>/service` module — one implementation, two front doors.
 * If either side ever grows its own copy of the logic (the failure §21.6
 * forbids: "never a second implementation"), the import assertions here break.
 *
 * The behavioral half of the guarantee lives in the service tests (the core
 * produces identical rows/Activity/events regardless of caller) and the route
 * tests (each front door passes its plane's identity into that core).
 */

const ROOT = process.cwd();

function importsOf(relPath: string): string {
  const source = readFileSync(join(ROOT, "src", relPath), "utf8");
  const matches = [
    ...source.matchAll(/import[\s\S]*?from\s*["'][^"']+["'];?/g),
    ...source.matchAll(/import\s+["'][^"']+["'];?/g),
  ];
  return matches.map((m) => m[0]).join("\n");
}

const SURFACES: {
  entity: string;
  core: string;
  route: string;
  action: string;
  schemaModule: string;
}[] = [
  {
    entity: "customers",
    core: "createCustomerCore",
    route: "app/api/v1/customers/route.ts",
    action: "features/customers/actions.ts",
    schemaModule: "@/features/customers/schema",
  },
  {
    entity: "leads",
    core: "createLeadCore",
    route: "app/api/v1/leads/route.ts",
    action: "features/leads/actions.ts",
    schemaModule: "@/features/leads/schema",
  },
  {
    entity: "quotes",
    core: "createQuoteCore",
    route: "app/api/v1/quotes/route.ts",
    action: "features/quotes/actions.ts",
    schemaModule: "@/features/quotes/schema",
  },
];

describe("API write ≡ internal action (§21.12)", () => {
  for (const surface of SURFACES) {
    const serviceModule = `@/features/${surface.entity}/service`;

    it(`${surface.entity}: both front doors import ${surface.core} from ${serviceModule}`, () => {
      for (const file of [surface.route, surface.action]) {
        const imports = importsOf(file);
        expect(imports, `${file} must import ${surface.core}`).toContain(surface.core);
        expect(imports, `${file} must import it from ${serviceModule}`).toContain(serviceModule);
      }
    });

    it(`${surface.entity}: both front doors validate with the same schema module`, () => {
      for (const file of [surface.route, surface.action]) {
        expect(importsOf(file)).toContain(surface.schemaModule);
      }
    });
  }

  it("customers PATCH shares updateCustomerCore with the staff update action", () => {
    expect(importsOf("app/api/v1/customers/[id]/route.ts")).toContain("updateCustomerCore");
    expect(importsOf("features/customers/actions.ts")).toContain("updateCustomerCore");
  });
});
