import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

// Server component -- see app/blog/page.tsx for why. force-dynamic keeps
// this in sync with the admin Publish/Unpublish buttons instantly.
export const dynamic = "force-dynamic";

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  format: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
};

async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, content, format, seo_title, seo_description, published_at"
    )
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  return (data as BlogPost) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    return { title: "Article not found" };
  }

  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  const paragraphs = post.content.split(/\n\s*\n/).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || post.seo_description || undefined,
    datePublished: post.published_at || undefined,
    publisher: {
      "@type": "Organization",
      name: "99Bricks",
    },
  };

  return (
    <main className="min-h-screen bg-zinc-50">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
            href="/blog"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            All articles
          </Link>

        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10">

        {post.format && (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
            {post.format}
          </span>
        )}

        <h1 className="mt-3 text-3xl font-black leading-tight text-zinc-900 md:text-4xl">
          {post.title}
        </h1>

        {post.published_at && (
          <p className="mt-3 text-xs font-semibold text-zinc-400">
            {new Date(post.published_at).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        <div className="mt-6 space-y-4">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-base leading-relaxed text-zinc-700">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-10 border-t border-zinc-200 pt-6">
          <Link
            href="/"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Browse Jaipur listings
          </Link>
        </div>

      </article>

    </main>
  );
}
