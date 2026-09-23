import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, verifyAdmin } from "../../../../lib/supabaseAdmin";
import { githubRequest, GITHUB_OWNER, GITHUB_REPO } from "../../../../lib/github";

// POST /api/admin/build-queue/dispatch
// Body: { queueId: number }
// Header: Authorization: Bearer <supabase access token of a logged-in admin>
//
// Turns a queued "feature" build_queue row into a GitHub issue labeled
// "ai-build-feature". That label is what triggers .github/workflows/
// claude-build.yml, which writes the code and opens a pull request.
// This is what makes Approve on a feature recommendation actually start
// work -- no manual "Claude's Building This" click needed.
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
    .select("id, title, detail, type, status, github_issue_number")
    .eq("id", queueId)
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: "Build queue item not found." },
      { status: 404 }
    );
  }

  if (item.type !== "feature") {
    return NextResponse.json(
      { error: "Only 'feature' items can be dispatched to build." },
      { status: 400 }
    );
  }

  if (item.github_issue_number) {
    return NextResponse.json(
      {
        error:
          "This item was already dispatched (GitHub issue #" +
          item.github_issue_number +
          "). Use Retry from GitHub directly if it needs to run again.",
      },
      { status: 409 }
    );
  }

  let issueResponse: Response;

  try {
    issueResponse = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: "POST",
        body: JSON.stringify({
          title: item.title,
          body:
            item.detail +
            "\n\n---\nOpened automatically from 99Bricks admin panel. build_queue id: " +
            item.id,
          labels: ["ai-build-feature"],
        }),
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

  if (!issueResponse.ok) {
    const detail = await issueResponse.text().catch(() => "");
    return NextResponse.json(
      {
        error:
          "GitHub rejected the issue creation (status " +
          issueResponse.status +
          "): " +
          detail,
      },
      { status: 502 }
    );
  }

  const issue = await issueResponse.json();

  const { error: updateError } = await supabaseAdmin
    .from("build_queue")
    .update({
      github_issue_number: issue.number,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (updateError) {
    return NextResponse.json(
      {
        error:
          "GitHub issue #" +
          issue.number +
          " was created, but saving it to build_queue failed: " +
          updateError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  });
}
