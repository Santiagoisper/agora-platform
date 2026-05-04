import { getDb } from "@/db";
import { matchEvents } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

type MatchEventInput = {
  roomId: string;
  actorType: "owner" | "bot" | "referee" | "system";
  actorId?: string | null;
  eventType: string;
  severity?: "info" | "warn" | "block";
  summary: string;
  details?: string;
};

export async function logMatchEvent(input: MatchEventInput) {
  try {
    const db = getDb();
    await db.insert(matchEvents).values({
      roomId: input.roomId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      summary: input.summary,
      details: input.details ?? null,
    });
  } catch (error) {
    // Event logging is best-effort. Never block main arena flow.
    console.error("Failed to write match event:", error);
  }
}

export type SerializedMatchEvent = {
  id: string;
  roomId: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  severity: string;
  summary: string;
  details: string | null;
  createdAt: string;
};

export async function listMatchEvents(roomId: string): Promise<SerializedMatchEvent[]> {
  const db = getDb();
  const events = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.roomId, roomId))
    .orderBy(asc(matchEvents.createdAt));

  return events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
}
