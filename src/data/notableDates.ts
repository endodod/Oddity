// Curated notable dates (month/day only — matched against any year) for the
// "Historical Proximity" badge. Facts only, no external text reproduced.
export interface NotableDate {
  month: number; // 1-12
  day: number;
  label: string;
}

export const NOTABLE_DATES: NotableDate[] = [
  { month: 7, day: 20, label: "Anniversary of the first crewed Moon landing (1969)" },
  { month: 11, day: 9, label: "Anniversary of the fall of the Berlin Wall (1989)" },
  { month: 1, day: 27, label: "International Holocaust Remembrance Day" },
  { month: 6, day: 6, label: "Anniversary of the D-Day landings (1944)" },
  { month: 4, day: 12, label: "Anniversary of the first human spaceflight (1961)" },
  { month: 1, day: 9, label: "Anniversary of the first iPhone unveiling (2007)" },
  { month: 8, day: 6, label: "Anniversary of the first website going live (1991)" },
  { month: 10, day: 4, label: "Anniversary of the Sputnik 1 launch (1957)" },
  { month: 12, day: 10, label: "Human Rights Day" },
  { month: 3, day: 20, label: "March equinox (approximate)" },
  { month: 9, day: 22, label: "September equinox (approximate)" },
  { month: 6, day: 21, label: "June solstice (approximate)" },
  { month: 12, day: 21, label: "December solstice (approximate)" },
];

export function nearestNotableDate(
  month: number,
  day: number
): { date: NotableDate; dayDistance: number } | null {
  let best: NotableDate | null = null;
  let bestDist = Infinity;
  for (const nd of NOTABLE_DATES) {
    // Compare day-of-year distance, wrapping across year boundary.
    const toDayOfYear = (m: number, d: number) => m * 31 + d; // coarse but fine for proximity
    const a = toDayOfYear(month, day);
    const b = toDayOfYear(nd.month, nd.day);
    const raw = Math.abs(a - b);
    const dist = Math.min(raw, 372 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = nd;
    }
  }
  return best ? { date: best, dayDistance: bestDist } : null;
}
