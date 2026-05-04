import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedRoom } from "@/lib/authorization";
import { listMatchEvents } from "@/lib/match-events";
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

  const events = await listMatchEvents(id);
  return NextResponse.json(events);
}
