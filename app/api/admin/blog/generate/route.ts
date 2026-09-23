import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import {
  generateBlogArticle,
  PlatformSnapshot,
} from "../../../../lib/gemini";

// POST /api/admin/blog/generate
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
// Body: { buildQueueId: number }
//
// Takes one queued "content" item from build_queue (a market-trend
// recommendation an admin already approved), asks Gemini to write a full
// article grounded in the platform's real listing mix, and inserts it into
// blog_posts as a "draft" for review on /admin/blog. Marks the build_queue
// item "in_progress" so it's clear a draft exists. This is the only step
// in the whole blog flow that touches Gemini -- reviewing, editing, and
// publishing the draft afterwards are all plain database writes from the
// admin page (via the anon client, allowed by blog_posts' admin RLS
// policies), which is what lets Publish apply to the live site instantly.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  const adminId = await verifyAdmin(accessToken);

  if (!adminId) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const buildQueueId = body?.buildQueueId;

  if (!buildQueueId) {
    return NextResponse.json(
      { error: "buildQueueId is required." },
      { status: 400 }
    );
  }

  const { data: queueItem, error: queueError } = await supabaseAdmin
    .from("build_queue")
    .select("id, title, detail, type, status")
    .eq("id", buildQueueId)
    .single();

  if (queueError || !queueItem) {
    return NextResponse.json(
      { error: "Could not find that build_queue item." },
      { status: 404 }
    );
  }

  if (queueItem.type !== "content") {
    return NextResponse.json(
      {
        error:
          "Only \"content\" build_queue items can be drafted into an article. This one is tagged \"feature\" -- that's a code task, not a content task.",
      },
      { status: 400 }
    );
  }

  if (queueItem.status === "done" || queueItem.status === "dismissed") {
    return NextResponse.json(
      { error: "This build_queue item is already " + queueItem.status + "." },
      { status: 400 }
    );
  }

  const { data: activeProperties, error: propertiesError } =
    await supabaseAdmin
      .from("properties")
      .select("type, area")
      .eq("verification_status", "approved")
      .eq("status", "Available");

  if (propertiesError) {
    return NextResponse.json(
      { error: "Failed to load properties: " + propertiesError.message },
      { status: 500 }
    );
  }

  const typeCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();

  for (const p of activeProperties || []) {
    if (p.type) {
      typeCounts.set(p.type, (typeCounts.get(p.type) || 0) + 1);
    }
    if (p.area) {
      areaCounts.set(p.area, (areaCounts.get(p.area) || 0) + 1);
    }
  }

  const snapshot: PlatformSnapshot = {
    totalListings: (activeProperties || []).length,
    typeBreakdown: Array.from(typeCounts.entries()).map(([type, count]) => ({
      type,
      count,
    })),
    areaBreakdown: Array.from(areaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([area, count]) => ({ area, count })),
  };

  let draft;

  try {
    draft = await generateBlogArticle(
      queueItem.title,
      queueItem.detail,
      null,
      snapshot
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini article drafting failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  // Slugify defensively -- Gemini's slug is usually fine, but never trust
  // model output to already be URL-safe.
  function slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  let baseSlug = slugify(draft.slug || draft.title) || "article";
  let finalSlug = baseSlug;
  let suffix = 2;

  // Ensure uniqueness -- append -2, -3, etc. on a collision rather than
  // failing the insert.
  while (true) {
    const { data: existing } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();

    if (!existing) break;

    finalSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("blog_posts")
    .insert({
      title: draft.title,
      slug: finalSlug,
      format: "Blog post",
      excerpt: draft.excerpt,
      content: draft.content,
      seo_title: draft.seoTitle,
      seo_description: draft.seoDescription,
      status: "draft",
      source_build_queue_id: queueItem.id,
    })
    .select("id, slug")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        error:
          "Failed to save the draft: " +
          (insertError?.message || "unknown error"),
      },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("build_queue")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", queueItem.id);

  return NextResponse.json({
    success: true,
    postId: inserted.id,
    slug: inserted.slug,
  });
}
