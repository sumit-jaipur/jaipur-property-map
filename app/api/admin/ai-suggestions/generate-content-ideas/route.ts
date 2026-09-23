import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { generateContentIdeas, PlatformSnapshot } from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/generate-content-ideas
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Platform-wide, not tied to one property (like market trend research).
// Builds a snapshot of what's actually currently listed (type + area
// breakdown), asks Gemini to pitch a handful of marketing content ideas
// grounded in that real data, and writes one "content_idea" ai_suggestions
// row per idea (status: pending, target_property_id: null). Approving one
// doesn't publish anything -- there's nowhere for a content idea to write
// to -- it just marks the idea reviewed, same as market_trend.
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

  if (snapshot.totalListings === 0) {
    return NextResponse.json(
      {
        error:
          "No active listings to base content ideas on yet.",
      },
      { status: 400 }
    );
  }

  let ideas;

  try {
    ideas = await generateContentIdeas(snapshot);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini content idea generation failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  if (!ideas || ideas.length === 0) {
    return NextResponse.json({ success: true, ideaCount: 0 });
  }

  const { error: insertError } = await supabaseAdmin
    .from("ai_suggestions")
    .insert(
      ideas.map((idea) => ({
        type: "content_idea",
        target_property_id: null,
        proposed_content: {
          title: idea.title,
          format: idea.format,
          pitch: idea.pitch,
        },
        status: "pending",
      }))
    );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save content ideas: " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, ideaCount: ideas.length });
}
