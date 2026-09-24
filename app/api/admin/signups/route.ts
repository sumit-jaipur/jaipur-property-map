import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../lib/supabaseAdmin";

// GET /api/admin/signups
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Lists every registered account that has NEVER submitted an inquiry --
// people who signed up and looked around the site, but haven't said
// "I'm interested" on anything yet. This is a separate, cold-call-style
// segment from the Sales Pipeline (which is only people who actively
// inquired): Sumit's own words -- "which one of any our consumer... his
// or her profile will also share on the sales department in another
// segment because they are not verified... but they have opened our
// website... that data we can provide to our cold callers."
//
// Honest limitation: the signup form only ever collects email/password,
// so most rows here will have no phone number (profiles.phone exists as
// of the inquiries-manual-leads-and-profile-phone migration, but nothing
// writes to it yet) -- this list is real, but not yet callable for most
// accounts until phone capture is added to signup.
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

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type, phone");

  if (profilesError) {
    return NextResponse.json(
      {
        error:
          "Failed to load profiles (has the inquiries-manual-leads-and-profile-phone migration been run?): " +
          profilesError.message,
      },
      { status: 500 }
    );
  }

  const { data: inquiryRows, error: inquiryError } = await supabaseAdmin
    .from("inquiries")
    .select("buyer_id")
    .not("buyer_id", "is", null);

  if (inquiryError) {
    return NextResponse.json(
      { error: "Failed to load inquiries: " + inquiryError.message },
      { status: 500 }
    );
  }

  const alreadyEngagedIds = new Set(
    (inquiryRows || []).map((r) => r.buyer_id as string)
  );

  const { data: userList, error: userListError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (userListError) {
    return NextResponse.json(
      {
        error: "Failed to load account list: " + userListError.message,
      },
      { status: 500 }
    );
  }

  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  const signups = userList.users
    .filter((u) => !alreadyEngagedIds.has(u.id))
    .map((u) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email || "(no email)",
        accountType: profile?.account_type || "buyer",
        phone: profile?.phone || null,
        signedUpAt: u.created_at,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime()
    );

  return NextResponse.json({ signups });
}
