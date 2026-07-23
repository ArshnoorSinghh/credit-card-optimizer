import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ALL_CARDS } from "@/lib/cards";
import { LEGAL_DOCS } from "@/lib/legal";

/*
  Sitemap for the public, indexable surface: the marketing pages, the two
  optimizers and the card browser, every card detail page, and the legal docs.
  Authed/app-only routes (dashboard, auth) are intentionally excluded — see robots.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = ["", "/cards", "/optimizer", "/points", "/onboarding", "/results", "/legal"];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const cardEntries: MetadataRoute.Sitemap = ALL_CARDS.map((c) => ({
    url: `${SITE_URL}/cards/${c.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const legalEntries: MetadataRoute.Sitemap = LEGAL_DOCS.map((d) => ({
    url: `${SITE_URL}/legal/${d.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [...staticEntries, ...cardEntries, ...legalEntries];
}
