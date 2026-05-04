import { requireSessionUserId } from "@/lib/auth";
import { requireOwnedBot, requireOwnedRoom } from "@/lib/authorization";
import { getDb } from "@/db";
import { roomBots } from "@/db/schema";
import { logMatchEvent } from "@/lib/match-events";
import { encryptSecret } from "@/lib/secrets";
import { preflightBotForRoom } from "@/lib/bot-preflight";
import { listRoomParticipants, reconcileRoomState } from "@/lib/rooms";
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

    if (room.status === "closed" || room.status === "archived") {
      return NextResponse.json({ error: `Room is ${room.status}` }, { status: 409 });
    }
    if (room.status === "draft") {
      return NextResponse.json({ error: "Room is draft. Lock the arena before bots can join." }, { status: 409 });
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

    const preflight = preflightBotForRoom({
      model: bot.model,
      systemPrompt: bot.systemPrompt,
      skills: bot.skills,
      apiKey,
      eliminatedAt: bot.eliminatedAt,
    });

    if (!preflight.ok) {
      await logMatchEvent({
        roomId: id,
        actorType: "bot",
        actorId: botId,
        eventType: "bot_preflight_failed",
        severity: "block",
        summary: preflight.reason,
        details: preflight.error,
      });

      return NextResponse.json(
        {
          error: preflight.error,
          reason: preflight.reason,
        },
        { status: 400 }
      );
    }

    await logMatchEvent({
      roomId: id,
      actorType: "bot",
      actorId: botId,
      eventType: "bot_preflight_passed",
      severity: preflight.riskScore > 0 ? "warn" : "info",
      summary: `Bot preflight passed with risk score ${preflight.riskScore}.`,
      details: preflight.warnings.join(" | "),
    });

    if (room.status === "active") {
      return NextResponse.json({ error: "Room already active. Join during locked/waiting phase." }, { status: 409 });
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

    await listRoomParticipants(id);
    const reconciled = await reconcileRoomState(id);

    await logMatchEvent({
      roomId: id,
      actorType: "bot",
      actorId: botId,
      eventType: "bot_joined",
      summary: "Bot joined locked arena.",
    });

    return NextResponse.json({
      room: {
        id,
        status: reconciled?.status ?? room.status,
        startsAt: reconciled?.startsAt ?? room.startsAt,
      },
      firstMessage: null,
      roomClosed: false,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
