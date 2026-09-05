"use client";

import { useState } from "react";
import type { ModeId } from "@/modes";
import type { ScoreResult } from "@/modes/types";
import type { DiceRoll } from "@/modes/dice";
import type { CardHand } from "@/modes/cards";
import { DiceRollAnimation } from "./rolls/DiceRollAnimation";
import { CardDrawAnimation } from "./rolls/CardDrawAnimation";
import { CoordinateRollAnimation } from "./rolls/CoordinateRollAnimation";
import { TimeCapsuleRollAnimation } from "./rolls/TimeCapsuleRollAnimation";
import { NumberRollAnimation } from "./rolls/NumberRollAnimation";
import { LetterRollAnimation } from "./rolls/LetterRollAnimation";
import { RARITY_COLORS } from "./rarityColors";

const BADGE_STAGGER_MS = 350;

interface Props {
  modeId: ModeId;
  modeName: string;
  raw: unknown;
  display: string;
  score: ScoreResult;
}

function RollAnimation({ modeId, raw, display, onComplete }: { modeId: ModeId; raw: unknown; display: string; onComplete: () => void }) {
  switch (modeId) {
    case "dice":
      return <DiceRollAnimation finalValue={raw as DiceRoll} onComplete={onComplete} />;
    case "cards":
      return <CardDrawAnimation finalValue={raw as CardHand} onComplete={onComplete} />;
    case "coordinates":
      return <CoordinateRollAnimation display={display} onComplete={onComplete} />;
    case "timecapsule":
      return <TimeCapsuleRollAnimation display={display} onComplete={onComplete} />;
    case "number":
      return <NumberRollAnimation display={display} onComplete={onComplete} />;
    case "letters":
      return <LetterRollAnimation display={display} onComplete={onComplete} />;
  }
}

export function DailyRollCard({ modeId, modeName, raw, display, score }: Props) {
  const [revealed, setRevealed] = useState(false);
  const sortedBadges = [...score.badges].sort((a, b) => a.epValue - b.epValue);

  return (
    <section className="rounded-lg border border-white/10 p-4">
      <h2 className="text-xl font-semibold">{modeName}</h2>
      <div className="my-3 min-h-[64px] flex items-center">
        <RollAnimation modeId={modeId} raw={raw} display={display} onComplete={() => setRevealed(true)} />
      </div>
      <div
        className={`transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!revealed}
      >
        <p className="text-sm opacity-80">
          {score.badges.length} badge{score.badges.length === 1 ? "" : "s"} · {score.ep.toLocaleString("en-US")} EP ·{" "}
          {score.rarity}
          {score.combo.label ? ` · ${score.combo.label}` : ""}
        </p>
        <ul className="mt-2 text-sm space-y-1">
          {sortedBadges.map((b, i) => {
            const colors = RARITY_COLORS[b.rarityBand];
            return (
              <li
                key={b.id}
                className={`flex items-center gap-2 border-l-2 pl-2 transition-all duration-300 ease-out ${colors.border} ${
                  revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                }`}
                style={{ transitionDelay: `${i * BADGE_STAGGER_MS}ms` }}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} />
                <span className={colors.text}>{b.name}</span>
                <span className="opacity-60">— {b.epValue.toLocaleString("en-US")} EP</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
