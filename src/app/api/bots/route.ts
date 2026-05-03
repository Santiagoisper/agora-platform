import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bots } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
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
        ownerId: "anonymous", // auth coming later
      })
      .returning();

    return NextResponse.json(bot, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
