"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { LOCALITIES, getLocalityBySlug } from "../../lib/localities";

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number;
  area: string;
  road: string;
  image: string;
  verification_status?: string;
};

function formatPrice(price: number) {
  if (price >= 10000000) {
    return "INR " + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return "INR " + (price / 100000).toFixed(0) + " Lakh";
  }

  return "INR " + price.toLocaleString("en-IN");
}

export default function LocalityPage() {
  const params = useParams();
  const slug = String(params.slug || "");

  const locality = getLocalityBySlug(slug);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locality) {
      setLoading(false);
      return;
    }

    async function loadProperties() {
      setLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .or(
          `title.ilike.%${locality!.name}%,road.ilike.%${locality!.name}%`
        )
        .order("id", { ascending: false });

      if (!error && data) {
        setProperties(data as Property[]);
      }

      setLoading(false);
    }

    loadProperties();
  }, [slug]);

  const otherLocalities = LOCALITIES.filter((l) => l.slug !== slug);

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

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
            href="/"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            Back to listings
          </Link>

        </div>
      </div>

      {!locality ? (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black text-zinc-900">
            Locality not found
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            We don&apos;t have a page for that locality yet.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Browse all Jaipur listings
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-8">

          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
              {locality.tier} &middot; Jaipur
            </p>

            <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
              Properties in {locality.name}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {locality.blurb}
            </p>

            <p className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
              Typical pricing: {locality.priceBand}
            </p>
          </div>

          {loading && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm font-medium text-zinc-500">
              Loading properties...
            </div>
          )}

          {!loading && properties.length === 0 && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
              <h2 className="text-lg font-black text-zinc-900">
                No listings in {locality.name} yet
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Be the first to list a property here, or browse all
                current listings across Jaipur.
              </p>

              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/add-property"
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                >
                  List a property
                </Link>

                <Link
                  href="/"
                  className="rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-200"
                >
                  Browse all listings
                </Link>
              </div>
            </div>
          )}

          {!loading && properties.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <img
                    src={
                      property.image ||
                      "https://placehold.co/400x260?text=Property"
                    }
                    alt={property.title}
                    className="h-44 w-full object-cover"
                  />

                  <div className="p-4">
                    <p className="text-sm font-bold leading-snug text-zinc-900 group-hover:text-accent">
                      {property.title}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {property.type}
                      {property.bhk ? ` • ${property.bhk} BHK` : ""}
                      {property.area ? ` • ${property.area}` : ""}
                    </p>

                    <p className="mt-2 text-base font-black text-accent">
                      {formatPrice(property.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 border-t border-zinc-200 pt-6">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Browse other Jaipur localities
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {otherLocalities.map((l) => (
                <Link
                  key={l.slug}
                  href={`/locality/${l.slug}`}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-100"
                >
                  {l.name}
                </Link>
              ))}
            </div>
          </div>

        </div>
      )}

    </main>
  );
}
