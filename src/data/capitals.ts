// A small curated set of national capitals with approximate coordinates.
// Good enough for "nearest capital" proximity checks at launch — swap in a
// full ~200-capital dataset (e.g. from a geo package) before shipping widely.
export interface Capital {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export const CAPITALS: Capital[] = [
  { city: "Washington, D.C.", country: "United States", lat: 38.9, lon: -77.0 },
  { city: "Ottawa", country: "Canada", lat: 45.4, lon: -75.7 },
  { city: "Mexico City", country: "Mexico", lat: 19.4, lon: -99.1 },
  { city: "Bogotá", country: "Colombia", lat: 4.6, lon: -74.1 },
  { city: "Lima", country: "Peru", lat: -12.0, lon: -77.0 },
  { city: "Brasília", country: "Brazil", lat: -15.8, lon: -47.9 },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6, lon: -58.4 },
  { city: "Santiago", country: "Chile", lat: -33.4, lon: -70.7 },
  { city: "London", country: "United Kingdom", lat: 51.5, lon: -0.1 },
  { city: "Paris", country: "France", lat: 48.9, lon: 2.4 },
  { city: "Madrid", country: "Spain", lat: 40.4, lon: -3.7 },
  { city: "Lisbon", country: "Portugal", lat: 38.7, lon: -9.1 },
  { city: "Bern", country: "Switzerland", lat: 46.9, lon: 7.4 },
  { city: "Rome", country: "Italy", lat: 41.9, lon: 12.5 },
  { city: "Berlin", country: "Germany", lat: 52.5, lon: 13.4 },
  { city: "Vienna", country: "Austria", lat: 48.2, lon: 16.4 },
  { city: "Warsaw", country: "Poland", lat: 52.2, lon: 21.0 },
  { city: "Stockholm", country: "Sweden", lat: 59.3, lon: 18.1 },
  { city: "Oslo", country: "Norway", lat: 59.9, lon: 10.7 },
  { city: "Helsinki", country: "Finland", lat: 60.2, lon: 24.9 },
  { city: "Moscow", country: "Russia", lat: 55.8, lon: 37.6 },
  { city: "Athens", country: "Greece", lat: 38.0, lon: 23.7 },
  { city: "Ankara", country: "Türkiye", lat: 39.9, lon: 32.9 },
  { city: "Cairo", country: "Egypt", lat: 30.0, lon: 31.2 },
  { city: "Nairobi", country: "Kenya", lat: -1.3, lon: 36.8 },
  { city: "Pretoria", country: "South Africa", lat: -25.7, lon: 28.2 },
  { city: "Abuja", country: "Nigeria", lat: 9.1, lon: 7.5 },
  { city: "Rabat", country: "Morocco", lat: 34.0, lon: -6.8 },
  { city: "Riyadh", country: "Saudi Arabia", lat: 24.7, lon: 46.7 },
  { city: "New Delhi", country: "India", lat: 28.6, lon: 77.2 },
  { city: "Beijing", country: "China", lat: 39.9, lon: 116.4 },
  { city: "Tokyo", country: "Japan", lat: 35.7, lon: 139.7 },
  { city: "Seoul", country: "South Korea", lat: 37.6, lon: 127.0 },
  { city: "Bangkok", country: "Thailand", lat: 13.8, lon: 100.5 },
  { city: "Jakarta", country: "Indonesia", lat: -6.2, lon: 106.8 },
  { city: "Manila", country: "Philippines", lat: 14.6, lon: 121.0 },
  { city: "Canberra", country: "Australia", lat: -35.3, lon: 149.1 },
  { city: "Wellington", country: "New Zealand", lat: -41.3, lon: 174.8 },
  { city: "Ulaanbaatar", country: "Mongolia", lat: 47.9, lon: 106.9 },
  { city: "Reykjavik", country: "Iceland", lat: 64.1, lon: -21.9 },
];

/** Great-circle distance in km (haversine formula). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestCapital(lat: number, lon: number): { capital: Capital; distanceKm: number } {
  let best = CAPITALS[0];
  let bestDist = Infinity;
  for (const c of CAPITALS) {
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return { capital: best, distanceKm: bestDist };
}
