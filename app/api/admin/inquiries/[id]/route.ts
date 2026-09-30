import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";

const VALID_STATUSES = [
  "new",
  "contacted",
  "site_visit_scheduled",
  "closed_won",
  "closed_lost",
];

// PATCH /api/admin/inquiries/[id]
// Body: { status?: string, assignedTo?: string | null, adminNotes?: string }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Updates one inquiry's pipeline status, allots it to a registered
// broker/agent for the site visit, and/or saves an internal note -- any
// combination of the three in one call, whichever fields are present in
// the body. Admin-only, writes via the service-role client since there's
// no client-side UPDATE policy broad enough for an admin to edit another
// user's inquiry row directly (see the inquiries-sales-pipeline
// migration).
//
// When this call actually assigns (or re-assigns) the lead to someone
// new, it also drops a row into `search_alerts` so the broker sees it in
// their own 🔔 Alerts inbox/bell badge -- the same inbox saved-search
// matches use, see search-alerts-broker-notification-migration.sql.
// Before this, a broker only found out by manually opening /broker.
export async function PATCH(
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
  const inquiryId = Number(id);

  if (!inquiryId) {
    return NextResponse.json(
      { error: "Invalid inquiry id." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Load who this lead was assigned to BEFORE this update -- needed to
  // tell a genuinely new assignment apart from an admin just re-saving
  // status/notes on an already-assigned lead (which must NOT re-notify
  // the broker every time), and to build a readable notification message.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("inquiries")
    .select("assigned_to, property_id, contact_name")
    .eq("id", inquiryId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Inquiry not found." },
      { status: 404 }
    );
  }

  const update: {
    status?: string;
    assigned_to?: string | null;
    admin_notes?: string;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body.assignedTo !== undefined) {
    update.assigned_to = body.assignedTo;
  }

  if (body.adminNotes !== undefined) {
    update.admin_notes = body.adminNotes;
  }

  const { error } = await supabaseAdmin
    .from("inquiries")
    .update(update)
    .eq("id", inquiryId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update inquiry: " + error.message },
      { status: 500 }
    );
  }

  const isNewAssignment =
    body.assignedTo !== undefined &&
    Boolean(body.assignedTo) &&
    body.assignedTo !== existing.assigned_to;

  if (isNewAssignment) {
    let leadLabel = existing.contact_name
      ? `lead from ${existing.contact_name}`
      : "a lead";

    if (existing.property_id) {
      const { data: property } = await supabaseAdmin
        .from("properties")
        .select("title")
        .eq("id", existing.property_id)
        .single();

      if (property?.title) {
        leadLabel = property.title;
      }
    }

    // Don't let a notification failure undo an otherwise-successful
    // assignment -- the broker can still find the lead on /broker (My
    // Visits) even without the bell alert, so this is logged, not thrown.
    const { error: alertError } = await supabaseAdmin
      .from("search_alerts")
      .insert({
        type: "broker_assignment",
        user_id: body.assignedTo,
        inquiry_id: inquiryId,
        property_id: existing.property_id ?? null,
        message: `You've been assigned a new site visit: ${leadLabel}`,
      });

    if (alertError) {
      console.error(
        "Failed to create broker-assignment alert:",
        alertError.message
      );
    }
  }

  return NextResponse.json({ success: true });
}
