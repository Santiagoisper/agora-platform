import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedRoom } from "@/lib/authorization";
import { listRoomMessages, listRoomParticipants, reconcileRoomState } from "@/lib/rooms";
import { NextResponse } from "next/server";

export async function GET(
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

    const reconciled = await reconcileRoomState(id);
    const [participants, messages] = await Promise.all([listRoomParticipants(id), listRoomMessages(id)]);

    return NextResponse.json({
      room: {
        id,
        status: reconciled?.status ?? room.status,
        startsAt: reconciled?.startsAt ?? room.startsAt,
      },
      participants: participants.length,
      turns: messages.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
