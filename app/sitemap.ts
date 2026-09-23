import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://jaipur-property-map.vercel.app";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/favorites`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  if (!supabaseUrl || !supabaseKey) {
    return staticRoutes;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseKey
  );

  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("verification_status", "approved");

  const propertyRoutes: MetadataRoute.Sitemap =
    (data ?? []).map((property) => ({
      url: `${baseUrl}/properties/${property.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const { data: postData } = await supabase
    .from("blog_posts")
    .select("slug, published_at")
    .eq("status", "published");

  const blogRoutes: MetadataRoute.Sitemap =
    (postData ?? []).map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.published_at
        ? new Date(post.published_at)
        : new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [
    ...staticRoutes,
    ...propertyRoutes,
    ...blogRoutes,
  ];
}
