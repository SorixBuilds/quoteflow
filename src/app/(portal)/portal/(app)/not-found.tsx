import Link from "next/link";

/** Portal-scoped 404 (§12.10) — a neutral message, never an enumeration oracle. */
export default function PortalNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-foreground text-lg font-semibold">Not available</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This item isn&apos;t available on your portal. It may have moved or no longer exists.
      </p>
      <Link href="/portal" className="text-primary mt-4 inline-block text-sm hover:underline">
        Back to your portal
      </Link>
    </div>
  );
}
