"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Property = {
  id: number;
  title: string;
  image: string | null;
};

type InquiryRow = {
  id: number;
  property_id: number;
  message: string;
  created_at: string;
  properties: Property | null;
};

export default function MyInquiriesPage() {
  const router = useRouter();

  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInquiries() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("inquiries")
        .select(`
          id,
          property_id,
          message,
          created_at,
          properties (
            id,
            title,
            image
          )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setInquiries((data ?? []) as unknown as InquiryRow[]);
      }

      setLoading(false);
    }

    loadInquiries();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading inquiries...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">

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
            {inquiries.length} Sent
          </span>

        </div>
      </div>


      <div className="mx-auto max-w-5xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Buyer Messages
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            My Inquiries
          </h1>

          <p className="mt-2 text-zinc-500">
            Review the messages you have sent to property sellers.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {!error && inquiries.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
              💬
            </div>

            <h2 className="mt-4 text-xl font-black text-zinc-900">
              No inquiries yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Open a property and contact the seller to start a conversation.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              Browse Properties
            </Link>

          </div>
        )}


        <div className="space-y-4">

          {inquiries.map((inquiry) => (
            <article
              key={inquiry.id}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >

              <div className="flex flex-col gap-4 sm:flex-row">

                {inquiry.properties?.image ? (
                  <img
                    src={inquiry.properties.image}
                    alt={inquiry.properties.title}
                    className="h-36 w-full rounded-2xl object-cover sm:h-28 sm:w-36"
                  />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center rounded-2xl bg-zinc-100 text-2xl sm:w-36">
                    🏠
                  </div>
                )}


                <div className="min-w-0 flex-1">

                  <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                    Inquiry sent for
                  </p>

                  <h2 className="mt-1 truncate text-lg font-black text-zinc-900">
                    {inquiry.properties?.title || "Property"}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(inquiry.created_at).toLocaleString()}
                  </p>


                  <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3">
                    <p className="text-sm leading-6 text-zinc-700">
                      {inquiry.message}
                    </p>
                  </div>


                  <Link
                    href={`/properties/${inquiry.property_id}`}
                    className="mt-4 inline-block rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
                  >
                    View Property
                  </Link>

                </div>

              </div>

            </article>
          ))}

        </div>

      </div>

    </main>
  );
}