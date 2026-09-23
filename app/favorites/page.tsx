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
  image: string | null;
  status: string;
};

type FavoriteRow = {
  property_id: number;
  properties: Property | null;
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

export default function FavoritesPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("favorites")
        .select(`
          property_id,
          properties (
            id,
            title,
            type,
            price,
            bhk,
            area,
            facing,
            parking,
            road,
            image,
            status
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as FavoriteRow[];

      setProperties(
        rows
          .map((row) => row.properties)
          .filter(
            (property): property is Property =>
              property !== null
          )
      );

      setLoading(false);
    }

    loadFavorites();
  }, [router]);

  async function removeFavorite(propertyId: number) {
    setRemovingId(propertyId);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);

    setRemovingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setProperties((current) =>
      current.filter(
        (property) => property.id !== propertyId
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />

          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading favorites...
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

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
            {properties.length} Saved
          </span>

        </div>
      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Your shortlist
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            My Favorites
          </h1>

          <p className="mt-2 text-zinc-500">
            Keep track of properties you are interested in.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {!error && properties.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
              ♡
            </div>

            <h2 className="mt-4 text-xl font-black text-zinc-900">
              No saved properties yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Tap the heart on any property to save it here.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              Explore Properties
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

                <Link href={`/properties/${property.id}`}>
                  <img
                    src={
                      property.image ||
                      "https://placehold.co/600x400?text=Property"
                    }
                    alt={property.title}
                    className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    removeFavorite(property.id)
                  }
                  disabled={removingId === property.id}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-lg shadow-lg transition hover:scale-110 disabled:opacity-50"
                  title="Remove favorite"
                >
                  {removingId === property.id ? "..." : "❤️"}
                </button>

                <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-zinc-800">
                  {property.type}
                </span>

              </div>


              <div className="p-5">

                <Link href={`/properties/${property.id}`}>
                  <h2 className="truncate text-lg font-black text-zinc-900 transition hover:text-red-600">
                    {property.title}
                  </h2>
                </Link>

                <p className="mt-1 text-sm text-zinc-500">
                  {property.area || "Jaipur"}
                </p>

                <p className="mt-3 text-xl font-black text-red-600">
                  {formatPrice(property.price)}
                </p>


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


                <div className="mt-5 grid grid-cols-2 gap-2">

                  <Link
                    href={`/properties/${property.id}`}
                    className="rounded-xl bg-zinc-900 px-3 py-2.5 text-center text-sm font-bold text-white transition hover:bg-zinc-800"
                  >
                    View Property
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      removeFavorite(property.id)
                    }
                    disabled={removingId === property.id}
                    className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {removingId === property.id
                      ? "Removing..."
                      : "Remove"}
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