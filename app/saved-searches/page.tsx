"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import {
  SavedSearchFilters,
  describeFilters,
} from "../lib/savedSearch";

type SavedSearchRow = {
  id: number;
  name: string;
  filters: SavedSearchFilters;
  is_active: boolean;
  created_at: string;
};

export default function SavedSearchesPage() {
  const router = useRouter();

  const [savedSearches, setSavedSearches] = useState<SavedSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadSavedSearches() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("saved_searches")
        .select("id, name, filters, is_active, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setSavedSearches((data ?? []) as SavedSearchRow[]);
      }

      setLoading(false);
    }

    loadSavedSearches();
  }, [router]);

  async function toggleActive(id: number, currentValue: boolean) {
    setUpdatingId(id);
    setError("");

    const { error } = await supabase
      .from("saved_searches")
      .update({ is_active: !currentValue })
      .eq("id", id);

    setUpdatingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSavedSearches((current) =>
      current.map((savedSearch) =>
        savedSearch.id === id
          ? { ...savedSearch, is_active: !currentValue }
          : savedSearch
      )
    );
  }

  async function deleteSavedSearch(id: number) {
    setUpdatingId(id);
    setError("");

    const { error } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", id);

    setUpdatingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSavedSearches((current) =>
      current.filter((savedSearch) => savedSearch.id !== id)
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading saved searches...
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
            href="/alerts"
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
          >
            View Alerts
          </Link>

        </div>
      </div>


      <div className="mx-auto max-w-4xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Market alerts
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Saved Searches
          </h1>

          <p className="mt-2 text-zinc-500">
            We&apos;ll alert you the moment a listing matching one of these
            searches is approved.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {savedSearches.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
              🔔
            </div>

            <h2 className="mt-4 text-xl font-black text-zinc-900">
              No saved searches yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Set your filters on the homepage and tap &quot;Save
              Search&quot; to get alerted about new matches.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              Start Searching
            </Link>

          </div>
        )}


        <div className="space-y-4">

          {savedSearches.map((savedSearch) => (
            <article
              key={savedSearch.id}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-zinc-900">
                    {savedSearch.name}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {describeFilters(savedSearch.filters)}
                  </p>

                  <p className="mt-2 text-xs text-zinc-400">
                    Saved{" "}
                    {new Date(
                      savedSearch.created_at
                    ).toLocaleDateString("en-IN")}
                  </p>
                </div>

                <span
                  className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                    savedSearch.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {savedSearch.is_active ? "Alerts on" : "Paused"}
                </span>

              </div>

              <div className="mt-4 flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() =>
                    toggleActive(savedSearch.id, savedSearch.is_active)
                  }
                  disabled={updatingId === savedSearch.id}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  {savedSearch.is_active ? "Pause Alerts" : "Resume Alerts"}
                </button>

                <button
                  type="button"
                  onClick={() => deleteSavedSearch(savedSearch.id)}
                  disabled={updatingId === savedSearch.id}
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>

              </div>

            </article>
          ))}

        </div>

      </div>

    </main>
  );
}
