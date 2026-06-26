import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Auth.js (next-auth v5) module augmentation.
 *
 * Adds the QuoteFlow-specific claims (`organizationId`, `role`, `isActive`) to
 * the framework's `User`, `Session`, and `JWT` types so callbacks and
 * `session.user` are strongly typed end-to-end (§7.3–7.4). Type-only — never
 * bundled into client code.
 */

declare module "next-auth" {
  /** Shape returned by the Credentials `authorize()` (§6.1 step 4f). */
  interface User {
    organizationId: string;
    role: Role;
    isActive?: boolean;
  }

  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: Role;
      /**
       * Reflects `isActive` at the time the JWT was issued. Under the JWT
       * strategy this can be stale; sensitive writes re-check the database
       * (§7.6). Middleware uses it as a best-effort force-logout signal (§6.6).
       */
      isActive: boolean;
    } & DefaultSession["user"];
  }
}

// The `JWT` interface is declared in `@auth/core/jwt`; `next-auth/jwt` only
// re-exports it (`export * from "@auth/core/jwt"`). Augmenting the re-export
// would not merge with the real interface, so we augment the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    role: Role;
    isActive: boolean;
  }
}
