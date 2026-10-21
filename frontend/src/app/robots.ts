import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.FRONTEND_URL || "https://smartcampingau.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore/", "/privacy", "/terms"],
        disallow: ["/trip/", "/pack/", "/api/", "/_next/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
