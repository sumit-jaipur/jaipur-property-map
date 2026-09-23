"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import LocationPicker from "../../../components/LocationPicker";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();

  const propertyId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [currentImage, setCurrentImage] = useState("");
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
    status: "Available",
  });

  useEffect(() => {
    async function loadProperty() {
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
        .eq("id", propertyId)
        .eq("seller_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setError(
          "Property not found or you do not have permission to edit it."
        );
        setLoading(false);
        return;
      }

      setForm({
        title: data.title ?? "",
        type: data.type ?? "Villa",
        price: String(data.price ?? ""),
        bhk: String(data.bhk ?? ""),
        area: data.area ?? "",
        facing: data.facing ?? "East",
        parking: data.parking ?? "",
        road: data.road ?? "",
        lat: String(data.lat ?? ""),
        lng: String(data.lng ?? ""),
        status: data.status ?? "Available",
      });

      setCurrentImage(data.image ?? "");
      setLoading(false);
    }

    if (propertyId) {
      loadProperty();
    }
  }, [propertyId, router]);

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
      router.replace("/auth");
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
      currentImage ||
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

    const { error: updateError } = await supabase
      .from("properties")
      .update({
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
        status: form.status,
      })
      .eq("id", propertyId)
      .eq("seller_id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/my-properties");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-red-600" />

          <p className="mt-4 text-sm font-medium text-zinc-500">
            Loading property...
          </p>
        </div>
      </main>
    );
  }

  if (error && !form.title) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-zinc-900">
            Unable to edit property
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => router.push("/my-properties")}
            className="mt-5 rounded-xl bg-zinc-900 px-5 py-2.5 font-semibold text-white"
          >
            Back to My Properties
          </button>
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

          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/logo.png"
                alt="99Bricks"
                className="h-9 w-9 rounded-full object-cover shadow-sm"
              />
              <span className="hidden text-sm font-black text-header-fg sm:block">
                99Bricks
              </span>
            </Link>

            <button
              type="button"
              onClick={() => router.push("/my-properties")}
              className="text-sm font-semibold text-header-fg/70 hover:text-white"
            >
              Back to My Properties
            </button>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
            Edit Listing
          </span>

        </div>
      </div>


      <div className="mx-auto max-w-6xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Property management
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Edit your property
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-500">
            Update your listing details. Important changes may require
            admin approval again.
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

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Details
              </p>

              <h2 className="mt-1 mb-5 text-xl font-black text-zinc-900">
                Basic information
              </h2>


              <div className="space-y-5">

                <div>
                  <label className={labelClass}>
                    Property Title
                  </label>

                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
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
                      <option>Villa</option>
                      <option>Apartment</option>
                      <option>Plot</option>
                      <option>Commercial</option>
                    </select>
                  </div>


                  <div>
                    <label className={labelClass}>
                      Price (INR)
                    </label>

                    <input
                      name="price"
                      type="number"
                      value={form.price}
                      onChange={handleChange}
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
                      value={form.bhk}
                      onChange={handleChange}
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
                      className={inputClass}
                    />
                  </div>

                </div>

              </div>

            </section>


            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <h2 className="mb-5 text-xl font-black text-zinc-900">
                Property features
              </h2>

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
                    className={inputClass}
                  />
                </div>

              </div>

            </section>


            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

              <h2 className="mb-5 text-xl font-black text-zinc-900">
                Location
              </h2>

              <p className="mb-4 -mt-3 text-sm text-zinc-500">
                Click on the map to move the pin, or drag it to the
                exact property location.
              </p>

              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) =>
                  setForm((f) => ({ ...f, lat, lng }))
                }
              />

            </section>

          </div>


          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

              <h2 className="text-lg font-black text-zinc-900">
                Property image
              </h2>

              {currentImage && (
                <img
                  src={currentImage}
                  alt="Current property"
                  className="mt-4 h-44 w-full rounded-2xl object-cover"
                />
              )}

              <p className="mt-4 text-sm font-semibold text-zinc-700">
                Replace image
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setImageFile(
                    e.target.files?.[0] ?? null
                  )
                }
                className="mt-3 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600"
              />

            </section>


            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

              <label className={labelClass}>
                Listing Status
              </label>

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className={inputClass}
              >
                <option>Available</option>
                <option>Sold</option>
                <option>Unavailable</option>
              </select>

            </section>


            <section className="rounded-3xl bg-zinc-900 p-5 text-white shadow-xl">

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">
                Save changes
              </p>

              <h2 className="mt-2 text-xl font-black">
                Update listing
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Important changes may send this property back for
                admin verification.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-3.5 font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </section>

          </aside>

        </form>

      </div>

    </main>
  );
}