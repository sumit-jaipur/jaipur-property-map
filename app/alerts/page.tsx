"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number;
  area: string;
  image: string | null;
};

type SavedSearch = {
  name: string;
};

type AlertRow = {
  id: number;
  seen: boolean;
  created_at: string;
  properties: Property | null;
  saved_searches: SavedSearch | null;
};

function formatPrice(price: number) {
  const rupee = "₹";

  if (price >= 10000000) {
    return rupee + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return rupee + (price / 100000).toFixed(0) + " Lakh";
  }

  return rupee + price.toLocaleString("en-IN");
}

export default function AlertsPage() {
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadAlerts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("search_alerts")
        .select(
          `
          id,
          seen,
          created_at,
          properties (
            id,
            title,
            type,
            price,
            bhk,
            area,
            image
          ),
          saved_searches (
            name
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as AlertRow[];

      setAlerts(rows);
      setLoading(false);

      const unseenIds = rows
        .filter((row) => !row.seen)
        .map((row) => row.id);

      if (unseenIds.length > 0) {
        await supabase
          .from("search_alerts")
          .update({ seen: true })
          .in("id", unseenIds);
      }
    }

    loadAlerts();
  }, [router]);

  async function dismissAlert(alertId: number) {
    setDismissingId(alertId);
    setError("");

    const { error } = await supabase
      .from("search_alerts")
      .delete()
      .eq("id", alertId);

    setDismissingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading alerts...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">

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

          <Link
            href="/saved-searches"
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
          >
            Manage Saved Searches
          </Link>

        </div>
      </div>


      <div className="mx-auto max-w-4xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Market alerts
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Your Alerts
          </h1>

          <p className="mt-2 text-zinc-500">
            New listings that match one of your saved searches.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {alerts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
              🔔
            </div>

            <h2 className="mt-4 text-xl font-black text-zinc-900">
              No alerts yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Save a search from the homepage and we&apos;ll let you know
              as soon as a matching listing goes live.
            </p>

            <Link
              href="/saved-searches"
              className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              View Saved Searches
            </Link>

          </div>
        )}


        <div className="space-y-4">

          {alerts.map((alert) =>
            alert.properties ? (
              <article
                key={alert.id}
                className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
              >

                <Link
                  href={`/properties/${alert.properties.id}`}
                  className="shrink-0"
                >
                  <img
                    src={
                      alert.properties.image ||
                      "https://placehold.co/300x200?text=Property"
                    }
                    alt={alert.properties.title}
                    className="h-32 w-full rounded-2xl object-cover sm:h-24 sm:w-32"
                  />
                </Link>

                <div className="min-w-0 flex-1">

                  {alert.saved_searches && (
                    <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                      Matches &quot;{alert.saved_searches.name}&quot;
                    </p>
                  )}

                  <Link href={`/properties/${alert.properties.id}`}>
                    <h2 className="mt-1 truncate text-base font-black text-zinc-900 hover:text-red-600">
                      {alert.properties.title}
                    </h2>
                  </Link>

                  <p className="mt-1 text-sm text-zinc-500">
                    {alert.properties.area || "Jaipur"} &middot;{" "}
                    {alert.properties.bhk} BHK {alert.properties.type}
                  </p>

                  <p className="mt-1 text-lg font-black text-red-600">
                    {formatPrice(alert.properties.price)}
                  </p>

                </div>

                <div className="flex shrink-0 items-center gap-2">

                  <Link
                    href={`/properties/${alert.properties.id}`}
                    className="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-zinc-800"
                  >
                    View
                  </Link>

                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    disabled={dismissingId === alert.id}
                    className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {dismissingId === alert.id ? "..." : "Dismiss"}
                  </button>

                </div>

              </article>
            ) : null
          )}

        </div>

      </div>

    </main>
  );
}
