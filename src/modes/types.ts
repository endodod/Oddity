// Shared types used by every mode's scoring engine.
// Each mode module exports `roll(seed)` and `score(rawValue)` matching this contract
// so the daily-roll page, leaderboard, and profile pages can iterate generically.

export type RarityBand =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythic";

/** EP range for each tier — see ep-balancing doc. Used as the ceiling/floor for graded badges. */
export const TIER_RANGES: Record<RarityBand, [number, number]> = {
  Common: [100, 1000],
  Uncommon: [1000, 5000],
  Rare: [5000, 20000],
  Epic: [20000, 75000],
  Legendary: [75000, 250000],
  Mythic: [250000, 1000000],
};

export interface Badge {
  /** Stable slug, e.g. "yahtzee" or "royal-flush". Used as the Prisma Badge.id. */
  id: string;
  name: string;
  description: string;
  rarityBand: RarityBand;
  /** Estimated hit probability (0-1). Replace with simulated values before launch. */
  probability: number;
  /** EP awarded when this badge is earned. For graded badges this is the value actually
   *  rolled this time (between the badge's epMin/epMax) — see gradeBadge(). */
  epValue: number;
  /** Present only on badges scored by magnitude (see gradeBadge()). Lets the UI show
   *  "812 / 1,000 EP — so close to the cap!" instead of just a flat number. */
  grade?: { epMin: number; epMax: number; magnitude: number };
}

export interface ScoreResult {
  badges: Badge[];
  /** Sum of individual badge EP, before the combo multiplier/bonus. */
  baseEp: number;
  /** Final EP after the combo layer — this is what actually gets added to the player's total. */
  ep: number;
  rarity: RarityBand;
  combo: ComboResult;
  namedCombosHit: NamedCombo[];
}

export interface ModeEngine<TRaw> {
  id: string;
  name: string;
  roll(seed: () => number): TRaw;
  score(raw: TRaw): ScoreResult;
  /** Human-readable rendering of the raw value, for display/sharing. */
  display(raw: TRaw): string;
}

/**
 * EP formula shared across modes: rarer badges are worth more.
 * k is a tuning constant — adjust after playtesting so totals feel good.
 */
export function epFromProbability(probability: number, k = 40): number {
  const p = Math.max(probability, 1e-7); // avoid divide-by-zero on "impossible" badges
  return Math.round(k / Math.sqrt(p));
}

export function rarityFromProbability(probability: number): RarityBand {
  if (probability < 0.00001) return "Mythic";
  if (probability < 0.0001) return "Legendary";
  if (probability < 0.001) return "Epic";
  if (probability < 0.01) return "Rare";
  if (probability < 0.1) return "Uncommon";
  return "Common";
}

// ---------------------------------------------------------------------------
// Graded (magnitude-scaled) badges
//
// Some conditions aren't just yes/no — "more evens than odds" is more
// impressive with 7 evens than with 4, "capital jackpot" is more impressive
// at 2km than at 24km. A graded badge still belongs to one rarity tier (so it
// sits in the badge case in the right place and the tier still communicates
// "how special is this"), but its EP scales within that tier's range based on
// how extreme the actual roll was, instead of being a single flat number.
// ---------------------------------------------------------------------------

export interface GradeInput {
  /** The tier this badge belongs to — sets the EP floor/ceiling. */
  tier: RarityBand;
  /** Raw magnitude for this roll (e.g. count of even digits, distance in km). */
  value: number;
  /** The magnitude at which the badge JUST barely qualifies (worth the tier's floor-ish EP). */
  atThreshold: number;
  /** The best possible magnitude for this condition (worth the tier's ceiling EP). Can be
   *  numerically smaller than atThreshold for "closer is better" conditions (e.g. distance). */
  atBest: number;
  /** Exponent on the normalized 0..1 progress. 1 = linear. >1 rewards true extremes
   *  disproportionately (recommended for "structural" magnitudes like run length or
   *  digit-parity counts). <1 rewards near-qualifiers more generously (recommended for
   *  continuous physical magnitudes like distance-in-km, where the last few km matter less
   *  than the first big jump into range). Default 1.4 — a gentle reward-the-extreme curve. */
  curve?: number;
  /** Fraction of the tier's EP range used as the floor for the *worst* qualifying magnitude.
   *  Default 0.35 — even a bare-minimum qualifier is worth more than nothing, but nowhere
   *  near what the extreme case pays out. */
  floorFraction?: number;
}

/**
 * Turns a raw magnitude into an EP value within the badge's tier range, plus the
 * `grade` metadata the UI needs to show a progress-style readout.
 */
export function gradeBadge(input: GradeInput): { epValue: number; grade: NonNullable<Badge["grade"]> } {
  const { tier, value, atThreshold, atBest, curve = 1.4, floorFraction = 0.35 } = input;
  const [tierMin, tierMax] = TIER_RANGES[tier];

  const span = atBest - atThreshold;
  const raw = span === 0 ? 1 : (value - atThreshold) / span;
  const t = Math.min(Math.max(raw, 0), 1);
  const eased = Math.pow(t, curve);

  const gradeEpMin = Math.round(tierMin + (tierMax - tierMin) * floorFraction);
  const gradeEpMax = tierMax;
  const epValue = Math.round(gradeEpMin + (gradeEpMax - gradeEpMin) * eased);

  return {
    epValue,
    grade: { epMin: gradeEpMin, epMax: gradeEpMax, magnitude: value },
  };
}

// ---------------------------------------------------------------------------
// Combos
//
// Two layers, deliberately simple to keep the reveal readable:
//  1. A generic "badge count" multiplier — the more badges stack on one roll,
//     the bigger the multiplier on the roll's TOTAL ep. Applies automatically
//     in every mode, no authoring required.
//  2. Named combos — a small, hand-curated list per mode of specific badge
//     pairs/sets that are thematically fun together (e.g. a coordinate that's
//     both "In the Tropics" and "On Land" = "Rainforest Special"). These are
//     their own bonus badge with their own flat EP, awarded IN ADDITION to
//     the badges that triggered them, on top of the generic multiplier.
// ---------------------------------------------------------------------------

export interface ComboResult {
  badgeCount: number;
  multiplier: number;
  label: string | null;
}

const COMBO_STEPS: { min: number; multiplier: number; label: string }[] = [
  { min: 7, multiplier: 1.5, label: "ULTRA COMBO!" },
  { min: 5, multiplier: 1.3, label: "Mega Combo!" },
  { min: 3, multiplier: 1.15, label: "Combo!" },
  { min: 2, multiplier: 1.05, label: "Double!" },
];

/** Generic stacking bonus based purely on how many badges fired this roll. */
export function comboMultiplier(badgeCount: number): ComboResult {
  const step = COMBO_STEPS.find((s) => badgeCount >= s.min);
  return { badgeCount, multiplier: step?.multiplier ?? 1, label: step?.label ?? null };
}

export interface NamedCombo {
  id: string;
  name: string;
  description: string;
  /** All of these badge ids must be present on the roll for the combo to fire. */
  requires: string[];
  bonusEp: number;
}

/** Returns every named combo whose full badge-id requirement is satisfied by this roll. */
export function matchNamedCombos(earnedIds: Set<string>, combos: NamedCombo[]): NamedCombo[] {
  return combos.filter((c) => c.requires.every((id) => earnedIds.has(id)));
}

/**
 * Applies the full combo layer to a base badge list + base EP total:
 * generic multiplier first, then named-combo flat bonuses (which are NOT
 * themselves multiplied — they're a fixed "you found a secret" reward).
 */
export function applyCombos(
  badges: Badge[],
  baseEp: number,
  namedCombos: NamedCombo[]
): { finalEp: number; combo: ComboResult; namedCombosHit: NamedCombo[] } {
  const combo = comboMultiplier(badges.length);
  const earnedIds = new Set(badges.map((b) => b.id));
  const namedCombosHit = matchNamedCombos(earnedIds, namedCombos);
  const namedBonus = namedCombosHit.reduce((a, c) => a + c.bonusEp, 0);
  const finalEp = Math.round(baseEp * combo.multiplier) + namedBonus;
  return { finalEp, combo, namedCombosHit };
}

/** Deterministic PRNG (mulberry32) so a seed produces the same roll every time. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string (e.g. `${userId}-${modeId}-${dateISO}`) into a 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
