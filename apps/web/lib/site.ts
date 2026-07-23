/*
  Canonical site URL, resolved once. Used for metadataBase (so OG/Twitter image
  URLs are absolute), the sitemap, and robots.

  Priority: an explicit NEXT_PUBLIC_SITE_URL, else the Vercel-provided host, else
  localhost for dev.
*/
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const SITE_NAME = "Fils";
export const SITE_DESCRIPTION =
  "Model your spending, find your best 1–3 card portfolio, and make every point count. UAE credit-card optimization.";
