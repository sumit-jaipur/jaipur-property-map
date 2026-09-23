import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  generateComparisonStoryline,
  ComparisonCandidate,
} from "../../lib/gemini";

// POST /api/compare-storyline
// Body: { propertyIds: number[] }
//
// Public, consumer-facing endpoint (no admin auth) -- called automatically
// as soon as the /compare page loads 2+ properties, before the buyer types
// anything. Writes a short neutral narrative describing how the compared
// properties differ. Uses the service-role client only to read properties
// (properties has no RLS policies yet), never to write anything.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const propertyIds: number[] = Array.isArray(body?.propertyIds)
    ? body.propertyIds.filter((id: unknown) => typeof id === "number")
    : [];

  if (propertyIds.length < 2) {
    return NextResponse.json(
      { error: "Compare at least 2 properties first." },
      { status: 400 }
    );
  }

  const { data: properties, error: propertiesError } = await supabaseAdmin
    .from("properties")
    .select("id, title, type, price, bhk, area, facing, parking, road")
    .in("id", propertyIds);

  if (propertiesError) {
    return NextResponse.json(
      { error: "Failed to load properties: " + propertiesError.message },
      { status: 500 }
    );
  }

  if (!properties || properties.length < 2) {
    return NextResponse.json(
      { error: "Could not find those properties to compare." },
      { status: 404 }
    );
  }

  const candidates: ComparisonCandidate[] = properties.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    price: p.price,
    bhk: p.bhk,
    area: p.area,
    facing: p.facing,
    parking: p.parking,
    road: p.road,
    verification_status: null,
  }));

  try {
    const result = await generateComparisonStoryline(candidates);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "AI overview failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }
}
