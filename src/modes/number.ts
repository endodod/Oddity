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

/** Five independent digits, most-significant first — e.g. [4, 0, 1, 2, 9] displays as "40129". */
export type NumberRoll = [number, number, number, number, number];

function rollDigit(seed: () => number): number {
  return Math.floor(seed() * 10);
}

function roll(seed: () => number): NumberRoll {
  return [rollDigit(seed), rollDigit(seed), rollDigit(seed), rollDigit(seed), rollDigit(seed)];
}

function toValue(digits: NumberRoll): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}

function counts(digits: NumberRoll): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of digits) c[d] = (c[d] ?? 0) + 1;
  return c;
}

function isConsecutiveRun(sorted: number[], length: number): boolean {
  const uniq = Array.from(new Set(sorted)).sort((a, b) => a - b);
  for (let i = 0; i + length - 1 < uniq.length; i++) {
    let ok = true;
    for (let k = 1; k < length; k++) {
      if (uniq[i + k] !== uniq[i] + k) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function isPalindrome(digits: NumberRoll): boolean {
  return digits.join("") === [...digits].reverse().join("");
}

function isAscending(digits: NumberRoll): boolean {
  return digits.every((d, i) => i === 0 || d >= digits[i - 1]);
}

function isDescending(digits: NumberRoll): boolean {
  return digits.every((d, i) => i === 0 || d <= digits[i - 1]);
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

function isPerfectSquare(n: number): boolean {
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

/**
 * Probabilities are computed from the 10-value/5-position multinomial distribution
 * (100,000 total ordered outcomes) where exact, and reasonable estimates elsewhere —
 * mirrors the exact 6-value analogue in dice.ts, just widened to 10 digit values.
 */
function badgeDefs(): Omit<Badge, "epValue">[] {
  const defs: Omit<Badge, "epValue" | "rarityBand">[] = [
    { id: "quintuple", name: "Quintuple", description: "All five digits match.", probability: 10 / 100000 },
    { id: "all-zeros", name: "Absolute Zero", description: "The roll is 00000.", probability: 1 / 100000 },
    { id: "all-nines", name: "Maximum Overdrive", description: "The roll is 99999.", probability: 1 / 100000 },
    { id: "full-house-digits", name: "Digit Full House", description: "Three of one digit and two of another.", probability: 900 / 100000 },
    { id: "large-run", name: "Full Run", description: "Five consecutive digits (e.g. 01234 or 56789).", probability: 720 / 100000 },
    { id: "small-run", name: "Short Run", description: "Four consecutive distinct digits present.", probability: 0.11 },
    { id: "all-different-digits", name: "Full Spread", description: "All five digits are distinct.", probability: 0.3024 },
    { id: "max-sum-digits", name: "Peak Value", description: "Digit sum is 45 (all nines).", probability: 1 / 100000 },
    { id: "min-sum-digits", name: "Rock Bottom", description: "Digit sum is 0 (all zeros).", probability: 1 / 100000 },
    { id: "palindrome-number", name: "Numeric Mirror", description: "The digits read the same forwards and backwards.", probability: 0.001 },
    { id: "ascending-digits", name: "Climbing", description: "Digits are non-decreasing left to right.", probability: 0.0025 },
    { id: "descending-digits", name: "Falling", description: "Digits are non-increasing left to right.", probability: 0.0025 },
    { id: "round-thousand", name: "Round Number", description: "The number ends in three or more zeros.", probability: 0.0028 },
    { id: "prime-roll", name: "Prime Cut", description: "The full 5-digit number is prime.", probability: 0.098 },
    { id: "perfect-square", name: "Perfect Square", description: "The full 5-digit number is a perfect square.", probability: 0.0032 },
  ];
  return defs.map((d) => ({ ...d, rarityBand: rarityFromProbability(d.probability) }));
}

const BADGES: Record<string, Badge> = Object.fromEntries(
  badgeDefs().map((d) => [d.id, { ...d, epValue: epFromProbability(d.probability) }])
);

const NAMED_COMBOS: NamedCombo[] = [
  {
    id: "sorted-spread-digits",
    name: "Sorted Spread",
    description: "All five digits are distinct AND they landed in ascending order.",
    requires: ["all-different-digits", "ascending-digits"],
    bonusEp: 2500,
  },
];

function score(digits: NumberRoll): ScoreResult {
  const sorted = [...digits].sort((a, b) => a - b);
  const c = counts(digits);
  const countValues = Object.values(c).sort((a, b) => b - a);
  const sum = digits.reduce((a, b) => a + b, 0);
  const evenCount = digits.filter((d) => d % 2 === 0).length;
  const oddCount = 5 - evenCount;
  const value = toValue(digits);

  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  if (countValues[0] === 5) {
    push("quintuple");
    if (digits[0] === 0) push("all-zeros");
    if (digits[0] === 9) push("all-nines");
  } else if (countValues[0] === 4) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 4)![0]);
    pushGraded(
      { id: "four-of-a-kind-digits", name: "Four of a Kind", description: "Exactly four digits match.", rarityBand: "Epic", probability: 450 / 100000 },
      { tier: "Epic", value: matchedValue, atThreshold: 0, atBest: 9 }
    );
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    push("full-house-digits");
  } else if (countValues[0] === 3) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 3)![0]);
    pushGraded(
      { id: "three-of-a-kind-digits", name: "Three of a Kind", description: "Exactly three digits match.", rarityBand: "Uncommon", probability: 0.072 },
      { tier: "Uncommon", value: matchedValue, atThreshold: 0, atBest: 9 }
    );
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    const pairValues = Object.entries(c).filter(([, n]) => n === 2).map(([v]) => Number(v));
    pushGraded(
      { id: "two-pair-digits", name: "Two Pair", description: "Two separate matching digit pairs.", rarityBand: "Uncommon", probability: 0.108 },
      { tier: "Uncommon", value: Math.max(...pairValues), atThreshold: 0, atBest: 9 }
    );
  } else if (countValues[0] === 2) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 2)![0]);
    pushGraded(
      { id: "one-pair-digits", name: "One Pair", description: "Exactly one matching digit pair.", rarityBand: "Common", probability: 0.4 },
      { tier: "Common", value: matchedValue, atThreshold: 0, atBest: 9, curve: 1 }
    );
  }

  if (isConsecutiveRun(sorted, 5)) push("large-run");
  else if (isConsecutiveRun(sorted, 4)) push("small-run");

  if (countValues[0] === 1) push("all-different-digits");

  if (sum === 45) push("max-sum-digits");
  if (sum === 0) push("min-sum-digits");

  if (isPalindrome(digits)) push("palindrome-number");
  else if (isAscending(digits)) push("ascending-digits");
  else if (isDescending(digits)) push("descending-digits");

  if (value !== 0 && value % 1000 === 0) push("round-thousand");
  if (isPrime(value)) push("prime-roll");
  if (isPerfectSquare(value)) push("perfect-square");

  if (evenCount >= 3 && evenCount < 5) {
    pushGraded(
      { id: "even-dominance-digits", name: "Even Dominance", description: "Most digits are even.", rarityBand: "Common", probability: 0.3 },
      { tier: "Common", value: evenCount, atThreshold: 3, atBest: 4 }
    );
  } else if (oddCount >= 3 && oddCount < 5) {
    pushGraded(
      { id: "odd-dominance-digits", name: "Odd Dominance", description: "Most digits are odd.", rarityBand: "Common", probability: 0.3 },
      { tier: "Common", value: oddCount, atThreshold: 3, atBest: 4 }
    );
  }

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const numberMode: ModeEngine<NumberRoll> = {
  id: "number",
  name: "Number Mode",
  roll,
  score,
  display: (digits) => digits.join(""),
};
