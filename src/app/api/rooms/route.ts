import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { logMatchEvent } from "@/lib/match-events";
import { validateRoomDraft } from "@/lib/topic-policy";
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
    const validation = validateRoomDraft(body);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: validation.error,
          reason: validation.reason,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const [room] = await db
      .insert(rooms)
      .values({
        ownerId,
        title: validation.title,
        topic: validation.topic,
        type: validation.type,
        status: "draft",
      })
      .returning();

    await logMatchEvent({
      roomId: room.id,
      actorType: "owner",
      actorId: ownerId,
      eventType: "room_created_draft",
      severity: validation.riskScore > 0 ? "warn" : "info",
      summary: `Room created in draft with risk score ${validation.riskScore}.`,
      details: validation.warnings.join(" | "),
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
