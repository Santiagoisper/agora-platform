import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedRoom } from "@/lib/authorization";
import { appendNextRoomMessage, listRoomParticipants } from "@/lib/rooms";
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

    if (room.status === "closed") {
      return NextResponse.json({ error: "Room is closed" }, { status: 409 });
    }

    const participants = await listRoomParticipants(id);

    if (participants.length < 2) {
      return NextResponse.json(
        { error: "At least two bots are required to advance the room" },
        { status: 409 }
      );
    }

    const result = await appendNextRoomMessage(id);

    return NextResponse.json({
      message: result.message,
      roomClosed: result.roomClosed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
