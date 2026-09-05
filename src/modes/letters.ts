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

/** Five independent letters A-Z, in rolled order — e.g. ["Q", "U", "I", "L", "T"]. */
export type LetterRoll = [string, string, string, string, string];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const RARE_LETTERS = new Set(["Q", "X", "Z", "J", "K", "V"]);

// Small curated list for the "It's a Word!" flavor badge — not exhaustive, just fun to hit.
const FIVE_LETTER_WORDS = new Set([
  "ABOUT", "THEIR", "THERE", "WHICH", "WOULD", "COULD", "SHOULD", "WORLD", "SOUND", "HOUSE",
  "MONEY", "MUSIC", "NIGHT", "RIGHT", "LIGHT", "FIGHT", "MIGHT", "SIGHT", "TIGHT", "BREAD",
  "HEART", "EARTH", "OCEAN", "SNAKE", "BRAVE", "CHESS", "DRIVE", "EAGLE", "FRESH", "GHOST",
  "HAPPY", "IDEAL", "JUMPY", "KNIFE", "LEMON", "MAGIC", "NOBLE", "QUIET", "ROBOT", "STORM",
  "TIGER", "UNITY", "VIVID", "WATER", "YOUTH", "ZEBRA", "ALARM", "BENCH", "CANDY", "DOUBT",
]);

function rollLetter(seed: () => number): string {
  return ALPHABET[Math.floor(seed() * 26)];
}

function roll(seed: () => number): LetterRoll {
  return [rollLetter(seed), rollLetter(seed), rollLetter(seed), rollLetter(seed), rollLetter(seed)];
}

function alphaIndex(letter: string): number {
  return ALPHABET.indexOf(letter);
}

function counts(letters: LetterRoll): Record<string, number> {
  const c: Record<string, number> = {};
  for (const l of letters) c[l] = (c[l] ?? 0) + 1;
  return c;
}

function isConsecutiveRun(sortedIdx: number[], length: number): boolean {
  const uniq = Array.from(new Set(sortedIdx)).sort((a, b) => a - b);
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

function isPalindrome(letters: LetterRoll): boolean {
  return letters.join("") === [...letters].reverse().join("");
}

function isAscending(letters: LetterRoll): boolean {
  return letters.every((l, i) => i === 0 || alphaIndex(l) >= alphaIndex(letters[i - 1]));
}

function isDescending(letters: LetterRoll): boolean {
  return letters.every((l, i) => i === 0 || alphaIndex(l) <= alphaIndex(letters[i - 1]));
}

/**
 * Probabilities are rough estimates over the 26-value/5-position space (11,881,376 total
 * ordered outcomes) — exact for the independent per-letter conditions (vowels, consonants,
 * runs), estimated for the collision-shape ones (pairs/trips/etc, same tradeoff dice.ts and
 * cards.ts take for their own flavor badges).
 */
function badgeDefs(): Omit<Badge, "epValue">[] {
  const defs: Omit<Badge, "epValue" | "rarityBand">[] = [
    { id: "quintuple-letters", name: "Fivefold", description: "All five letters match.", probability: 26 / 26 ** 5 },
    { id: "full-house-letters", name: "Letter Full House", description: "Three of one letter and two of another.", probability: 0.0003 },
    { id: "large-run-letters", name: "Full Run", description: "Five consecutive letters of the alphabet (e.g. ABCDE).", probability: 22 / 26 ** 5 },
    { id: "small-run-letters", name: "Short Run", description: "Four consecutive distinct letters present.", probability: 0.02 },
    { id: "all-different-letters", name: "Full Spread", description: "All five letters are distinct.", probability: 0.6644 },
    { id: "all-vowels", name: "Vowel Chorus", description: "All five letters are vowels (A, E, I, O, U).", probability: (5 / 26) ** 5 },
    { id: "all-consonants", name: "Consonant Wall", description: "All five letters are consonants.", probability: (21 / 26) ** 5 },
    { id: "palindrome-letters", name: "Letter Mirror", description: "The letters read the same forwards and backwards.", probability: 0.0015 },
    { id: "ascending-letters", name: "Alphabetical Climb", description: "Letters appear in non-decreasing alphabetical order.", probability: 0.0026 },
    { id: "descending-letters", name: "Alphabetical Drop", description: "Letters appear in non-increasing alphabetical order.", probability: 0.0026 },
    { id: "rare-letter-cluster", name: "Rare Find", description: "Three or more letters are rare (Q, X, Z, J, K, V).", probability: 0.03 },
    { id: "real-word", name: "It's a Word!", description: "The five letters spell a recognizable word.", probability: 0.0004 },
  ];
  return defs.map((d) => ({ ...d, rarityBand: rarityFromProbability(d.probability) }));
}

const BADGES: Record<string, Badge> = Object.fromEntries(
  badgeDefs().map((d) => [d.id, { ...d, epValue: epFromProbability(d.probability) }])
);

const NAMED_COMBOS: NamedCombo[] = [
  {
    id: "sorted-spread-letters",
    name: "Sorted Spread",
    description: "All five letters are distinct AND they landed in ascending alphabetical order.",
    requires: ["all-different-letters", "ascending-letters"],
    bonusEp: 2500,
  },
];

function score(letters: LetterRoll): ScoreResult {
  const c = counts(letters);
  const countValues = Object.values(c).sort((a, b) => b - a);
  const idxs = letters.map(alphaIndex);
  const sortedIdx = [...idxs].sort((a, b) => a - b);
  const vowelCount = letters.filter((l) => VOWELS.has(l)).length;
  const consonantCount = 5 - vowelCount;
  const rareCount = letters.filter((l) => RARE_LETTERS.has(l)).length;

  const earned: Badge[] = [];
  const push = (id: string) => earned.push(BADGES[id]);
  const pushGraded = (partial: Omit<Badge, "epValue" | "grade">, gradeInput: Parameters<typeof gradeBadge>[0]) => {
    const { epValue, grade } = gradeBadge(gradeInput);
    earned.push({ ...partial, epValue, grade });
  };

  if (countValues[0] === 5) {
    push("quintuple-letters");
  } else if (countValues[0] === 4) {
    const matchedLetter = Object.entries(c).find(([, n]) => n === 4)![0];
    pushGraded(
      { id: "four-of-a-kind-letters", name: "Four of a Kind", description: "Exactly four letters match.", rarityBand: "Epic", probability: 0.0004 },
      { tier: "Epic", value: alphaIndex(matchedLetter), atThreshold: 0, atBest: 25 }
    );
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    push("full-house-letters");
  } else if (countValues[0] === 3) {
    const matchedLetter = Object.entries(c).find(([, n]) => n === 3)![0];
    pushGraded(
      { id: "three-of-a-kind-letters", name: "Three of a Kind", description: "Exactly three letters match.", rarityBand: "Uncommon", probability: 0.009 },
      { tier: "Uncommon", value: alphaIndex(matchedLetter), atThreshold: 0, atBest: 25 }
    );
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    const pairIdxs = Object.entries(c).filter(([, n]) => n === 2).map(([l]) => alphaIndex(l));
    pushGraded(
      { id: "two-pair-letters", name: "Two Pair", description: "Two separate matching letter pairs.", rarityBand: "Uncommon", probability: 0.012 },
      { tier: "Uncommon", value: Math.max(...pairIdxs), atThreshold: 0, atBest: 25 }
    );
  } else if (countValues[0] === 2) {
    const matchedLetter = Object.entries(c).find(([, n]) => n === 2)![0];
    pushGraded(
      { id: "one-pair-letters", name: "One Pair", description: "Exactly one matching letter pair.", rarityBand: "Common", probability: 0.29 },
      { tier: "Common", value: alphaIndex(matchedLetter), atThreshold: 0, atBest: 25, curve: 1 }
    );
  }

  if (isConsecutiveRun(sortedIdx, 5)) push("large-run-letters");
  else if (isConsecutiveRun(sortedIdx, 4)) push("small-run-letters");

  if (countValues[0] === 1) push("all-different-letters");
  if (vowelCount === 5) push("all-vowels");
  if (consonantCount === 5) push("all-consonants");

  if (isPalindrome(letters)) push("palindrome-letters");
  else if (isAscending(letters)) push("ascending-letters");
  else if (isDescending(letters)) push("descending-letters");

  if (rareCount >= 3) push("rare-letter-cluster");
  if (FIVE_LETTER_WORDS.has(letters.join(""))) push("real-word");

  if (vowelCount >= 3 && vowelCount < 5) {
    pushGraded(
      { id: "vowel-dominance", name: "Vowel Dominance", description: "Most letters are vowels.", rarityBand: "Uncommon", probability: 0.05 },
      { tier: "Uncommon", value: vowelCount, atThreshold: 3, atBest: 4 }
    );
  } else if (consonantCount >= 3 && consonantCount < 5) {
    pushGraded(
      { id: "consonant-dominance", name: "Consonant Dominance", description: "Most letters are consonants.", rarityBand: "Common", probability: 0.4 },
      { tier: "Common", value: consonantCount, atThreshold: 3, atBest: 4 }
    );
  }

  const baseEp = earned.reduce((a, b) => a + b.epValue, 0);
  const { finalEp, combo, namedCombosHit } = applyCombos(earned, baseEp, NAMED_COMBOS);
  const bestProbability = Math.min(...earned.map((b) => b.probability), 1);
  const rarity = rarityFromProbability(bestProbability);

  return { badges: earned, baseEp, ep: finalEp, rarity, combo, namedCombosHit };
}

export const letterMode: ModeEngine<LetterRoll> = {
  id: "letters",
  name: "Letter Mode",
  roll,
  score,
  display: (letters) => letters.join(""),
};
