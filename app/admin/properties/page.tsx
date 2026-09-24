"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  area: string;
  image: string | null;
  status: string;
  verification_status: "pending" | "approved" | "rejected";
  is_featured: boolean;
};

function formatPrice(price: number) {
  const rupee = "\u20B9";

  if (price >= 10000000) {
    return rupee + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return rupee + (price / 100000).toFixed(0) + " Lakh";
  }

  return rupee + price.toLocaleString("en-IN");
}

export default function AdminPropertiesPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
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
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, title, type, price, area, image, status, verification_status, is_featured"
        )
        .order("id", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setProperties((data ?? []) as Property[]);
      }

      setLoading(false);
    }

    loadPage();
  }, [router]);

  async function changeStatus(
    propertyId: number,
    newStatus: "approved" | "rejected"
  ) {
    setUpdatingId(propertyId);
    setError("");

    const { error } = await supabase
      .from("properties")
      .update({
        verification_status: newStatus,
      })
      .eq("id", propertyId);

    setUpdatingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setProperties((current) =>
      current.map((property) =>
        property.id === propertyId
          ? {
              ...property,
              verification_status: newStatus,
            }
          : property
      )
    );

    // Approving a listing is the moment it goes live for buyers, so this
    // is also the moment saved-search alerts should fire -- check the
    // newly-approved listing against every active saved search right
    // away instead of waiting on a separate job.
    if (newStatus === "approved") {
      await notifySavedSearchMatches(propertyId);
    }
  }

  async function notifySavedSearchMatches(propertyId: number) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const response = await fetch("/api/alerts/notify-matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ propertyId }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(
        "Listing approved, but saved-search alerts could not be sent: " +
          (result?.error || "unknown error")
      );
    }
  }

  // "Featured Listing and Ad Badges" -- built 2026-09-23 from an approved
  // market-trend "feature" recommendation (see build_queue). Featured
  // listings get a gold badge and are sorted to the top of every public
  // listing view. This is a manual admin toggle for now, matching item 1
  // of the confirmed monetization plan (featured/boosted listings) --
  // wiring it to an actual paid purchase flow comes later, once a payment
  // gateway is chosen.
  async function toggleFeatured(propertyId: number, currentValue: boolean) {
    setUpdatingId(propertyId);
    setError("");

    const { error } = await supabase
      .from("properties")
      .update({ is_featured: !currentValue })
      .eq("id", propertyId);

    setUpdatingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setProperties((current) =>
      current.map((property) =>
        property.id === propertyId
          ? { ...property, is_featured: !currentValue }
          : property
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading admin dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            🛡️
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

  const pendingCount = properties.filter(
    (property) => property.verification_status === "pending"
  ).length;

  const approvedCount = properties.filter(
    (property) => property.verification_status === "approved"
  ).length;

  const rejectedCount = properties.filter(
    (property) => property.verification_status === "rejected"
  ).length;

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

          <div className="flex items-center gap-2">
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

            <Link
              href="/admin/hr"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              HR
            </Link>

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              Admin Dashboard
            </span>
          </div>

        </div>
      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Property moderation
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Property Approval
          </h1>

          <p className="mt-2 text-zinc-500">
            Review seller listings before they become visible to buyers.
          </p>
        </div>


        <div className="mb-7 grid gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
              Pending
            </p>

            <p className="mt-2 text-3xl font-black text-yellow-800">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Approved
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-800">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700">
              Rejected
            </p>

            <p className="mt-2 text-3xl font-black text-red-800">
              {rejectedCount}
            </p>
          </div>

        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        <div className="space-y-4">

          {properties.map((property) => (
            <article
              key={property.id}
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
            >

              <div className="flex flex-col gap-5 p-5 md:flex-row">

                <img
                  src={
                    property.image ||
                    "https://placehold.co/500x350?text=Property"
                  }
                  alt={property.title}
                  className="h-52 w-full rounded-2xl object-cover md:h-40 md:w-56"
                />


                <div className="flex-1">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                        {property.type}
                      </p>

                      <h2 className="mt-1 text-xl font-black text-zinc-900">
                        {property.title}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {property.area}
                      </p>

                      <p className="mt-2 text-lg font-black text-red-600">
                        {formatPrice(property.price)}
                      </p>
                    </div>


                    <div className="flex flex-wrap items-center gap-2">

                      {property.is_featured && (
                        <span className="w-fit rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-white">
                          Featured
                        </span>
                      )}

                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                          property.verification_status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : property.verification_status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {property.verification_status}
                      </span>

                    </div>

                  </div>


                  <div className="mt-5 flex flex-wrap gap-2">

                    <Link
                      href={`/properties/${property.id}`}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      View Property
                    </Link>


                    <button
                      type="button"
                      onClick={() =>
                        changeStatus(property.id, "approved")
                      }
                      disabled={updatingId === property.id}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {updatingId === property.id
                        ? "Updating..."
                        : "Approve"}
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        changeStatus(property.id, "rejected")
                      }
                      disabled={updatingId === property.id}
                      className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        toggleFeatured(property.id, property.is_featured)
                      }
                      disabled={updatingId === property.id}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                        property.is_featured
                          ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          : "bg-gold text-white hover:opacity-90"
                      }`}
                    >
                      {property.is_featured
                        ? "Remove Featured"
                        : "Mark Featured"}
                    </button>

                  </div>

                </div>

              </div>

            </article>
          ))}

        </div>

      </div>

    </main>
  );
}