import { requireSessionUserId } from "@/lib/auth";
import { appendNextRoomMessage, getRoomById } from "@/lib/rooms";
import { NextResponse } from "next/server";

// Lazy progression: any authenticated viewer can nudge an active room forward.
// appendNextRoomMessage enforces the per-room turn cooldown, so this is safe to
// call on every poll. This is the main advancement path on Vercel Hobby, where
// the referee cron only runs once a day.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireSessionUserId();

    const room = await getRoomById(id);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!["starting", "active"].includes(room.status)) {
      return NextResponse.json({ advanced: false, status: room.status });
    }

    const result = await appendNextRoomMessage(id);

    return NextResponse.json({
      advanced: Boolean(result.message),
      roomClosed: result.roomClosed,
      status: result.room?.status ?? room.status,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
