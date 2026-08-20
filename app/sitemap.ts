import type { MetadataRoute } from "next";
import { SOURCES } from "@/lib/sources";
import { SITE_URL } from "@/lib/site";

const CATEGORIES = Array.from(new Set(SOURCES.map((s) => s.category)));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "always", priority: 1 },
    ...CATEGORIES.map((category) => ({
      url: `${SITE_URL}/?category=${encodeURIComponent(category)}`,
      changeFrequency: "always" as const,
      priority: 0.8,
    })),
  ];
}
