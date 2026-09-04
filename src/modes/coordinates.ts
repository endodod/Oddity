import {
  Badge,
  ModeEngine,
  ScoreResult,
  epFromProbability,
  rarityFromProbability,
  gradeBadge,
  applyCombos,
  NamedCombo,
} from "./types";
import { CAPITALS, distanceKm, nearestCapital } from "../data/capitals";

export interface Coordinate {
  lat: number; // -90..90
  lon: number; // -180..180
}

/**
 * Sample uniformly over the sphere's surface, not uniformly in degrees
 * (a naive uniform latitude sample over-represents the poles).
 */
function roll(seed: () => number): Coordinate {
  const lon = seed() * 360 - 180;
  const u = seed() * 2 - 1; // -1..1
  const lat = (Math.asin(u) * 180) / Math.PI;
  return { lat: round(lat, 4), lon: round(lon, 4) };
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Extremely rough land/ocean approximation using continent-scale bounding
 * boxes. This will misclassify plenty of coastal and inland-sea points —
 * replace with a real land-polygon lookup (e.g. Natural Earth data via a
 * point-in-polygon check) before shipping. Kept here so the mode is
 * functional end-to-end without an external geo dependency.
 */
const LAND_BOXES: { minLat: number; maxLat: number; minLon: number; maxLon: number }[] = [
  { minLat: 15, maxLat: 72, minLon: -170, maxLon: -50 }, // North America (rough)
  { minLat: -56, maxLat: 13, minLon: -82, maxLon: -34 }, // South America (rough)
  { minLat: 35, maxLat: 71, minLon: -10, maxLon: 40 }, // Europe (rough)
  { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 }, // Africa (rough)
  { minLat: 5, maxLat: 77, minLon: 40, maxLon: 180 }, // Asia (rough)
  { minLat: -44, maxLat: -10, minLon: 112, maxLon: 154 }, // Australia (rough)
  { minLat: -90, maxLat: -60, minLon: -180, maxLon: 180 }, // Antarctica (rough)
];

function isRoughlyOnLand(c: Coordinate): boolean {
  return LAND_BOXES.some(
    (b) => c.lat >= b.minLat && c.lat <= b.maxLat && c.lon >= b.minLon && c.lon <= b.maxLon
  );
}

function nearestLandDistanceKm(c: Coordinate): number {
  if (isRoughlyOnLand(c)) return 0;
  // Approximate "distance to nearest land" via distance to nearest capital
  // as a stand-in signal (capitals are on land) — coarse but directionally useful.
  return nearestCapital(c.lat, c.lon).distanceKm;
}

function badgeDefs(): Omit<Badge, "epValue" | "rarityBand">[] {
  return [
    { id: "null-island", name: "Null Island", description: "Landed within 0.01° of (0, 0).", probability: 0.0000003 },
    { id: "near-null-island", name: "Near Null Island", description: "Within 100 km of (0, 0).", probability: 0.00006 },
    { id: "on-land", name: "Landfall", description: "Point falls on a landmass.", probability: 0.29 },
    { id: "deep-ocean", name: "Middle of Nowhere", description: "Water, 1,000+ km from land.", probability: 0.15 },
    { id: "northern-hemisphere", name: "Northerner", description: "Latitude above the equator.", probability: 0.5 },
    { id: "southern-hemisphere", name: "Southerner", description: "Latitude below the equator.", probability: 0.5 },
    { id: "eastern-hemisphere", name: "Easterner", description: "Longitude east of the prime meridian.", probability: 0.5 },
    { id: "western-hemisphere", name: "Westerner", description: "Longitude west of the prime meridian.", probability: 0.5 },
    { id: "equator-hugger", name: "Equator Hugger", description: "Within 1° latitude of the equator.", probability: 0.011 },
    { id: "prime-meridian-hugger", name: "Meridian Hugger", description: "Within 1° longitude of 0°.", probability: 0.0056 },
    { id: "antimeridian-hugger", name: "Date Line Hugger", description: "Within 1° of the 180th meridian.", probability: 0.0056 },
    { id: "polar-proximity", name: "Polar Bound", description: "Within 5° latitude of a pole.", probability: 0.0076 },
    { id: "capital-jackpot", name: "Capital Landing", description: "Within 25 km of a national capital.", probability: 0.00004 },
    { id: "capital-close", name: "Capital Region", description: "Within 250 km of a national capital.", probability: 0.004 },
    { id: "round-coordinates", name: "Round Numbers", description: "Both lat and lon land on a whole degree.", probability: 0.0003 },
    { id: "matching-integers", name: "Matching Digits", description: "Integer part of lat equals integer part of lon.", probability: 0.0056 },
    { id: "roaring-forties", name: "Roaring Forties", description: "Latitude between 40°-50° in either hemisphere.", probability: 0.13 },
    { id: "tropics-band", name: "In the Tropics", description: "Latitude within the tropical band (±23.5°).", probability: 0.39 },
  ].map((d) => ({ ...d }));
}

const BADGES: Record<string, Badge> = Object.fromEntries(
  badgeDefs().map((d) => [
    d.id,
    { ...d, rarityBand: rarityFromProbability(d.probability), epValue: epFromProbability(d.probability) },
  ])
);

const NAMED_COMBOS: NamedCombo[] = [
  {
    id: "far-and-alone",
    name: "Far and Alone",
    description: "Deep ocean, in the Roaring Forties, far from any capital.",
    requires: ["deep-ocean", "roaring-forties"],
    bonusEp: 3000,
  },
];

function score(c: Coordinate): ScoreResult {
  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  // Distance-based badges are naturally graded: closer (or farther, depending on the
  // condition) is better, so EP scales continuously instead of being a flat threshold hit.
  const distFromOrigin = distanceKm(c.lat, c.lon, 0, 0);
  if (distFromOrigin < 1.1) push("null-island");
  else if (distFromOrigin < 100) {
    pushGraded(
      { id: "near-null-island", name: "Near Null Island", description: "Within 100 km of (0, 0).", rarityBand: "Mythic", probability: 0.00006 },
      { tier: "Mythic", value: distFromOrigin, atThreshold: 100, atBest: 1.1, curve: 0.8 }
    );
  }

  const onLand = isRoughlyOnLand(c);
  const landDist = nearestLandDistanceKm(c);
  if (onLand) push("on-land");
  else if (landDist > 1000) {
    pushGraded(
      { id: "deep-ocean", name: "Middle of Nowhere", description: "Water, far from any land.", rarityBand: "Rare", probability: 0.15 },
      { tier: "Rare", value: landDist, atThreshold: 1000, atBest: 4000, curve: 0.8 }
    );
  }

  push(c.lat >= 0 ? "northern-hemisphere" : "southern-hemisphere");
  push(c.lon >= 0 ? "eastern-hemisphere" : "western-hemisphere");

  if (Math.abs(c.lat) <= 1) push("equator-hugger");
  if (Math.abs(c.lon) <= 1) push("prime-meridian-hugger");
  if (Math.abs(Math.abs(c.lon) - 180) <= 1) push("antimeridian-hugger");
  if (Math.abs(c.lat) >= 85) push("polar-proximity");

  const { distanceKm: capDist } = nearestCapital(c.lat, c.lon);
  if (capDist <= 25) {
    pushGraded(
      { id: "capital-jackpot", name: "Capital Landing", description: "Very close to a national capital.", rarityBand: "Legendary", probability: 0.00004 },
      { tier: "Legendary", value: capDist, atThreshold: 25, atBest: 0, curve: 0.8 }
    );
  } else if (capDist <= 250) {
    pushGraded(
      { id: "capital-close", name: "Capital Region", description: "Within range of a national capital.", rarityBand: "Uncommon", probability: 0.004 },
      { tier: "Uncommon", value: capDist, atThreshold: 250, atBest: 25, curve: 0.8 }
    );
  }

  const latIsWhole = Math.abs(c.lat - Math.round(c.lat)) < 0.005;
  const lonIsWhole = Math.abs(c.lon - Math.round(c.lon)) < 0.005;
  if (latIsWhole && lonIsWhole) push("round-coordinates");

  if (Math.trunc(c.lat) === Math.trunc(c.lon)) push("matching-integers");

  if (Math.abs(c.lat) >= 40 && Math.abs(c.lat) <= 50) push("roaring-forties");
  if (Math.abs(c.lat) <= 23.5) push("tropics-band");

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const coordinateMode: ModeEngine<Coordinate> = {
  id: "coordinates",
  name: "Coordinate Mode",
  roll,
  score,
  display: (c) => `${c.lat.toFixed(4)}°, ${c.lon.toFixed(4)}°`,
};
