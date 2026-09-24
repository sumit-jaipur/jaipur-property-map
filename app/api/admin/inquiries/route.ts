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
// admin-only RLS policies), AND the inquiries-manual-leads-and-profile-phone
// migration (makes buyer_id optional, adds contact_name/contact_phone/
// source for leads added manually below, not through the website form) --
// see the project docs.
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
      "id, property_id, buyer_id, contact_name, contact_phone, source, message, status, assigned_to, admin_notes, created_at, updated_at, properties (id, title, type, price, image)"
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
    // A row from the website form has a real buyer_id -> show their
    // account email. A manually-added lead (phone call/WhatsApp/walk-in)
    // has no buyer_id -- show the name/phone the admin typed in instead.
    buyerEmail: i.buyer_id
      ? emailById.get(i.buyer_id as string) || "(unknown)"
      : null,
  }));

  return NextResponse.json({ inquiries: rows, brokers });
}

const VALID_SOURCES = ["phone_call", "whatsapp", "walk_in", "other"];

// POST /api/admin/inquiries
// Body: { contactName: string, contactPhone: string, source: string, message?: string }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Manually registers a lead that came from a phone call, WhatsApp message,
// or walk-in -- someone who never used the website's own inquiry form and
// so has no buyer_id/account. Lands in the same pipeline as website
// inquiries, just with no linked account and no property (the admin notes
// which property, if any, in the message instead, to keep this quick to
// fill in). Requires the inquiries-manual-leads-and-profile-phone
// migration to have been run first.
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

  if (!body || !body.contactName || !body.contactPhone) {
    return NextResponse.json(
      { error: "contactName and contactPhone are required." },
      { status: 400 }
    );
  }

  if (!VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      {
        error:
          "source must be phone_call, whatsapp, walk_in, or other.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .insert({
      buyer_id: null,
      contact_name: String(body.contactName).slice(0, 200),
      contact_phone: String(body.contactPhone).slice(0, 30),
      source: body.source,
      message: body.message
        ? String(body.message).slice(0, 2000)
        : "(Added manually by admin -- no message given.)",
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Failed to add lead (has the inquiries-manual-leads-and-profile-phone migration been run?): " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id });
}
