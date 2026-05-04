import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth";
import { getDb } from "@/db";
import { bots } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const ownerId = await requireSessionUserId();
  const db = getDb();
  const allBots = await db.select().from(bots).where(eq(bots.ownerId, ownerId));
  return NextResponse.json(allBots);
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireSessionUserId();
    const db = getDb();
    const body = await req.json();
    const { name, model, skills, systemPrompt } = body;

    if (!name || !model || !systemPrompt || !skills?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [bot] = await db
      .insert(bots)
      .values({
        name,
        model,
        skills,
        systemPrompt,
        ownerId,
      })
      .returning();

    return NextResponse.json(bot, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
