import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.FRONTEND_URL || "https://smartcampingau.com";
  const now = new Date("2026-10-17T00:00:00.000Z");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/sources`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const regions = [
    "sydney-nsw",
    "blue-mountains-nsw",
    "south-coast-nsw",
    "hunter-valley-nsw",
    "central-coast-nsw",
    "royal-national-park-nsw",
    "dog-friendly-camping-nsw",
    "beach-camping-nsw",
    "2wd-accessible-camping-nsw",
    "melbourne-vic",
    "brisbane-qld",
  ];

  const exploreRoutes: MetadataRoute.Sitemap = regions.map((slug) => ({
    url: `${baseUrl}/explore/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...exploreRoutes];
}
