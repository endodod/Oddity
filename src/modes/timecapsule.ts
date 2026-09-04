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
import { nearestNotableDate } from "../data/notableDates";

export interface TimeCapsule {
  date: Date; // rolled to the nearest minute (see roll())
}

const RANGE_START = new Date(Date.UTC(1900, 0, 1)).getTime();
const RANGE_END = new Date(Date.UTC(2099, 11, 31, 23, 59)).getTime();

function roll(seed: () => number): TimeCapsule {
  const t = RANGE_START + Math.floor(seed() * (RANGE_END - RANGE_START));
  const rounded = Math.floor(t / 60000) * 60000; // snap to the minute so "exact time" badges are reachable
  return { date: new Date(rounded) };
}

const ZODIAC: { name: string; startMonth: number; startDay: number; endMonth: number; endDay: number }[] = [
  { name: "Capricorn", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { name: "Aquarius", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { name: "Pisces", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
  { name: "Aries", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { name: "Taurus", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { name: "Gemini", startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { name: "Cancer", startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { name: "Leo", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { name: "Virgo", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { name: "Libra", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { name: "Scorpio", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { name: "Sagittarius", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
];

function zodiacFor(month: number, day: number): string {
  for (const z of ZODIAC) {
    if (z.startMonth === z.endMonth) {
      if (month === z.startMonth && day >= z.startDay && day <= z.endDay) return z.name;
    } else if (
      (month === z.startMonth && day >= z.startDay) ||
      (month === z.endMonth && day <= z.endDay)
    ) {
      return z.name;
    }
  }
  return "Capricorn"; // fallback, unreachable given full coverage above
}

function seasonFor(month: number): string {
  if ([12, 1, 2].includes(month)) return "Winter";
  if ([3, 4, 5].includes(month)) return "Spring";
  if ([6, 7, 8].includes(month)) return "Summer";
  return "Fall";
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function badgeDefs(): Omit<Badge, "epValue" | "rarityBand">[] {
  return [
    { id: "palindrome-date", name: "Palindrome Date", description: "The date string reads the same forwards and backwards.", probability: 0.001 },
    { id: "leap-day", name: "Leap Day", description: "Landed on February 29.", probability: 1 / 1461 },
    { id: "century-turn", name: "Century Turn", description: "The year ends in 00.", probability: 0.01 },
    { id: "millennium", name: "The Millennium", description: "The year is exactly 2000.", probability: 1 / 200 },
    { id: "first-of-month", name: "Fresh Start", description: "Day-of-month is 1.", probability: 1 / 30.4 },
    { id: "new-years-day", name: "New Year's Day", description: "Month/day is January 1.", probability: 1 / 365.25 },
    { id: "new-years-eve", name: "New Year's Eve", description: "Month/day is December 31.", probability: 1 / 365.25 },
    { id: "friday-13th", name: "Friday the 13th", description: "Day-of-month is 13 and it's a Friday.", probability: 1 / 850 },
    { id: "day-equals-month", name: "Mirror Date", description: "Day-of-month equals the month number.", probability: 12 / 365.25 },
    { id: "meme-420", name: "4/20", description: "Month/day is April 20.", probability: 1 / 365.25 },
    { id: "meme-609", name: "6/9", description: "Month/day is June 9.", probability: 1 / 365.25 },
    { id: "meme-1111", name: "11/11", description: "Month/day is November 11.", probability: 1 / 365.25 },
    { id: "time-1111", name: "11:11", description: "Time-of-day is 11:11.", probability: 2 / 1440 },
    { id: "time-420", name: "4:20", description: "Time-of-day is 4:20.", probability: 2 / 1440 },
    { id: "witching-hour", name: "Witching Hour", description: "Time falls between 00:00 and 00:59.", probability: 60 / 1440 },
    { id: "high-noon", name: "High Noon", description: "Time is exactly 12:00.", probability: 1 / 1440 },
    { id: "weekend-roll", name: "Weekend Roll", description: "Day-of-week is Saturday or Sunday.", probability: 2 / 7 },
    { id: "this-very-year", name: "This Very Year", description: "The rolled year matches the current year.", probability: 1 / 200 },
    // Collection-oriented flavor sets (low EP each, high pull toward "collect them all").
    ...ZODIAC.map((z) => ({
      id: `zodiac-${z.name.toLowerCase()}`,
      name: z.name,
      description: `Landed under the sign of ${z.name}.`,
      probability: 1 / 12,
    })),
    ...["Winter", "Spring", "Summer", "Fall"].map((s) => ({
      id: `season-${s.toLowerCase()}`,
      name: s,
      description: `Landed in ${s} (Northern Hemisphere convention).`,
      probability: 1 / 4,
    })),
  ];
}

const BADGES: Record<string, Badge> = Object.fromEntries(
  badgeDefs().map((d) => [
    d.id,
    { ...d, rarityBand: rarityFromProbability(d.probability), epValue: epFromProbability(d.probability) },
  ])
);

function isPalindromeDate(date: Date): boolean {
  // MMDDYYYY format, digits only.
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yyyy = String(date.getUTCFullYear());
  const s = mm + dd + yyyy;
  return s === s.split("").reverse().join("");
}

const NAMED_COMBOS: NamedCombo[] = [
  {
    id: "witching-weekend",
    name: "Witching Weekend",
    description: "Landed in the witching hour on a weekend.",
    requires: ["witching-hour", "weekend-roll"],
    bonusEp: 1500,
  },
];

function score(capsule: TimeCapsule): ScoreResult {
  const d = capsule.date;
  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const weekday = d.getUTCDay(); // 0 = Sunday
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();

  if (isPalindromeDate(d)) push("palindrome-date");
  if (month === 2 && day === 29 && isLeapYear(year)) push("leap-day");
  if (year % 100 === 0) push("century-turn");
  if (year === 2000) push("millennium");
  if (day === 1) push("first-of-month");
  if (month === 1 && day === 1) push("new-years-day");
  if (month === 12 && day === 31) push("new-years-eve");
  if (day === 13 && weekday === 5) push("friday-13th");
  if (day === month) push("day-equals-month");
  if (month === 4 && day === 20) push("meme-420");
  if (month === 6 && day === 9) push("meme-609");
  if (month === 11 && day === 11) push("meme-1111");
  if (hours % 12 === 11 && minutes === 11) push("time-1111");
  if (hours % 12 === 4 && minutes === 20) push("time-420");
  if (hours === 0) push("witching-hour");
  if (hours === 12 && minutes === 0) push("high-noon");
  if (weekday === 0 || weekday === 6) push("weekend-roll");

  const proximity = nearestNotableDate(month, day);
  if (proximity && proximity.dayDistance <= 3) {
    // Graded so day 1 pays out more than day 3; exact-day hits max the graded
    // badge out AND additionally earn the separate Legendary exact-match badge.
    pushGraded(
      { id: "historical-proximity", name: "Historical Echo", description: "Within 3 days of a notable historical date.", rarityBand: "Uncommon", probability: 0.07 },
      { tier: "Uncommon", value: proximity.dayDistance, atThreshold: 3, atBest: 0, curve: 1 }
    );
    if (proximity.dayDistance === 0) {
      pushGraded(
        { id: "historical-exact", name: "Historical Echo, Exact Match", description: "Landed on the precise day of a notable event.", rarityBand: "Legendary", probability: 0.0002 },
        { tier: "Legendary", value: 1, atThreshold: 1, atBest: 1 }
      );
    }
  }

  // Blast From the Past / Echo of Tomorrow: graded by how many years off from "today".
  const today = new Date();
  const yearsFromToday = year - today.getUTCFullYear();
  if (yearsFromToday <= -50) {
    pushGraded(
      { id: "blast-from-the-past", name: "Blast From the Past", description: "50+ years before the current year.", rarityBand: "Epic", probability: 0.25 },
      { tier: "Epic", value: -yearsFromToday, atThreshold: 50, atBest: 126, curve: 1.2 } // range caps at ~126y given the 1900 floor
    );
  } else if (yearsFromToday > 0) {
    pushGraded(
      { id: "echo-of-tomorrow", name: "Echo of Tomorrow", description: "A date still in the future.", rarityBand: "Epic", probability: 0.25 },
      { tier: "Epic", value: yearsFromToday, atThreshold: 1, atBest: 73, curve: 1.2 } // range caps at ~73y given the 2099 ceiling
    );
  } else if (yearsFromToday === 0) {
    push("this-very-year");
  }

  push(`zodiac-${zodiacFor(month, day).toLowerCase()}`);
  push(`season-${seasonFor(month).toLowerCase()}`);

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const timeCapsuleMode: ModeEngine<TimeCapsule> = {
  id: "timecapsule",
  name: "Time Capsule Mode",
  roll,
  score,
  display: (c) => c.date.toISOString().slice(0, 16).replace("T", " ") + " UTC",
};
