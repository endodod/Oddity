"use client";

import { useEffect, useRef, useState } from "react";
import type { DiceRoll } from "@/modes/dice";
import { useCompleteAfter } from "./Reel";

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const active = new Set(PIP_POSITIONS[value] ?? []);
  return (
    <div
      className={`h-12 w-12 rounded-lg bg-white shadow-lg grid grid-cols-3 grid-rows-3 gap-0.5 p-2 transition-transform duration-150 ${
        rolling ? "animate-[dice-spin_0.5s_linear_infinite]" : "scale-110"
      }`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`rounded-full self-center justify-self-center h-2 w-2 ${active.has(i) ? "bg-slate-900" : ""}`} />
      ))}
    </div>
  );
}

const SETTLE_BASE = 650;
const SETTLE_STAGGER = 260;
const TICK_MS = 70;
export const DICE_DURATION_MS = SETTLE_BASE + 4 * SETTLE_STAGGER + 400;

export function DiceRollAnimation({ finalValue, onComplete }: { finalValue: DiceRoll; onComplete: () => void }) {
  const [display, setDisplay] = useState<number[]>(() => finalValue.map(() => 1));
  const [settled, setSettled] = useState<boolean[]>(() => finalValue.map(() => false));
  const settledRef = useRef(settled);
  settledRef.current = settled;

  useEffect(() => {
    const tick = setInterval(() => {
      setDisplay((prev) => prev.map((v, i) => (settledRef.current[i] ? v : Math.floor(Math.random() * 6) + 1)));
    }, TICK_MS);

    const timers = finalValue.map((val, i) =>
      setTimeout(() => {
        setDisplay((prev) => {
          const next = [...prev];
          next[i] = val;
          return next;
        });
        setSettled((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, SETTLE_BASE + i * SETTLE_STAGGER)
    );

    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useCompleteAfter(DICE_DURATION_MS, onComplete);

  return (
    <div className="flex gap-3">
      {display.map((v, i) => (
        <Die key={i} value={v} rolling={!settled[i]} />
      ))}
    </div>
  );
}
