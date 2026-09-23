"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LocationPicker from "../components/LocationPicker";

export default function AddPropertyPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: "",
    type: "Villa",
    price: "",
    bhk: "",
    area: "",
    facing: "East",
    parking: "",
    road: "",
    lat: "",
    lng: "",
  });

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      setCheckingAuth(false);
    }

    checkAuth();
  }, [router]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    if (
      !form.title.trim() ||
      !form.price ||
      !form.lat ||
      !form.lng
    ) {
      setError(
        "Please fill Title, Price, Latitude and Longitude."
      );
      return;
    }

    setSaving(true);

    let imageUrl =
      "https://placehold.co/900x600?text=Property";

    if (imageFile) {
      const safeName = imageFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

      const fileName =
        `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from("property-images")
          .upload(fileName, imageFile);

      if (uploadError) {
        setError(
          "Image upload failed: " +
            uploadError.message
        );
        setSaving(false);
        return;
      }

      const { data } = supabase.storage
        .from("property-images")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    const { error: insertError } = await supabase
      .from("properties")
      .insert({
        seller_id: user.id,
        title: form.title.trim(),
        type: form.type,
        price: Number(form.price),
        bhk: Number(form.bhk) || 0,
        area: form.area.trim(),
        facing: form.facing,
        parking: form.parking.trim() || "-",
        road: form.road.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        image: imageUrl,
        status: "Available",
      });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/my-properties");
    router.refresh();
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-zinc-200 border-t-red-600 animate-spin" />

          <p className="mt-4 text-sm font-medium text-zinc-500">
            Preparing listing form...
          </p>
        </div>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-50";

  const labelClass =
    "mb-2 block text-sm font-bold text-zinc-700";

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

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
            Seller Listing
          </span>

        </div>
      </div>


      <div className="mx-auto max-w-6xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            List your property
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Create a new property listing
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-500">
            Add accurate property details and location information.
            New listings will be reviewed before becoming publicly visible.
          </p>
        </div>


        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        >

          <div className="space-y-6">

            {/* BASIC DETAILS */}

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                  Step 1
                </p>

                <h2 className="mt-1 text-xl font-black text-zinc-900">
                  Basic information
                </h2>
              </div>

              <div className="space-y-5">

                <div>
                  <label className={labelClass}>
                    Property Title *
                  </label>

                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Example: Luxury Villa in Vaishali Nagar"
                    className={inputClass}
                    required
                  />
                </div>


                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className={labelClass}>
                      Property Type
                    </label>

                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="Villa">Villa</option>
                      <option value="Apartment">
                        Apartment
                      </option>
                      <option value="Plot">Plot</option>
                      <option value="Commercial">
                        Commercial
                      </option>
                    </select>
                  </div>


                  <div>
                    <label className={labelClass}>
                      Price (INR) *
                    </label>

                    <input
                      name="price"
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="Example: 8500000"
                      className={inputClass}
                      required
                    />
                  </div>

                </div>


                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className={labelClass}>
                      BHK
                    </label>

                    <input
                      name="bhk"
                      type="number"
                      min="0"
                      value={form.bhk}
                      onChange={handleChange}
                      placeholder="Example: 3"
                      className={inputClass}
                    />
                  </div>


                  <div>
                    <label className={labelClass}>
                      Area
                    </label>

                    <input
                      name="area"
                      value={form.area}
                      onChange={handleChange}
                      placeholder="Example: 2200 sq ft"
                      className={inputClass}
                    />
                  </div>

                </div>

              </div>

            </section>


            {/* FEATURES */}

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                  Step 2
                </p>

                <h2 className="mt-1 text-xl font-black text-zinc-900">
                  Property features
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">

                <div>
                  <label className={labelClass}>
                    Facing
                  </label>

                  <select
                    name="facing"
                    value={form.facing}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option>East</option>
                    <option>West</option>
                    <option>North</option>
                    <option>South</option>
                  </select>
                </div>


                <div>
                  <label className={labelClass}>
                    Parking
                  </label>

                  <input
                    name="parking"
                    value={form.parking}
                    onChange={handleChange}
                    placeholder="Example: 2 Cars"
                    className={inputClass}
                  />
                </div>


                <div>
                  <label className={labelClass}>
                    Road Width
                  </label>

                  <input
                    name="road"
                    value={form.road}
                    onChange={handleChange}
                    placeholder="Example: 40 ft"
                    className={inputClass}
                  />
                </div>

              </div>

            </section>


            {/* LOCATION */}

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                  Step 3
                </p>

                <h2 className="mt-1 text-xl font-black text-zinc-900">
                  Map location
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Click on the map to drop a pin at the exact
                  property location, or drag the pin to adjust it.
                </p>
              </div>

              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) =>
                  setForm((f) => ({ ...f, lat, lng }))
                }
              />

            </section>

          </div>


          {/* RIGHT PANEL */}

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Property photo
              </p>

              <h2 className="mt-1 text-lg font-black text-zinc-900">
                Add a cover image
              </h2>

              <div className="mt-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                  📷
                </div>

                <p className="mt-3 text-sm font-semibold text-zinc-700">
                  Choose property image
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  JPG, PNG or WebP
                </p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageFile(
                      e.target.files?.[0] ?? null
                    )
                  }
                  className="mt-4 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600"
                />

              </div>

              {imageFile && (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  Selected: {imageFile.name}
                </div>
              )}

            </section>


            <section className="rounded-3xl bg-zinc-900 p-5 text-white shadow-xl">

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">
                Ready to list?
              </p>

              <h2 className="mt-2 text-xl font-black">
                Publish your property
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Your listing will be submitted for admin
                verification before it appears publicly.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-3.5 font-bold text-white shadow-lg transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Publishing..."
                  : "Submit Property"}
              </button>

            </section>

          </aside>

        </form>

      </div>
    </main>
  );
}