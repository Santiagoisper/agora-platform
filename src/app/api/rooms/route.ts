import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const ownerId = await requireSessionUserId();
  const db = getDb();
  const allRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.ownerId, ownerId))
    .orderBy(desc(rooms.createdAt))
    .limit(50);
  return NextResponse.json(allRooms);
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireSessionUserId();
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";

    if (!title || !topic || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const [room] = await db
      .insert(rooms)
      .values({
        ownerId,
        title,
        topic,
        type,
        status: "waiting",
      })
      .returning();

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
