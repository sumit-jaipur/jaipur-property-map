import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  generateComparisonAdvice,
  ComparisonCandidate,
} from "../../lib/gemini";

// POST /api/compare-advisor
// Body: { message: string, propertyIds: number[] }
//
// Public, consumer-facing endpoint (no admin auth) -- used on the /compare
// page. The buyer says what matters most to them and Gemini picks the
// single best fit out of ONLY the specific properties they're comparing,
// with a short trade-off note for each of the others. Uses the
// service-role client only to read properties (properties has no RLS
// policies yet), never to write anything.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const propertyIds: number[] = Array.isArray(body?.propertyIds)
    ? body.propertyIds.filter((id: unknown) => typeof id === "number")
    : [];

  if (!message) {
    return NextResponse.json(
      { error: "Tell the advisor what matters most to you first." },
      { status: 400 }
    );
  }

  if (propertyIds.length < 2) {
    return NextResponse.json(
      { error: "Compare at least 2 properties first." },
      { status: 400 }
    );
  }

  const { data: properties, error: propertiesError } = await supabaseAdmin
    .from("properties")
    .select(
      "id, title, type, price, bhk, area, facing, parking, road, verification_status"
    )
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
    verification_status: p.verification_status,
  }));

  let advice;

  try {
    advice = await generateComparisonAdvice(message, candidates);
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

  return NextResponse.json(advice);
}
