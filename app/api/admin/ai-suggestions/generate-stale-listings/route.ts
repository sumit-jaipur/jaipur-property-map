import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import {
  generateStaleListingSuggestions,
  StaleListingCandidate,
} from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/generate-stale-listings
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Scans currently approved + available properties and flags the ones that
// look "long-listed" relative to everything else currently live, writing
// one "stale_listing" ai_suggestions row per flagged property.
//
// IMPORTANT caveat: 99Bricks doesn't have a verified `created_at` (or
// `updated_at`) column on `properties` yet, and there's no traffic/view
// data either (that's what `traffic_alert` will need, once Analytics is
// wired up). So "long-listed" here is a proxy, not a precise day count:
// properties are ordered by id ascending (lower id = added earlier, since
// id is an auto-incrementing identity column) and the oldest slice of the
// currently active listings is treated as the stale candidates. This is
// good enough to surface "these are your oldest live listings, take a
// look" -- if a real created_at/updated_at column gets added later, this
// should be switched over to that for an accurate day count.
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
      .select("id, title, type, price, description")
      .eq("verification_status", "approved")
      .eq("status", "Available")
      .order("id", { ascending: true });

  if (propertiesError) {
    return NextResponse.json(
      { error: "Failed to load properties: " + propertiesError.message },
      { status: 500 }
    );
  }

  if (!activeProperties || activeProperties.length === 0) {
    return NextResponse.json({ success: true, flaggedCount: 0 });
  }

  const { data: existingSuggestions, error: existingError } =
    await supabaseAdmin
      .from("ai_suggestions")
      .select("target_property_id")
      .eq("type", "stale_listing")
      .eq("status", "pending");

  if (existingError) {
    return NextResponse.json(
      {
        error:
          "Failed to check existing suggestions: " + existingError.message,
      },
      { status: 500 }
    );
  }

  const alreadyFlagged = new Set(
    (existingSuggestions || []).map((s) => s.target_property_id)
  );

  // Oldest slice (by id) of the active properties that don't already have
  // a pending stale_listing suggestion, capped at 10 per run to keep the
  // Gemini call and the review queue manageable.
  const candidates = activeProperties
    .filter((p) => !alreadyFlagged.has(p.id))
    .slice(0, 10);

  if (candidates.length === 0) {
    return NextResponse.json({ success: true, flaggedCount: 0 });
  }

  const candidateInput: StaleListingCandidate[] = candidates.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    price: p.price,
    hasDescription: Boolean(p.description),
  }));

  let suggestions;

  try {
    suggestions = await generateStaleListingSuggestions(candidateInput);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini stale-listing check failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  if (suggestions.length === 0) {
    return NextResponse.json({ success: true, flaggedCount: 0 });
  }

  const { error: insertError } = await supabaseAdmin
    .from("ai_suggestions")
    .insert(
      suggestions.map((s) => ({
        type: "stale_listing",
        target_property_id: s.id,
        proposed_content: {
          reasoning: s.reasoning,
          suggestedAction: s.suggestedAction,
        },
        status: "pending",
      }))
    );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save suggestions: " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, flaggedCount: suggestions.length });
}
