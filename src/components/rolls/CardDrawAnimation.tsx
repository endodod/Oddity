"use client";

import { useEffect, useState } from "react";
import type { CardHand } from "@/modes/cards";
import { useCompleteAfter } from "./Reel";

const DEAL_STAGGER_MS = 480;
const FLIP_MS = 350;
export const CARD_DURATION_MS = DEAL_STAGGER_MS * 5 + FLIP_MS + 300;

function isRed(suit: string): boolean {
  return suit === "♥" || suit === "♦";
}

function Card({ card, dealt, revealed }: { card: CardHand[number]; dealt: boolean; revealed: boolean }) {
  return (
    <div
      className={`relative h-20 w-14 transition-all duration-300 ease-out [transform-style:preserve-3d] ${
        dealt ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{
        transitionDuration: `${FLIP_MS}ms`,
        transform: `${dealt ? "translateY(0)" : "translateY(12px)"} rotateY(${revealed ? 180 : 0}deg)`,
      }}
    >
      {/* Back face */}
      <div
        className="absolute inset-0 rounded-md border-2 border-white/20 bg-indigo-700 [backface-visibility:hidden]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 6px, transparent 6px 12px)" }}
      />
      {/* Front face */}
      <div
        className={`absolute inset-0 rounded-md border border-black/10 bg-white flex flex-col items-center justify-center [backface-visibility:hidden] ${
          isRed(card.suit) ? "text-red-600" : "text-slate-900"
        }`}
        style={{ transform: "rotateY(180deg)" }}
      >
        <span className="text-lg font-bold leading-none">{card.rank}</span>
        <span className="text-xl leading-none">{card.suit}</span>
      </div>
    </div>
  );
}

const FLIP_DELAY_MS = 200;

export function CardDrawAnimation({ finalValue, onComplete }: { finalValue: CardHand; onComplete: () => void }) {
  const [dealtCount, setDealtCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    const timers = finalValue.flatMap((_, i) => [
      setTimeout(() => setDealtCount((n) => Math.max(n, i + 1)), i * DEAL_STAGGER_MS),
      setTimeout(() => setRevealedCount((n) => Math.max(n, i + 1)), i * DEAL_STAGGER_MS + FLIP_DELAY_MS),
    ]);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useCompleteAfter(CARD_DURATION_MS, onComplete);

  return (
    <div className="flex gap-2">
      {finalValue.map((card, i) => (
        <Card key={i} card={card} dealt={i < dealtCount} revealed={i < revealedCount} />
      ))}
    </div>
  );
}
