"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapGL, { Marker, Popup, MapRef } from "react-map-gl/mapbox";
import Supercluster, { PointFeature } from "supercluster";
import "mapbox-gl/dist/mapbox-gl.css";

type Property = {
  id: number;
  title: string;
  type: string;
  price: string;
  bhk: number;
  area: string;
  facing: string;
  parking: string;
  road: string;
  lat: number;
  lng: number;
  image: string;
  status?: string;
};

type SearchLocation = {
  lat: number;
  lng: number;
};

type ClusterPointProps = {
  propertyId: number;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type Props = {
  properties: Property[];
  searchLocation?: SearchLocation | null;
  onSelectProperty?: (propertyId: number) => void;
};

export default function PropertyMap({
  properties,
  searchLocation,
  onSelectProperty,
}: Props) {
  const [selected, setSelected] = useState<Property | null>(null);

  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);

  // Default Jaipur location
  const mapLatitude = searchLocation?.lat ?? 26.9124;
  const mapLongitude = searchLocation?.lng ?? 75.7873;

  // Zoom closer when user searches for a location
  const mapZoom = searchLocation ? 14 : 11;

  const [viewport, setViewport] = useState<{
    bounds: [number, number, number, number];
    zoom: number;
  } | null>(null);

  const propertiesById = useMemo(() => {
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  // Group nearby properties together so the same building or a
  // property listed by several brokers doesn't pile up as a stack
  // of overlapping pins.
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<ClusterPointProps>({
      radius: 60,
      maxZoom: 17,
    });

    const points: PointFeature<ClusterPointProps>[] = properties.map(
      (property) => ({
        type: "Feature",
        properties: { propertyId: property.id },
        geometry: {
          type: "Point",
          coordinates: [property.lng, property.lat],
        },
      })
    );

    index.load(points);

    return index;
  }, [properties]);

  const clusters = useMemo(() => {
    if (!viewport) return [];

    return clusterIndex.getClusters(
      viewport.bounds,
      Math.round(viewport.zoom)
    );
  }, [clusterIndex, viewport]);

  const updateViewport = useCallback(() => {
    const map = mapRef.current?.getMap();

    if (!map) return;

    const bounds = map.getBounds();

    if (!bounds) return;

    setViewport({
      bounds: [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ],
      zoom: map.getZoom(),
    });
  }, []);

  function handleClusterClick(
    clusterId: number,
    longitude: number,
    latitude: number
  ) {
    const map = mapRef.current?.getMap();

    if (!map) return;

    const expansionZoom = Math.min(
      clusterIndex.getClusterExpansionZoom(clusterId),
      19
    );

    map.easeTo({
      center: [longitude, latitude],
      zoom: expansionZoom,
      duration: 500,
    });
  }

  return (
    <MapGL
      key={
        searchLocation
          ? `${searchLocation.lat}-${searchLocation.lng}`
          : "jaipur-map"
      }
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude: mapLongitude,
        latitude: mapLatitude,
        zoom: mapZoom,
      }}
      style={{
        width: "100%",
        height: "100%",
      }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      reuseMaps
      onLoad={updateViewport}
      onMove={updateViewport}
    >
      {/* PROPERTY MARKERS, CLUSTERED WHEN CLOSE TOGETHER */}

      {clusters.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;

        if ("cluster" in feature.properties && feature.properties.cluster) {
          const { cluster_id: clusterId, point_count: pointCount } =
            feature.properties;
          const size = Math.min(34 + pointCount * 2, 60);

          return (
            <Marker
              key={`cluster-${clusterId}`}
              longitude={longitude}
              latitude={latitude}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleClusterClick(clusterId, longitude, latitude);
              }}
            >
              <div
                className="flex cursor-pointer items-center justify-center rounded-full border-2 border-white bg-red-600 font-bold text-white shadow-lg transition hover:bg-red-700"
                style={{
                  width: size,
                  height: size,
                  fontSize: pointCount >= 100 ? 12 : 13,
                }}
                title={`${pointCount} properties here`}
              >
                {pointCount}
              </div>
            </Marker>
          );
        }

        const propertyId = feature.properties.propertyId;
        const property = propertiesById.get(propertyId);

        if (!property) return null;

        return (
          <Marker
            key={property.id}
            longitude={property.lng}
            latitude={property.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(property);
              onSelectProperty?.(property.id);
            }}
          >
            <div className="flex flex-col items-center cursor-pointer">
              <div className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap">
                {property.price}
              </div>

              <div className="w-3 h-3 bg-red-600 rotate-45 -mt-1.5 shadow-lg" />
            </div>
          </Marker>
        );
      })}

      {/* PROPERTY POPUP */}

      {selected && (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          anchor="bottom"
          onClose={() => setSelected(null)}
          closeOnClick={false}
          closeButton={false}
          maxWidth="260px"
          offset={20}
        >
          <div className="w-60 -m-3 overflow-hidden rounded-lg">
            {/* IMAGE */}

            <div className="relative">
              <img
                src={
                  selected.image ||
                  "https://placehold.co/400x300?text=Property"
                }
                alt={selected.title}
                className="w-full h-32 object-cover"
              />

              {/* CLOSE BUTTON */}

              <button
                onClick={() => setSelected(null)}
                className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-zinc-700 text-sm font-bold shadow"
              >
                ×
              </button>

              {/* PRICE */}

              <div className="absolute bottom-1.5 left-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {selected.price}
              </div>
            </div>

            {/* PROPERTY INFO */}

            <div className="p-3">
              <h3 className="font-semibold text-zinc-900 text-sm leading-tight">
                {selected.title}
              </h3>

              <p className="text-xs text-zinc-500 mt-0.5">
                {selected.type} • {selected.area}
              </p>

              {/* PROPERTY FEATURES */}

              <div className="flex flex-wrap gap-1 mt-2">
                {selected.bhk > 0 && (
                  <span className="text-[11px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-full">
                    {selected.bhk} BHK
                  </span>
                )}

                <span className="text-[11px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-full">
                  {selected.parking}
                </span>

                <span className="text-[11px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-full">
                  {selected.road}
                </span>

                <span className="text-[11px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-full">
                  {selected.facing} Facing
                </span>
              </div>

              {/* VIEW DETAILS BUTTON */}

              <button
                onClick={() =>
                  router.push(`/properties/${selected.id}`)
                }
                className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition"
              >
                View Details
              </button>
            </div>
          </div>
        </Popup>
      )}
    </MapGL>
  );
}
