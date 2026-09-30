import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// GET /api/broker/inquiries
// Header: Authorization: Bearer <supabase access token of the logged-in broker/agent>
//
// A broker/agent's own view of their assigned leads -- the same
// underlying `inquiries` rows Sumit sees in Admin -> Sales Pipeline,
// filtered to ONLY the ones he's assigned to this caller.
//
// Why this is a server route and not a plain client-side query (like the
// visit-confirmation update, which the broker dashboard does directly):
// resolving a buyer's email for a website-form lead needs the
// service-role client (the same way /api/admin/inquiries does it), which
// only ever runs on the server. The filtering itself is still "belt and
// braces" -- even if this route had a bug, the underlying RLS policy
// ("Brokers can view their assigned visits", assigned_to = auth.uid())
// means a broker's own Supabase session could never read another
// broker's row directly either.
//
// Requires claude/inquiries-broker-visits-migration.sql to have been run
// first (adds visit_completed/visit_note/visit_photo_url/visit_completed_at
// plus the RLS policies and locking trigger).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: leads, error: leadsError } = await supabaseAdmin
    .from("inquiries")
    .select(
      "id, property_id, buyer_id, contact_name, contact_phone, message, status, created_at, visit_completed, visit_note, visit_photo_url, visit_completed_at, properties (id, title, type, price, image)"
    )
    .eq("assigned_to", user.id)
    .order("created_at", { ascending: false });

  if (leadsError) {
    return NextResponse.json(
      {
        error:
          "Failed to load your visits (has the inquiries-broker-visits migration been run?): " +
          leadsError.message,
      },
      { status: 500 }
    );
  }

  const buyerIds = (leads || [])
    .map((l) => l.buyer_id)
    .filter((id): id is string => Boolean(id));

  const emailById = new Map<string, string>();

  if (buyerIds.length > 0) {
    const { data: userList, error: userListError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (userListError) {
      return NextResponse.json(
        { error: "Failed to load buyer emails: " + userListError.message },
        { status: 500 }
      );
    }

    for (const u of userList?.users || []) {
      if (u.email) emailById.set(u.id, u.email);
    }
  }

  const rows = (leads || []).map((l) => ({
    ...l,
    buyerEmail: l.buyer_id ? emailById.get(l.buyer_id as string) || null : null,
  }));

  return NextResponse.json({ leads: rows });
}
