"use client";

import { ReelRow, reelRowDuration, useCompleteAfter } from "./Reel";

const BASE_MS = 500;
const STAGGER_MS = 65;

export function CoordinateRollAnimation({ display, onComplete }: { display: string; onComplete: () => void }) {
  useCompleteAfter(reelRowDuration(display, BASE_MS, STAGGER_MS), onComplete);

  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="text-lg opacity-60">📍</span>
      <ReelRow text={display} baseMs={BASE_MS} staggerMs={STAGGER_MS} className="font-mono text-xl tracking-wide" digitsOnly />
    </div>
  );
}
