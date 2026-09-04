import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODES, type ModeId } from "@/modes";
import { hashSeed, mulberry32, type ScoreResult } from "@/modes/types";

export interface DailyRoll {
  raw: unknown;
  display: string;
  score: ScoreResult;
}

function todayUTC(): { dateISO: string; date: Date } {
  const dateISO = new Date().toISOString().slice(0, 10);
  return { dateISO, date: new Date(`${dateISO}T00:00:00.000Z`) };
}

// TimeCapsule's raw value carries a Date, which JSON round-trips as a string —
// reinflate it before handing the value back to that mode's score()/display().
function reviveRaw(modeId: ModeId, parsed: unknown): unknown {
  if (modeId === "timecapsule" && parsed && typeof parsed === "object" && "date" in parsed) {
    const { date, ...rest } = parsed as { date: string };
    return { ...rest, date: new Date(date) };
  }
  return parsed;
}

/**
 * Returns today's roll for (userId, modeId), creating it the first time it's requested.
 * The seed is derived only from userId + modeId + date, so once persisted the result can
 * never change no matter how many times this is called — that's what makes the roll
 * server-authoritative instead of trusting a client-submitted result.
 */
export async function getOrCreateDailyRoll(userId: string, modeId: ModeId): Promise<DailyRoll> {
  const mode = MODES[modeId];
  const { dateISO, date } = todayUTC();

  const existing = await prisma.roll.findUnique({
    where: { userId_modeId_date: { userId, modeId, date } },
  });

  const raw = existing
    ? reviveRaw(modeId, JSON.parse(existing.rawValue))
    : mode.roll(mulberry32(hashSeed(`${userId}-${modeId}-${dateISO}`)));

  const score = mode.score(raw as never);

  if (!existing) {
    await persistRoll(userId, modeId, mode.name, date, dateISO, raw, score);
  }

  return { raw, display: mode.display(raw as never), score };
}

async function persistRoll(
  userId: string,
  modeId: ModeId,
  modeName: string,
  date: Date,
  dateISO: string,
  raw: unknown,
  score: ScoreResult
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await tx.mode.upsert({ where: { id: modeId }, create: { id: modeId, name: modeName }, update: {} });

      for (const b of score.badges) {
        await tx.badge.upsert({
          where: { id: b.id },
          create: {
            id: b.id,
            modeId,
            name: b.name,
            description: b.description,
            rarityBand: b.rarityBand,
            epValue: b.epValue,
          },
          update: {},
        });
      }

      await tx.roll.create({
        data: {
          userId,
          modeId,
          date,
          rawValue: JSON.stringify(raw),
          baseEp: score.baseEp,
          ep: score.ep,
          rarity: score.rarity,
          comboLabel: score.combo.label,
          badges: { create: score.badges.map((b) => ({ badgeId: b.id, epValue: b.epValue })) },
        },
      });

      const lastPlayedISO = user.lastPlayed?.toISOString().slice(0, 10) ?? null;
      if (lastPlayedISO === dateISO) {
        await tx.user.update({ where: { id: userId }, data: { totalEp: { increment: score.ep } } });
      } else {
        const yesterday = new Date(date);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const playedYesterday = lastPlayedISO === yesterday.toISOString().slice(0, 10);
        await tx.user.update({
          where: { id: userId },
          data: {
            streak: playedYesterday ? user.streak + 1 : 1,
            lastPlayed: date,
            totalEp: { increment: score.ep },
          },
        });
      }
    });
  } catch (err) {
    // P2002: a concurrent request for the same (userId, modeId, date) won the race.
    // The seed is deterministic, so the roll it persisted is identical to this one —
    // nothing further to do.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
  }
}
