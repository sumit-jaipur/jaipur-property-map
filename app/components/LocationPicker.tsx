"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Center the address search on Jaipur so "Vaishali Nagar" finds the
// Jaipur one first, not a same-named place somewhere else in India.
const JAIPUR_LNG = 75.7873;
const JAIPUR_LAT = 26.9124;

type Props = {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
};

type Suggestion = {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
};

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const mapRef = useRef<any>(null);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [isIOS, setIsIOS] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const hasPin = lat !== "" && lng !== "";

  const centerLat = hasPin ? Number(lat) : JAIPUR_LAT;
  const centerLng = hasPin ? Number(lng) : JAIPUR_LNG;

  // iPhones/iPads need their own set of instructions below (Safari has an
  // extra location layer desktop Chrome doesn't) -- detect once on mount.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const iOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS 13+ reports itself as a Mac -- this is the standard way
      // to still tell it apart from an actual desktop Mac.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(iOSDevice);
  }, []);

  // Debounced address search via Mapbox's geocoding API -- the same
  // token already used for the map itself, no new setup needed.
  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      setSearching(true);

      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${MAPBOX_TOKEN}&country=IN&proximity=${JAIPUR_LNG},${JAIPUR_LAT}&limit=5`,
          { signal: controller.signal }
        );

        const data = await res.json();
        setSuggestions(data.features || []);
      } catch {
        // A cancelled/failed search just means no suggestions yet --
        // nothing to show the user.
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery]);

  function flyTo(latVal: number, lngVal: number, zoom = 15) {
    mapRef.current?.flyTo?.({
      center: [lngVal, latVal],
      zoom,
      duration: 1200,
    });
  }

  function selectSuggestion(feature: Suggestion) {
    const [lngVal, latVal] = feature.center;

    onChange(latVal.toFixed(6), lngVal.toFixed(6));
    setSearchQuery(feature.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
    flyTo(latVal, lngVal);
  }

  const handleMapClick = useCallback(
    (e: any) => {
      onChange(
        e.lngLat.lat.toFixed(6),
        e.lngLat.lng.toFixed(6)
      );
    },
    [onChange]
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError(
        "Location is not supported on this browser. Please search for the address or place the pin manually."
      );
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false
    ) {
      setLocateError(
        "Location only works over a secure (https) connection. Please search for the address or place the pin manually."
      );
      return;
    }

    setLocating(true);
    setLocateError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        onChange(latitude.toFixed(6), longitude.toFixed(6));
        flyTo(latitude, longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);

        if (err.code === err.PERMISSION_DENIED) {
          setLocateError(
            isIOS
              ? "Location was denied for this site. On your iPhone: tap the \"AA\" icon at the left of Safari's address bar -> Website Settings -> Location -> Allow, then try again."
              : "Location access is blocked for this site. Click the lock/info icon next to the browser address bar, allow \"Location,\" then try again."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocateError(
            isIOS
              ? "Your iPhone couldn't get a location. Check: Settings -> Privacy & Security -> Location Services is ON, AND further down Settings -> Privacy & Security -> Location Services -> Safari Websites is set to \"Ask Next Time\" or \"While Using the App\" (this second setting is separate and easy to miss). If you use iCloud Private Relay or a VPN, try turning it off and retry -- it can block precise location. You can also just search for the address below instead."
              : "Your device couldn't determine a location. On Windows: Settings -> Privacy & security -> Location -- make sure Location Services is ON and your browser is allowed. On a phone, make sure GPS/Location is turned on. You can also just search for the address below instead."
          );
        } else if (err.code === err.TIMEOUT) {
          setLocateError(
            "Getting your location took too long. Check your signal and try again, or search for the address below instead."
          );
        } else {
          setLocateError(
            "Could not get your location. Please search for the address or place the pin manually."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay so a click on a suggestion below still registers
            // before the list disappears.
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder="Search an address or locality, e.g. Vaishali Nagar, Jaipur"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-50"
        />

        {showSuggestions && (searching || suggestions.length > 0) && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
            {searching && (
              <p className="px-4 py-2.5 text-xs text-zinc-400">
                Searching...
              </p>
            )}

            {!searching &&
              suggestions.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(feature)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-red-50 hover:text-red-700"
                >
                  {feature.place_name}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: centerLng,
            latitude: centerLat,
            zoom: hasPin ? 14 : 11,
          }}
          style={{ width: "100%", height: 280 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={handleMapClick}
          cursor="crosshair"
        >
          {hasPin && (
            <Marker
              longitude={Number(lng)}
              latitude={Number(lat)}
              anchor="bottom"
              draggable
              onDragEnd={(e) =>
                onChange(
                  e.lngLat.lat.toFixed(6),
                  e.lngLat.lng.toFixed(6)
                )
              }
            >
              <div className="text-3xl leading-none drop-shadow-lg">
                📍
              </div>
            </Marker>
          )}
        </Map>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-500">
          {hasPin
            ? `Pin set at ${Number(lat).toFixed(5)}, ${Number(
                lng
              ).toFixed(5)}`
            : "Search an address above, or click anywhere on the map to drop a pin"}
        </p>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {locating
            ? "Locating..."
            : "📍 Use my current location"}
        </button>
      </div>

      {isIOS && !locateError && (
        <p className="mt-2 text-[11px] text-zinc-400">
          iPhone: when Safari asks, tap Allow. If nothing happens, check
          Settings → Privacy & Security → Location Services → Safari
          Websites is set to Ask/Allow -- or just use the search box
          above instead.
        </p>
      )}

      {locateError && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          {locateError}
        </p>
      )}
    </div>
  );
}
