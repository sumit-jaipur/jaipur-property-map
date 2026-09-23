import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { generateMarketTrendResearch } from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/generate-market-trends
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Runs five live-web-search-grounded Gemini queries (search via Tavily, not
// Gemini's own Google Search grounding tool -- see app/lib/gemini.ts for
// why), one per platform area -- design, SEO/content, marketing, product
// features, monetization -- and writes the result into ai_suggestions as
// SEVERAL "market_trend" rows (status: pending, target_property_id: null --
// this is platform-wide research, not tied to one listing):
//   - one "overview" row (the "what's working" summary) -- read-only,
//     Approve just marks it reviewed, same as before.
//   - one "recommendation" row PER recommendation, each tagged "content" or
//     "feature" AND a category (design/seo_content/marketing/features/
//     monetization) -- see generateMarketTrendResearch in app/lib/gemini.ts.
//     Approving a recommendation row queues it into build_queue for Claude
//     to actually act on next -- drafting/publishing an article for a
//     "content" one (via the blog system), or building the feature for a
//     "feature" one (still reviewed and deployed by Sumit like any other
//     code change).
// Nothing on the live site changes until an admin reviews it on
// /admin/ai-suggestions.
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

  let suggestion;

  try {
    suggestion = await generateMarketTrendResearch();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini research failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const rows = [
    {
      type: "market_trend",
      target_property_id: null,
      proposed_content: {
        kind: "overview",
        overview: suggestion.overview,
        sources: suggestion.sources,
      },
      status: "pending",
    },
    ...suggestion.recommendations.map((rec) => ({
      type: "market_trend",
      target_property_id: null,
      proposed_content: {
        kind: "recommendation",
        recommendationType: rec.type,
        recommendationCategory: rec.category,
        title: rec.title,
        detail: rec.detail,
        sources: suggestion.sources,
      },
      status: "pending",
    })),
  ];

  const { error: insertError } = await supabaseAdmin
    .from("ai_suggestions")
    .insert(rows);

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save research: " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    recommendationCount: suggestion.recommendations.length,
  });
}
