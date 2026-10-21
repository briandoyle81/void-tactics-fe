import type { MetadataRoute } from "next";

// /sitemap.xml: the website's pages (the game client isn't indexed).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voidtactics.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/audio-credits`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
