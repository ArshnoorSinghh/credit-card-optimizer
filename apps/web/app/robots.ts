import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/*
  robots.txt — allow crawling of the public product, but keep authed/app-only and
  API surfaces out of the index. Points crawlers at the sitemap.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/sign-in", "/sign-up"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
