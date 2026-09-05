import type { RarityBand } from "@/modes/types";

export const RARITY_COLORS: Record<RarityBand, { text: string; border: string; dot: string }> = {
  Common: { text: "text-slate-300", border: "border-slate-500/50", dot: "bg-slate-400" },
  Uncommon: { text: "text-emerald-300", border: "border-emerald-500/50", dot: "bg-emerald-400" },
  Rare: { text: "text-sky-300", border: "border-sky-500/50", dot: "bg-sky-400" },
  Epic: { text: "text-purple-300", border: "border-purple-500/50", dot: "bg-purple-400" },
  Legendary: { text: "text-amber-300", border: "border-amber-500/50", dot: "bg-amber-400" },
  Mythic: { text: "text-rose-300", border: "border-rose-500/50", dot: "bg-rose-400" },
};
