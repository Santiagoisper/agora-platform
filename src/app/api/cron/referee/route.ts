import { runRefereeTick } from "@/lib/rooms";
import { NextResponse } from "next/server";

function isAuthorizedCron(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) {
    return true;
  }

  const cronHeader = req.headers.get("x-vercel-cron-signature");
  if (cronHeader === expected) {
    return true;
  }

  return false;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runRefereeTick(48);
    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Referee cron failed:", error);
    return NextResponse.json({ error: "Referee tick failed" }, { status: 500 });
  }
}
