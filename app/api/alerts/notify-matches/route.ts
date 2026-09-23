import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../lib/supabaseAdmin";
import {
  propertyMatchesFilters,
  SavedSearchFilters,
} from "../../../lib/savedSearch";

// POST /api/alerts/notify-matches
// Body: { propertyId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Called right after an admin approves a listing (see
// app/admin/properties/page.tsx). Checks the newly-approved property
// against every active saved search and writes a search_alerts row for
// each match, which is what powers the buyer-facing /alerts inbox and
// the unseen-count badge. Runs with the service_role client because
// saved_searches belongs to other users and has no cross-user select
// policy -- only a trusted server process should read across users here.
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
    .select("id, type, bhk, price, facing, parking, road, lat, lng, verification_status, status")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    return NextResponse.json(
      { error: "Property not found." },
      { status: 404 }
    );
  }

  if (property.verification_status !== "approved" || property.status !== "Available") {
    return NextResponse.json(
      { error: "Property is not an approved, available listing." },
      { status: 400 }
    );
  }

  const { data: savedSearches, error: savedSearchesError } = await supabaseAdmin
    .from("saved_searches")
    .select("id, user_id, filters")
    .eq("is_active", true);

  if (savedSearchesError) {
    return NextResponse.json(
      { error: "Failed to load saved searches: " + savedSearchesError.message },
      { status: 500 }
    );
  }

  const matches = (savedSearches ?? []).filter((savedSearch) =>
    propertyMatchesFilters(property, savedSearch.filters as SavedSearchFilters)
  );

  if (matches.length === 0) {
    return NextResponse.json({ success: true, alertsCreated: 0 });
  }

  const { error: insertError } = await supabaseAdmin
    .from("search_alerts")
    .upsert(
      matches.map((savedSearch) => ({
        saved_search_id: savedSearch.id,
        user_id: savedSearch.user_id,
        property_id: property.id,
      })),
      { onConflict: "saved_search_id,property_id", ignoreDuplicates: true }
    );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create alerts: " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, alertsCreated: matches.length });
}
