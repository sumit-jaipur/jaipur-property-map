import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { generateDescriptionAndSeo } from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/generate
// Body: { propertyId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Generates a description_rewrite + seo_meta suggestion pair for one
// property via Gemini and writes them into ai_suggestions as "pending".
// Nothing here touches the live properties row -- that only happens when
// an admin approves the suggestion from /admin/ai-suggestions.
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

  let suggestion;

  try {
    suggestion = await generateDescriptionAndSeo(property);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini generation failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("ai_suggestions")
    .insert([
      {
        type: "description_rewrite",
        target_property_id: property.id,
        proposed_content: { description: suggestion.description },
        status: "pending",
      },
      {
        type: "seo_meta",
        target_property_id: property.id,
        proposed_content: {
          seo_title: suggestion.seo_title,
          seo_description: suggestion.seo_description,
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
