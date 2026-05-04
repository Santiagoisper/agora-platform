import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedRoom } from "@/lib/authorization";
import { logMatchEvent } from "@/lib/match-events";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ownerId = await requireSessionUserId();
    const room = await requireOwnedRoom(id, ownerId);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status === "closed" || room.status === "archived") {
      return NextResponse.json({ error: "Room is not lockable" }, { status: 409 });
    }

    if (room.status !== "draft") {
      return NextResponse.json({ error: `Room is already ${room.status}` }, { status: 409 });
    }

    const db = getDb();
    const [updated] = await db
      .update(rooms)
      .set({ status: "locked" })
      .where(eq(rooms.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    await logMatchEvent({
      roomId: id,
      actorType: "owner",
      actorId: ownerId,
      eventType: "room_locked",
      summary: "Owner locked arena draft.",
    });

    return NextResponse.json({ room: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
