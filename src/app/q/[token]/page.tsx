import type { Metadata } from "next";

import { getPublicQuoteByToken } from "@/features/quotes/public";
import { PublicQuoteView } from "@/features/quotes/components/PublicQuoteView";

export const metadata: Metadata = { title: "Your quote", robots: { index: false } };

/**
 * Public quote page (Phase 5, §16, §39). Top-level route outside the auth shell —
 * access is granted solely by the HMAC token in the URL. An invalid/forged token
 * yields a neutral "not available" message, never an enumeration oracle.
 */
export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await getPublicQuoteByToken(token);

  if (!quote) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-foreground text-lg font-semibold">Quote not available</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This link is invalid or has expired. Please contact the business that sent it to you.
        </p>
      </div>
    );
  }

  return <PublicQuoteView quote={quote} token={token} />;
}
