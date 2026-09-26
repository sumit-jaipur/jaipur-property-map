import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../../lib/supabaseAdmin";

// GET /api/admin/properties/[id]/lister
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// The Property Approval page needs a way to actually reach whoever
// listed a pending property -- to verify it's real before approving it,
// and because a broker worth calling back might be worth recruiting.
// profiles.phone is readable client-side already, but email only lives
// in Supabase's own auth.users table, which requires the service-role
// key to read -- hence this small server route instead of a direct
// client-side query.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  const adminId = await verifyAdmin(accessToken);

  if (!adminId) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const { id } = await params;

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("seller_id")
    .eq("id", id)
    .maybeSingle();

  if (propertyError) {
    return NextResponse.json(
      { error: "Failed to load property: " + propertyError.message },
      { status: 500 }
    );
  }

  if (!property?.seller_id) {
    return NextResponse.json(
      { error: "This listing has no associated seller account." },
      { status: 404 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone, account_type")
    .eq("id", property.seller_id)
    .maybeSingle();

  const { data: userResult, error: userError } =
    await supabaseAdmin.auth.admin.getUserById(property.seller_id);

  if (userError) {
    return NextResponse.json(
      { error: "Failed to load account: " + userError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    phone: profile?.phone || null,
    accountType: profile?.account_type || null,
    email: userResult?.user?.email || null,
  });
}
