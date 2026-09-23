import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { githubRequest, GITHUB_OWNER, GITHUB_REPO } from "../../../../lib/github";

// POST /api/admin/build-queue/merge
// Body: { queueId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// This is the one deliberate manual step in the automated build
// pipeline: Claude writes the code and opens a pull request on its own,
// but nothing reaches the live site until an admin clicks
// "Merge & Go Live" here. Vercel auto-deploys the instant this merge
// lands on main.
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
  const queueId = body?.queueId;

  if (!queueId) {
    return NextResponse.json(
      { error: "queueId is required." },
      { status: 400 }
    );
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("build_queue")
    .select("id, github_pr_number, status")
    .eq("id", queueId)
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: "Build queue item not found." },
      { status: 404 }
    );
  }

  if (!item.github_pr_number) {
    return NextResponse.json(
      { error: "No pull request linked to this item yet." },
      { status: 400 }
    );
  }

  let mergeResponse: Response;

  try {
    mergeResponse = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${item.github_pr_number}/merge`,
      {
        method: "PUT",
        body: JSON.stringify({ merge_method: "squash" }),
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Failed to reach GitHub: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  if (!mergeResponse.ok) {
    const detail = await mergeResponse.text().catch(() => "");
    return NextResponse.json(
      {
        error:
          "GitHub could not merge PR #" +
          item.github_pr_number +
          " (status " +
          mergeResponse.status +
          "): " +
          detail +
          ". This usually means the build/checks haven't finished or failed -- check the PR on GitHub.",
      },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("build_queue")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  if (updateError) {
    return NextResponse.json(
      {
        error:
          "PR #" +
          item.github_pr_number +
          " was merged, but updating build_queue failed: " +
          updateError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
