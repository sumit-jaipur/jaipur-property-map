// Shared shape for a saved search's filters, plus the matching logic used
// both when a buyer saves a search from the homepage and when
// /api/alerts/notify-matches checks a newly-approved listing against
// every active saved search. Mirrors the filter logic in app/page.tsx --
// keep the two in sync if the homepage filters change.

export type SavedSearchLocation = {
  lat: number;
  lng: number;
  label: string;
};

export type SavedSearchFilters = {
  propertyType: string;
  bhk: string;
  minPrice: number | null;
  maxPrice: number | null;
  facing: string;
  parking: string;
  minRoadWidth: number | null;
  location: SavedSearchLocation | null;
  radiusKm: number;
};

export type MatchableProperty = {
  type: string;
  bhk: number;
  price: number;
  facing: string | null;
  parking: string | null;
  road: string | null;
  lat: number;
  lng: number;
};

function getRoadWidth(road: string | null | undefined) {
  const value = parseFloat(road || "");
  return Number.isNaN(value) ? 0 : value;
}

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const earthRadius = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

  const latDifference = toRadians(lat2 - lat1);
  const lngDifference = toRadians(lng2 - lng1);

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(lngDifference / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function propertyMatchesFilters(
  property: MatchableProperty,
  filters: SavedSearchFilters
): boolean {
  const matchesType =
    filters.propertyType === "All" || property.type === filters.propertyType;

  const matchesBhk =
    filters.bhk === "Any" ||
    (filters.bhk === "2" && property.bhk === 2) ||
    (filters.bhk === "3" && property.bhk === 3) ||
    (filters.bhk === "4+" && property.bhk >= 4);

  const matchesMinPrice =
    filters.minPrice === null || property.price >= filters.minPrice;

  const matchesMaxPrice =
    filters.maxPrice === null || property.price <= filters.maxPrice;

  const matchesFacing =
    filters.facing === "Any" ||
    property.facing?.toLowerCase() === filters.facing.toLowerCase();

  const hasParking =
    Boolean(property.parking) &&
    property.parking !== "-" &&
    property.parking !== "0" &&
    property.parking?.toLowerCase() !== "no";

  const matchesParking =
    filters.parking === "Any" ||
    (filters.parking === "Yes" && hasParking) ||
    (filters.parking === "No" && !hasParking);

  const matchesRoad =
    filters.minRoadWidth === null ||
    getRoadWidth(property.road) >= filters.minRoadWidth;

  let matchesLocation = true;

  if (filters.location) {
    const distance = getDistanceKm(
      filters.location.lat,
      filters.location.lng,
      property.lat,
      property.lng
    );

    matchesLocation = distance <= filters.radiusKm;
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

export function describeFilters(filters: SavedSearchFilters): string {
  const parts: string[] = [];

  parts.push(filters.propertyType === "All" ? "Any type" : filters.propertyType);

  if (filters.bhk !== "Any") {
    parts.push(`${filters.bhk} BHK`);
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const min = filters.minPrice !== null ? `₹${filters.minPrice.toLocaleString("en-IN")}` : "Any";
    const max = filters.maxPrice !== null ? `₹${filters.maxPrice.toLocaleString("en-IN")}` : "Any";
    parts.push(`${min} - ${max}`);
  }

  if (filters.facing !== "Any") {
    parts.push(`${filters.facing} facing`);
  }

  if (filters.parking !== "Any") {
    parts.push(filters.parking === "Yes" ? "Parking available" : "No parking");
  }

  if (filters.minRoadWidth !== null) {
    parts.push(`${filters.minRoadWidth}+ ft road`);
  }

  if (filters.location) {
    parts.push(`within ${filters.radiusKm}km of ${filters.location.label}`);
  }

  return parts.join(" · ");
}

export function defaultSearchName(filters: SavedSearchFilters): string {
  const type = filters.propertyType === "All" ? "Property" : filters.propertyType;
  const bhk = filters.bhk !== "Any" ? `${filters.bhk} BHK ` : "";
  const where = filters.location ? ` in ${filters.location.label}` : " in Jaipur";

  return `${bhk}${type}${where}`;
}
