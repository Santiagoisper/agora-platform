import { getRoomById } from "@/lib/rooms";
import { getDb } from "@/db";
import { bots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export async function requireOwnedBot(botId: string, ownerId: string) {
  const db = getDb();
  const bot = await db.query.bots.findFirst({ where: eq(bots.id, botId) });

  if (!bot || bot.ownerId !== ownerId) {
    return null;
  }

  return bot;
}

export async function requireOwnedRoom(roomId: string, ownerId: string) {
  const room = await getRoomById(roomId);

  if (!room || room.ownerId !== ownerId) {
    return null;
  }

  return room;
}

export async function requireOwnedRoomOrNotFound(roomId: string, ownerId: string) {
  const room = await requireOwnedRoom(roomId, ownerId);

  if (!room) {
    notFound();
  }

  return room;
}
