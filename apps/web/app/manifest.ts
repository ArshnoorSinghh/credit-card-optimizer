import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

/*
  Web app manifest — gives the site an installable identity and a branded splash /
  tab treatment. Icons reference the app/icon.svg mark (scalable) and the generated
  apple touch icon.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Smarter UAE credit cards`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e6",
    theme_color: "#f7f1e6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
