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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

  const inquiryId = Number(params.id);

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

  return NextResponse.json({ success: true });
}
