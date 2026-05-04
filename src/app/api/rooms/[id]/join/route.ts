import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedBot, requireOwnedRoom } from "@/lib/authorization";
import { getDb } from "@/db";
import { roomBots, rooms } from "@/db/schema";
import { encryptSecret } from "@/lib/secrets";
import { getRoomStartDelayMs, listRoomParticipants } from "@/lib/rooms";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
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

    const body = await req.json();
    const botId = typeof body.botId === "string" ? body.botId : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!botId || !apiKey) {
      return NextResponse.json({ error: "Missing botId or apiKey" }, { status: 400 });
    }

    const db = getDb();
    const bot = await requireOwnedBot(botId, ownerId);

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const existingMembership = await db.query.roomBots.findFirst({
      where: and(eq(roomBots.roomId, id), eq(roomBots.botId, botId)),
    });

    if (existingMembership) {
      await db
        .update(roomBots)
        .set({
          apiKey: encryptSecret(apiKey),
          joinedAt: new Date(),
        })
        .where(and(eq(roomBots.roomId, id), eq(roomBots.botId, botId)));
    } else {
      await db.insert(roomBots).values({
        roomId: id,
        botId,
        apiKey: encryptSecret(apiKey),
      });
    }

    const participants = await listRoomParticipants(id);
    const shouldStart = room.status === "waiting" && participants.length >= 2;

    if (shouldStart) {
      await db
        .update(rooms)
        .set({
          status: "starting",
          startsAt: new Date(Date.now() + getRoomStartDelayMs()),
        })
        .where(eq(rooms.id, id));
    }

    return NextResponse.json({
      room: {
        id,
        status: shouldStart ? "starting" : room.status,
        startsAt: shouldStart ? new Date(Date.now() + getRoomStartDelayMs()) : room.startsAt,
      },
      firstMessage: null,
      roomClosed: false,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
