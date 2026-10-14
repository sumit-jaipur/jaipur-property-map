import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../lib/supabaseAdmin";
import { githubRequest, GITHUB_OWNER } from "../../../lib/github";

// GET /api/admin/usage-stats
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Powers the admin "Usage & Limits" page. Two kinds of numbers come back:
//
// 1) LIVE numbers this route actually measures right now: row counts from
//    our own Supabase tables, real bytes used in the property-images
//    storage bucket (walked directly, not estimated), and GitHub's own
//    live rate-limit/billing reply for the token the build pipeline uses.
// 2) REFERENCE numbers: the free-tier ceiling for each third-party
//    service we depend on (Supabase, Vercel, Mapbox, Gemini, Tavily,
//    GitHub Actions), researched from each service's own docs and dated
//    below so Sumit knows how fresh they are. These are NOT fetched live
//    -- Mapbox/Gemini/Tavily don't expose "how much have I used" through
//    the same key this app already calls them with, and Vercel's usage
//    API needs a separate token this app has never needed before. Each
//    one says exactly what extra credential would be needed to make it
//    live, so that's a deliberate choice to make later, not a gap nobody
//    knows about.
//
// Researched 2026-10-14. Re-check the official pricing page for each
// service every few months -- free tiers change.
const LIMITS_RESEARCHED_AT = "2026-10-14";

type StorageWalkResult = {
  fileCount: number;
  totalBytes: number;
  truncated: boolean;
};

// Supabase Storage's list() only returns one folder level at a time (like
// `ls`, not `ls -R`) -- a folder entry comes back with id === null. Capped
// at MAX_OBJECTS so a bucket that somehow grew huge can't make this route
// hang; past the cap, totalBytes is reported as a floor, not an exact
// total (truncated: true tells the page to say so).
async function walkStorageBucket(
  bucket: string,
  path: string,
  acc: StorageWalkResult,
  maxObjects: number
): Promise<void> {
  if (acc.truncated) return;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error || !data) return;

  for (const entry of data) {
    if (acc.fileCount >= maxObjects) {
      acc.truncated = true;
      return;
    }

    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.id === null) {
      // A "folder" -- recurse into it.
      await walkStorageBucket(bucket, entryPath, acc, maxObjects);
    } else {
      acc.fileCount += 1;
      acc.totalBytes += entry.metadata?.size ?? 0;
    }
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  const adminId = await verifyAdmin(accessToken);

  if (!adminId) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  // --- Live counts from our own database -----------------------------
  // Wrapped so a table that doesn't exist yet on an older DB (or any
  // other query failure) just comes back as "unknown" instead of taking
  // the whole page down.
  async function safeCount(
    build: () => PromiseLike<{ count: number | null; error: unknown }>
  ): Promise<number | null> {
    try {
      const { count, error } = await build();
      return error ? null : count ?? null;
    } catch {
      return null;
    }
  }

  const [
    propertiesTotal,
    propertiesPending,
    propertyMediaCount,
    inquiriesCount,
    blogPostsCount,
    buildQueueDispatched,
    userList,
  ] = await Promise.all([
    safeCount(() =>
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true })
    ),
    safeCount(() =>
      supabaseAdmin
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending")
    ),
    safeCount(() =>
      supabaseAdmin.from("property_media").select("id", { count: "exact", head: true })
    ),
    safeCount(() =>
      supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true })
    ),
    safeCount(() =>
      supabaseAdmin.from("blog_posts").select("id", { count: "exact", head: true })
    ),
    safeCount(() =>
      supabaseAdmin
        .from("build_queue")
        .select("id", { count: "exact", head: true })
        .not("github_issue_number", "is", null)
    ),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // --- Live bytes actually used in the property-images bucket --------
  const storageWalk: StorageWalkResult = {
    fileCount: 0,
    totalBytes: 0,
    truncated: false,
  };

  try {
    await walkStorageBucket("property-images", "", storageWalk, 4000);
  } catch {
    // Leave whatever was accumulated before the failure -- a partial,
    // clearly-truncated number is still more useful than none.
    storageWalk.truncated = true;
  }

  // --- GitHub: live rate-limit + best-effort Actions minutes ---------
  let githubRateLimit: { remaining: number; limit: number; resetsAt: string } | null = null;
  let githubActionsMinutesUsed: number | null = null;

  try {
    const rateLimitRes = await githubRequest("/rate_limit");

    if (rateLimitRes.ok) {
      const rl = await rateLimitRes.json();
      githubRateLimit = {
        remaining: rl.rate.remaining,
        limit: rl.rate.limit,
        resetsAt: new Date(rl.rate.reset * 1000).toISOString(),
      };
    }

    // Actions billing needs the token to have billing-read access to the
    // account that owns the repo -- a repo-scoped PAT often doesn't, so
    // this is allowed to just silently come back null.
    const billingRes = await githubRequest(
      `/users/${GITHUB_OWNER}/settings/billing/actions`
    );

    if (billingRes.ok) {
      const billing = await billingRes.json();
      githubActionsMinutesUsed = billing.total_minutes_used ?? null;
    }
  } catch {
    // GITHUB_DISPATCH_TOKEN not set, or GitHub unreachable -- the
    // reference numbers below still render fine without this.
  }

  return NextResponse.json({
    researchedAt: LIMITS_RESEARCHED_AT,
    live: {
      database: {
        propertiesTotal,
        propertiesPending,
        propertyMediaCount,
        inquiriesCount,
        blogPostsCount,
        registeredUsers: userList.data?.users.length ?? null,
        buildQueueDispatched,
      },
      storage: {
        bucket: "property-images",
        fileCount: storageWalk.fileCount,
        totalBytes: storageWalk.totalBytes,
        truncated: storageWalk.truncated,
      },
      github: {
        rateLimit: githubRateLimit,
        actionsMinutesUsed: githubActionsMinutesUsed,
      },
    },
    // Static reference limits -- see the comment at the top of this file
    // for why these aren't fetched live, and LIMITS_RESEARCHED_AT above
    // for when they were last checked.
    reference: [
      {
        service: "Supabase",
        plan: "Free",
        resets: "Mostly monthly; project pauses after 7 days with no activity",
        limits: [
          { label: "Database size", value: "500 MB" },
          { label: "File storage", value: "1 GB" },
          { label: "Monthly egress (bandwidth out)", value: "5 GB/month" },
          { label: "Monthly active users", value: "50,000/month" },
          { label: "Edge Function invocations", value: "500,000/month" },
        ],
        sourceUrl: "https://supabase.com/pricing",
      },
      {
        service: "Vercel",
        plan: "Hobby",
        resets: "Rolling ~30 days from when a limit is hit (no fixed billing date)",
        limits: [
          { label: "Fast Data Transfer", value: "100 GB/month" },
          { label: "Function invocations", value: "1,000,000/month" },
          { label: "Active CPU", value: "4 CPU-hrs/month" },
          { label: "Deployments", value: "100/day" },
          { label: "Runtime log retention", value: "1 hour" },
        ],
        sourceUrl: "https://vercel.com/docs/plans/hobby",
      },
      {
        service: "Mapbox",
        plan: "Pay-as-you-go (free allowance)",
        resets: "Monthly",
        limits: [
          { label: "Map loads (web)", value: "50,000/month" },
          { label: "Temporary Geocoding API", value: "100,000 requests/month" },
          { label: "Search Box API requests", value: "~25,000/month" },
        ],
        sourceUrl: "https://www.mapbox.com/pricing",
      },
      {
        service: "Gemini API",
        plan: "Free tier",
        resets: "Request-per-day quota resets at midnight Pacific time",
        limits: [
          {
            label: "Requests per minute / per day",
            value: "Varies by model & project -- check aistudio.google.com/rate-limit",
          },
        ],
        sourceUrl: "https://ai.google.dev/gemini-api/docs/rate-limits",
      },
      {
        service: "Tavily (web search for AI content research)",
        plan: "Free Researcher",
        resets: "Monthly",
        limits: [
          { label: "Search credits", value: "1,000/month" },
          { label: "Basic search", value: "1 credit each" },
          { label: "Advanced search", value: "2 credits each" },
        ],
        sourceUrl: "https://docs.tavily.com/documentation/api-credits",
      },
      {
        service: "GitHub Actions (auto-build pipeline)",
        plan: "Free (private repo)",
        resets: "Monthly",
        limits: [
          { label: "Runner minutes", value: "2,000/month" },
          { label: "Artifact + Packages storage", value: "500 MB" },
          { label: "Actions cache", value: "10 GB/repo" },
        ],
        sourceUrl:
          "https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions",
      },
    ],
  });
}
