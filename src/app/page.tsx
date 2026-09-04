import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { MODES, type ModeId } from "@/modes";
import { getOrCreateDailyRoll } from "@/lib/rolls";

// Reads the session cookie on every request, so this page can't be statically rendered.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">Oddity</h1>
        <p className="text-sm opacity-70 mb-8">Sign in to roll today's badges.</p>
        <div className="flex gap-4">
          <Link href="/auth/sign-in" className="text-indigo-400 hover:underline">
            Sign in
          </Link>
          <Link href="/auth/sign-up" className="text-indigo-400 hover:underline">
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  const userId = session.user.id;
  const rolls = await Promise.all(
    (Object.keys(MODES) as ModeId[]).map(async (modeId) => {
      const mode = MODES[modeId];
      const { display, score } = await getOrCreateDailyRoll(userId, modeId);
      return { mode, display, score };
    })
  );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold mb-2">Oddity</h1>
      <p className="text-sm opacity-70 mb-8">
        Today's rolls, {session.user.name ?? session.user.email}.
      </p>
      <div className="space-y-6">
        {rolls.map(({ mode, display, score }) => (
          <section key={mode.id} className="rounded-lg border border-white/10 p-4">
            <h2 className="text-xl font-semibold">{mode.name}</h2>
            <p className="font-mono text-lg my-2">{display}</p>
            <p className="text-sm opacity-80">
              {score.badges.length} badge{score.badges.length === 1 ? "" : "s"} ·{" "}
              {score.ep.toLocaleString()} EP · {score.rarity}
              {score.combo.label ? ` · ${score.combo.label}` : ""}
            </p>
            <ul className="mt-2 text-sm opacity-70 list-disc list-inside">
              {score.badges.map((b) => (
                <li key={b.id}>
                  {b.name} — {b.epValue.toLocaleString()} EP
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
