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
  facing: string;
  parking: string;
  road: string;
  image: string;
  status: string;
  seller_id: string | null;
  verification_status: "pending" | "approved" | "rejected";
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

export default function MyPropertiesPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadMyProperties() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("seller_id", user.id)
        .order("id", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setProperties((data ?? []) as Property[]);
      }

      setLoading(false);
    }

    loadMyProperties();
  }, [router]);

  async function handleDelete(property: Property) {
    const confirmed = window.confirm(
      `Delete "${property.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(property.id);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", property.id)
      .eq("seller_id", user.id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setProperties((current) =>
      current.filter((item) => item.id !== property.id)
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading your properties...
          </p>
        </div>
      </main>
    );
  }

  const approvedCount = properties.filter(
    (item) => item.verification_status === "approved"
  ).length;

  const pendingCount = properties.filter(
    (item) => item.verification_status === "pending"
  ).length;

  const rejectedCount = properties.filter(
    (item) => item.verification_status === "rejected"
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

          <Link
            href="/add-property"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            + Add Property
          </Link>

        </div>
      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Seller Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            My Properties
          </h1>

          <p className="mt-2 text-zinc-500">
            Manage your listings, verification status and property details.
          </p>
        </div>


        <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Total
            </p>

            <p className="mt-2 text-2xl font-black text-zinc-900">
              {properties.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
              Approved
            </p>

            <p className="mt-2 text-2xl font-black text-emerald-800">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
              Pending
            </p>

            <p className="mt-2 text-2xl font-black text-yellow-800">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-red-600">
              Rejected
            </p>

            <p className="mt-2 text-2xl font-black text-red-800">
              {rejectedCount}
            </p>
          </div>

        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {!error && properties.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
              🏠
            </div>

            <h2 className="mt-4 text-xl font-black text-zinc-900">
              No properties listed yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Create your first property listing and start reaching buyers.
            </p>

            <Link
              href="/add-property"
              className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              List Property
            </Link>

          </div>
        )}


        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

          {properties.map((property) => (
            <article
              key={property.id}
              className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >

              <div className="relative overflow-hidden">

                <img
                  src={
                    property.image ||
                    "https://placehold.co/600x400?text=Property"
                  }
                  alt={property.title}
                  className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />

                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold capitalize shadow ${
                    property.verification_status === "approved"
                      ? "bg-emerald-500 text-white"
                      : property.verification_status === "rejected"
                      ? "bg-red-600 text-white"
                      : "bg-yellow-400 text-yellow-950"
                  }`}
                >
                  {property.verification_status || "pending"}
                </span>

                <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-zinc-800">
                  {property.type}
                </span>

              </div>


              <div className="p-5">

                <h2 className="truncate text-lg font-black text-zinc-900">
                  {property.title}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {property.area || "Area not specified"}
                </p>


                <div className="mt-4 flex items-end justify-between gap-3">

                  <div>
                    <p className="text-xs text-zinc-400">
                      Asking Price
                    </p>

                    <p className="text-xl font-black text-red-600">
                      {formatPrice(property.price)}
                    </p>
                  </div>

                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {property.status}
                  </span>

                </div>


                <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl bg-zinc-50 py-2">

                  <div className="text-center">
                    <p className="text-[10px] uppercase text-zinc-400">
                      BHK
                    </p>

                    <p className="text-xs font-bold text-zinc-800">
                      {property.bhk || "-"}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] uppercase text-zinc-400">
                      Facing
                    </p>

                    <p className="text-xs font-bold text-zinc-800">
                      {property.facing || "-"}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] uppercase text-zinc-400">
                      Parking
                    </p>

                    <p className="truncate px-1 text-xs font-bold text-zinc-800">
                      {property.parking || "-"}
                    </p>
                  </div>

                </div>


                {property.verification_status === "pending" && (
                  <div className="mt-4 rounded-xl bg-yellow-50 px-3 py-2.5 text-xs font-semibold text-yellow-700">
                    Waiting for admin approval.
                  </div>
                )}

                {property.verification_status === "rejected" && (
                  <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                    This listing requires changes before approval.
                  </div>
                )}

                {property.verification_status === "approved" && (
                  <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                    Verified and visible to buyers.
                  </div>
                )}


                <div className="mt-5 grid grid-cols-3 gap-2">

                  <Link
                    href={`/properties/${property.id}`}
                    className="rounded-xl border border-zinc-200 px-2 py-2.5 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    View
                  </Link>

                  <Link
                    href={`/properties/${property.id}/edit`}
                    className="rounded-xl bg-zinc-900 px-2 py-2.5 text-center text-sm font-bold text-white transition hover:bg-zinc-800"
                  >
                    Edit
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(property)}
                    disabled={deletingId === property.id}
                    className="rounded-xl bg-red-50 px-2 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId === property.id
                      ? "..."
                      : "Delete"}
                  </button>

                </div>

              </div>

            </article>
          ))}

        </div>

      </div>

    </main>
  );
}