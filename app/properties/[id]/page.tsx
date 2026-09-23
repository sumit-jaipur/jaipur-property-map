"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import EmiCalculator from "../../components/EmiCalculator";
import { LOCALITIES } from "../../lib/localities";
import { getAccountTypeLabel } from "../../lib/accountTypes";

function formatPrice(price: number) {
  if (!price) return "";

  if (price >= 10000000) {
    return "INR " + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return "INR " + (price / 100000).toFixed(0) + " Lakh";
  }

  return "INR " + price.toLocaleString("en-IN");
}

export default function PropertyPage() {
  const params = useParams();
  const router = useRouter();

  const [property, setProperty] = useState<any>(null);
  const [listerTypeLabel, setListerTypeLabel] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState(
    "Hi, I am interested in this property."
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadProperty() {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", params.id)
        .single();

      if (!error) {
        setProperty(data);

        if (data.seller_id) {
          const { data: sellerProfile } = await supabase
            .from("profiles")
            .select("account_type")
            .eq("id", data.seller_id)
            .single();

          setListerTypeLabel(
            getAccountTypeLabel(sellerProfile?.account_type)
          );
        }
      }
    }

    loadProperty();
  }, [params.id]);

  async function sendInquiry() {
    setStatus("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { error } = await supabase
      .from("inquiries")
      .insert({
        property_id: property.id,
        buyer_id: user.id,
        message: message,
      });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Inquiry sent successfully.");
  }

  if (!property) {
    return <div className="p-10">Loading...</div>;
  }

  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "";

  const shareText = `${property.title} - ${formatPrice(
    Number(property.price)
  )}\n${pageUrl}`;

  const matchedLocality = LOCALITIES.find((l) => {
    const haystack = `${property.title || ""} ${property.road || ""}`.toLowerCase();
    return haystack.includes(l.name.toLowerCase());
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: `${property.type || ""} in Jaipur${
      property.area ? `, ${property.area}` : ""
    }`,
    url: pageUrl,
    image: property.image || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Jaipur",
      addressRegion: "Rajasthan",
      addressCountry: "IN",
    },
    geo:
      property.lat && property.lng
        ? {
            "@type": "GeoCoordinates",
            latitude: property.lat,
            longitude: property.lng,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      price: property.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="min-h-screen bg-zinc-50">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">

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

      <div className="max-w-4xl mx-auto bg-white rounded-xl border overflow-hidden mt-6 mb-10 sm:mx-auto sm:mt-8 mx-4">

        <img
          src={
            property.image ||
            "https://placehold.co/900x500?text=Property"
          }
          alt={property.title}
          className="w-full h-80 object-cover"
        />

        <div className="p-6">
          <h1 className="text-3xl font-bold">
            {property.title}
          </h1>

          <p className="mt-2 text-zinc-600">
            {property.type} • {property.area}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-xl font-bold text-red-600">
              {formatPrice(Number(property.price))}
            </p>

            {listerTypeLabel && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                Listed by: {listerTypeLabel}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.32a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.26-8.24M8.53 6.9c-.17 0-.45.06-.68.32-.23.25-.9.88-.9 2.15 0 1.27.92 2.5 1.05 2.67.13.17 1.8 2.89 4.45 3.94.62.27 1.1.43 1.48.55.62.2 1.19.17 1.63.1.5-.07 1.53-.62 1.75-1.23.22-.6.22-1.11.15-1.22-.06-.1-.23-.16-.48-.28-.25-.13-1.53-.75-1.77-.84-.24-.09-.4-.13-.58.13-.17.26-.66.84-.81 1-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.28-1.51-1.43-1.77-.15-.26-.02-.4.11-.53.12-.12.26-.3.4-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45C9.42 8.63 8.9 7.32 8.7 6.9c-.14-.3-.3-.3-.46-.3l-.4-.01" />
              </svg>
              Share on WhatsApp
            </a>

            {matchedLocality && (
              <Link
                href={`/locality/${matchedLocality.slug}`}
                className="text-sm font-semibold text-zinc-500 hover:text-accent"
              >
                More listings in {matchedLocality.name} &gt;
              </Link>
            )}
          </div>

          <div className="mt-8 border-t pt-6">

            <h2 className="text-2xl font-bold">
              Contact Seller
            </h2>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border rounded-lg p-3 mt-4"
            />

            <button
              onClick={sendInquiry}
              className="mt-3 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Send Inquiry
            </button>

            {status && (
              <p className="mt-3 font-medium">
                {status}
              </p>
            )}

          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-4 mb-10 sm:mx-auto">
        <EmiCalculator defaultPrice={Number(property.price)} />
      </div>
    </main>
  );
}
