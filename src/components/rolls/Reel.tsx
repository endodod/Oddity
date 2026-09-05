"use client";

import { useEffect, useRef, useState } from "react";

const DIGIT_CANDIDATES = "0123456789";
const LETTER_CANDIDATES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function candidatesFor(finalChar: string, digitsOnly: boolean): string | null {
  if (/[0-9]/.test(finalChar)) return DIGIT_CANDIDATES;
  if (!digitsOnly && /[a-zA-Z]/.test(finalChar)) return LETTER_CANDIDATES;
  return null; // punctuation/spaces/fixed text (e.g. "UTC") never spin — they just sit there
}

interface ReelCharProps {
  finalChar: string;
  settleAfterMs: number;
  tickMs?: number;
  className?: string;
  /** When true, only digit characters spin — letters render as static text.
   *  Use for rows like coordinates/dates where any letters are fixed labels, not rolled data. */
  digitsOnly?: boolean;
}

/** A single character slot that free-spins through its candidate alphabet, then locks in. */
export function ReelChar({ finalChar, settleAfterMs, tickMs = 55, className = "", digitsOnly = false }: ReelCharProps) {
  const candidates = candidatesFor(finalChar, digitsOnly);
  const [display, setDisplay] = useState(candidates ? candidates[0] : finalChar);
  const [settled, setSettled] = useState(!candidates);

  useEffect(() => {
    if (!candidates) return;
    setSettled(false);
    const interval = setInterval(() => {
      setDisplay(candidates[Math.floor(Math.random() * candidates.length)]);
    }, tickMs);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setDisplay(finalChar);
      setSettled(true);
    }, settleAfterMs);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // Intentionally run once per mount — finalChar/settleAfterMs are fixed for the
    // lifetime of a given roll's reveal animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      className={`inline-block whitespace-pre tabular-nums transition-transform duration-150 ${
        settled ? "scale-100" : "scale-105 opacity-90"
      } ${className}`}
    >
      {display}
    </span>
  );
}

interface ReelRowProps {
  text: string;
  baseMs?: number;
  staggerMs?: number;
  tickMs?: number;
  className?: string;
  charClassName?: string;
  digitsOnly?: boolean;
}

/** A row of ReelChars, each settling a little later than the one before it — left to right. */
export function ReelRow({ text, baseMs = 500, staggerMs = 90, tickMs = 55, className = "", charClassName = "", digitsOnly = false }: ReelRowProps) {
  return (
    <span className={className}>
      {text.split("").map((ch, i) => (
        <ReelChar
          key={i}
          finalChar={ch}
          settleAfterMs={baseMs + i * staggerMs}
          tickMs={tickMs}
          className={charClassName}
          digitsOnly={digitsOnly}
        />
      ))}
    </span>
  );
}

/** Total time (ms) a ReelRow with these settings takes to fully settle, plus a small buffer. */
export function reelRowDuration(text: string, baseMs = 500, staggerMs = 90, bufferMs = 350): number {
  return baseMs + Math.max(0, text.length - 1) * staggerMs + bufferMs;
}

/** Fires `onComplete` once, `ms` after mount. Convenience wrapper so animation
 *  components don't each hand-roll the same effect. */
export function useCompleteAfter(ms: number, onComplete: () => void) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    const t = setTimeout(() => onCompleteRef.current(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
}
