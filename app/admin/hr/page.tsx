"use client";

import { useState } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// "HR" -- built from Sumit's direct request: drafts job-post text for
// external hiring platforms (Naukri, Apna, Indeed, Internshala) so he can
// hire real people (sales executives, freelance field agents, interns) to
// build his team. 99Bricks does NOT get its own careers page -- Sumit was
// explicit the platform has no traffic to post jobs to yet. This tool
// only drafts text; Sumit still creates the account on each platform
// himself and pastes/publishes it there. Nothing is saved to the
// database -- generate, copy, done.

type EmploymentType = "full_time" | "freelance" | "internship";

type JobPostDraft = {
  platform: string;
  title: string;
  body: string;
};

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "freelance", label: "Freelance / Commission-based" },
  { value: "internship", label: "Internship" },
];

export default function AdminHrPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [roleTitle, setRoleTitle] = useState("");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("full_time");
  const [details, setDetails] = useState("");

  const [drafts, setDrafts] = useState<JobPostDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        setAccessDenied(true);
      }

      setCheckingAccess(false);
    }

    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleGenerate() {
    if (!roleTitle.trim() || !details.trim()) {
      setError("Fill in the role title and what the role involves first.");
      return;
    }

    setLoading(true);
    setError("");
    setDrafts([]);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/admin/hr/generate-job-post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ roleTitle, employmentType, details }),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Failed to generate job posts.");
      return;
    }

    setDrafts(data.drafts || []);
  }

  async function handleCopy(draft: JobPostDraft) {
    const text = `${draft.title}\n\n${draft.body}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlatform(draft.platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch {
      setError(
        "Couldn't copy automatically -- select the text below and copy it manually."
      );
    }
  }

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-zinc-900">Admins only</h1>
          <p className="mt-2 text-sm text-zinc-500">
            You don&apos;t have access to this page.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white"
          >
            Back to 99Bricks
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="99Bricks"
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
            <span className="text-sm font-black text-header-fg">
              99Bricks
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/properties"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Property Approval
            </Link>
            <Link
              href="/admin/ai-suggestions"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              AI Suggestions
            </Link>
            <Link
              href="/admin/blog"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Blog Studio
            </Link>
            <Link
              href="/admin/inquiries"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Sales Pipeline
            </Link>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              HR
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            HR
          </p>
          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Draft a job post
          </h1>
          <p className="mt-2 text-zinc-500">
            Describe the role once, and Gemini drafts it separately for
            Naukri, Apna, Indeed, and Internshala, each written in that
            platform&apos;s own style. This only drafts the text -- you
            still create the account on each platform and paste it in
            yourself. 99Bricks doesn&apos;t have its own careers page.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Role title
            </span>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Real Estate Sales Executive"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Employment type
            </span>
            <select
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as EmploymentType)
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              What the role involves / requirements
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="e.g. Handle site visits for Mansarovar and C-Scheme listings, follow up with leads over phone and WhatsApp, 1-2 years experience preferred but freshers welcome, performance-based incentive on closed deals."
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
            />
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-5 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Drafting..." : "Generate Job Posts"}
          </button>
        </div>

        {drafts.length > 0 && (
          <div className="mt-6 space-y-4">
            {drafts.map((draft) => (
              <article
                key={draft.platform}
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
                    {draft.platform}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(draft)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-800"
                  >
                    {copiedPlatform === draft.platform ? "Copied!" : "Copy"}
                  </button>
                </div>

                <h2 className="mt-3 text-lg font-black text-zinc-900">
                  {draft.title}
                </h2>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                  {draft.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
