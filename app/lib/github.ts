// Server-only helper for talking to the GitHub REST API. Never import
// this from a "use client" component -- GITHUB_DISPATCH_TOKEN must stay
// server-side only.
//
// Used by the automated build pipeline: approving a "feature" item in
// /admin/ai-suggestions opens a GitHub issue labeled "ai-build-feature",
// which the claude-build.yml workflow picks up to write the code and
// open a pull request. Once that PR passes its build, the admin panel's
// "Merge & Go Live" button merges it using this same token.

export const GITHUB_OWNER = "sumit-jaipur";
export const GITHUB_REPO = "jaipur-property-map";

function githubToken(): string {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_DISPATCH_TOKEN is not set. Add it as a Vercel environment variable (a GitHub personal access token with 'repo' scope) and redeploy."
    );
  }
  return token;
}

export async function githubRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}
