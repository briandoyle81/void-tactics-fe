import type { MetadataRoute } from "next";

// /robots.txt. The game client and Ops Console stay crawlable on purpose:
// they're kept out of search by noindex (their layouts, and X-Robots-Tag on
// the play host in proxy.ts), which crawlers only see if they can fetch them.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voidtactics.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
