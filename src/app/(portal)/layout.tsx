import type { Metadata } from "next";

/**
 * Customer Portal route group (§12.4) — an entirely separate surface from the
 * internal staff application, with its own layout and no shared chrome, sidebar,
 * or session. It deliberately renders none of the staff `(dashboard)` shell. The
 * staff `middleware` treats every `/portal/*` path as its own bucket (§12.9), so
 * a staff session grants nothing here and each page self-gates via
 * `requirePortalSession()`.
 *
 * Indexing is disabled — a customer portal is private by definition.
 */
export const metadata: Metadata = {
  title: { default: "Customer Portal", template: "%s · Customer Portal" },
  robots: { index: false, follow: false },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted/30 min-h-full">{children}</div>;
}
