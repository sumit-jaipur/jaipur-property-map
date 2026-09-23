import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  generatePropertyRecommendations,
  PropertyCandidate,
} from "../../lib/gemini";

// POST /api/ai-advisor
// Body: { message: string }
//
// Public, consumer-facing endpoint (no admin auth) -- a buyer describes
// what they're looking for in plain language and Gemini picks the best
// matching properties from the current live, approved listings. Uses the
// service-role client only to read properties (properties has no RLS
// policies yet, see project status doc), never to write anything.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Please describe what you're looking for." },
      { status: 400 }
    );
  }

  const { data: properties, error: propertiesError } = await supabaseAdmin
    .from("properties")
    .select("id, title, type, price, bhk, area, image")
    .eq("verification_status", "approved");

  if (propertiesError) {
    return NextResponse.json(
      { error: "Failed to load properties: " + propertiesError.message },
      { status: 500 }
    );
  }

  if (!properties || properties.length === 0) {
    return NextResponse.json({
      summary: "There are no approved listings to recommend from yet.",
      recommendations: [],
    });
  }

  const candidates: PropertyCandidate[] = properties.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    price: p.price,
    bhk: p.bhk,
    area: p.area,
  }));

  let result;

  try {
    result = await generatePropertyRecommendations(message, candidates);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "AI advisor failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const propertyById = new Map(properties.map((p) => [p.id, p]));

  const recommendations = result.recommendations
    .map((r) => {
      const property = propertyById.get(r.id);
      if (!property) return null;

      return {
        id: property.id,
        title: property.title,
        type: property.type,
        price: property.price,
        bhk: property.bhk,
        area: property.area,
        image: property.image,
        reason: r.reason,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    summary: result.summary,
    recommendations,
  });
}
