"use client";

import { ReelChar, useCompleteAfter } from "./Reel";

const BASE_MS = 600;
const STAGGER_MS = 160;
const TICK_MS = 45;

export function LetterRollAnimation({ display, onComplete }: { display: string; onComplete: () => void }) {
  const chars = display.split("");
  useCompleteAfter(BASE_MS + Math.max(0, chars.length - 1) * STAGGER_MS + 350, onComplete);

  return (
    <div className="flex gap-2">
      {chars.map((ch, i) => (
        <div
          key={i}
          className="h-14 w-11 rounded-md bg-amber-100 text-slate-900 border border-amber-300/60 shadow flex items-center justify-center text-2xl font-mono font-bold"
        >
          <ReelChar finalChar={ch} settleAfterMs={BASE_MS + i * STAGGER_MS} tickMs={TICK_MS} />
        </div>
      ))}
    </div>
  );
}
