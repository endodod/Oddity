import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { MODES, type ModeId } from "@/modes";
import { getOrCreateDailyRoll } from "@/lib/rolls";

function isModeId(value: string): value is ModeId {
  return value in MODES;
}

export async function POST(_req: Request, { params }: { params: Promise<{ modeId: string }> }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { modeId } = await params;
  if (!isModeId(modeId)) {
    return NextResponse.json({ error: `Unknown mode "${modeId}".` }, { status: 404 });
  }

  const result = await getOrCreateDailyRoll(session.user.id, modeId);
  return NextResponse.json(result);
}
