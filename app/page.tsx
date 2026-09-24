"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";
import PropertyMap from "./components/PropertyMap";
import AuthButton from "./components/AuthButton";
import {
  SavedSearchFilters,
  defaultSearchName,
} from "./lib/savedSearch";

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
  lat: number;
  lng: number;
  image: string;
  status: string;
  verification_status?: string;
  is_featured?: boolean;
};

type SearchLocation = {
  lat: number;
  lng: number;
};

type LocationSuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  featureType: string;
};

type MapboxFeature = {
  id?: string;

  geometry?: {
    coordinates?: number[];
  };

  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
  };
};

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function formatPrice(price: number) {
  if (price >= 10000000) {
    return (
      "INR " +
      (price / 10000000).toFixed(2) +
      " Cr"
    );
  }

  if (price >= 100000) {
    return (
      "INR " +
      (price / 100000).toFixed(0) +
      " Lakh"
    );
  }

  return (
    "INR " +
    price.toLocaleString("en-IN")
  );
}

function getRoadWidth(road: string) {
  const value = parseFloat(road);

  return Number.isNaN(value)
    ? 0
    : value;
}

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const earthRadius = 6371;

  const toRadians = (
    degrees: number
  ) => degrees * (Math.PI / 180);

  const latDifference =
    toRadians(lat2 - lat1);

  const lngDifference =
    toRadians(lng2 - lng1);

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(lngDifference / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function locationPriority(
  type: string
) {
  if (type === "neighborhood") {
    return 1;
  }

  if (type === "locality") {
    return 2;
  }

  if (type === "place") {
    return 3;
  }

  if (type === "street") {
    return 4;
  }

  if (type === "address") {
    return 5;
  }

  return 10;
}

export default function Home() {
  const router = useRouter();

  const [
    properties,
    setProperties,
  ] = useState<Property[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    userId,
    setUserId,
  ] = useState<string | null>(null);

  const [
    favoriteIds,
    setFavoriteIds,
  ] = useState<number[]>([]);

  const [
    favoriteLoading,
    setFavoriteLoading,
  ] = useState<number | null>(null);

  const [
    compareIds,
    setCompareIds,
  ] = useState<number[]>([]);

  const [
    propertyType,
    setPropertyType,
  ] = useState("All");

  const [
    bhk,
    setBhk,
  ] = useState("Any");

  const [
    minPrice,
    setMinPrice,
  ] = useState("");

  const [
    maxPrice,
    setMaxPrice,
  ] = useState("");

  const [
    showMoreFilters,
    setShowMoreFilters,
  ] = useState(false);

  const [
    facing,
    setFacing,
  ] = useState("Any");

  const [
    parking,
    setParking,
  ] = useState("Any");

  const [
    minRoadWidth,
    setMinRoadWidth,
  ] = useState("");

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    searchLocation,
    setSearchLocation,
  ] = useState<SearchLocation | null>(
    null
  );

  const [
    suggestions,
    setSuggestions,
  ] = useState<
    LocationSuggestion[]
  >([]);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    searchRadiusKm,
    setSearchRadiusKm,
  ] = useState(5);

  const [
    locatingMe,
    setLocatingMe,
  ] = useState(false);

  const [
    sheetExpanded,
    setSheetExpanded,
  ] = useState(false);

  const [
    highlightedId,
    setHighlightedId,
  ] = useState<number | null>(null);

  const [
    saveSearchOpen,
    setSaveSearchOpen,
  ] = useState(false);

  const [
    saveSearchName,
    setSaveSearchName,
  ] = useState("");

  const [
    savingSearch,
    setSavingSearch,
  ] = useState(false);

  const [
    saveSearchMessage,
    setSaveSearchMessage,
  ] = useState("");

  const dragStartY = useRef<number | null>(null);

  const sheetRef = useRef<HTMLElement | null>(null);

  function handleSheetDragStart(
    e: React.TouchEvent
  ) {
    dragStartY.current = e.touches[0].clientY;
  }

  function handleSheetDragEnd(
    e: React.TouchEvent
  ) {
    if (dragStartY.current === null) return;

    const deltaY =
      e.changedTouches[0].clientY -
      dragStartY.current;

    dragStartY.current = null;

    // A real swipe: handle it here and stop the browser's
    // trailing synthetic "click" from firing too, which was
    // undoing the drag by toggling the state right back.
    if (Math.abs(deltaY) > 10) {
      e.preventDefault();

      if (deltaY < -30) {
        setSheetExpanded(true);
      } else if (deltaY > 30) {
        setSheetExpanded(false);
      }
    }
  }

  function handleSelectFromMap(
    propertyId: number
  ) {
    setSheetExpanded(true);
    setHighlightedId(propertyId);

    setTimeout(() => {
      document
        .getElementById(
          `property-card-${propertyId}`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 150);

    setTimeout(() => {
      setHighlightedId((current) =>
        current === propertyId ? null : current
      );
    }, 2500);
  }


  // LOAD PROPERTIES

  useEffect(() => {
    async function loadProperties() {
      const {
        data,
        error,
      } = await supabase
        .from("properties")
        .select("*")
        .eq("verification_status", "approved")
        .eq("status", "Available")
        // Featured listings (is_featured, toggled from /admin/properties)
        // rise to the top of every list; newest-first within each group.
        .order("is_featured", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        });

      if (error) {
        console.error(error);
      } else {
        setProperties(
          (data ?? []) as Property[]
        );
      }

      setLoading(false);
    }

    loadProperties();
  }, []);


  // LOAD ACCOUNT AND FAVORITES

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserId(null);
        setFavoriteIds([]);
        return;
      }

      setUserId(user.id);

      const { data } =
        await supabase
          .from("favorites")
          .select("property_id")
          .eq(
            "user_id",
            user.id
          );

      setFavoriteIds(
        (data ?? []).map(
          (item) =>
            Number(
              item.property_id
            )
        )
      );
    }

    loadAccount();

    const { data } =
      supabase.auth.onAuthStateChange(
        () => {
          loadAccount();
        }
      );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);


  // FAVORITES

  async function toggleFavorite(
    propertyId: number
  ) {
    if (!userId) {
      router.push("/auth");
      return;
    }

    setFavoriteLoading(
      propertyId
    );

    const isFavorite =
      favoriteIds.includes(
        propertyId
      );

    if (isFavorite) {
      const { error } =
        await supabase
          .from("favorites")
          .delete()
          .eq(
            "user_id",
            userId
          )
          .eq(
            "property_id",
            propertyId
          );

      if (!error) {
        setFavoriteIds(
          (current) =>
            current.filter(
              (id) =>
                id !== propertyId
            )
        );
      }
    } else {
      const { error } =
        await supabase
          .from("favorites")
          .insert({
            user_id: userId,
            property_id:
              propertyId,
          });

      if (!error) {
        setFavoriteIds(
          (current) => [
            ...current,
            propertyId,
          ]
        );
      }
    }

    setFavoriteLoading(null);
  }


  // COMPARE

  function toggleCompare(propertyId: number) {
    setCompareIds((current) => {
      if (current.includes(propertyId)) {
        return current.filter(
          (id) => id !== propertyId
        );
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, propertyId];
    });
  }


  // LOCATION AUTOCOMPLETE

  useEffect(() => {
    const text =
      searchText.trim();

    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!MAPBOX_TOKEN) {
      return;
    }

    const controller =
      new AbortController();

    const timer = setTimeout(
      async () => {
        try {
          const url =
            "https://api.mapbox.com/search/geocode/v6/forward" +
            `?q=${encodeURIComponent(
              text
            )}` +
            "&country=IN" +
            "&bbox=75.65,26.75,76.05,27.10" +
            "&proximity=75.7873,26.9124" +
            "&types=neighborhood,locality,place,street,address" +
            "&limit=10" +
            "&autocomplete=true" +
            "&language=en" +
            `&access_token=${MAPBOX_TOKEN}`;

          const response =
            await fetch(url, {
              signal:
                controller.signal,
            });

          if (!response.ok) {
            return;
          }

          const data =
            await response.json();

          const features:
            MapboxFeature[] =
            data.features ?? [];

          const typed =
            text.toLowerCase();

          const results =
            features
              .map(
                (
                  feature
                ):
                  | LocationSuggestion
                  | null => {
                  const coordinates =
                    feature
                      .geometry
                      ?.coordinates;

                  if (
                    !coordinates ||
                    coordinates.length <
                      2
                  ) {
                    return null;
                  }

                  const info =
                    feature.properties ??
                    {};

                  const label =
                    info.full_address ||
                    [
                      info.name,
                      info.place_formatted,
                    ]
                      .filter(Boolean)
                      .join(", ");

                  if (!label) {
                    return null;
                  }

                  return {
                    id:
                      info.mapbox_id ||
                      feature.id ||
                      `${coordinates[1]}-${coordinates[0]}`,

                    label,

                    lat:
                      coordinates[1],

                    lng:
                      coordinates[0],

                    featureType:
                      info.feature_type ||
                      "",
                  };
                }
              )
              .filter(
                (
                  item
                ): item is LocationSuggestion =>
                  item !== null
              );

          results.sort(
            (a, b) => {
              const aLabel =
                a.label.toLowerCase();

              const bLabel =
                b.label.toLowerCase();

              const aStarts =
                aLabel.startsWith(
                  typed
                );

              const bStarts =
                bLabel.startsWith(
                  typed
                );

              if (
                aStarts &&
                !bStarts
              ) {
                return -1;
              }

              if (
                !aStarts &&
                bStarts
              ) {
                return 1;
              }

              return (
                locationPriority(
                  a.featureType
                ) -
                locationPriority(
                  b.featureType
                )
              );
            }
          );

          setSuggestions(
            results.slice(0, 6)
          );
        } catch (error) {
          if (
            error instanceof
              Error &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Location autocomplete error:",
            error
          );
        }
      },
      400
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);


  function selectSuggestion(
    suggestion: LocationSuggestion
  ) {
    setSearchText(
      suggestion.label
    );

    setSearchLocation({
      lat: suggestion.lat,
      lng: suggestion.lng,
    });

    setSuggestions([]);
    setSearchError("");
  }


  function handleNearMe() {
    if (!navigator.geolocation) {
      setSearchError(
        "Location isn't supported on this device."
      );
      return;
    }

    setLocatingMe(true);
    setSearchError("");
    setSuggestions([]);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setSearchText("Near me");
        setLocatingMe(false);
      },
      () => {
        setSearchError(
          "Couldn't get your location. Please allow location access, or search a locality instead."
        );
        setLocatingMe(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }


  // LOCATION SEARCH

  async function handleLocationSearch(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const text =
      searchText.trim();

    if (!text) {
      setSearchError(
        "Enter a Jaipur location."
      );
      return;
    }

    if (!MAPBOX_TOKEN) {
      setSearchError(
        "Mapbox token is missing."
      );
      return;
    }

    setSearching(true);
    setSearchError("");
    setSuggestions([]);

    try {
      const url =
        "https://api.mapbox.com/search/geocode/v6/forward" +
        `?q=${encodeURIComponent(
          `${text}, Jaipur`
        )}` +
        "&country=IN" +
        "&bbox=75.65,26.75,76.05,27.10" +
        "&proximity=75.7873,26.9124" +
        "&limit=1" +
        "&autocomplete=false" +
        "&language=en" +
        `&access_token=${MAPBOX_TOKEN}`;

      const response =
        await fetch(url);

      const data =
        await response.json();

      const coordinates =
        data.features?.[0]
          ?.geometry
          ?.coordinates;

      if (!coordinates) {
        setSearchError(
          "Location not found in Jaipur."
        );
        return;
      }

      setSearchLocation({
        lat: coordinates[1],
        lng: coordinates[0],
      });
    } catch {
      setSearchError(
        "Unable to search location."
      );
    } finally {
      setSearching(false);
    }
  }


  // FILTER PROPERTIES

  const filteredProperties =
    properties.filter(
      (property) => {
        const matchesType =
          propertyType ===
            "All" ||
          property.type ===
            propertyType;

        const matchesBhk =
          bhk === "Any" ||
          (bhk === "2" &&
            property.bhk === 2) ||
          (bhk === "3" &&
            property.bhk === 3) ||
          (bhk === "4+" &&
            property.bhk >= 4);

        const matchesMinPrice =
          !minPrice ||
          property.price >=
            Number(minPrice);

        const matchesMaxPrice =
          !maxPrice ||
          property.price <=
            Number(maxPrice);

        const matchesFacing =
          facing === "Any" ||
          property.facing
            ?.toLowerCase() ===
            facing.toLowerCase();

        const hasParking =
          Boolean(
            property.parking
          ) &&
          property.parking !==
            "-" &&
          property.parking !==
            "0" &&
          property.parking
            ?.toLowerCase() !==
            "no";

        const matchesParking =
          parking === "Any" ||
          (parking === "Yes" &&
            hasParking) ||
          (parking === "No" &&
            !hasParking);

        const matchesRoad =
          !minRoadWidth ||
          getRoadWidth(
            property.road
          ) >=
            Number(
              minRoadWidth
            );

        let matchesLocation =
          true;

        if (searchLocation) {
          const distance =
            getDistanceKm(
              searchLocation.lat,
              searchLocation.lng,
              property.lat,
              property.lng
            );

          matchesLocation =
            distance <=
            searchRadiusKm;
        }

        return (
          matchesType &&
          matchesBhk &&
          matchesMinPrice &&
          matchesMaxPrice &&
          matchesFacing &&
          matchesParking &&
          matchesRoad &&
          matchesLocation
        );
      }
    );


  const activeFilterCount =
    [
      propertyType !== "All",
      bhk !== "Any",
      Boolean(minPrice),
      Boolean(maxPrice),
      facing !== "Any",
      parking !== "Any",
      Boolean(minRoadWidth),
    ].filter(Boolean).length;


  function clearFilters() {
    setPropertyType("All");
    setBhk("Any");
    setMinPrice("");
    setMaxPrice("");
    setFacing("Any");
    setParking("Any");
    setMinRoadWidth("");
  }


  function clearLocation() {
    setSearchText("");
    setSearchLocation(null);
    setSuggestions([]);
    setSearchError("");
  }


  // SAVED SEARCHES

  function currentFilters(): SavedSearchFilters {
    return {
      propertyType,
      bhk,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      facing,
      parking,
      minRoadWidth: minRoadWidth ? Number(minRoadWidth) : null,
      location: searchLocation
        ? {
            lat: searchLocation.lat,
            lng: searchLocation.lng,
            label: searchText || "your search area",
          }
        : null,
      radiusKm: searchRadiusKm,
    };
  }

  function openSaveSearch() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    setSaveSearchMessage("");
    setSaveSearchName(defaultSearchName(currentFilters()));
    setSaveSearchOpen(true);
  }

  async function handleSaveSearch() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    const name = saveSearchName.trim();

    if (!name) {
      setSaveSearchMessage("Give this search a name.");
      return;
    }

    setSavingSearch(true);
    setSaveSearchMessage("");

    const { error } = await supabase.from("saved_searches").insert({
      user_id: userId,
      name,
      filters: currentFilters(),
    });

    setSavingSearch(false);

    if (error) {
      setSaveSearchMessage(error.message);
      return;
    }

    setSaveSearchMessage(
      "Saved! We'll alert you when a matching listing is approved."
    );

    setTimeout(() => {
      setSaveSearchOpen(false);
      setSaveSearchMessage("");
    }, 2500);
  }


  return (
    <div className="min-h-screen bg-zinc-50">

      {/* HEADER */}

      <header className="sticky top-0 z-50 bg-header-bg text-header-fg shadow-md">

        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 lg:px-6">

          <Link
            href="/"
            className="shrink-0"
          >
            <div className="flex items-center gap-2.5">

              <img
                src="/logo.png"
                alt="99Bricks"
                className="h-10 w-10 shrink-0 rounded-full object-cover shadow-md"
              />

              <div className="hidden sm:block">

                <p className="text-base font-black leading-tight text-header-fg">
                  99Bricks
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Find Your Dream Home
                </p>

              </div>

            </div>
          </Link>


          {/* SEARCH */}

          <div className="relative mx-auto flex-1 max-w-2xl">

            <form
              onSubmit={
                handleLocationSearch
              }
              className="flex rounded-2xl border border-white/15 bg-white/10 p-1 shadow-sm transition focus-within:border-accent/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/15"
            >

              <div className="flex flex-1 items-center px-3">

                <input
                  value={searchText}
                  onChange={(e) =>
                    setSearchText(
                      e.target.value
                    )
                  }
                  placeholder="Search Malviya Nagar, Vaishali Nagar..."
                  autoComplete="off"
                  className="w-full bg-transparent py-2 text-sm text-header-fg outline-none placeholder:text-header-fg/50 focus:text-zinc-900"
                />

              </div>

              <button
                type="button"
                onClick={handleNearMe}
                disabled={locatingMe}
                title="Use my current location"
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-header-fg/70 transition hover:bg-white/15 hover:text-header-fg disabled:opacity-50"
              >
                {locatingMe ? (
                  <span className="text-[10px] font-bold">
                    ...
                  </span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4.5 w-4.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M12 2v3M12 19v3M2 12h3M19 12h3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>

              <button
                type="submit"
                disabled={searching}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {searching
                  ? "Searching..."
                  : "Search"}
              </button>

            </form>


            {suggestions.length >
              0 && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">

                {suggestions.map(
                  (suggestion) => (
                    <button
                      key={
                        suggestion.id
                      }
                      type="button"
                      onClick={() =>
                        selectSuggestion(
                          suggestion
                        )
                      }
                      className="flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition last:border-0 hover:bg-accent-soft"
                    >

                      <div className="min-w-0">

                        <p className="text-sm font-semibold text-zinc-900">
                          {
                            suggestion.label
                          }
                        </p>

                        <p className="mt-0.5 text-xs capitalize text-zinc-400">
                          {suggestion.featureType ||
                            "Location"}
                        </p>

                      </div>

                    </button>
                  )
                )}

              </div>
            )}

          </div>


          <div className="flex shrink-0 items-center gap-2">

            <Link
              href="/blog"
              className="hidden rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-header-fg transition hover:bg-white/20 md:block"
            >
              Blog
            </Link>

            <Link
              href="/ai-advisor"
              className="hidden rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 md:block"
            >
              Ask AI Advisor
            </Link>

            <Link
              href="/add-property"
              className="hidden rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-header-fg transition hover:bg-white/20 md:block"
            >
              + List Property
            </Link>

            <AuthButton />

          </div>

        </div>

      </header>


      {/* FILTERS */}

      <div className="relative z-20 border-b border-zinc-200 bg-white">

        <div className="mx-auto max-w-[1600px] px-4 py-3 lg:px-6">

          <div className="flex items-center gap-2 overflow-x-auto pb-1">

            <div className="flex shrink-0 gap-1 rounded-xl bg-zinc-100 p-1">
              {[
                "All",
                "Villa",
                "Apartment",
                "Plot",
                "Commercial",
              ].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setPropertyType(type)
                  }
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    propertyType === type
                      ? "bg-accent text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>


            <div className="flex shrink-0 gap-1 rounded-xl bg-zinc-100 p-1">
              {[
                { value: "Any", label: "Any BHK" },
                { value: "2", label: "2 BHK" },
                { value: "3", label: "3 BHK" },
                { value: "4+", label: "4+ BHK" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setBhk(option.value)
                  }
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    bhk === option.value
                      ? "bg-accent text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>


            <input
              type="number"
              value={minPrice}
              onChange={(e) =>
                setMinPrice(
                  e.target.value
                )
              }
              placeholder="Min Price"
              className="w-28 shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none"
            />


            <input
              type="number"
              value={maxPrice}
              onChange={(e) =>
                setMaxPrice(
                  e.target.value
                )
              }
              placeholder="Max Price"
              className="w-28 shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none"
            />


            {searchLocation && (
              <select
                value={
                  searchRadiusKm
                }
                onChange={(e) =>
                  setSearchRadiusKm(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              >
                <option value={2}>
                  2 km radius
                </option>

                <option value={5}>
                  5 km radius
                </option>

                <option value={10}>
                  10 km radius
                </option>

                <option value={20}>
                  20 km radius
                </option>
              </select>
            )}


            <button
              type="button"
              onClick={() =>
                setShowMoreFilters(
                  (current) =>
                    !current
                )
              }
              className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                showMoreFilters ||
                activeFilterCount >
                  0
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              Filters
              {activeFilterCount >
                0 &&
                ` (${activeFilterCount})`}
            </button>


            {activeFilterCount >
              0 && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="shrink-0 px-2 py-2 text-sm font-semibold text-red-600"
              >
                Clear
              </button>
            )}


            <button
              type="button"
              onClick={openSaveSearch}
              className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-accent/40 hover:text-accent"
            >
              🔔 Save Search
            </button>

          </div>


          {saveSearchOpen && (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4 sm:flex-row sm:items-center">

              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Alert name
                </label>

                <input
                  value={saveSearchName}
                  onChange={(e) =>
                    setSaveSearchName(e.target.value)
                  }
                  placeholder="Example: 3 BHK in Vaishali Nagar"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  disabled={savingSearch}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingSearch ? "Saving..." : "Save & Get Alerts"}
                </button>

                <button
                  type="button"
                  onClick={() => setSaveSearchOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-500"
                >
                  Cancel
                </button>
              </div>

              {saveSearchMessage && (
                <p className="text-sm font-medium text-accent sm:basis-full">
                  {saveSearchMessage}
                </p>
              )}

            </div>
          )}


          {showMoreFilters && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">

              <div>

                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Facing
                </label>

                <select
                  value={facing}
                  onChange={(e) =>
                    setFacing(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="Any">
                    Any Facing
                  </option>

                  <option value="East">
                    East
                  </option>

                  <option value="West">
                    West
                  </option>

                  <option value="North">
                    North
                  </option>

                  <option value="South">
                    South
                  </option>
                </select>

              </div>


              <div>

                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Parking
                </label>

                <select
                  value={parking}
                  onChange={(e) =>
                    setParking(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="Any">
                    Any Parking
                  </option>

                  <option value="Yes">
                    Parking Available
                  </option>

                  <option value="No">
                    No Parking
                  </option>
                </select>

              </div>


              <div>

                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Minimum Road Width
                </label>

                <input
                  type="number"
                  value={
                    minRoadWidth
                  }
                  onChange={(e) =>
                    setMinRoadWidth(
                      e.target.value
                    )
                  }
                  placeholder="Example: 30"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
                />

              </div>

            </div>
          )}


          {searchLocation && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-2.5">

              <p className="truncate text-sm font-medium text-red-700">
                Showing properties near{" "}
                <span className="font-bold">
                  {searchText}
                </span>
              </p>

              <button
                type="button"
                onClick={
                  clearLocation
                }
                className="shrink-0 text-xs font-bold text-red-600"
              >
                Remove location
              </button>

            </div>
          )}


          {searchError && (
            <p className="mt-2 text-sm font-medium text-red-600">
              {searchError}
            </p>
          )}

        </div>

      </div>


      {/* LIST AND MAP */}

      <main className="w-full lg:grid lg:h-[calc(100vh-138px)] lg:min-h-[650px] lg:grid-cols-[minmax(460px,42%)_minmax(0,58%)] lg:overflow-hidden">


        {/* PROPERTY LIST */}

        <section
          ref={sheetRef}
          className={`order-1 fixed inset-x-0 bottom-0 z-10 overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-200 bg-zinc-50 shadow-[0_-12px_30px_-6px_rgba(0,0,0,0.25)] transition-[top] duration-300 ease-out ${
            sheetExpanded ? "top-[8vh]" : "top-[82vh]"
          } lg:static lg:inset-auto lg:top-auto lg:z-auto lg:h-auto lg:overscroll-auto lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none lg:transition-none`}
        >

          <div
            onClick={() =>
              setSheetExpanded((current) => !current)
            }
            onTouchStart={handleSheetDragStart}
            onTouchEnd={handleSheetDragEnd}
            className="sticky top-0 z-10 touch-none select-none border-b border-zinc-200 bg-zinc-50/95 backdrop-blur lg:touch-auto"
          >

            <div className="flex justify-center pt-2.5 pb-1 lg:hidden">
              <span className="h-1.5 w-12 rounded-full bg-zinc-300" />
            </div>

            <div className="px-4 py-3 lg:py-4 lg:px-6">

              <div className="flex items-end justify-between gap-4">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">
                    Jaipur Properties
                  </p>

                  <h2 className="mt-1 text-xl font-black text-zinc-900">
                    {loading
                      ? "Finding properties..."
                      : `${filteredProperties.length} properties found`}
                  </h2>

                </div>

                <p className="text-xs text-zinc-400">
                  Map verified locations
                </p>

              </div>

            </div>

          </div>


          <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-2">

            {!loading &&
              filteredProperties.length ===
                0 && (
                <div className="col-span-full rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">

                  <h3 className="font-bold text-zinc-900">
                    No properties found
                  </h3>

                  <p className="mt-2 text-sm text-zinc-500">
                    Try changing your location or filters.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      clearFilters();
                      clearLocation();
                    }}
                    className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Reset Search
                  </button>

                </div>
              )}


            {filteredProperties.map(
              (property) => {
                const isFavorite =
                  favoriteIds.includes(
                    property.id
                  );

                return (
                  <article
                    key={
                      property.id
                    }
                    id={`property-card-${property.id}`}
                    className={`group relative scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                      highlightedId === property.id
                        ? "border-accent ring-2 ring-accent/40"
                        : "border-zinc-200"
                    }`}
                  >

                    <Link
                      href={`/properties/${property.id}`}
                      className="block"
                    >

                      <div className="relative overflow-hidden">

                        <img
                          src={
                            property.image ||
                            "https://placehold.co/600x400?text=Property"
                          }
                          alt={
                            property.title
                          }
                          className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />

                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />

                        <div className="absolute bottom-3 left-3 flex gap-2">

                          {property.is_featured && (
                            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-white shadow">
                              Featured
                            </span>
                          )}

                          {property.verification_status ===
                            "approved" && (
                            <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                              Verified
                            </span>
                          )}

                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-zinc-800 backdrop-blur">
                            {
                              property.type
                            }
                          </span>

                        </div>

                      </div>

                    </Link>


                    <label
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                      className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 shadow-lg backdrop-blur transition hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={compareIds.includes(
                          property.id
                        )}
                        onChange={() =>
                          toggleCompare(property.id)
                        }
                        className="h-3.5 w-3.5 accent-accent"
                      />
                      Compare
                    </label>


                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite(
                          property.id
                        )
                      }
                      disabled={
                        favoriteLoading ===
                        property.id
                      }
                      className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-sm font-black shadow-lg backdrop-blur transition hover:scale-110 disabled:opacity-50"
                      title={
                        isFavorite
                          ? "Remove favorite"
                          : "Add favorite"
                      }
                    >
                      {isFavorite
                        ? "Saved"
                        : "Save"}
                    </button>


                    <Link
                      href={`/properties/${property.id}`}
                      className="block p-4"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h3 className="truncate text-base font-bold text-zinc-900 transition group-hover:text-red-600">
                            {
                              property.title
                            }
                          </h3>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {property.area ||
                              "Jaipur"}
                          </p>

                        </div>


                        <p className="shrink-0 text-base font-black text-red-600">
                          {formatPrice(
                            property.price
                          )}
                        </p>

                      </div>


                      <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl bg-zinc-50 py-2">

                        <div className="px-2 text-center">

                          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                            BHK
                          </p>

                          <p className="mt-0.5 text-xs font-bold text-zinc-800">
                            {property.bhk ||
                              "-"}
                          </p>

                        </div>


                        <div className="px-2 text-center">

                          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                            Facing
                          </p>

                          <p className="mt-0.5 truncate text-xs font-bold text-zinc-800">
                            {property.facing ||
                              "-"}
                          </p>

                        </div>


                        <div className="px-2 text-center">

                          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                            Parking
                          </p>

                          <p className="mt-0.5 truncate text-xs font-bold text-zinc-800">
                            {property.parking ||
                              "-"}
                          </p>

                        </div>

                      </div>


                      <div className="mt-4 flex items-center justify-between gap-3">

                        <span className="text-xs font-medium text-zinc-400">
                          Road:{" "}
                          {property.road ||
                            "-"}
                        </span>

                        <span className="text-sm font-bold text-red-600">
                          View details &gt;
                        </span>

                      </div>

                    </Link>

                  </article>
                );
              }
            )}

          </div>

        </section>


        {/* MAP */}

        <section className="order-2 fixed inset-0 z-0 w-full min-w-0 overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:h-full lg:min-h-0">

          <div className="absolute inset-0">

            <PropertyMap
              searchLocation={
                searchLocation
              }
              onSelectProperty={
                handleSelectFromMap
              }
              properties={filteredProperties.map(
                (property) => ({
                  ...property,

                  price:
                    formatPrice(
                      property.price
                    ),
                })
              )}
            />


            <div className="pointer-events-none absolute left-4 top-36 z-10 rounded-xl border border-white/60 bg-white/90 px-3 py-2 shadow-lg backdrop-blur lg:top-4">

              <p className="text-xs font-semibold text-zinc-500">
                Explore Jaipur
              </p>

              <p className="text-sm font-black text-zinc-900">
                {
                  filteredProperties.length
                }{" "}
                map locations
              </p>

            </div>

          </div>

        </section>

      </main>


      {/* MOBILE LIST PROPERTY BUTTON */}

      <Link
        href="/add-property"
        className={`fixed right-5 z-40 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-2xl md:hidden ${
          compareIds.length > 0 ? "bottom-24" : "bottom-5"
        }`}
      >
        + List Property
      </Link>


      {/* COMPARE BAR */}

      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">

          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">

            <p className="text-sm font-bold text-zinc-700">
              {compareIds.length}{" "}
              {compareIds.length === 1
                ? "property"
                : "properties"}{" "}
              selected
              {compareIds.length >= 4 &&
                " (max 4)"}
            </p>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="rounded-full px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900"
              >
                Clear
              </button>

              {compareIds.length >= 2 ? (
                <Link
                  href={`/compare?ids=${compareIds.join(",")}`}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Compare ({compareIds.length})
                </Link>
              ) : (
                <span className="rounded-full bg-zinc-200 px-5 py-2.5 text-sm font-bold text-zinc-400">
                  Select 1 more
                </span>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}