"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, Layer, NavigationControl } from "react-map-gl/mapbox";
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

// Search Box API's /suggest step returns a name/id, not coordinates --
// /retrieve is a second call that resolves those once something is
// actually picked (see selectSuggestion below).
type Suggestion = {
  id: string; // mapbox_id, passed to /retrieve once picked
  place_name: string;
};

type MapboxSuggestion = {
  mapbox_id?: string;
  name?: string;
  full_address?: string;
  place_formatted?: string;
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

  // Search Box API bills per search "session" (typing through to a pick),
  // not per keystroke -- this holds that session's id, reset once a
  // location is resolved so the next search starts a fresh one.
  const sessionTokenRef = useRef<string | null>(null);

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

  // Debounced address search via Mapbox's Search Box API -- the same
  // token already used for the map itself, no new setup needed. This
  // replaced the older Geocoding API, which only matched formal
  // addresses/streets/neighborhoods -- a landmark, shop, or informal
  // place name (which is often all a seller actually knows) matched
  // nothing and the map never moved to the right area.
  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      setSearching(true);

      try {
        const res = await fetch(
          "https://api.mapbox.com/search/searchbox/v1/suggest" +
            `?q=${encodeURIComponent(query)}` +
            `&session_token=${sessionTokenRef.current}` +
            `&access_token=${MAPBOX_TOKEN}` +
            "&country=IN" +
            `&proximity=${JAIPUR_LNG},${JAIPUR_LAT}` +
            "&language=en" +
            "&limit=6",
          { signal: controller.signal }
        );

        const data = await res.json();
        const rawSuggestions: MapboxSuggestion[] = data.suggestions || [];

        const parsed: Suggestion[] = rawSuggestions
          .filter((item) => item.mapbox_id)
          .map((item) => ({
            id: item.mapbox_id as string,
            place_name:
              item.full_address ||
              [item.name, item.place_formatted]
                .filter(Boolean)
                .join(", "),
          }));

        setSuggestions(parsed);
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

  async function selectSuggestion(suggestion: Suggestion) {
    setSearchQuery(suggestion.place_name);
    setSuggestions([]);
    setShowSuggestions(false);

    if (!sessionTokenRef.current) return;

    try {
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
          suggestion.id
        )}?session_token=${sessionTokenRef.current}&access_token=${MAPBOX_TOKEN}`
      );

      const data = await res.json();
      const coordinates = data.features?.[0]?.geometry?.coordinates;

      if (!coordinates || coordinates.length < 2) return;

      const [lngVal, latVal] = coordinates;

      onChange(latVal.toFixed(6), lngVal.toFixed(6));
      flyTo(latVal, lngVal);
    } finally {
      // The session ends once a place is picked -- the next search
      // starts fresh.
      sessionTokenRef.current = null;
    }
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
            // A real photographic street view isn't something Mapbox
            // offers -- this is the free alternative: tilt the existing
            // map into a 3D perspective (with the buildings layer below)
            // so you can see what's actually around the pin instead of
            // a flat top-down view. Drag with two fingers (or right-click
            // drag on desktop), or use the tilt control at top-right.
            pitch: 55,
            bearing: -12,
          }}
          maxPitch={70}
          style={{ width: "100%", height: 280 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={handleMapClick}
          cursor="crosshair"
        >
          <NavigationControl position="top-right" visualizePitch />

          {/* Extrudes real building footprints to their actual height so
              the tilted view reads as a skyline, not just a tilted flat
              map. Uses the building data already included in the
              streets-v12 style -- no extra data source or cost. */}
          <Layer
            id="3d-buildings"
            source="composite"
            source-layer="building"
            type="fill-extrusion"
            minzoom={14}
            paint={{
              "fill-extrusion-color": "#d4d4d8",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.8,
            }}
          />

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
