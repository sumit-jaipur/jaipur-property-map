"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { getAccountTypeLabel } from "../../lib/accountTypes";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

// Everything beyond the summary card -- fetched only once an admin
// actually opens a listing to review it, not for every row up front.
type PropertyDetail = {
  bhk: number | null;
  facing: string | null;
  parking: string | null;
  road: string | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  video_url: string | null;
};

type ListerInfo = {
  phone: string | null;
  email: string | null;
  accountType: string | null;
};

type PropertyReview = {
  detail: PropertyDetail;
  gallery: string[];
  lister: ListerInfo | null;
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

// Phone numbers are saved as whatever the seller typed at signup --
// usually a plain 10-digit Indian mobile number with no country code,
// which a wa.me link needs to actually open a chat.
function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function AdminPropertiesPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // This used to be a plain link out to the public /properties/[id]
  // page -- but that page is built for a buyer to send an inquiry, not
  // for verifying a listing before approving it. Reviewing a pending
  // property now expands right here instead, with the seller's contact
  // info front and center so it can actually be called and checked.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewCache, setReviewCache] = useState<
    Record<number, PropertyReview>
  >({});
  const [reviewLoadingId, setReviewLoadingId] = useState<number | null>(
    null
  );
  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>(
    {}
  );

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

  async function toggleReview(propertyId: number) {
    if (expandedId === propertyId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(propertyId);

    if (reviewCache[propertyId]) {
      return;
    }

    setReviewLoadingId(propertyId);
    setReviewErrors((current) => ({ ...current, [propertyId]: "" }));

    try {
      const { data: fullProperty, error: propertyError } = await supabase
        .from("properties")
        .select("bhk, facing, parking, road, lat, lng, status, video_url")
        .eq("id", propertyId)
        .single();

      if (propertyError || !fullProperty) {
        throw new Error(
          propertyError?.message || "Could not load property details."
        );
      }

      const { data: mediaRows } = await supabase
        .from("property_media")
        .select("url")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      let lister: ListerInfo | null = null;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const response = await fetch(
          `/api/admin/properties/${propertyId}/lister`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          lister = await response.json();
        }
      }

      setReviewCache((current) => ({
        ...current,
        [propertyId]: {
          detail: fullProperty as PropertyDetail,
          gallery: (mediaRows || []).map((row) => row.url as string),
          lister,
        },
      }));
    } catch (err) {
      setReviewErrors((current) => ({
        ...current,
        [propertyId]:
          err instanceof Error
            ? err.message
            : "Could not load property details.",
      }));
    } finally {
      setReviewLoadingId(null);
    }
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

          {properties.map((property) => {
            const isExpanded = expandedId === property.id;
            const review = reviewCache[property.id];

            return (
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

                    <button
                      type="button"
                      onClick={() => toggleReview(property.id)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      {expandedId === property.id
                        ? "Hide Details"
                        : "Review Details"}
                    </button>


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


                  {isExpanded && (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">

                      {reviewLoadingId === property.id && (
                        <p className="text-sm font-semibold text-zinc-500">
                          Loading listing details...
                        </p>
                      )}

                      {reviewErrors[property.id] && (
                        <p className="text-sm font-semibold text-red-600">
                          {reviewErrors[property.id]}
                        </p>
                      )}

                      {review && (
                        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                              Property details
                            </p>

                            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                              <div>
                                <dt className="text-zinc-400">BHK</dt>
                                <dd className="font-semibold text-zinc-800">
                                  {review.detail.bhk || "-"}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-zinc-400">Facing</dt>
                                <dd className="font-semibold text-zinc-800">
                                  {review.detail.facing || "-"}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-zinc-400">Parking</dt>
                                <dd className="font-semibold text-zinc-800">
                                  {review.detail.parking || "-"}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-zinc-400">Road width</dt>
                                <dd className="font-semibold text-zinc-800">
                                  {review.detail.road || "-"}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-zinc-400">
                                  Listing status
                                </dt>
                                <dd className="font-semibold text-zinc-800">
                                  {review.detail.status || "-"}
                                </dd>
                              </div>

                              {review.detail.video_url && (
                                <div>
                                  <dt className="text-zinc-400">
                                    Video tour
                                  </dt>
                                  <dd>
                                    <a
                                      href={review.detail.video_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-red-600 hover:underline"
                                    >
                                      Watch
                                    </a>
                                  </dd>
                                </div>
                              )}
                            </dl>

                            {review.gallery.length > 0 && (
                              <div className="mt-4 flex gap-2 overflow-x-auto">
                                {review.gallery.map((url, index) => (
                                  <img
                                    key={`${url}-${index}`}
                                    src={url}
                                    alt={`${property.title} photo ${
                                      index + 1
                                    }`}
                                    className="h-20 w-28 flex-shrink-0 rounded-lg object-cover"
                                  />
                                ))}
                              </div>
                            )}

                            {review.detail.lat &&
                              review.detail.lng &&
                              MAPBOX_TOKEN && (
                                <a
                                  href={`https://www.google.com/maps?q=${review.detail.lat},${review.detail.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-4 block overflow-hidden rounded-xl border border-zinc-200"
                                >
                                  <img
                                    src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+dc2626(${review.detail.lng},${review.detail.lat})/${review.detail.lng},${review.detail.lat},15,0,55/500x220@2x?access_token=${MAPBOX_TOKEN}`}
                                    alt="Property location"
                                    className="h-40 w-full object-cover"
                                  />
                                  <p className="bg-white px-3 py-2 text-xs font-semibold text-zinc-500">
                                    {review.detail.lat.toFixed(5)},{" "}
                                    {review.detail.lng.toFixed(5)} -- open
                                    in Google Maps
                                  </p>
                                </a>
                              )}
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                              Contact the lister
                            </p>

                            {review.lister ? (
                              <div className="mt-2 space-y-2 rounded-xl border border-zinc-200 bg-white p-4">

                                {review.lister.accountType && (
                                  <span className="inline-block w-fit rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                                    {getAccountTypeLabel(
                                      review.lister.accountType
                                    )}
                                  </span>
                                )}

                                {review.lister.phone ? (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <a
                                      href={`tel:${review.lister.phone}`}
                                      className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white hover:opacity-90"
                                    >
                                      Call {review.lister.phone}
                                    </a>

                                    <a
                                      href={`https://wa.me/${toWhatsAppNumber(
                                        review.lister.phone
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white hover:opacity-90"
                                    >
                                      WhatsApp
                                    </a>
                                  </div>
                                ) : (
                                  <p className="pt-1 text-sm text-zinc-400">
                                    No phone number on file for this
                                    account.
                                  </p>
                                )}

                                {review.lister.email && (
                                  <p className="pt-1 text-sm text-zinc-600">
                                    {review.lister.email}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-zinc-400">
                                Could not load contact info for this
                                listing's seller.
                              </p>
                            )}
                          </div>

                        </div>
                      )}

                    </div>
                  )}

                </div>

              </div>

            </article>
            );
          })}

        </div>

      </div>

    </main>
  );
}