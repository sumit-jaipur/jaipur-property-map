"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// "Sales Pipeline" -- built from Sumit's direct request: every buyer
// inquiry (the existing `inquiries` table, unchanged -- a buyer's message
// to a seller sent from a property page) now also carries a pipeline
// status and can be allotted to a registered broker or agent for the site
// visit. This is the admin-wide view across every listing; a seller still
// only sees inquiries for their own properties on the existing /inquiries
// page, which is untouched.
//
// Two additions from Sumit's direct follow-up request:
// 1. "Add Lead" -- a manual lead that came from a phone call, WhatsApp, or
//    walk-in, not the website form, entered by the admin directly.
// 2. "Signups" view -- registered accounts that have never submitted an
//    inquiry, kept as a separate cold-call-style segment, since Sumit
//    wants that list handed to his cold callers.
//
// Requires TWO migrations to have been run in Supabase first:
// inquiries-sales-pipeline-migration.sql, then
// inquiries-manual-leads-and-profile-phone-migration.sql -- see the
// project docs.

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  image: string | null;
};

type Broker = {
  id: string;
  accountType: string;
  email: string;
};

type InquiryStatus =
  | "new"
  | "contacted"
  | "site_visit_scheduled"
  | "closed_won"
  | "closed_lost";

type InquirySource =
  | "website_form"
  | "phone_call"
  | "whatsapp"
  | "walk_in"
  | "other";

type Inquiry = {
  id: number;
  property_id: number | null;
  buyer_id: string | null;
  buyerEmail: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  source: InquirySource;
  message: string;
  status: InquiryStatus;
  assigned_to: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  properties: Property | null;
};

type Signup = {
  id: string;
  email: string;
  accountType: string;
  phone: string | null;
  signedUpAt: string;
};

const STATUS_TABS: { value: InquiryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "site_visit_scheduled", label: "Site Visit Scheduled" },
  { value: "closed_won", label: "Closed - Won" },
  { value: "closed_lost", label: "Closed - Lost" },
];

const STATUS_STYLES: Record<InquiryStatus, string> = {
  new: "bg-zinc-100 text-zinc-600",
  contacted: "bg-amber-50 text-amber-700",
  site_visit_scheduled: "bg-blue-50 text-blue-700",
  closed_won: "bg-green-50 text-green-700",
  closed_lost: "bg-red-50 text-red-700",
};

const SOURCE_LABELS: Record<InquirySource, string> = {
  website_form: "Website",
  phone_call: "Phone Call",
  whatsapp: "WhatsApp",
  walk_in: "Walk-in",
  other: "Other",
};

const LEAD_SOURCE_OPTIONS: { value: InquirySource; label: string }[] = [
  { value: "phone_call", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Other" },
];

function formatPrice(price: number) {
  const rupee = "₹";
  if (price >= 10000000) return rupee + (price / 10000000).toFixed(2) + " Cr";
  if (price >= 100000) return rupee + (price / 100000).toFixed(0) + " Lakh";
  return rupee + price.toLocaleString("en-IN");
}

export default function AdminInquiriesPage() {
  const router = useRouter();

  const [view, setView] = useState<"pipeline" | "signups">("pipeline");

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<InquiryStatus | "all">("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupsLoaded, setSignupsLoaded] = useState(false);

  const [showAddLead, setShowAddLead] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSource, setLeadSource] = useState<InquirySource>("phone_call");
  const [leadMessage, setLeadMessage] = useState("");

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
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const authedFetch = await getAuthedFetch();
    const response = await authedFetch("/api/admin/inquiries");
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Failed to load the sales pipeline.");
      setLoading(false);
      return;
    }

    setInquiries(data.inquiries || []);
    setBrokers(data.brokers || []);
    setLoading(false);
  }

  async function loadSignups() {
    setSignupsLoading(true);
    setError("");

    const authedFetch = await getAuthedFetch();
    const response = await authedFetch("/api/admin/signups");
    const data = await response.json();

    setSignupsLoading(false);

    if (!response.ok) {
      setError(data.error || "Failed to load signups.");
      return;
    }

    setSignups(data.signups || []);
    setSignupsLoaded(true);
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (view === "signups" && !signupsLoaded) {
      loadSignups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function updateInquiry(
    id: number,
    patch: {
      status?: InquiryStatus;
      assignedTo?: string | null;
      adminNotes?: string;
    }
  ) {
    setUpdatingId(id);
    setError("");

    const authedFetch = await getAuthedFetch();
    const response = await authedFetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    const data = await response.json();

    setUpdatingId(null);

    if (!response.ok) {
      setError(data.error || "Failed to update this inquiry.");
      return;
    }

    setInquiries((current) =>
      current.map((inquiry) =>
        inquiry.id === id
          ? {
              ...inquiry,
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.assignedTo !== undefined
                ? { assigned_to: patch.assignedTo }
                : {}),
              ...(patch.adminNotes !== undefined
                ? { admin_notes: patch.adminNotes }
                : {}),
            }
          : inquiry
      )
    );
  }

  async function handleAddLead() {
    if (!leadName.trim() || !leadPhone.trim()) {
      setError("Name and phone number are required to add a lead.");
      return;
    }

    setAddingLead(true);
    setError("");

    const authedFetch = await getAuthedFetch();
    const response = await authedFetch("/api/admin/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: leadName,
        contactPhone: leadPhone,
        source: leadSource,
        message: leadMessage,
      }),
    });

    const data = await response.json();

    setAddingLead(false);

    if (!response.ok) {
      setError(data.error || "Failed to add this lead.");
      return;
    }

    setLeadName("");
    setLeadPhone("");
    setLeadSource("phone_call");
    setLeadMessage("");
    setShowAddLead(false);
    loadPage();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading the sales pipeline...
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

  const visibleInquiries =
    activeTab === "all"
      ? inquiries
      : inquiries.filter((inquiry) => inquiry.status === activeTab);

  const countByStatus = (status: InquiryStatus | "all") =>
    status === "all"
      ? inquiries.length
      : inquiries.filter((inquiry) => inquiry.status === status).length;

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

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              Sales Pipeline
            </span>

            <Link
              href="/admin/hr"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              HR
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
              Sales
            </p>
            <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
              {view === "pipeline" ? "Buyer inquiries pipeline" : "Signups"}
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-500">
              {view === "pipeline"
                ? "Every buyer message across every listing, plus any lead you add manually, in one place. Move a lead through the pipeline and allot it to a registered broker or agent for the site visit."
                : "Registered accounts that have never submitted an inquiry -- people who signed up but haven't said they're interested in anything yet. A separate, cold-call-style list, kept apart from the pipeline on the left."}
            </p>
          </div>

          {view === "pipeline" && (
            <button
              type="button"
              onClick={() => setShowAddLead((v) => !v)}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
            >
              {showAddLead ? "Cancel" : "+ Add Lead"}
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("pipeline")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              view === "pipeline"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setView("signups")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              view === "signups"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            Signups (Cold Call List)
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {view === "pipeline" && showAddLead && (
          <div className="mb-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-zinc-900">
              Add a lead manually
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              For someone who called you or messaged on WhatsApp -- not
              through the website form.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Name
                </span>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="e.g. 98290 00000"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  How they reached you
                </span>
                <select
                  value={leadSource}
                  onChange={(e) =>
                    setLeadSource(e.target.value as InquirySource)
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                >
                  {LEAD_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Notes (which property, what they asked, etc.)
                </span>
                <textarea
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  rows={2}
                  placeholder="e.g. Asked about 3BHK flats in Mansarovar under 60 Lakh"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddLead}
              disabled={addingLead}
              className="mt-4 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {addingLead ? "Adding..." : "Add Lead"}
            </button>
          </div>
        )}

        {view === "pipeline" && (
          <>
            {brokers.length === 0 && (
              <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                No accounts with account type &quot;Broker&quot; or &quot;Real
                Estate Agent&quot; exist yet -- assignment will be
                unavailable until at least one broker or agent signs up.
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    activeTab === tab.value
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {tab.label} ({countByStatus(tab.value)})
                </button>
              ))}
            </div>

            {visibleInquiries.length === 0 && (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
                  📋
                </div>
                <h2 className="mt-4 text-xl font-black text-zinc-900">
                  No inquiries here
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Buyer messages sent from a property page, or leads you add
                  manually, will show up here.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {visibleInquiries.map((inquiry) => {
                const isUpdating = updatingId === inquiry.id;
                const noteDraft =
                  noteDrafts[inquiry.id] !== undefined
                    ? noteDrafts[inquiry.id]
                    : inquiry.admin_notes || "";

                return (
                  <article
                    key={inquiry.id}
                    className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[inquiry.status]}`}
                          >
                            {STATUS_TABS.find(
                              (t) => t.value === inquiry.status
                            )?.label || inquiry.status}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                            {SOURCE_LABELS[inquiry.source]}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {new Date(inquiry.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h2 className="mt-2 text-lg font-black text-zinc-900">
                          {inquiry.properties?.title || "General inquiry"}
                        </h2>

                        {inquiry.properties && (
                          <p className="text-sm text-zinc-500">
                            {inquiry.properties.type} &middot;{" "}
                            {formatPrice(inquiry.properties.price)}
                          </p>
                        )}

                        {inquiry.buyer_id ? (
                          <p className="mt-1 text-sm font-semibold text-zinc-700">
                            Buyer: {inquiry.buyerEmail}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-zinc-700">
                            {inquiry.contact_name} &middot;{" "}
                            {inquiry.contact_phone}
                          </p>
                        )}

                        <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Message
                          </p>
                          <p className="mt-1 text-sm leading-6 text-zinc-700">
                            {inquiry.message}
                          </p>
                        </div>

                        {inquiry.property_id && (
                          <Link
                            href={`/properties/${inquiry.property_id}`}
                            className="mt-3 inline-block text-xs font-bold text-red-600 hover:underline"
                          >
                            View property &rarr;
                          </Link>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-3 lg:w-72">
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Status
                          </span>
                          <select
                            value={inquiry.status}
                            disabled={isUpdating}
                            onChange={(e) =>
                              updateInquiry(inquiry.id, {
                                status: e.target.value as InquiryStatus,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                          >
                            {STATUS_TABS.filter((t) => t.value !== "all").map(
                              (t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Allot to broker / agent
                          </span>
                          <select
                            value={inquiry.assigned_to || ""}
                            disabled={isUpdating || brokers.length === 0}
                            onChange={(e) =>
                              updateInquiry(inquiry.id, {
                                assignedTo: e.target.value || null,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                          >
                            <option value="">Unassigned</option>
                            {brokers.map((broker) => (
                              <option key={broker.id} value={broker.id}>
                                {broker.email} (
                                {broker.accountType === "broker"
                                  ? "Broker"
                                  : "Agent"}
                                )
                              </option>
                            ))}
                          </select>
                          <span className="mt-1 block text-xs text-zinc-400">
                            Assigning here doesn&apos;t notify them yet --
                            let them know directly for now.
                          </span>
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Internal note
                          </span>
                          <textarea
                            value={noteDraft}
                            disabled={isUpdating}
                            onChange={(e) =>
                              setNoteDrafts((current) => ({
                                ...current,
                                [inquiry.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                            placeholder="Only visible to admins"
                          />
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              updateInquiry(inquiry.id, {
                                adminNotes: noteDraft,
                              })
                            }
                            className="mt-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Save note
                          </button>
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {view === "signups" && (
          <>
            <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Signup now collects a phone number, so every new signup from
              here on will be callable. Accounts created before that change
              will still show no phone until they sign up again.
            </div>

            {signupsLoading && (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
                Loading signups...
              </div>
            )}

            {!signupsLoading && signups.length === 0 && signupsLoaded && (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                <h2 className="text-xl font-black text-zinc-900">
                  No signups without an inquiry
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Every registered account has already submitted at least
                  one inquiry.
                </p>
              </div>
            )}

            {!signupsLoading && signups.length > 0 && (
              <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Account type</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3">Signed up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signups.map((signup) => (
                      <tr
                        key={signup.id}
                        className="border-b border-zinc-50 last:border-0"
                      >
                        <td className="px-5 py-3 font-semibold text-zinc-800">
                          {signup.email}
                        </td>
                        <td className="px-5 py-3 text-zinc-600">
                          {signup.accountType}
                        </td>
                        <td className="px-5 py-3 text-zinc-600">
                          {signup.phone || (
                            <span className="text-zinc-300">
                              Not collected
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-zinc-500">
                          {new Date(signup.signedUpAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
