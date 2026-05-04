import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedRoom } from "@/lib/authorization";
import { listRoomMessages } from "@/lib/rooms";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerId = await requireSessionUserId();
  const room = await requireOwnedRoom(id, ownerId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const roomMessages = await listRoomMessages(id);
  return NextResponse.json(roomMessages);
}
