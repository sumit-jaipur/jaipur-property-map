"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { checkAdminAccess } from "../../lib/adminGuard";
import AdminHeader from "../../components/AdminHeader";
import {
  ShieldAlert,
  Database,
  HardDrive,
  Users,
  Home,
  MessageSquare,
  Newspaper,
  GitBranch,
  ExternalLink,
  Info,
} from "lucide-react";

// "Usage & Limits" -- built from Sumit's direct request: a place in the
// admin panel that shows how much of each free service we're actually
// using, so he can see ahead of time when something is going to run out
// or need upgrading, instead of finding out when it suddenly stops
// working.
//
// Two different kinds of numbers appear on this page, and they're
// labeled accordingly so neither is mistaken for the other:
//   - "Live" cards are measured right now, straight from our own
//     Supabase database and storage bucket (and GitHub's own reply for
//     the build pipeline's token).
//   - "Free-tier reference" cards are the ceiling each service allows on
//     its free plan, researched from that service's own pricing page.
//     Mapbox, Gemini and Tavily don't expose "how much have I used"
//     through the same key/token this app already calls them with, so
//     those three stay reference-only until a separate usage-reporting
//     credential is added for each -- this page says exactly what that
//     would take, right on the card, rather than silently guessing a
//     number.
export default function AdminUsagePage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      const access = await checkAdminAccess();

      if (!access.ok) {
        if (access.reason === "signed_out") {
          router.replace("/auth");
          return;
        } else if (access.reason === "mfa_required") {
          router.replace(
            `/admin/verify-2fa?next=${encodeURIComponent("/admin/usage")}`
          );
          return;
        } else {
          setAccessDenied(true);
          setCheckingAccess(false);
          return;
        }
      }

      setCheckingAccess(false);
      loadStats();
    }

    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadStats() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/auth");
      return;
    }

    try {
      const res = await fetch("/api/admin/usage-stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load usage stats.");
        setLoading(false);
        return;
      }

      setStats(data);
    } catch {
      setError("Something went wrong loading usage stats. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">Loading...</p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <ShieldAlert className="h-7 w-7 text-red-500" />
          </div>

          <h1 className="mt-4 text-2xl font-black text-zinc-900">
            Access Denied
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            This dashboard is only available to administrators.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-zinc-900 px-5 py-2.5 font-semibold text-white"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const db = stats?.live.database;
  const storage = stats?.live.storage;
  const github = stats?.live.github;

  return (
    <main className="min-h-screen bg-zinc-50">
      <AdminHeader />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
              Platform health
            </p>
            <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
              Usage & limits
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-500">
              What every free service behind 99Bricks is actually being
              used for, and the ceiling each one allows, so nothing stops
              working with no warning.
            </p>
          </div>

          {stats && (
            <p className="text-xs text-zinc-400">
              Reference limits checked {stats.researchedAt}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading && !stats && (
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
            Loading live numbers...
          </div>
        )}

        {stats && (
          <>
            {/* ---- Live, measured right now ---------------------------- */}
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-zinc-400">
                Live right now
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Home}
                  label="Listings"
                  value={db?.propertiesTotal}
                  sub={
                    db?.propertiesPending != null
                      ? `${db.propertiesPending} pending review`
                      : undefined
                  }
                />
                <StatCard
                  icon={Users}
                  label="Registered users"
                  value={db?.registeredUsers}
                />
                <StatCard
                  icon={MessageSquare}
                  label="Inquiries"
                  value={db?.inquiriesCount}
                />
                <StatCard
                  icon={Newspaper}
                  label="Blog posts"
                  value={db?.blogPostsCount}
                />
                <StatCard
                  icon={Database}
                  label="Photo/video rows"
                  value={db?.propertyMediaCount}
                  sub="property_media table"
                />
                <StatCard
                  icon={HardDrive}
                  label="Storage used"
                  value={
                    storage
                      ? formatBytes(storage.totalBytes)
                      : undefined
                  }
                  sub={
                    storage
                      ? `${storage.fileCount.toLocaleString()} files in "${storage.bucket}"${
                          storage.truncated ? " (capped count -- actually higher)" : ""
                        } · ${percentOf(storage.totalBytes, 1 * 1024 ** 3)}% of the 1 GB free plan`
                      : undefined
                  }
                />
                <StatCard
                  icon={GitBranch}
                  label="AI-built features shipped"
                  value={db?.buildQueueDispatched}
                  sub="Opened as GitHub issues via the build pipeline"
                />
                {github?.rateLimit && (
                  <StatCard
                    icon={GitBranch}
                    label="GitHub API calls left this hour"
                    value={`${github.rateLimit.remaining} / ${github.rateLimit.limit}`}
                    sub={`Resets ${new Date(github.rateLimit.resetsAt).toLocaleTimeString()}`}
                  />
                )}
                {github?.actionsMinutesUsed != null && (
                  <StatCard
                    icon={GitBranch}
                    label="GitHub Actions minutes used"
                    value={github.actionsMinutesUsed}
                    sub="This billing month, out of 2,000 free"
                  />
                )}
              </div>
            </section>

            {/* ---- Free-tier reference ---------------------------------- */}
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-zinc-400">
                Free-tier ceilings
              </h2>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {stats.reference.map((service) => (
                  <div
                    key={service.service}
                    className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-zinc-900">
                          {service.service}
                        </h3>
                        <p className="text-xs font-semibold text-zinc-400">
                          {service.plan}
                        </p>
                      </div>

                      <a
                        href={service.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-zinc-300 transition hover:text-red-600"
                        title="View official pricing page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <ul className="mt-3 flex-1 space-y-1.5">
                      {service.limits.map((limit) => (
                        <li
                          key={limit.label}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span className="text-zinc-500">{limit.label}</span>
                          <span className="font-bold text-zinc-900">
                            {limit.value}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
                      Resets: {service.resets}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-zinc-100 px-4 py-3 text-xs text-zinc-500">
                <Info className="h-4 w-4 shrink-0 translate-y-0.5" />
                <p>
                  Mapbox, Gemini and Tavily don&apos;t report &quot;how much
                  I&apos;ve used&quot; through the same key this app already
                  calls them with -- each needs its own separate
                  usage-reporting credential to go live here too. Worth
                  doing once growth makes it worth watching closely; not
                  worth doing before then.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

type UsageStats = {
  researchedAt: string;
  live: {
    database: {
      propertiesTotal: number | null;
      propertiesPending: number | null;
      propertyMediaCount: number | null;
      inquiriesCount: number | null;
      blogPostsCount: number | null;
      registeredUsers: number | null;
      buildQueueDispatched: number | null;
    };
    storage: {
      bucket: string;
      fileCount: number;
      totalBytes: number;
      truncated: boolean;
    };
    github: {
      rateLimit: { remaining: number; limit: number; resetsAt: string } | null;
      actionsMinutesUsed: number | null;
    };
  };
  reference: {
    service: string;
    plan: string;
    resets: string;
    limits: { label: string; value: string }[];
    sourceUrl: string;
  }[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function percentOf(value: number, of: number): string {
  if (of <= 0) return "0";
  return Math.min(100, (value / of) * 100).toFixed(1);
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Database;
  label: string;
  value: number | string | null | undefined;
  sub?: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-2 text-2xl font-black text-zinc-900">
        {value ?? "--"}
      </p>

      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}
