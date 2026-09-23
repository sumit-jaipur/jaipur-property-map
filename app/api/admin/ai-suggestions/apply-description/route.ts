import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { generateDescriptionAndSeo } from "../../../../lib/gemini";

// POST /api/admin/ai-suggestions/apply-description
// Body: { propertyId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Unlike /api/admin/ai-suggestions/generate (which only creates pending
// description_rewrite/seo_meta suggestions for later review), this route
// writes a Gemini-drafted description straight into the property's
// `description` field immediately. It exists specifically for approving a
// "stale_listing" suggestion whose suggestedAction is "write a missing
// description" -- that's the one part of a stale-listing flag that can
// safely auto-apply itself (unlike "refresh the photos" or "confirm with
// the seller", which need a real person to do something). Only writes
// `description` -- it does not touch seo_title/seo_description, so the
// existing "Generate" flow on the admin page is still the way to get SEO
// meta suggestions reviewed separately.
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

  let generated;

  try {
    generated = await generateDescriptionAndSeo(property);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini description generation failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("properties")
    .update({ description: generated.description })
    .eq("id", property.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to write description: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    description: generated.description,
  });
}
