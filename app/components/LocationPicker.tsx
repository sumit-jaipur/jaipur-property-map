"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, Layer, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Paperclip } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Center the address search on Jaipur so "Vaishali Nagar" finds the
// Jaipur one first, not a same-named place somewhere else in India.
const JAIPUR_LNG = 75.7873;
const JAIPUR_LAT = 26.9124;

// Where a pin's coordinates came from -- shown to the admin reviewing the
// listing so a pasted link (which nobody has necessarily stood at) gets a
// second look, the same way every other listing already does before it
// goes live.
export type LocationSource = "map_click" | "search" | "gps" | "pasted_link";

type Props = {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string, source?: LocationSource) => void;
};

// Pulls lat/lng out of a Google Maps or Apple Maps URL that already has
// them in its query string or path -- covers the common
// "https://www.google.com/maps/place/.../@26.9124,75.7873,15z" and
// "?q=26.9124,75.7873" / "ll=26.9124,75.7873" shapes. A *shortened* link
// (maps.app.goo.gl, goo.gl/maps, g.co, Apple's maps.apple.com/p/...) never
// has coordinates in the URL itself -- resolveLocationLink below handles
// those by asking the server to follow the redirect first.
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /[@,]\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, // .../@26.9124,75.7873,15z
    /[?&]q=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, // ?q=26.9124,75.7873
    /[?&]ll=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, // ?ll=26.9124,75.7873 (Apple Maps)
    /[?&]daddr=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, // ?daddr=26.9124,75.7873
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Plain pasted coordinates, e.g. "26.9124, 75.7873" or "Lat 26.9124 Lng
// 75.7873" -- deliberately loose about the surrounding text (that's
// exactly what gets pasted from a WhatsApp message or a notes app) but
// strict about requiring exactly two decimal numbers so it doesn't
// misread a URL's zoom level or a street number as a coordinate.
function extractPlainCoordinates(text: string): { lat: number; lng: number } | null {
  const numbers = text.match(/-?\d{1,3}\.\d+/g);
  if (!numbers || numbers.length !== 2) return null;

  const lat = Number(numbers[0]);
  const lng = Number(numbers[1]);
  if (!isValidCoordinate(lat, lng)) return null;

  return { lat, lng };
}

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

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState("");

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

      onChange(latVal.toFixed(6), lngVal.toFixed(6), "search");
      flyTo(latVal, lngVal);
    } finally {
      // The session ends once a place is picked -- the next search
      // starts fresh.
      sessionTokenRef.current = null;
    }
  }

  // Lets a broker use a location shared with them (over WhatsApp, say) for
  // a property they haven't physically visited yet, instead of requiring
  // "Use my current location" to always mean they're standing there right
  // now. Plain coordinates and a full Google/Apple Maps link (one that
  // already has the coordinates in its URL) resolve instantly in the
  // browser; a shortened share link (maps.app.goo.gl, goo.gl/maps, g.co,
  // maps.apple.com/p/...) doesn't carry coordinates in the URL at all --
  // it only reveals them after the redirect, which the browser's own
  // fetch can't follow cross-origin, so that case asks the server route
  // below to resolve it instead. Either way the pin that results is still
  // just a starting point: it's shown as draggable, same as always, so it
  // can be nudged onto the exact spot before saving, and it's tagged
  // "pasted_link" so the admin review screen knows to double-check it.
  async function handlePasteLocation() {
    const text = pasteText.trim();

    if (!text) return;

    setPasting(true);
    setPasteError("");

    try {
      if (/^https?:\/\//i.test(text)) {
        const direct = extractCoordsFromUrl(text);

        if (direct) {
          onChange(direct.lat.toFixed(6), direct.lng.toFixed(6), "pasted_link");
          flyTo(direct.lat, direct.lng);
          setShowPasteBox(false);
          setPasteText("");
          return;
        }

        // No coordinates in the URL itself -- most likely a shortened
        // share link. Ask the server to follow the redirect.
        const res = await fetch("/api/resolve-location-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: text }),
        });

        const data = await res.json();

        if (!res.ok || !isValidCoordinate(data.lat, data.lng)) {
          setPasteError(
            data.error ||
              "Couldn't find a location in that link. Open it, make sure it shows a specific pin (not just an area), and paste the address-bar URL, or search/drop a pin manually instead."
          );
          return;
        }

        onChange(
          Number(data.lat).toFixed(6),
          Number(data.lng).toFixed(6),
          "pasted_link"
        );
        flyTo(data.lat, data.lng);
        setShowPasteBox(false);
        setPasteText("");
        return;
      }

      const plain = extractPlainCoordinates(text);

      if (!plain) {
        setPasteError(
          "Couldn't read that as a location. Paste a Google Maps or Apple Maps link, or coordinates like 26.9124, 75.7873."
        );
        return;
      }

      onChange(plain.lat.toFixed(6), plain.lng.toFixed(6), "pasted_link");
      flyTo(plain.lat, plain.lng);
      setShowPasteBox(false);
      setPasteText("");
    } catch {
      setPasteError("Something went wrong reading that. Please try again.");
    } finally {
      setPasting(false);
    }
  }

  const handleMapClick = useCallback(
    (e: any) => {
      onChange(
        e.lngLat.lat.toFixed(6),
        e.lngLat.lng.toFixed(6),
        "map_click"
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

        onChange(latitude.toFixed(6), longitude.toFixed(6), "gps");
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
                  e.lngLat.lng.toFixed(6),
                  "map_click"
                )
              }
            >
              {/* A real MapPin glyph instead of the 📍 emoji -- Apple,
                  Google and Samsung each draw the pin emoji differently
                  (and some Android fonts render it as a generic flag),
                  so the exact same listing's pin looked different on an
                  iPhone vs an Android phone. One SVG looks identical
                  everywhere. */}
              <MapPin
                className="h-9 w-9 text-red-600 drop-shadow-lg"
                fill="currentColor"
                stroke="white"
                strokeWidth={1.5}
              />
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {locating ? (
              "Locating..."
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" />
                Use my current location
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowPasteBox((current) => !current);
              setPasteError("");
            }}
            className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Paste a shared location
          </button>
        </div>
      </div>

      {showPasteBox && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="mb-2 text-xs text-zinc-500">
            Not there in person yet? Paste a Google Maps or Apple Maps link
            someone sent you (WhatsApp included), or just the coordinates.
            You can still drag the pin to fine-tune it afterwards, and it
            goes through the same review as every other listing before it
            goes live.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setPasteError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePasteLocation();
                }
              }}
              placeholder="https://maps.app.goo.gl/... or 26.9124, 75.7873"
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
            />

            <button
              type="button"
              onClick={handlePasteLocation}
              disabled={pasting || !pasteText.trim()}
              className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pasting ? "Reading..." : "Use this location"}
            </button>
          </div>

          {pasteError && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              {pasteError}
            </p>
          )}
        </div>
      )}

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
