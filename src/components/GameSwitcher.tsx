"use client";

import { useState } from "react";
import type { ModeId } from "@/modes";
import type { ScoreResult } from "@/modes/types";
import { DailyRollCard } from "./DailyRollCard";

const MODE_ICONS: Record<ModeId, string> = {
  number: "🔢",
  letters: "🔤",
  dice: "🎲",
  cards: "🃏",
  coordinates: "📍",
  timecapsule: "⏳",
};

export interface GameRoll {
  modeId: ModeId;
  modeName: string;
  raw: unknown;
  display: string;
  score: ScoreResult;
}

export function GameSwitcher({ rolls }: { rolls: GameRoll[] }) {
  const [activeId, setActiveId] = useState<ModeId>(rolls[0]?.modeId);
  const active = rolls.find((r) => r.modeId === activeId) ?? rolls[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Select a game">
        {rolls.map((r) => (
          <button
            key={r.modeId}
            type="button"
            role="tab"
            aria-selected={r.modeId === active.modeId}
            onClick={() => setActiveId(r.modeId)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              r.modeId === active.modeId
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
          >
            <span className="mr-1.5">{MODE_ICONS[r.modeId]}</span>
            {r.modeName}
          </button>
        ))}
      </div>

      <DailyRollCard
        key={active.modeId}
        modeId={active.modeId}
        modeName={active.modeName}
        raw={active.raw}
        display={active.display}
        score={active.score}
      />
    </div>
  );
}
