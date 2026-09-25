"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LocationPicker from "../components/LocationPicker";

const MAX_PHOTOS = 15;

export default function AddPropertyPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");

  // Up to 15 photos -- the seller/builder can select several at once from
  // the file picker (or add more in a second pick), plus one optional
  // video tour of the property.
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);

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

  function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);

    if (picked.length === 0) return;

    setImageFiles((prev) => {
      const combined = [...prev, ...picked];
      return combined.slice(0, MAX_PHOTOS);
    });

    // Let the same input be used again to add more photos in a second
    // pick without the browser thinking nothing changed.
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
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

    if (imageFiles.length > MAX_PHOTOS) {
      setError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    setSaving(true);

    // 1) Upload every selected photo, in the order they were added, so
    //    the gallery matches what the seller picked.
    const imageUrls: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];

      setUploadProgress(
        `Uploading photo ${i + 1} of ${imageFiles.length}...`
      );

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const fileName = `${user.id}/${Date.now()}-${i}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(fileName, file);

      if (uploadError) {
        setError(`Photo ${i + 1} failed to upload: ${uploadError.message}`);
        setSaving(false);
        setUploadProgress("");
        return;
      }

      const { data } = supabase.storage
        .from("property-images")
        .getPublicUrl(fileName);

      imageUrls.push(data.publicUrl);
    }

    // 2) Upload the video tour, if one was picked.
    let videoUrl: string | null = null;

    if (videoFile) {
      setUploadProgress("Uploading video tour...");

      const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const fileName = `${user.id}/videos/${Date.now()}-${safeName}`;

      const { error: videoUploadError } = await supabase.storage
        .from("property-images")
        .upload(fileName, videoFile);

      if (videoUploadError) {
        setError(`Video upload failed: ${videoUploadError.message}`);
        setSaving(false);
        setUploadProgress("");
        return;
      }

      const { data } = supabase.storage
        .from("property-images")
        .getPublicUrl(fileName);

      videoUrl = data.publicUrl;
    }

    setUploadProgress("Saving listing...");

    const coverImage =
      imageUrls[0] || "https://placehold.co/900x600?text=Property";

    const { data: inserted, error: insertError } = await supabase
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
        image: coverImage,
        video_url: videoUrl,
        status: "Available",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setSaving(false);
      setUploadProgress("");
      setError(insertError?.message || "Failed to save listing.");
      return;
    }

    // 3) Save the full photo gallery (cover photo included, so the
    //    gallery order matches exactly what was uploaded).
    if (imageUrls.length > 0) {
      const { error: mediaError } = await supabase
        .from("property_media")
        .insert(
          imageUrls.map((url, index) => ({
            property_id: inserted.id,
            url,
            sort_order: index,
          }))
        );

      if (mediaError) {
        // The listing itself was created fine -- the cover photo is
        // already saved on it -- so don't block the seller on this, just
        // surface it.
        console.error("Failed to save photo gallery:", mediaError);
      }
    }

    setSaving(false);
    setUploadProgress("");

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
                Property photos
              </p>

              <h2 className="mt-1 text-lg font-black text-zinc-900">
                Add up to {MAX_PHOTOS} photos
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                The first photo becomes the cover image shown on listing
                cards. Select several at once, or add more in a second
                pick.
              </p>

              <div className="mt-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                  📷
                </div>

                <p className="mt-3 text-sm font-semibold text-zinc-700">
                  Choose property photos
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  JPG, PNG or WebP · up to {MAX_PHOTOS} photos
                </p>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={imageFiles.length >= MAX_PHOTOS}
                  onChange={handlePhotosSelected}
                  className="mt-4 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600 disabled:opacity-50"
                />

              </div>

              {imageFiles.length > 0 && (
                <>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-700">
                      {imageFiles.length} photo
                      {imageFiles.length === 1 ? "" : "s"} selected
                    </p>

                    <p className="text-xs text-zinc-400">
                      {MAX_PHOTOS - imageFiles.length} remaining
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {imageFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Photo ${index + 1}`}
                          className="h-full w-full object-cover"
                        />

                        {index === 0 && (
                          <span className="absolute left-1 top-1 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Cover
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </section>


            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Optional
              </p>

              <h2 className="mt-1 text-lg font-black text-zinc-900">
                Video tour
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                A short walkthrough video helps buyers get a feel for the
                property before scheduling a visit.
              </p>

              <input
                type="file"
                accept="video/*"
                onChange={(e) =>
                  setVideoFile(e.target.files?.[0] ?? null)
                }
                className="mt-4 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600"
              />

              {videoFile && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <span className="truncate">{videoFile.name}</span>

                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    className="ml-2 shrink-0 text-emerald-700/70 hover:text-emerald-900"
                  >
                    Remove
                  </button>
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
                  ? uploadProgress || "Publishing..."
                  : "Submit Property"}
              </button>

            </section>

          </aside>

        </form>

      </div>
    </main>
  );
}
