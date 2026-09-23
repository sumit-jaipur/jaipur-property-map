import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { generatePriceFlag, PropertyCandidate } from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/generate-price-flag
// Body: { propertyId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Compares one property's price against other approved properties of the
// same type already on 99Bricks, and writes the result into ai_suggestions
// as a single "price_flag" suggestion (status: pending), including a
// concrete suggestedPrice. This route never touches the property's price
// itself -- the admin page applies suggestedPrice directly to the listing
// when the admin clicks Approve.
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

  const body = await request.json().catch(() => null);
  const propertyId = body?.propertyId;

  if (!propertyId) {
    return NextResponse.json(
      { error: "propertyId is required." },
      { status: 400 }
    );
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, title, type, price, bhk, area, facing, parking, road")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    return NextResponse.json(
      { error: "Property not found." },
      { status: 404 }
    );
  }

  const { data: comparableRows, error: comparableError } = await supabaseAdmin
    .from("properties")
    .select("id, title, type, price, bhk, area")
    .eq("type", property.type)
    .eq("verification_status", "approved")
    .neq("id", property.id)
    .limit(20);

  if (comparableError) {
    return NextResponse.json(
      {
        error:
          "Failed to load comparable properties: " + comparableError.message,
      },
      { status: 500 }
    );
  }

  if (!comparableRows || comparableRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Not enough comparable listings of this type to check pricing yet.",
      },
      { status: 400 }
    );
  }

  const comparables: PropertyCandidate[] = comparableRows.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    price: p.price,
    bhk: p.bhk,
    area: p.area,
  }));

  let result;

  try {
    result = await generatePriceFlag(property, comparables);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini price check failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("ai_suggestions")
    .insert([
      {
        type: "price_flag",
        target_property_id: property.id,
        proposed_content: {
          flag: result.flag,
          reasoning: result.reasoning,
          suggestedRange: result.suggestedRange,
          suggestedPrice: result.suggestedPrice,
        },
        status: "pending",
      },
    ]);

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save suggestion: " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
