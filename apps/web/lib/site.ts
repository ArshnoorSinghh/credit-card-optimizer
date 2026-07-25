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
// why: this is user-facing copy (meta description, OG, Twitter), so it follows main's
// no-dash rule. Kept identical to the description main set in layout.tsx so the site
// has one description, not two that drift apart.
export const SITE_DESCRIPTION =
  "Find the best 1 to 3 UAE credit card combination for how you actually spend, net of every annual fee and reward cap. See the maths behind every recommendation, and know what your points are worth.";
