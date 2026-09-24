import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/supabaseAdmin";
import {
  generateJobPostDrafts,
  JobPostEmploymentType,
} from "../../../../lib/gemini";

const VALID_TYPES = ["full_time", "freelance", "internship"];

// POST /api/admin/hr/generate-job-post
// Body: { roleTitle: string, employmentType: "full_time"|"freelance"|"internship", details: string }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Drafts job-post text per hiring platform (Naukri, Apna, Indeed, and
// Internshala for internship/freelance roles) for the admin to copy and
// paste onto that platform themselves -- see app/lib/gemini.ts for why
// nothing posts automatically. Stateless: nothing is saved to the
// database, this just returns the drafts for the admin to read and copy.
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

  if (!body || !body.roleTitle || !body.details) {
    return NextResponse.json(
      { error: "roleTitle and details are required." },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.includes(body.employmentType)) {
    return NextResponse.json(
      {
        error:
          "employmentType must be full_time, freelance, or internship.",
      },
      { status: 400 }
    );
  }

  try {
    const drafts = await generateJobPostDrafts({
      roleTitle: String(body.roleTitle).slice(0, 200),
      employmentType: body.employmentType as JobPostEmploymentType,
      details: String(body.details).slice(0, 3000),
    });

    return NextResponse.json({ drafts });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Gemini job-post drafting failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }
}
