import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

// Server component, deliberately not "use client" -- the whole point of
// this page is to be crawlable and indexed by Google, so it reads
// blog_posts directly on the server and renders real HTML, not a
// client-side fetch. force-dynamic means a newly Published post (or an
// Unpublish) shows up here immediately, with no rebuild/deploy needed --
// see app/admin/blog/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Jaipur real estate guides, market trends, and buying tips from 99Bricks.",
};

type BlogPostSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  format: string | null;
  published_at: string | null;
};

async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, format, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (data ?? []) as BlogPostSummary[];
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="99Bricks"
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
            <span className="text-sm font-black text-header-fg">
              99Bricks
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            Back to listings
          </Link>

        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">

        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
          99Bricks Journal
        </p>

        <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
          Jaipur Real Estate Guides &amp; Insights
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Buying tips, locality guides, and market trends for Jaipur
          property, written for 99Bricks.
        </p>

        {posts.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <p className="text-sm text-zinc-500">
              No articles published yet -- check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                {post.format && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                    {post.format}
                  </span>
                )}

                <h2 className="mt-3 text-lg font-black leading-snug text-zinc-900 group-hover:text-accent">
                  {post.title}
                </h2>

                {post.excerpt && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {post.excerpt}
                  </p>
                )}

                {post.published_at && (
                  <p className="mt-3 text-xs font-semibold text-zinc-400">
                    {new Date(post.published_at).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

      </div>

    </main>
  );
}
