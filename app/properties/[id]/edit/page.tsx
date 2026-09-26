"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import LocationPicker from "../../../components/LocationPicker";
import PriceInput, {
  PriceUnit,
  priceUnitToRupees,
  rupeesToPriceUnit,
} from "../../../components/PriceInput";

const MAX_PHOTOS = 15;

type ExistingPhoto = { id: number; url: string };

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();

  const propertyId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");

  // Photos already saved on this listing (loaded from property_media),
  // separate from new ones being added in this edit session.
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "Villa",
    bhk: "",
    area: "",
    facing: "East",
    parking: "",
    road: "",
    lat: "",
    lng: "",
    status: "Available",
  });

  // Price is entered/edited as a plain number plus a Lakh/Crore unit
  // instead of the full rupee figure -- kept separate from `form` since
  // it needs its own two-part change handler.
  const [priceValue, setPriceValue] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("lakh");

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
        bhk: String(data.bhk ?? ""),
        area: data.area ?? "",
        facing: data.facing ?? "East",
        parking: data.parking ?? "",
        road: data.road ?? "",
        lat: String(data.lat ?? ""),
        lng: String(data.lng ?? ""),
        status: data.status ?? "Available",
      });

      const savedPrice = rupeesToPriceUnit(Number(data.price) || 0);
      setPriceValue(savedPrice.valueText);
      setPriceUnit(savedPrice.unit);

      setCurrentVideoUrl(data.video_url ?? null);

      const { data: media } = await supabase
        .from("property_media")
        .select("id, url")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      if (media && media.length > 0) {
        setExistingPhotos(media as ExistingPhoto[]);
      } else if (data.image) {
        // Old listing from before the gallery existed -- fall back to its
        // single cover image so it doesn't look empty.
        setExistingPhotos([{ id: -1, url: data.image }]);
      }

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

  const totalPhotoCount = existingPhotos.length + newImageFiles.length;

  function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);

    if (picked.length === 0) return;

    setNewImageFiles((prev) => {
      const combined = [...prev, ...picked];
      const room = Math.max(0, MAX_PHOTOS - existingPhotos.length);
      return combined.slice(0, room);
    });

    e.target.value = "";
  }

  function removeExistingPhoto(id: number) {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function removeNewPhoto(index: number) {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
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
      !priceValue ||
      !form.lat ||
      !form.lng
    ) {
      setError(
        "Please fill Title, Price, Latitude and Longitude."
      );
      return;
    }

    if (totalPhotoCount > MAX_PHOTOS) {
      setError(`You can have up to ${MAX_PHOTOS} photos.`);
      return;
    }

    setSaving(true);

    // 1) Upload any newly added photos.
    const newImageUrls: string[] = [];

    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];

      setUploadProgress(
        `Uploading photo ${i + 1} of ${newImageFiles.length}...`
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

      newImageUrls.push(data.publicUrl);
    }

    // 2) Handle the video: keep as-is, replace, or remove.
    let videoUrl: string | null = currentVideoUrl;

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
    } else if (removeVideo) {
      videoUrl = null;
    }

    setUploadProgress("Saving listing...");

    // Final gallery order: photos kept from before, then any newly added
    // ones -- the first photo overall becomes the new cover image.
    const finalUrls = [
      ...existingPhotos.map((p) => p.url),
      ...newImageUrls,
    ];

    const coverImage =
      finalUrls[0] || "https://placehold.co/900x600?text=Property";

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        title: form.title.trim(),
        type: form.type,
        price: priceUnitToRupees(priceValue, priceUnit),
        bhk: Number(form.bhk) || 0,
        area: form.area.trim(),
        facing: form.facing,
        parking: form.parking.trim() || "-",
        road: form.road.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        image: coverImage,
        video_url: videoUrl,
        status: form.status,
      })
      .eq("id", propertyId)
      .eq("seller_id", user.id);

    if (updateError) {
      setSaving(false);
      setUploadProgress("");
      setError(updateError.message);
      return;
    }

    // Re-sync the gallery table: clear what was there for this property,
    // then save the final photo list in order. Simpler and safer than
    // trying to diff individual rows.
    await supabase
      .from("property_media")
      .delete()
      .eq("property_id", propertyId);

    if (finalUrls.length > 0) {
      const { error: mediaError } = await supabase
        .from("property_media")
        .insert(
          finalUrls.map((url, index) => ({
            property_id: Number(propertyId),
            url,
            sort_order: index,
          }))
        );

      if (mediaError) {
        console.error("Failed to save photo gallery:", mediaError);
      }
    }

    setSaving(false);
    setUploadProgress("");

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


                  <PriceInput
                    valueText={priceValue}
                    unit={priceUnit}
                    onValueChange={setPriceValue}
                    onUnitChange={setPriceUnit}
                    inputClassName={inputClass}
                    labelClassName={labelClass}
                    required
                  />

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

              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Property photos
              </p>

              <h2 className="mt-1 text-lg font-black text-zinc-900">
                {totalPhotoCount} of {MAX_PHOTOS} photos
              </h2>

              {existingPhotos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {existingPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200"
                    >
                      <img
                        src={photo.url}
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
                        onClick={() => removeExistingPhoto(photo.id)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {newImageFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {newImageFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-emerald-200"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />

                      <span className="absolute left-1 top-1 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        New
                      </span>

                      <button
                        type="button"
                        onClick={() => removeNewPhoto(index)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
                        aria-label={`Remove new photo ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-sm font-semibold text-zinc-700">
                Add more photos
              </p>

              <input
                type="file"
                accept="image/*"
                multiple
                disabled={totalPhotoCount >= MAX_PHOTOS}
                onChange={handlePhotosSelected}
                className="mt-3 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600 disabled:opacity-50"
              />

            </section>


            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

              <h2 className="text-lg font-black text-zinc-900">
                Video tour
              </h2>

              {currentVideoUrl && !removeVideo && !videoFile && (
                <div className="mt-3 space-y-2">
                  <video
                    src={currentVideoUrl}
                    controls
                    className="w-full rounded-xl"
                  />

                  <button
                    type="button"
                    onClick={() => setRemoveVideo(true)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove video
                  </button>
                </div>
              )}

              {removeVideo && (
                <p className="mt-3 text-xs font-semibold text-zinc-500">
                  Video will be removed when you save.{" "}
                  <button
                    type="button"
                    onClick={() => setRemoveVideo(false)}
                    className="text-red-600 hover:underline"
                  >
                    Undo
                  </button>
                </p>
              )}

              <p className="mt-4 text-sm font-semibold text-zinc-700">
                {currentVideoUrl ? "Replace video" : "Add a video tour"}
              </p>

              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  setVideoFile(e.target.files?.[0] ?? null);
                  setRemoveVideo(false);
                }}
                className="mt-3 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-600"
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
                  ? uploadProgress || "Saving..."
                  : "Save Changes"}
              </button>

            </section>

          </aside>

        </form>

      </div>

    </main>
  );
}
