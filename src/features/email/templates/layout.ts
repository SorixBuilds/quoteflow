import type { EmailBrand } from "@/features/email/branding";

/**
 * Email layout & escaping (Phase 6B Step 5, §3, §11.9).
 *
 * The single HTML producer in the email subsystem. Template functions emit only
 * *structured data* (`TemplateBody` — plain strings, never markup); this layout
 * is the one place that turns that data into HTML, and it escapes every
 * interpolated value. That inverts the injection risk: a template can't emit
 * unescaped user input even by accident, because it never emits HTML at all
 * (§11.9 — the email equivalent of Prisma's parameterized-query discipline).
 *
 * Both renderers (`renderHtml`, `renderText`) are pure and deterministic given a
 * `TemplateBody` + `EmailBrand`, so the snapshot tests are stable.
 */

/** A structured body block — the only content vocabulary a template may emit. */
export type BodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "keyValue"; rows: { label: string; value: string }[] }
  | { type: "lineItems"; rows: { description: string; amount: string }[] }
  | { type: "total"; label: string; value: string }
  | { type: "note"; text: string };

/** What a template function returns: subject + structured, markup-free body. */
export type TemplateBody = {
  subject: string;
  /** Hidden inbox-preview line. */
  preheader?: string;
  heading: string;
  blocks: BodyBlock[];
  /** Optional primary call-to-action button (the URL is attribute-escaped). */
  cta?: { label: string; url: string };
};

/** Escape the five HTML-significant characters for safe text interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape a URL for use in an `href`. Only `http(s)` and `mailto:` are allowed
 * through; anything else (e.g. a `javascript:` URI) collapses to `#`, so a
 * crafted link can never become an active scheme in the rendered email.
 */
export function safeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return "#";
}

function renderBlockHtml(block: BodyBlock, brand: EmailBrand): string {
  switch (block.type) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1A1A1A;">${escapeHtml(
        block.text,
      )}</p>`;
    case "note":
      return `<p style="margin:0 0 16px;padding:12px 16px;background:#F5F6F8;border-radius:6px;font-size:14px;line-height:1.6;color:#3A3A3A;">${escapeHtml(
        block.text,
      )}</p>`;
    case "keyValue":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:14px;color:#1A1A1A;">${block.rows
        .map(
          (row) =>
            `<tr><td style="padding:4px 0;color:#6B7280;">${escapeHtml(
              row.label,
            )}</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(
              row.value,
            )}</td></tr>`,
        )
        .join("")}</table>`;
    case "lineItems":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:14px;color:#1A1A1A;border-collapse:collapse;">${block.rows
        .map(
          (row) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${escapeHtml(
              row.description,
            )}</td><td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap;">${escapeHtml(
              row.amount,
            )}</td></tr>`,
        )
        .join("")}</table>`;
    case "total":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:16px;font-weight:700;color:#1A1A1A;"><tr><td style="padding:8px 0;">${escapeHtml(
        block.label,
      )}</td><td style="padding:8px 0;text-align:right;color:${escapeHtml(
        brand.primaryColor,
      )};">${escapeHtml(block.value)}</td></tr></table>`;
  }
}

/** Render the full branded HTML document for a template body. */
export function renderHtml(body: TemplateBody, brand: EmailBrand): string {
  const logo = brand.logoUrl
    ? `<img src="${safeUrl(brand.logoUrl)}" alt="${escapeHtml(
        brand.companyName,
      )}" style="max-height:40px;max-width:180px;display:block;" />`
    : `<span style="font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(
        brand.companyName,
      )}</span>`;

  const cta = body.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:6px;background:${escapeHtml(
        brand.accentColor,
      )};"><a href="${safeUrl(
        body.cta.url,
      )}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(
        body.cta.label,
      )}</a></td></tr></table>`
    : "";

  const signature = brand.signature
    ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#3A3A3A;">${escapeHtml(
        brand.signature,
      )}</p>`
    : "";

  const footer = brand.footer
    ? `<p style="margin:0 0 8px;">${escapeHtml(brand.footer)}</p>`
    : "";

  const preheader = body.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
        body.preheader,
      )}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(
    body.subject,
  )}</title></head>
<body style="margin:0;padding:0;background:#F5F6F8;">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F5F6F8;padding:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #E5E7EB;">
<tr><td style="background:${escapeHtml(
    brand.primaryColor,
  )};padding:20px 32px;">${logo}</td></tr>
<tr><td style="padding:32px 32px 8px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1A1A1A;">${escapeHtml(
    body.heading,
  )}</h1>
${body.blocks.map((b) => renderBlockHtml(b, brand)).join("\n")}
${cta}
${signature}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#6B7280;">
${footer}
<p style="margin:0;">${escapeHtml(brand.companyName)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderBlockText(block: BodyBlock): string {
  switch (block.type) {
    case "paragraph":
    case "note":
      return block.text;
    case "keyValue":
      return block.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "lineItems":
      return block.rows.map((r) => `- ${r.description}  ${r.amount}`).join("\n");
    case "total":
      return `${block.label}: ${block.value}`;
  }
}

/** Render the plain-text alternative for a template body (§2 — plain-text alt). */
export function renderText(body: TemplateBody, brand: EmailBrand): string {
  const lines: string[] = [brand.companyName, "", body.heading, ""];
  for (const block of body.blocks) {
    lines.push(renderBlockText(block), "");
  }
  if (body.cta) {
    lines.push(`${body.cta.label}: ${body.cta.url}`, "");
  }
  if (brand.signature) lines.push(brand.signature, "");
  if (brand.footer) lines.push("—", brand.footer);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
