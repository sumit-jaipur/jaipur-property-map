"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function formatPrice(price: number) {
  const rupee = "₹";

  if (price >= 10000000) {
    return rupee + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return rupee + (price / 100000).toFixed(0) + " Lakh";
  }

  return rupee + price.toLocaleString("en-IN");
}

type Property = {
  id: number;
  title: string;
  type: string;
  image: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type DescriptionContent = { description: string };
type SeoContent = { seo_title: string; seo_description: string };
type MarketTrendSource = { title: string; url: string };
// Legacy shape: how market_trend suggestions looked before the
// content/feature split -- kept so any old, not-yet-reviewed rows from
// before this change still render instead of breaking.
type MarketTrendLegacyContent = { research: string; sources?: MarketTrendSource[] };
type MarketTrendOverviewContent = {
  kind: "overview";
  overview: string;
  sources?: MarketTrendSource[];
};
type MarketTrendCategory =
  | "design"
  | "seo_content"
  | "marketing"
  | "features"
  | "monetization"
  | "trust_legal"
  | "rental_management"
  | "financing"
  | "general";

const CATEGORY_LABELS: Record<MarketTrendCategory, string> = {
  design: "Design & UX",
  seo_content: "SEO & Content",
  marketing: "Marketing",
  features: "Product Features",
  monetization: "Monetization",
  trust_legal: "Trust & Legal",
  rental_management: "Rental & Property Mgmt",
  financing: "Financing",
  general: "General",
};

type MarketTrendRecommendationContent = {
  kind: "recommendation";
  recommendationType: "content" | "feature";
  // Optional -- older rows generated before this field existed won't have
  // it, so the card below falls back to not showing a category badge.
  recommendationCategory?: MarketTrendCategory;
  title: string;
  detail: string;
  sources?: MarketTrendSource[];
};
type MarketTrendContent =
  | MarketTrendLegacyContent
  | MarketTrendOverviewContent
  | MarketTrendRecommendationContent;

type BuildQueueItem = {
  id: number;
  title: string;
  detail: string;
  type: "content" | "feature";
  status: "queued" | "in_progress" | "done" | "dismissed";
  created_at: string;
  github_issue_number?: number | null;
  github_pr_number?: number | null;
  github_pr_url?: string | null;
};
type PriceFlagContent = {
  flag: "fair" | "overpriced" | "underpriced";
  reasoning: string;
  suggestedRange: string;
  suggestedPrice?: number;
};
type StaleListingContent = { reasoning: string; suggestedAction: string };
type ContentIdeaContent = { title: string; format: string; pitch: string };

type Suggestion = {
  id: number;
  type:
    | "description_rewrite"
    | "seo_meta"
    | "market_trend"
    | "price_flag"
    | "stale_listing"
    | "content_idea"
    | string;
  target_property_id: number | null;
  proposed_content:
    | DescriptionContent
    | SeoContent
    | MarketTrendContent
    | PriceFlagContent
    | StaleListingContent
    | ContentIdeaContent;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function AiSuggestionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [buildQueue, setBuildQueue] = useState<BuildQueueItem[]>([]);
  const [updatingQueueId, setUpdatingQueueId] = useState<number | null>(null);
  const [dispatchingQueueId, setDispatchingQueueId] = useState<number | null>(
    null
  );
  const [mergingQueueId, setMergingQueueId] = useState<number | null>(null);

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [checkingPriceId, setCheckingPriceId] = useState<number | null>(null);
  const [generatingTrends, setGeneratingTrends] = useState(false);
  const [scanningStale, setScanningStale] = useState(false);
  const [staleInfo, setStaleInfo] = useState("");
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideasInfo, setIdeasInfo] = useState("");

  async function loadEverything() {
    const [
      { data: suggestionData, error: suggestionError },
      { data: propertyData, error: propertyError },
      { data: buildQueueData, error: buildQueueError },
    ] = await Promise.all([
      supabase
        .from("ai_suggestions")
        .select("id, type, target_property_id, proposed_content, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("properties")
        .select("id, title, type, image, description, seo_title, seo_description")
        .order("id", { ascending: false }),
      // build_queue may not exist yet if the migration hasn't been run --
      // fail quietly (empty queue) rather than blocking the whole page.
      supabase
        .from("build_queue")
        .select(
          "id, title, detail, type, status, created_at, github_issue_number, github_pr_number, github_pr_url"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (suggestionError) {
      setError(suggestionError.message);
    } else {
      setSuggestions((suggestionData ?? []) as Suggestion[]);
    }

    if (propertyError) {
      setError((prev) => prev || propertyError.message);
    } else {
      setProperties((propertyData ?? []) as Property[]);
    }

    if (!buildQueueError) {
      setBuildQueue((buildQueueData ?? []) as BuildQueueItem[]);
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

  function propertyFor(suggestion: Suggestion) {
    return properties.find((p) => p.id === suggestion.target_property_id);
  }

  // Manual status controls on the Build Queue -- a "feature" item never
  // builds itself (that would mean shipping code with no human check,
  // which is exactly what this whole project avoids). This is how it
  // actually gets tracked: a session (Claude) builds and commits the code,
  // then you click "Claude's Building This" while that's in progress and
  // "Mark Done" once you've reviewed, deployed, and confirmed it's live --
  // same as everything else on this project.
  async function handleUpdateQueueStatus(
    itemId: number,
    newStatus: "in_progress" | "done" | "dismissed"
  ) {
    setUpdatingQueueId(itemId);
    setError("");

    const { error: queueUpdateError } = await supabase
      .from("build_queue")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    setUpdatingQueueId(null);

    if (queueUpdateError) {
      setError(queueUpdateError.message);
      return;
    }

    setBuildQueue((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    );
  }

  // Turns a queued "feature" item into a GitHub issue labeled
  // "ai-build-feature", which triggers the claude-build.yml workflow to
  // actually write the code and open a pull request. Called automatically
  // right after Approve on a feature recommendation; also exposed as a
  // manual "Start AI Build" button in case that automatic call fails
  // (e.g. GitHub was briefly unreachable) so nothing gets silently stuck.
  async function handleDispatchBuild(itemId: number) {
    setDispatchingQueueId(itemId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch("/api/admin/build-queue/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ queueId: itemId }),
    });

    const result = await response.json().catch(() => ({}));

    setDispatchingQueueId(null);

    if (!response.ok) {
      setError(result?.error || "Could not start the AI build.");
      return;
    }

    setBuildQueue((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, status: "in_progress", github_issue_number: result.issueNumber }
          : item
      )
    );
  }

  // The one manual step in the pipeline: merges the pull request Claude
  // opened, which is what actually makes it go live (Vercel auto-deploys
  // the instant it lands on main). Only enabled once a PR exists for this
  // item -- see the "Ready to merge" section below.
  async function handleMergeBuild(itemId: number) {
    setMergingQueueId(itemId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch("/api/admin/build-queue/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ queueId: itemId }),
    });

    const result = await response.json().catch(() => ({}));

    setMergingQueueId(null);

    if (!response.ok) {
      setError(result?.error || "Could not merge this pull request.");
      return;
    }

    setBuildQueue((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: "done" } : item
      )
    );
  }

  async function markSuggestionApproved(suggestion: Suggestion) {
    const { error: suggestionUpdateError } = await supabase
      .from("ai_suggestions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", suggestion.id);

    setUpdatingId(null);

    if (suggestionUpdateError) {
      setError(suggestionUpdateError.message);
      return;
    }

    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
  }

  async function handleApprove(suggestion: Suggestion) {
    setUpdatingId(suggestion.id);
    setError("");

    // content_idea: platform-wide, not tied to a listing, no destination
    // feature to publish into yet -- approving just marks it reviewed.
    if (suggestion.type === "content_idea") {
      await markSuggestionApproved(suggestion);
      return;
    }

    if (suggestion.type === "market_trend") {
      const content = suggestion.proposed_content as MarketTrendContent;

      // Only an individual "recommendation" row queues into build_queue --
      // the "overview" row (and any legacy row from before this split) is
      // read-only context, so approving it just marks it reviewed.
      if ("kind" in content && content.kind === "recommendation") {
        const { data: insertedRows, error: queueError } = await supabase
          .from("build_queue")
          .insert([
            {
              title: content.title,
              detail: content.detail,
              type: content.recommendationType,
              status: "queued",
              source_suggestion_id: suggestion.id,
            },
          ])
          .select()
          .single();

        if (queueError || !insertedRows) {
          setError(
            "Could not add this to the build queue (" +
              (queueError?.message || "unknown error") +
              "). If build_queue doesn't exist yet, run its migration first."
          );
          setUpdatingId(null);
          return;
        }

        const newItem = insertedRows as BuildQueueItem;

        setBuildQueue((current) => [newItem, ...current]);

        // Feature ideas kick off the AI build automatically -- that's
        // what makes Approve here the only click needed. Content ideas
        // (blog posts etc.) have nowhere automated to build yet, so they
        // just sit in the queue as before.
        if (newItem.type === "feature") {
          await handleDispatchBuild(newItem.id);
        }
      }

      await markSuggestionApproved(suggestion);
      return;
    }

    if (suggestion.type === "price_flag") {
      const content = suggestion.proposed_content as PriceFlagContent;
      const property = propertyFor(suggestion);

      if (!property) {
        setError("Could not find the property for this suggestion.");
        setUpdatingId(null);
        return;
      }

      if (
        typeof content.suggestedPrice !== "number" ||
        !isFinite(content.suggestedPrice) ||
        content.suggestedPrice <= 0
      ) {
        setError(
          "This price check was generated before auto-apply was added -- dismiss it and click Check Price again to get one Approve can apply."
        );
        setUpdatingId(null);
        return;
      }

      const { error: propertyUpdateError } = await supabase
        .from("properties")
        .update({ price: content.suggestedPrice })
        .eq("id", property.id);

      if (propertyUpdateError) {
        setError(propertyUpdateError.message);
        setUpdatingId(null);
        return;
      }

      await markSuggestionApproved(suggestion);
      return;
    }

    if (suggestion.type === "stale_listing") {
      const property = propertyFor(suggestion);

      if (property && !property.description) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/auth");
          return;
        }

        const response = await fetch(
          "/api/admin/ai-suggestions/apply-description",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ propertyId: property.id }),
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(result?.error || "Failed to write description.");
          setUpdatingId(null);
          return;
        }

        setProperties((current) =>
          current.map((p) =>
            p.id === property.id
              ? { ...p, description: result.description }
              : p
          )
        );
      }

      await markSuggestionApproved(suggestion);
      return;
    }

    const property = propertyFor(suggestion);

    if (!property) {
      setError("Could not find the property for this suggestion.");
      setUpdatingId(null);
      return;
    }

    let propertyUpdate: Record<string, string> = {};

    if (suggestion.type === "description_rewrite") {
      const content = suggestion.proposed_content as DescriptionContent;
      propertyUpdate = { description: content.description };
    } else if (suggestion.type === "seo_meta") {
      const content = suggestion.proposed_content as SeoContent;
      propertyUpdate = {
        seo_title: content.seo_title,
        seo_description: content.seo_description,
      };
    }

    const { error: propertyUpdateError } = await supabase
      .from("properties")
      .update(propertyUpdate)
      .eq("id", property.id);

    if (propertyUpdateError) {
      setError(propertyUpdateError.message);
      setUpdatingId(null);
      return;
    }

    const { error: suggestionUpdateError } = await supabase
      .from("ai_suggestions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", suggestion.id);

    setUpdatingId(null);

    if (suggestionUpdateError) {
      setError(suggestionUpdateError.message);
      return;
    }

    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
    setProperties((current) =>
      current.map((p) => (p.id === property.id ? { ...p, ...propertyUpdate } : p))
    );
  }

  async function handleReject(suggestion: Suggestion) {
    setUpdatingId(suggestion.id);
    setError("");

    const { error: suggestionUpdateError } = await supabase
      .from("ai_suggestions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", suggestion.id);

    setUpdatingId(null);

    if (suggestionUpdateError) {
      setError(suggestionUpdateError.message);
      return;
    }

    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
  }

  async function handleGenerate(propertyId: number) {
    setGeneratingId(propertyId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch("/api/admin/ai-suggestions/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ propertyId }),
    });

    const result = await response.json().catch(() => ({}));

    setGeneratingId(null);

    if (!response.ok) {
      setError(result?.error || "Generation failed.");
      return;
    }

    await loadEverything();
  }

  async function handleGenerateTrends() {
    setGeneratingTrends(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch(
      "/api/admin/ai-suggestions/generate-market-trends",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json().catch(() => ({}));

    setGeneratingTrends(false);

    if (!response.ok) {
      setError(result?.error || "Research failed.");
      return;
    }

    await loadEverything();
  }

  async function handleCheckPrice(propertyId: number) {
    setCheckingPriceId(propertyId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch(
      "/api/admin/ai-suggestions/generate-price-flag",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ propertyId }),
      }
    );

    const result = await response.json().catch(() => ({}));

    setCheckingPriceId(null);

    if (!response.ok) {
      setError(result?.error || "Price check failed.");
      return;
    }

    await loadEverything();
  }

  async function handleScanStaleListings() {
    setScanningStale(true);
    setError("");
    setStaleInfo("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch(
      "/api/admin/ai-suggestions/generate-stale-listings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json().catch(() => ({}));

    setScanningStale(false);

    if (!response.ok) {
      setError(result?.error || "Stale listing scan failed.");
      return;
    }

    if (!result.flaggedCount) {
      setStaleInfo("No stale listings found right now.");
    } else {
      setStaleInfo(
        `Flagged ${result.flaggedCount} listing${
          result.flaggedCount === 1 ? "" : "s"
        } for review below.`
      );
    }

    await loadEverything();
  }

  async function handleGenerateContentIdeas() {
    setGeneratingIdeas(true);
    setError("");
    setIdeasInfo("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    const response = await fetch(
      "/api/admin/ai-suggestions/generate-content-ideas",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json().catch(() => ({}));

    setGeneratingIdeas(false);

    if (!response.ok) {
      setError(result?.error || "Content idea generation failed.");
      return;
    }

    setIdeasInfo(
      result.ideaCount
        ? `Added ${result.ideaCount} content idea${
            result.ideaCount === 1 ? "" : "s"
          } for review below.`
        : "No content ideas generated this time -- try again."
    );

    await loadEverything();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading AI Suggestions...
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

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              AI Suggestions
            </span>

            <Link
              href="/admin/blog"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Blog Studio
            </Link>

            <Link
              href="/admin/inquiries"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Sales Pipeline
            </Link>
          </div>

        </div>
      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            AI review queue
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            AI Suggestions
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-500">
            Gemini drafts a description and SEO meta for a property, and can
            research market trends for the platform as a whole. Nothing
            reaches a live listing until you approve it here.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {/* BUILD QUEUE -- everything approved from a market-trend
            recommendation lands here. "feature" items automatically open
            a GitHub issue, which Claude Code picks up to write the code
            and open a pull request -- no further click needed to get
            that far. The one manual step left is "Merge & Go Live" once
            a PR is ready, so nothing reaches the live site without a
            deliberate tap. "content" items become real articles once the
            blog system ships. */}

        {buildQueue.length > 0 && (
          <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              Build queue
            </p>

            <h2 className="mt-1 text-xl font-black text-zinc-900">
              What&apos;s queued from approved recommendations
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Feature ideas build themselves automatically once approved --
              Claude writes the code and opens a pull request. Tap
              &quot;Merge &amp; Go Live&quot; once a PR is ready to actually
              ship it. Content ideas become real articles once the blog
              system ships.
            </p>

            <ul className="mt-4 space-y-2">
              {buildQueue.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span
                      className={
                        "mr-2 rounded-full px-2 py-0.5 text-xs font-bold " +
                        (item.type === "feature"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700")
                      }
                    >
                      {item.type === "feature" ? "Feature" : "Content"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-800">
                      {item.title}
                    </span>

                    {item.github_pr_url ? (
                      <a
                        href={item.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs font-semibold text-blue-600 underline hover:text-blue-800"
                      >
                        View PR #{item.github_pr_number}
                      </a>
                    ) : item.github_issue_number ? (
                      <a
                        href={`https://github.com/sumit-jaipur/jaipur-property-map/issues/${item.github_issue_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs font-semibold text-blue-600 underline hover:text-blue-800"
                      >
                        View issue #{item.github_issue_number}
                      </a>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={
                        "w-fit rounded-full px-3 py-1 text-xs font-bold " +
                        (item.status === "done"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "in_progress"
                          ? "bg-blue-50 text-blue-700"
                          : item.status === "dismissed"
                          ? "bg-zinc-100 text-zinc-500"
                          : "bg-yellow-50 text-yellow-700")
                      }
                    >
                      {item.github_pr_number && item.status === "in_progress"
                        ? "PR ready"
                        : item.github_issue_number && item.status === "in_progress"
                        ? "Claude is building this"
                        : item.status}
                    </span>

                    {item.status === "queued" &&
                      item.type === "feature" &&
                      !item.github_issue_number && (
                        <button
                          type="button"
                          onClick={() => handleDispatchBuild(item.id)}
                          disabled={dispatchingQueueId === item.id}
                          className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {dispatchingQueueId === item.id
                            ? "Starting..."
                            : "Start AI Build"}
                        </button>
                      )}

                    {item.status === "in_progress" &&
                      item.type === "feature" &&
                      item.github_pr_number && (
                        <button
                          type="button"
                          onClick={() => handleMergeBuild(item.id)}
                          disabled={mergingQueueId === item.id}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {mergingQueueId === item.id
                            ? "Merging..."
                            : "Merge & Go Live"}
                        </button>
                      )}

                    {(item.status === "queued" ||
                      item.status === "in_progress") &&
                      item.type === "feature" &&
                      !item.github_pr_number && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQueueStatus(item.id, "done")
                          }
                          disabled={updatingQueueId === item.id}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Mark Done Manually
                        </button>
                      )}

                    {item.status !== "done" &&
                      item.status !== "dismissed" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQueueStatus(item.id, "dismissed")
                          }
                          disabled={updatingQueueId === item.id}
                          className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>

          </section>
        )}


        {/* MARKET TREND RESEARCH */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Market research
              </p>

              <h2 className="mt-1 text-xl font-black text-zinc-900">
                What&apos;s working for property platforms right now
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Gemini searches the web across eight areas -- design, SEO
                &amp; content, marketing, product features, monetization,
                trust &amp; legal compliance, rental &amp; property
                management, and financing -- not limited to a fixed list,
                and not limited to Indian platforms -- looking at real
                estate platforms worldwide (Zillow, Redfin, 99acres,
                MagicBricks, NoBroker, and others) for what&apos;s working,
                with a real eye on which features actually make money, then
                drafts recommendations for what&apos;s realistic for a
                Jaipur-focused platform. This is platform-wide research, not
                tied to one listing.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateTrends}
              disabled={generatingTrends}
              className="flex-shrink-0 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {generatingTrends ? "Researching..." : "Research Market Trends"}
            </button>

          </div>

        </section>


        {/* STALE LISTINGS */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Stale listings
              </p>

              <h2 className="mt-1 text-xl font-black text-zinc-900">
                Find long-listed properties that need attention
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Scans your oldest active listings and flags ones worth a
                second look -- refresh photos, revisit the price, or check
                the listing is still available. 99Bricks doesn&apos;t track
                exact days-on-market yet, so this uses listing order as a
                stand-in.
              </p>
            </div>

            <button
              type="button"
              onClick={handleScanStaleListings}
              disabled={scanningStale}
              className="flex-shrink-0 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {scanningStale ? "Scanning..." : "Scan for Stale Listings"}
            </button>

          </div>

          {staleInfo && (
            <p className="mt-3 text-sm font-semibold text-zinc-500">
              {staleInfo}
            </p>
          )}

        </section>


        {/* CONTENT IDEAS */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Content ideas
              </p>

              <h2 className="mt-1 text-xl font-black text-zinc-900">
                Get marketing content ideas for 99Bricks
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Gemini pitches a handful of blog posts, locality guides, and
                social captions based on what&apos;s actually listed right
                now. Platform-wide, not tied to one listing -- writing the
                actual content is still a separate step.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateContentIdeas}
              disabled={generatingIdeas}
              className="flex-shrink-0 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {generatingIdeas ? "Thinking..." : "Get Content Ideas"}
            </button>

          </div>

          {ideasInfo && (
            <p className="mt-3 text-sm font-semibold text-zinc-500">
              {ideasInfo}
            </p>
          )}

        </section>


        {/* GENERATE NEW SUGGESTIONS */}

        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-black text-zinc-900">
              Generate suggestions for a property
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Pick a listing below and Gemini will draft a description and
              SEO meta for it. This does not change the live listing.
            </p>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">

            {properties.map((property) => (
              <div
                key={property.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3"
              >

                <div className="flex min-w-0 items-center gap-3">

                  <img
                    src={
                      property.image ||
                      "https://placehold.co/100x100?text=99B"
                    }
                    alt={property.title}
                    className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900">
                      {property.title}
                    </p>

                    <p className="text-xs text-zinc-400">
                      {property.type}
                      {property.description
                        ? " - has description"
                        : " - no description yet"}
                    </p>
                  </div>

                </div>

                <div className="flex flex-shrink-0 gap-2">

                  <button
                    type="button"
                    onClick={() => handleCheckPrice(property.id)}
                    disabled={checkingPriceId === property.id}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {checkingPriceId === property.id
                      ? "Checking..."
                      : "Check Price"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerate(property.id)}
                    disabled={generatingId === property.id}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {generatingId === property.id
                      ? "Generating..."
                      : "Generate"}
                  </button>

                </div>

              </div>
            ))}

            {properties.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-400">
                No properties found.
              </p>
            )}

          </div>

        </section>


        {/* PENDING REVIEW QUEUE */}

        <section>

          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              Step 2
            </p>

            <h2 className="mt-1 text-xl font-black text-zinc-900">
              Pending review ({suggestions.length})
            </h2>
          </div>

          {suggestions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
                🤖
              </div>

              <h2 className="mt-4 text-xl font-black text-zinc-900">
                Nothing to review right now
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Generate a suggestion above to see it here.
              </p>

            </div>
          )}

          <div className="space-y-4">

            {suggestions.map((suggestion) => {
              const property = propertyFor(suggestion);

              if (suggestion.type === "market_trend") {
                const content = suggestion.proposed_content as MarketTrendContent;
                const isRecommendation = "kind" in content && content.kind === "recommendation";
                const sources =
                  "sources" in content && content.sources ? content.sources : [];

                // A recommendation row -- tagged "content" (words) or
                // "feature" (code). Approve queues it into build_queue.
                if (isRecommendation) {
                  const rec = content as MarketTrendRecommendationContent;
                  const isFeature = rec.recommendationType === "feature";

                  return (
                    <article
                      key={suggestion.id}
                      className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={
                                  "text-xs font-bold uppercase tracking-wide " +
                                  (isFeature ? "text-purple-500" : "text-blue-500")
                                }
                              >
                                {isFeature ? "Feature idea" : "Content idea"} -- from market
                                research
                              </p>

                              {rec.recommendationCategory && (
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">
                                  {CATEGORY_LABELS[rec.recommendationCategory]}
                                </span>
                              )}
                            </div>

                            <h2 className="mt-1 text-xl font-black text-zinc-900">
                              {rec.title}
                            </h2>
                          </div>

                          <span className="w-fit rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-700">
                            Pending
                          </span>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-zinc-700">
                          {rec.detail}
                        </p>

                        {sources.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                              Sources
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {sources.map((source, i) => (
                                <li key={i} className="text-xs">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline hover:text-blue-800"
                                  >
                                    {source.title || source.url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                          <p className="text-xs leading-5 text-zinc-600">
                            {isFeature
                              ? "Approve adds this to the Build Queue below -- it'll get built in a coming session, and you'll still review and deploy the code, same as every other change on this project."
                              : "Approve adds this to the Build Queue below, tagged as a content idea. Once the blog/content-publishing system ships, queued content ideas like this become real drafted articles for you to review and publish."}
                          </p>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {updatingId === suggestion.id
                              ? "Saving..."
                              : isFeature
                              ? "Queue to Build"
                              : "Queue for Content"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }

                // Overview row (or a legacy pre-split row) -- read-only
                // context, nowhere to apply to, so Approve just marks it
                // reviewed.
                const overviewText =
                  "kind" in content && content.kind === "overview"
                    ? content.overview
                    : "research" in content
                    ? content.research
                    : "";

                return (
                  <article
                    key={suggestion.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                  >

                    <div className="p-5">

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                            Market trend research
                          </p>

                          <h2 className="mt-1 text-xl font-black text-zinc-900">
                            What&apos;s working right now
                          </h2>
                        </div>

                        <span className="w-fit rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-700">
                          Pending
                        </span>

                      </div>


                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                          {overviewText}
                        </p>
                      </div>

                      {sources.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Sources
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {sources.map((source, i) => (
                              <li key={i} className="text-xs">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline hover:text-blue-800"
                                >
                                  {source.title || source.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}


                      <div className="mt-5 flex flex-wrap gap-2">

                        <button
                          type="button"
                          onClick={() => handleApprove(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {updatingId === suggestion.id ? "Saving..." : "Mark Reviewed"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Dismiss
                        </button>

                      </div>

                    </div>

                  </article>
                );
              }

              if (suggestion.type === "price_flag") {
                const content = suggestion.proposed_content as PriceFlagContent;

                const flagStyles: Record<string, string> = {
                  fair: "bg-emerald-50 text-emerald-700",
                  overpriced: "bg-red-50 text-red-700",
                  underpriced: "bg-blue-50 text-blue-700",
                };

                const flagLabels: Record<string, string> = {
                  fair: "Fairly priced",
                  overpriced: "Overpriced",
                  underpriced: "Underpriced",
                };

                return (
                  <article
                    key={suggestion.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                  >

                    <div className="flex flex-col gap-5 p-5 md:flex-row">

                      <img
                        src={
                          property?.image ||
                          "https://placehold.co/500x350?text=Property"
                        }
                        alt={property?.title || "Property"}
                        className="h-40 w-full rounded-2xl object-cover md:h-40 md:w-56"
                      />

                      <div className="flex-1">

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                              Price check
                            </p>

                            <h2 className="mt-1 text-xl font-black text-zinc-900">
                              {property?.title ||
                                `Property #${suggestion.target_property_id}`}
                            </h2>
                          </div>

                          <span
                            className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                              flagStyles[content.flag] ||
                              "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {flagLabels[content.flag] || content.flag}
                          </span>

                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4">
                          <p className="text-sm leading-6 text-zinc-700">
                            {content.reasoning}
                          </p>

                          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Suggested range
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-900">
                            {content.suggestedRange}
                          </p>

                          {typeof content.suggestedPrice === "number" && (
                            <p className="mt-2 text-xs text-zinc-500">
                              Approve will set the listed price to{" "}
                              <span className="font-bold text-zinc-800">
                                {formatPrice(content.suggestedPrice)}
                              </span>
                              .
                            </p>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() => handleApprove(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {updatingId === suggestion.id
                              ? "Applying..."
                              : "Apply Price"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Dismiss
                          </button>

                          {property && (
                            <Link
                              href={`/properties/${property.id}/edit`}
                              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                            >
                              Edit Price Manually
                            </Link>
                          )}

                        </div>

                      </div>

                    </div>

                  </article>
                );
              }

              if (suggestion.type === "stale_listing") {
                const content = suggestion.proposed_content as StaleListingContent;

                return (
                  <article
                    key={suggestion.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                  >

                    <div className="flex flex-col gap-5 p-5 md:flex-row">

                      <img
                        src={
                          property?.image ||
                          "https://placehold.co/500x350?text=Property"
                        }
                        alt={property?.title || "Property"}
                        className="h-40 w-full rounded-2xl object-cover md:h-40 md:w-56"
                      />

                      <div className="flex-1">

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                              Long-listed
                            </p>

                            <h2 className="mt-1 text-xl font-black text-zinc-900">
                              {property?.title ||
                                `Property #${suggestion.target_property_id}`}
                            </h2>
                          </div>

                          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                            Needs attention
                          </span>

                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4">
                          <p className="text-sm leading-6 text-zinc-700">
                            {content.reasoning}
                          </p>

                          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Suggested action
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-900">
                            {content.suggestedAction}
                          </p>

                          {property && !property.description && (
                            <p className="mt-2 text-xs text-zinc-500">
                              This listing has no description yet -- Approve
                              will write one automatically. Photos and
                              checking with the seller are still up to you.
                            </p>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() => handleApprove(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {updatingId === suggestion.id
                              ? "Saving..."
                              : property && !property.description
                              ? "Write Description & Approve"
                              : "Mark Reviewed"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(suggestion)}
                            disabled={updatingId === suggestion.id}
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Dismiss
                          </button>

                          {property && (
                            <Link
                              href={`/properties/${property.id}/edit`}
                              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                            >
                              Edit Listing
                            </Link>
                          )}

                          {property && (
                            <Link
                              href={`/properties/${property.id}`}
                              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                            >
                              View Property
                            </Link>
                          )}

                        </div>

                      </div>

                    </div>

                  </article>
                );
              }

              if (suggestion.type === "content_idea") {
                const content = suggestion.proposed_content as ContentIdeaContent;

                return (
                  <article
                    key={suggestion.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                  >

                    <div className="p-5">

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                            Content idea -- {content.format}
                          </p>

                          <h2 className="mt-1 text-xl font-black text-zinc-900">
                            {content.title}
                          </h2>
                        </div>

                        <span className="w-fit rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-700">
                          Pending
                        </span>

                      </div>


                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <p className="text-sm leading-6 text-emerald-900">
                          {content.pitch}
                        </p>
                      </div>


                      <div className="mt-5 flex flex-wrap gap-2">

                        <button
                          type="button"
                          onClick={() => handleApprove(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {updatingId === suggestion.id ? "Saving..." : "Mark Reviewed"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Dismiss
                        </button>

                      </div>

                    </div>

                  </article>
                );
              }

              return (
                <article
                  key={suggestion.id}
                  className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                >

                  <div className="flex flex-col gap-5 p-5 md:flex-row">

                    <img
                      src={
                        property?.image ||
                        "https://placehold.co/500x350?text=Property"
                      }
                      alt={property?.title || "Property"}
                      className="h-40 w-full rounded-2xl object-cover md:h-40 md:w-56"
                    />

                    <div className="flex-1">

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                            {suggestion.type === "description_rewrite"
                              ? "Description rewrite"
                              : "SEO meta"}
                          </p>

                          <h2 className="mt-1 text-xl font-black text-zinc-900">
                            {property?.title || `Property #${suggestion.target_property_id}`}
                          </h2>
                        </div>

                        <span className="w-fit rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-700">
                          Pending
                        </span>

                      </div>


                      {suggestion.type === "description_rewrite" && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">

                          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                              Current
                            </p>
                            <p className="mt-2 text-sm leading-6 text-zinc-600">
                              {property?.description || "No description set yet."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                              AI Suggests
                            </p>
                            <p className="mt-2 text-sm leading-6 text-emerald-900">
                              {(suggestion.proposed_content as DescriptionContent).description}
                            </p>
                          </div>

                        </div>
                      )}


                      {suggestion.type === "seo_meta" && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">

                          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                              Current
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-700">
                              {property?.seo_title || "No SEO title set."}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {property?.seo_description || "No SEO description set."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                              AI Suggests
                            </p>
                            <p className="mt-2 text-sm font-semibold text-emerald-900">
                              {(suggestion.proposed_content as SeoContent).seo_title}
                            </p>
                            <p className="mt-1 text-sm text-emerald-800">
                              {(suggestion.proposed_content as SeoContent).seo_description}
                            </p>
                          </div>

                        </div>
                      )}


                      <div className="mt-5 flex flex-wrap gap-2">

                        <button
                          type="button"
                          onClick={() => handleApprove(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {updatingId === suggestion.id ? "Saving..." : "Approve"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(suggestion)}
                          disabled={updatingId === suggestion.id}
                          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>

                        {property && (
                          <Link
                            href={`/properties/${property.id}`}
                            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            View Property
                          </Link>
                        )}

                      </div>

                    </div>

                  </div>

                </article>
              );
            })}

          </div>

        </section>

      </div>

    </main>
  );
}
