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

export type DiceRoll = [number, number, number, number, number];

function rollDie(seed: () => number): number {
  return Math.floor(seed() * 6) + 1;
}

function roll(seed: () => number): DiceRoll {
  return [rollDie(seed), rollDie(seed), rollDie(seed), rollDie(seed), rollDie(seed)];
}

function counts(dice: DiceRoll): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of dice) c[d] = (c[d] ?? 0) + 1;
  return c;
}

function isSmallStraight(sorted: number[]): boolean {
  const uniq = Array.from(new Set(sorted)).sort((a, b) => a - b);
  for (let i = 0; i + 3 < uniq.length; i++) {
    if (uniq[i + 1] === uniq[i] + 1 && uniq[i + 2] === uniq[i] + 2 && uniq[i + 3] === uniq[i] + 3) {
      return true;
    }
  }
  return false;
}

function isLargeStraight(sorted: number[]): boolean {
  const a = sorted.join("");
  return a === "12345" || a === "23456";
}

function isRolledOrderPalindrome(dice: DiceRoll): boolean {
  return dice.join("") === [...dice].reverse().join("");
}

function isRolledOrderAscending(dice: DiceRoll): boolean {
  return dice.every((d, i) => i === 0 || d >= dice[i - 1]);
}

function isRolledOrderDescending(dice: DiceRoll): boolean {
  return dice.every((d, i) => i === 0 || d <= dice[i - 1]);
}

/**
 * Static (non-graded) badge definitions — same shape as before. Graded badges
 * (High Roller, Low Roller, matched-value pairs/trips/quads, parity dominance)
 * are built on the fly inside score() via gradeBadge(), since their EP depends
 * on the specific roll, not just a fixed probability.
 */
function badgeDefs(): Omit<Badge, "epValue">[] {
  const defs: Omit<Badge, "epValue" | "rarityBand">[] = [
    { id: "yahtzee", name: "Yahtzee", description: "All five dice show the same value.", probability: 6 / 7776 },
    { id: "boxcars", name: "Boxcars", description: "All five dice show 6.", probability: 1 / 7776 },
    { id: "snake-cluster", name: "Snake Cluster", description: "All five dice show 1.", probability: 1 / 7776 },
    { id: "full-house", name: "Full House", description: "Three of one value and two of another.", probability: 300 / 7776 },
    { id: "large-straight", name: "Large Straight", description: "Five consecutive values (1-5 or 2-6).", probability: 240 / 7776 },
    { id: "small-straight", name: "Small Straight", description: "Four consecutive distinct values present.", probability: 0.19 },
    { id: "all-different", name: "Full Spread", description: "All five dice show distinct values.", probability: 0.093 },
    { id: "max-sum", name: "Perfect Thirty", description: "Sum of all dice is 30.", probability: 1 / 7776 },
    { id: "min-sum", name: "Rock Bottom", description: "Sum of all dice is 5.", probability: 1 / 7776 },
    { id: "lucky-seven", name: "Lucky Seven", description: "Sum of all dice is exactly 7.", probability: 0.0013 },
    { id: "blackjack-sum", name: "Blackjack", description: "Sum of all dice is exactly 21.", probability: 0.09 },
    { id: "rolled-palindrome", name: "Mirror Roll", description: "The roll order itself is a palindrome.", probability: 0.028 },
    { id: "rolled-ascending", name: "Climbing", description: "Dice appear in non-decreasing order as rolled.", probability: 0.02 },
    { id: "rolled-descending", name: "Falling", description: "Dice appear in non-increasing order as rolled.", probability: 0.02 },
  ];
  return defs.map((d) => ({ ...d, rarityBand: rarityFromProbability(d.probability) }));
}

const BADGES: Record<string, Badge> = Object.fromEntries(
  badgeDefs().map((d) => [d.id, { ...d, epValue: epFromProbability(d.probability) }])
);

/** Named combos: specific badge-id sets that pay a flat bonus when they co-occur. */
const NAMED_COMBOS: NamedCombo[] = [
  {
    id: "clean-sweep",
    name: "Clean Sweep",
    description: "Every die is different AND they landed in rising order.",
    requires: ["all-different", "rolled-ascending"],
    bonusEp: 2500,
  },
  {
    id: "mirror-house",
    name: "Mirror House",
    description: "A Full House that also happens to be a palindrome in roll order.",
    requires: ["full-house", "rolled-palindrome"],
    bonusEp: 4000,
  },
];

function score(dice: DiceRoll): ScoreResult {
  const sorted = [...dice].sort((a, b) => a - b);
  const c = counts(dice);
  const countValues = Object.values(c).sort((a, b) => b - a);
  const sum = dice.reduce((a, b) => a + b, 0);
  const evenCount = dice.filter((d) => d % 2 === 0).length;
  const oddCount = 5 - evenCount;

  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  // --- Matched-value combos: graded by which face value matched (a pair of 6s
  // beats a pair of 1s within the same tier). ---
  if (countValues[0] === 5) {
    push("yahtzee");
    if (dice[0] === 6) push("boxcars");
    if (dice[0] === 1) push("snake-cluster");
  } else if (countValues[0] === 4) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 4)![0]);
    pushGraded(
      { id: "four-of-a-kind", name: "Four of a Kind", description: "Exactly four dice match.", rarityBand: "Epic", probability: 150 / 7776 },
      { tier: "Epic", value: matchedValue, atThreshold: 1, atBest: 6 }
    );
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    push("full-house");
  } else if (countValues[0] === 3) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 3)![0]);
    pushGraded(
      { id: "three-of-a-kind", name: "Three of a Kind", description: "Exactly three dice match.", rarityBand: "Uncommon", probability: 0.15 },
      { tier: "Uncommon", value: matchedValue, atThreshold: 1, atBest: 6 }
    );
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    const pairValues = Object.entries(c).filter(([, n]) => n === 2).map(([v]) => Number(v));
    pushGraded(
      { id: "two-pair", name: "Two Pair", description: "Two separate matching pairs.", rarityBand: "Uncommon", probability: 0.2 },
      { tier: "Uncommon", value: Math.max(...pairValues), atThreshold: 1, atBest: 6 }
    );
  } else if (countValues[0] === 2) {
    const matchedValue = Number(Object.entries(c).find(([, n]) => n === 2)![0]);
    pushGraded(
      { id: "one-pair", name: "One Pair", description: "Exactly one matching pair.", rarityBand: "Common", probability: 0.35 },
      { tier: "Common", value: matchedValue, atThreshold: 1, atBest: 6, curve: 1 }
    );
  }

  if (isLargeStraight(sorted)) push("large-straight");
  else if (isSmallStraight(sorted)) push("small-straight");

  if (countValues[0] === 1) push("all-different");

  // --- Sum-based badges: High/Low Roller are graded; the true extremes (30, 5)
  // stay their own separate Mythic badges rather than the top of the graded range. ---
  if (sum === 30) push("max-sum");
  else if (sum >= 25) {
    pushGraded(
      { id: "high-sum", name: "High Roller", description: "Sum of all dice is 25 or more.", rarityBand: "Uncommon", probability: 0.01 },
      { tier: "Uncommon", value: sum, atThreshold: 25, atBest: 29 }
    );
  }
  if (sum === 5) push("min-sum");
  else if (sum <= 8) {
    pushGraded(
      { id: "low-sum", name: "Low Roller", description: "Sum of all dice is 8 or less.", rarityBand: "Uncommon", probability: 0.01 },
      { tier: "Uncommon", value: sum, atThreshold: 8, atBest: 6 } // lower sum = closer to best, note reversed direction
    );
  }
  if (sum === 7) push("lucky-seven");
  if (sum === 21) push("blackjack-sum");

  // --- Parity dominance: graded 3 -> 4 evens/odds; 5/5 is still its own flat badge
  // (kept as a static Common badge elsewhere in the set) so it doesn't just look like
  // "Even Dominance maxed out" — it's a distinct, separately-named thing. ---
  if (evenCount >= 3 && evenCount < 5) {
    pushGraded(
      { id: "even-dominance", name: "Even Dominance", description: "Most of the dice show even values.", rarityBand: "Common", probability: 0.3 },
      { tier: "Common", value: evenCount, atThreshold: 3, atBest: 4 }
    );
  } else if (oddCount >= 3 && oddCount < 5) {
    pushGraded(
      { id: "odd-dominance", name: "Odd Dominance", description: "Most of the dice show odd values.", rarityBand: "Common", probability: 0.3 },
      { tier: "Common", value: oddCount, atThreshold: 3, atBest: 4 }
    );
  }

  if (isRolledOrderPalindrome(dice)) push("rolled-palindrome");
  else if (isRolledOrderAscending(dice)) push("rolled-ascending");
  else if (isRolledOrderDescending(dice)) push("rolled-descending");

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const diceMode: ModeEngine<DiceRoll> = {
  id: "dice",
  name: "Dice Mode",
  roll,
  score,
  display: (dice) => dice.join(" · "),
};
