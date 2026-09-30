"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// Broker/agent dashboard: shows only the leads Sumit (an admin, from
// Admin -> Sales Pipeline) has assigned to THIS logged-in broker, and
// lets the broker confirm they actually completed the site visit --
// with a short note and a photo as proof -- which then shows back up on
// Sumit's Sales Pipeline view.
//
// Security: this page never trusts the client for who-sees-what. Reading
// the list goes through /api/broker/inquiries, which re-checks the
// caller's own Supabase session token server-side and only ever returns
// rows where assigned_to = that caller's id -- a broker can never fetch
// another broker's leads by guessing an id. Marking a visit complete
// writes directly to `inquiries` with the broker's own logged-in
// Supabase client; the "Brokers can update their assigned visits" RLS
// policy plus the lock_inquiry_fields_for_broker trigger (see
// claude/inquiries-broker-visits-migration.sql) enforce, at the database
// level, that this can only ever touch that one row's visit_* columns --
// never the status, assignment, admin notes, or another broker's data,
// even from a hand-crafted API call. Requires that migration to have
// been run first.

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  image: string | null;
};

type Lead = {
  id: number;
  property_id: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  buyerEmail: string | null;
  message: string;
  status: string;
  created_at: string;
  visit_completed: boolean;
  visit_note: string | null;
  visit_photo_url: string | null;
  visit_completed_at: string | null;
  properties: Property | null;
};

function formatPrice(price: number) {
  const rupee = "₹";
  if (price >= 10000000) return rupee + (price / 10000000).toFixed(2) + " Cr";
  if (price >= 100000) return rupee + (price / 100000).toFixed(0) + " Lakh";
  return rupee + price.toLocaleString("en-IN");
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-600",
  contacted: "bg-amber-50 text-amber-700",
  site_visit_scheduled: "bg-blue-50 text-blue-700",
  closed_won: "bg-green-50 text-green-700",
  closed_lost: "bg-red-50 text-red-700",
};

const MAX_PHOTO_MB = 10;

export default function BrokerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [photoFiles, setPhotoFiles] = useState<Record<number, File | null>>(
    {}
  );
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function getAuthedFetch() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return (path: string, init?: RequestInit) =>
      fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });
  }

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
      .select("account_type")
      .eq("id", user.id)
      .single();

    if (!["broker", "agent"].includes(profile?.account_type || "")) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const authedFetch = await getAuthedFetch();
    const response = await authedFetch("/api/broker/inquiries");
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        data.error ||
          "Failed to load your assigned visits (has the broker-visits migration been run yet?)."
      );
      setLoading(false);
      return;
    }

    setLeads(data.leads || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function submitVisit(leadId: number) {
    setSubmittingId(leadId);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmittingId(null);
      router.replace("/auth");
      return;
    }

    const note = (noteDrafts[leadId] || "").trim();
    const photo = photoFiles[leadId] || null;

    if (!note) {
      setError("Add a short note about the visit before confirming.");
      setSubmittingId(null);
      return;
    }

    if (!photo) {
      setError("Attach a photo from the visit as proof before confirming.");
      setSubmittingId(null);
      return;
    }

    if (photo.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(
        `That photo is ${(photo.size / (1024 * 1024)).toFixed(
          1
        )}MB, over the ${MAX_PHOTO_MB}MB limit. Try a smaller photo.`
      );
      setSubmittingId(null);
      return;
    }

    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const fileName = `${user.id}/visits/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(fileName, photo);

    if (uploadError) {
      setError(`Photo failed to upload: ${uploadError.message}`);
      setSubmittingId(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("property-images")
      .getPublicUrl(fileName);

    // .select("id") so we can tell when RLS filtered the row out: an
    // update that matches zero rows returns no error at all.
    const { data: updatedRows, error: updateError } = await supabase
      .from("inquiries")
      .update({
        visit_completed: true,
        visit_note: note,
        visit_photo_url: publicUrlData.publicUrl,
        visit_completed_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select("id");

    setSubmittingId(null);

    if (updateError) {
      setError(`Failed to save your visit confirmation: ${updateError.message}`);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setError(
        "Your visit confirmation was not saved -- this visit may no longer be assigned to you."
      );
      return;
    }

    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              visit_completed: true,
              visit_note: note,
              visit_photo_url: publicUrlData.publicUrl,
              visit_completed_at: new Date().toISOString(),
            }
          : lead
      )
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-400">Loading your visits...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-zinc-900">
            Brokers &amp; agents only
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            This page is for team members with a Broker or Agent account.
            Your account isn&apos;t set up as one.
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

  const pending = leads.filter((lead) => !lead.visit_completed);
  const completed = leads.filter((lead) => lead.visit_completed);

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
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

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
            My Visits
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-black text-zinc-900">
          Assigned Site Visits
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Leads assigned to you. Confirm each visit with a short note and a
          photo once you&apos;ve been to the property -- it shows up on
          Sumit&apos;s Sales Pipeline right away.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {leads.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-400">
            No leads assigned to you yet.
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Pending ({pending.length})
            </h2>

            <div className="mt-3 space-y-4">
              {pending.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            STATUS_STYLES[lead.status] ||
                            "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {lead.status.replace(/_/g, " ")}
                        </span>

                        <span className="text-xs text-zinc-400">
                          {new Date(lead.created_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </span>
                      </div>

                      {lead.properties && (
                        <p className="mt-1.5 text-sm font-semibold text-zinc-900">
                          {lead.properties.title} &middot;{" "}
                          {formatPrice(lead.properties.price)}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-zinc-700">
                        {lead.contact_name || lead.buyerEmail || "Buyer"}
                        {lead.contact_phone ? ` · ${lead.contact_phone}` : ""}
                      </p>

                      {lead.message && (
                        <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
                          &ldquo;{lead.message}&rdquo;
                        </p>
                      )}
                    </div>

                    {lead.properties?.image && (
                      <img
                        src={lead.properties.image}
                        alt={lead.properties.title}
                        className="h-16 w-20 shrink-0 rounded-xl object-cover"
                      />
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Confirm this visit
                    </p>

                    <textarea
                      value={noteDrafts[lead.id] || ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [lead.id]: event.target.value,
                        }))
                      }
                      placeholder="What happened at the visit? (client interest, questions raised, next steps...)"
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-300"
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setPhotoFiles((current) => ({
                            ...current,
                            [lead.id]: event.target.files?.[0] || null,
                          }))
                        }
                        className="text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                      />

                      <button
                        type="button"
                        disabled={submittingId === lead.id}
                        onClick={() => submitVisit(lead.id)}
                        className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {submittingId === lead.id
                          ? "Saving..."
                          : "✓ Mark Visit Complete"}
                      </button>
                    </div>

                    <p className="mt-1.5 text-[11px] text-zinc-400">
                      Photo up to {MAX_PHOTO_MB}MB. Once submitted this
                      can&apos;t be edited or removed -- it&apos;s your proof
                      of the visit.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Verified ({completed.length})
            </h2>

            <div className="mt-3 space-y-3">
              {completed.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-green-100 bg-green-50/40 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700">
                      {"✓ Visit verified"}
                    </span>

                    {lead.visit_completed_at && (
                      <span className="text-xs text-zinc-400">
                        {new Date(lead.visit_completed_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    )}
                  </div>

                  {lead.properties && (
                    <p className="mt-1.5 text-sm font-semibold text-zinc-900">
                      {lead.properties.title}
                    </p>
                  )}

                  <p className="mt-1 text-sm text-zinc-700">
                    {lead.contact_name || lead.buyerEmail || "Buyer"}
                  </p>

                  {lead.visit_note && (
                    <p className="mt-1.5 text-sm text-zinc-600">
                      &ldquo;{lead.visit_note}&rdquo;
                    </p>
                  )}

                  {lead.visit_photo_url && (
                    <a
                      href={lead.visit_photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block"
                    >
                      <img
                        src={lead.visit_photo_url}
                        alt="Visit proof"
                        className="h-20 w-28 rounded-xl object-cover"
                      />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
