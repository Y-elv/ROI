import type { Opportunity } from "./types";

export const RWANDA_DISTRICTS_BY_PROVINCE = {
  "City of Kigali": ["Gasabo", "Kicukiro", "Nyarugenge"],
  "Northern Province": ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
  "Southern Province": ["Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango"],
  "Eastern Province": ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"],
  "Western Province": ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"],
} as const;

export type RwandaProvince = keyof typeof RWANDA_DISTRICTS_BY_PROVINCE;
export const RWANDA_PROVINCES = Object.keys(RWANDA_DISTRICTS_BY_PROVINCE) as RwandaProvince[];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function districtsForProvince(province?: string): string[] {
  if (province) {
    return RWANDA_PROVINCES.includes(province as RwandaProvince)
      ? [...RWANDA_DISTRICTS_BY_PROVINCE[province as RwandaProvince]]
      : [];
  }
  return Object.values(RWANDA_DISTRICTS_BY_PROVINCE).flatMap((districts) => [...districts]);
}

export function isValidCoordinates<T extends { latitude?: unknown; longitude?: unknown }>(
  value: T,
): value is T & Coordinates {
  return typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180;
}

export function haversineDistanceKm(from: Coordinates, to: Coordinates): number | null {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) return null;

  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
    Math.cos(radians(to.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(Math.max(0, 1 - haversine)));
  const distance = 6371.0088 * centralAngle;
  return Number.isFinite(distance) ? distance : null;
}

export function distanceToOpportunity(
  location: Opportunity["location"],
  origin: Coordinates,
): { kilometers: number; precision: "district_reference" | "unspecified" } | null {
  if (!location || !isValidCoordinates(location)) return null;
  const kilometers = haversineDistanceKm(origin, location);
  return kilometers === null
    ? null
    : {
        kilometers,
        precision: location.coordinateType === "district_reference" ? "district_reference" : "unspecified",
      };
}

export function locationMatchesFilters(
  location: Opportunity["location"],
  province: string,
  district: string,
): boolean {
  return (!province || location?.province === province) &&
    (!district || location?.district === district);
}

export function sortByDistance<T>(
  entries: T[],
  getLocation: (entry: T) => Opportunity["location"],
  origin: Coordinates,
): T[] {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      distance: distanceToOpportunity(getLocation(entry), origin)?.kilometers ?? null,
    }))
    .sort((left, right) => {
      if (left.distance === null) return right.distance === null ? left.index - right.index : 1;
      if (right.distance === null) return -1;
      return left.distance - right.distance || left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export function formatOpportunityLocation(location: Opportunity["location"]): string {
  const province = location?.province?.trim();
  const district = location?.district?.trim();
  if (province && district) return `${province} · ${district} District`;
  if (province) return province;
  if (district) return `${district} District`;
  const displayLocation = location?.displayLocation?.trim();
  return displayLocation || "Location not specified";
}
