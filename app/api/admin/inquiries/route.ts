import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../lib/supabaseAdmin";

// GET /api/admin/inquiries
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Lists every buyer inquiry (the existing `inquiries` table -- a buyer's
// message to a seller, sent from a property page) as a sales pipeline:
// each row's status, which property it's for, who it's allotted to, plus
// the list of registered brokers/agents available to assign. Admin-only --
// a seller only ever sees inquiries for their own listings via the
// existing /inquiries page and its own RLS policy; this route is the
// admin-wide view across every listing, used by /admin/inquiries.
//
// Requires the inquiries-sales-pipeline migration to have been run first
// (adds status/assigned_to/admin_notes/updated_at to `inquiries`, plus two
// admin-only RLS policies) -- see the project docs.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  const adminId = await verifyAdmin(accessToken);

  if (!adminId) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const { data: inquiries, error: inquiriesError } = await supabaseAdmin
    .from("inquiries")
    .select(
      "id, property_id, buyer_id, message, status, assigned_to, admin_notes, created_at, updated_at, properties (id, title, type, price, image)"
    )
    .order("created_at", { ascending: false });

  if (inquiriesError) {
    return NextResponse.json(
      {
        error:
          "Failed to load inquiries (has the inquiries-sales-pipeline migration been run?): " +
          inquiriesError.message,
      },
      { status: 500 }
    );
  }

  const { data: brokerProfiles, error: brokerError } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type")
    .in("account_type", ["broker", "agent"]);

  if (brokerError) {
    return NextResponse.json(
      { error: "Failed to load brokers: " + brokerError.message },
      { status: 500 }
    );
  }

  // Emails aren't stored on `profiles` -- pull them from Supabase Auth
  // itself via the service-role client so the admin can actually tell
  // buyers and brokers apart, since this list is only ever shown to an
  // already-verified admin.
  const { data: userList, error: userListError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (userListError) {
    return NextResponse.json(
      {
        error: "Failed to load account emails: " + userListError.message,
      },
      { status: 500 }
    );
  }

  const emailById = new Map(
    userList.users.map((u) => [u.id, u.email || "(no email)"])
  );

  const brokers = (brokerProfiles || []).map((p) => ({
    id: p.id as string,
    accountType: p.account_type as string,
    email: emailById.get(p.id as string) || "(no email)",
  }));

  const rows = (inquiries || []).map((i) => ({
    ...i,
    buyerEmail: emailById.get(i.buyer_id as string) || "(unknown)",
  }));

  return NextResponse.json({ inquiries: rows, brokers });
}
