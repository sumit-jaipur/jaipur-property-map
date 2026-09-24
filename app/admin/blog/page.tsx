"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type QueueItem = {
  id: number;
  title: string;
  detail: string;
  type: "content" | "feature";
  status: "queued" | "in_progress" | "done" | "dismissed";
};

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  format: string | null;
  excerpt: string | null;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "published";
  source_build_queue_id: number | null;
  published_at: string | null;
  created_at: string;
};

type DraftEdits = {
  title: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
};

export default function AdminBlogPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [drafts, setDrafts] = useState<BlogPost[]>([]);
  const [published, setPublished] = useState<BlogPost[]>([]);

  const [edits, setEdits] = useState<Record<number, DraftEdits>>({});

  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [discardingId, setDiscardingId] = useState<number | null>(null);
  const [unpublishingId, setUnpublishingId] = useState<number | null>(null);

  async function loadEverything() {
    const [
      { data: queueData, error: queueError },
      { data: postData, error: postError },
    ] = await Promise.all([
      supabase
        .from("build_queue")
        .select("id, title, detail, type, status")
        .eq("type", "content")
        .in("status", ["queued", "in_progress"])
        .order("created_at", { ascending: false }),
      supabase
        .from("blog_posts")
        .select(
          "id, title, slug, format, excerpt, content, seo_title, seo_description, status, source_build_queue_id, published_at, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (!queueError) {
      setQueueItems((queueData ?? []) as QueueItem[]);
    }

    if (postError) {
      // blog_posts may not exist yet if the migration hasn't been run --
      // show a clear message instead of a blank/broken page.
      setError(
        "Could not load blog posts (has claude/blog-posts-migration.sql been run in Supabase yet?). " +
          postError.message
      );
    } else {
      const all = (postData ?? []) as BlogPost[];
      const draftPosts = all.filter((p) => p.status === "draft");

      setDrafts(draftPosts);
      setPublished(all.filter((p) => p.status === "published"));

      setEdits((current) => {
        const next = { ...current };
        for (const post of draftPosts) {
          if (!next[post.id]) {
            next[post.id] = {
              title: post.title,
              excerpt: post.excerpt || "",
              content: post.content,
              seo_title: post.seo_title || "",
              seo_description: post.seo_description || "",
            };
          }
        }
        return next;
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      await loadEverything();
    }

    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleDraftArticle(item: QueueItem) {
    setDraftingId(item.id);
    setError("");
    setInfo("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setDraftingId(null);
      setError("Your session expired -- please sign in again.");
      return;
    }

    const response = await fetch("/api/admin/blog/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ buildQueueId: item.id }),
    });

    const result = await response.json();

    setDraftingId(null);

    if (!response.ok) {
      setError(result.error || "Failed to draft the article.");
      return;
    }

    setInfo(`Draft ready -- review it below before publishing.`);
    await loadEverything();
  }

  function updateEdit(postId: number, field: keyof DraftEdits, value: string) {
    setEdits((current) => ({
      ...current,
      [postId]: { ...current[postId], [field]: value },
    }));
  }

  async function handleSaveDraft(post: BlogPost) {
    const draftEdits = edits[post.id];
    if (!draftEdits) return;

    setSavingId(post.id);
    setError("");

    const { error: updateError } = await supabase
      .from("blog_posts")
      .update({
        title: draftEdits.title,
        excerpt: draftEdits.excerpt,
        content: draftEdits.content,
        seo_title: draftEdits.seo_title,
        seo_description: draftEdits.seo_description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setInfo("Changes saved.");
    await loadEverything();
  }

  async function handlePublish(post: BlogPost) {
    const draftEdits = edits[post.id];

    setPublishingId(post.id);
    setError("");
    setInfo("");

    const { error: publishError } = await supabase
      .from("blog_posts")
      .update({
        ...(draftEdits
          ? {
              title: draftEdits.title,
              excerpt: draftEdits.excerpt,
              content: draftEdits.content,
              seo_title: draftEdits.seo_title,
              seo_description: draftEdits.seo_description,
            }
          : {}),
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (publishError) {
      setPublishingId(null);
      setError(publishError.message);
      return;
    }

    if (post.source_build_queue_id) {
      await supabase
        .from("build_queue")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", post.source_build_queue_id);
    }

    setPublishingId(null);
    setInfo("Published -- it's live on /blog right now.");
    await loadEverything();
  }

  async function handleUnpublish(post: BlogPost) {
    setUnpublishingId(post.id);
    setError("");

    const { error: unpublishError } = await supabase
      .from("blog_posts")
      .update({ status: "draft" })
      .eq("id", post.id);

    setUnpublishingId(null);

    if (unpublishError) {
      setError(unpublishError.message);
      return;
    }

    await loadEverything();
  }

  async function handleDiscardDraft(post: BlogPost) {
    setDiscardingId(post.id);
    setError("");

    const { error: deleteError } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", post.id);

    if (deleteError) {
      setDiscardingId(null);
      setError(deleteError.message);
      return;
    }

    if (post.source_build_queue_id) {
      await supabase
        .from("build_queue")
        .update({ status: "queued", updated_at: new Date().toISOString() })
        .eq("id", post.source_build_queue_id);
    }

    setDiscardingId(null);
    await loadEverything();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading Blog Studio...
          </p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            🛡️
          </div>

          <h1 className="mt-4 text-2xl font-black text-zinc-900">
            Access Denied
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            This dashboard is only available to administrators.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-zinc-900 px-5 py-2.5 font-semibold text-white"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">

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

          <div className="flex items-center gap-2">
            <Link
              href="/admin/properties"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Property Approval
            </Link>

            <Link
              href="/admin/ai-suggestions"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              AI Suggestions
            </Link>

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              Blog Studio
            </span>

            <Link
              href="/admin/inquiries"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Sales Pipeline
            </Link>

            <Link
              href="/admin/hr"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              HR
            </Link>
          </div>

        </div>
      </div>


      <div className="mx-auto max-w-5xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Content pipeline
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Blog Studio
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-500">
            Turn an approved content idea into a full article, review and
            edit it, then publish. Publishing writes straight to the live
            site -- no deploy needed, it appears on /blog immediately.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {info}
          </div>
        )}


        {/* QUEUED CONTENT IDEAS -- approved market-trend recommendations
            (type: "content") waiting to become an article. */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">
            Queued content ideas
          </p>

          <h2 className="mt-1 text-xl font-black text-zinc-900">
            Ready to draft
          </h2>

          {queueItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Nothing queued right now. Approve a &quot;Content&quot;
              recommendation on the AI Suggestions page to send one here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {queueItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.detail}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDraftArticle(item)}
                    disabled={draftingId === item.id}
                    className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {draftingId === item.id
                      ? "Drafting..."
                      : item.status === "in_progress"
                      ? "Draft Again"
                      : "Draft Article"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>


        {/* DRAFTS -- Gemini-written articles waiting for review/edit and
            Publish. */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">
            Drafts
          </p>

          <h2 className="mt-1 text-xl font-black text-zinc-900">
            Review before publishing
          </h2>

          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No drafts waiting right now.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {drafts.map((post) => {
                const draftEdits = edits[post.id] || {
                  title: post.title,
                  excerpt: post.excerpt || "",
                  content: post.content,
                  seo_title: post.seo_title || "",
                  seo_description: post.seo_description || "",
                };

                return (
                  <div
                    key={post.id}
                    className="rounded-2xl border border-zinc-200 p-4"
                  >
                    <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Title
                    </label>
                    <input
                      value={draftEdits.title}
                      onChange={(e) =>
                        updateEdit(post.id, "title", e.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-900"
                    />

                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Excerpt
                    </label>
                    <textarea
                      value={draftEdits.excerpt}
                      onChange={(e) =>
                        updateEdit(post.id, "excerpt", e.target.value)
                      }
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                    />

                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Article body
                    </label>
                    <textarea
                      value={draftEdits.content}
                      onChange={(e) =>
                        updateEdit(post.id, "content", e.target.value)
                      }
                      rows={10}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm leading-relaxed text-zinc-700"
                    />

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-zinc-400">
                          SEO title
                        </label>
                        <input
                          value={draftEdits.seo_title}
                          onChange={(e) =>
                            updateEdit(post.id, "seo_title", e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-zinc-400">
                          SEO description
                        </label>
                        <input
                          value={draftEdits.seo_description}
                          onChange={(e) =>
                            updateEdit(
                              post.id,
                              "seo_description",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handlePublish(post)}
                        disabled={publishingId === post.id}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {publishingId === post.id
                          ? "Publishing..."
                          : "Publish"}
                      </button>

                      <button
                        onClick={() => handleSaveDraft(post)}
                        disabled={savingId === post.id}
                        className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
                      >
                        {savingId === post.id ? "Saving..." : "Save Changes"}
                      </button>

                      <button
                        onClick={() => handleDiscardDraft(post)}
                        disabled={discardingId === post.id}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {discardingId === post.id
                          ? "Discarding..."
                          : "Discard Draft"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>


        {/* PUBLISHED -- live on /blog right now. */}

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">
            Published
          </p>

          <h2 className="mt-1 text-xl font-black text-zinc-900">
            Live on 99Bricks right now
          </h2>

          {published.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Nothing published yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {published.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800">
                      {post.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      /blog/{post.slug}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => handleUnpublish(post)}
                      disabled={unpublishingId === post.id}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {unpublishingId === post.id
                        ? "Unpublishing..."
                        : "Unpublish"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>

    </main>
  );
}
