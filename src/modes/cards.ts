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

export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export type Suit = (typeof SUITS)[number];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}
export type CardHand = [Card, Card, Card, Card, Card];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

/** Fisher-Yates shuffle using the seeded PRNG, then take the first 5 cards. */
function roll(seed: () => number): CardHand {
  const deck = buildDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(seed() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, 5) as CardHand;
}

function rankValue(rank: Rank, aceHigh = true): number {
  const order = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const v = order.indexOf(rank) + 2;
  return rank === "A" && !aceHigh ? 1 : v;
}

function isRed(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

/**
 * Exact probabilities from the standard 5-card-draw distribution
 * (2,598,960 total hands — see poker-probability references).
 */
function badgeDefs(): Omit<Badge, "epValue" | "rarityBand">[] {
  return [
    { id: "royal-flush", name: "Royal Flush", description: "10-J-Q-K-A, all one suit.", probability: 4 / 2598960 },
    { id: "straight-flush", name: "Straight Flush", description: "Five consecutive ranks, all one suit.", probability: 36 / 2598960 },
    { id: "four-of-a-kind", name: "Four of a Kind", description: "Four cards of the same rank.", probability: 624 / 2598960 },
    { id: "full-house", name: "Full House", description: "Three of a kind plus a pair.", probability: 3744 / 2598960 },
    { id: "flush", name: "Flush", description: "All five cards share a suit (not a straight).", probability: 5108 / 2598960 },
    { id: "straight", name: "Straight", description: "Five consecutive ranks, mixed suits.", probability: 10200 / 2598960 },
    { id: "three-of-a-kind", name: "Three of a Kind", description: "Three cards of the same rank.", probability: 54912 / 2598960 },
    { id: "two-pair", name: "Two Pair", description: "Two separate matching pairs.", probability: 123552 / 2598960 },
    { id: "one-pair", name: "One Pair", description: "One matching pair.", probability: 1098240 / 2598960 },
    { id: "high-card", name: "High Card", description: "No pair or better.", probability: 1302540 / 2598960 },
    // Flavor extras layered on top of the base hand rank.
    { id: "wheel-straight", name: "The Wheel", description: "The straight is A-2-3-4-5.", probability: 10200 / 2598960 / 10 },
    { id: "broadway-straight", name: "Broadway", description: "The straight is 10-J-Q-K-A.", probability: 10200 / 2598960 / 10 },
    { id: "all-face-cards", name: "Court Assembly", description: "All five cards are J, Q, K, or A.", probability: 0.0005 },
    { id: "all-low-cards", name: "Low Ball", description: "All five cards are ranked 2 through 6.", probability: 0.001 },
    { id: "monochrome", name: "Monochrome Hand", description: "All five cards share a color but aren't a flush.", probability: 0.05 },
    { id: "rainbow", name: "Rainbow Hand", description: "All four suits are represented.", probability: 0.26 },
    { id: "pocket-rockets", name: "Pocket Rockets", description: "The hand contains a pair of Aces.", probability: 0.003 },
    { id: "rank-sum-extreme", name: "Extreme Weight", description: "Sum of card ranks is in the top or bottom 1%.", probability: 0.02 },
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
    id: "rainbow-face-off",
    name: "Rainbow Face-Off",
    description: "All four suits are present AND every card is a face card or Ace.",
    requires: ["rainbow", "all-face-cards"],
    bonusEp: 3000,
  },
];

function score(hand: CardHand): ScoreResult {
  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  const rankCounts: Record<string, number> = {};
  for (const c of hand) rankCounts[c.rank] = (rankCounts[c.rank] ?? 0) + 1;
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  const suitSet = new Set(hand.map((c) => c.suit));
  const isFlush = suitSet.size === 1;

  const highValues = [...hand].map((c) => rankValue(c.rank, true)).sort((a, b) => a - b);
  const lowAceValues = [...hand].map((c) => rankValue(c.rank, false)).sort((a, b) => a - b);

  const isConsecutive = (vals: number[]) => vals.every((v, i) => i === 0 || v === vals[i - 1] + 1);
  const isStraightHigh = isConsecutive(highValues);
  const isStraightLow = isConsecutive(lowAceValues); // catches the wheel (A-2-3-4-5)
  const isStraight = isStraightHigh || isStraightLow;

  const isRoyal = isStraightHigh && highValues[0] === 10;
  const isWheel = isStraightLow && lowAceValues[0] === 1;

  if (isFlush && isStraight) {
    if (isRoyal) push("royal-flush");
    else push("straight-flush");
  } else if (counts[0] === 4) {
    push("four-of-a-kind");
  } else if (counts[0] === 3 && counts[1] === 2) {
    push("full-house");
  } else if (isFlush) {
    push("flush");
  } else if (isStraight) {
    push("straight");
    if (isWheel) push("wheel-straight");
    if (isRoyal) push("broadway-straight"); // only reachable if not flush
  } else if (counts[0] === 3) {
    push("three-of-a-kind");
  } else if (counts[0] === 2 && counts[1] === 2) {
    push("two-pair");
  } else if (counts[0] === 2) {
    const pairRank = Object.entries(rankCounts).find(([, n]) => n === 2)![0] as Rank;
    pushGraded(
      { id: "one-pair", name: "One Pair", description: "One matching pair.", rarityBand: "Common", probability: 0.4226 },
      { tier: "Common", value: rankValue(pairRank, true), atThreshold: 2, atBest: 14 }
    );
  } else {
    push("high-card");
  }

  if (hand.every((c) => ["J", "Q", "K", "A"].includes(c.rank))) push("all-face-cards");
  if (hand.every((c) => ["2", "3", "4", "5", "6"].includes(c.rank))) push("all-low-cards");

  const colors = new Set(hand.map((c) => (isRed(c.suit) ? "red" : "black")));
  if (colors.size === 1 && !isFlush) push("monochrome");
  if (suitSet.size === 4) push("rainbow");

  if (rankCounts["A"] === 2) push("pocket-rockets");

  const rankSum = hand.reduce((a, c) => a + rankValue(c.rank, true), 0);
  if (rankSum >= 58 || rankSum <= 22) push("rank-sum-extreme"); // tune thresholds after simulation

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const cardMode: ModeEngine<CardHand> = {
  id: "cards",
  name: "Card Mode",
  roll,
  score,
  display: (hand) => hand.map((c) => `${c.rank}${c.suit}`).join(" "),
};
