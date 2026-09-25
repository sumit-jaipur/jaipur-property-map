"use client";

import { useCallback, useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type Props = {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
};

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const hasPin = lat !== "" && lng !== "";

  const centerLat = hasPin ? Number(lat) : 26.9124;
  const centerLng = hasPin ? Number(lng) : 75.7873;

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
        "Location is not supported on this browser. Please place the pin manually."
      );
      return;
    }

    // The geolocation API only works over a secure (https) connection --
    // always true on the live site, but this makes the failure clear
    // instead of a silent/confusing one if it's ever not.
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false
    ) {
      setLocateError(
        "Location only works over a secure (https) connection. Please place the pin manually."
      );
      return;
    }

    setLocating(true);
    setLocateError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(
          pos.coords.latitude.toFixed(6),
          pos.coords.longitude.toFixed(6)
        );
        setLocating(false);
      },
      (err) => {
        setLocating(false);

        // The old version showed one generic message no matter what
        // went wrong. Each of these actually needs a different fix from
        // whoever is filling the form, so tell them which one applies.
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError(
            "Location access is blocked for this site. Click the lock/info icon next to the browser address bar, allow \"Location,\" then try again."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocateError(
            "Your device couldn't determine a location. On Windows: Settings -> Privacy & security -> Location -- make sure Location Services is ON and your browser is allowed. On a phone, make sure GPS/Location is turned on."
          );
        } else if (err.code === err.TIMEOUT) {
          setLocateError(
            "Getting your location took too long. Check your internet/GPS signal (and that your laptop isn't in a low-power/sleep state) and try again."
          );
        } else {
          setLocateError(
            "Could not get your location. Please place the pin manually."
          );
        }
      },
      {
        // Ask for GPS-grade accuracy when the device has it (phones in
        // the field), don't hang forever if it's slow to resolve, and
        // never reuse a stale cached fix -- a seller/builder using this
        // on-site needs the position where they're standing right now.
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <Map
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
            : "Click anywhere on the map to drop a pin"}
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

      {locateError && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          {locateError}
        </p>
      )}
    </div>
  );
}
