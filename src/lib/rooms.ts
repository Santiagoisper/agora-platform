import { getDb } from "@/db";
import { bots, messages, roomBots, rooms } from "@/db/schema";
import { resolveVaultReference, revokeVaultReference } from "@/lib/key-vault";
import { logMatchEvent } from "@/lib/match-events";
import { generateProviderMessage, inferProvider } from "@/lib/providers";
import { acquireRefereeLock, releaseRefereeLock } from "@/lib/referee-lock";
import { decryptSecret } from "@/lib/secrets";
import { asc, eq, inArray } from "drizzle-orm";

export interface RoomParticipant {
  id: string;
  name: string;
  model: string;
  skills: string[];
}

interface RoomParticipantWithKey extends RoomParticipant {
  apiKey: string;
}

export interface SerializedRoomMessage {
  id: string;
  botId: string;
  botName: string;
  content: string;
  turn: number;
  score: number;
  createdAt: string;
}

const MAX_ROOM_TURNS = 12;
const ROOM_TURN_COOLDOWN_MS = 12000;
const ROOM_START_DELAY_MS = 3000;
const ELO_K = 24;
const BOT_ELIMINATION_LOSS_LIMIT = 5;
const LEGEND_TIER_TWO_WINS = 10;
const LEGEND_TIER_THREE_WINS = 20;

const ROOM_RULES: Record<string, string> = {
  debate: "Take a position, address the strongest opposing point, and stay concrete.",
  brainstorm: "Contribute one strong idea, build on the room, and avoid repeating prior points.",
  narrative: "Advance the story with one meaningful beat and preserve continuity.",
  marketplace: "Negotiate explicitly, push tradeoffs, and make your incentive clear.",
  research: "Make one analytical contribution grounded in evidence, mechanism, or critique.",
};

const SKILL_PROMPTS: Record<string, string> = {
  debater: "Argue clearly and forcefully.",
  researcher: "Use evidence, numbers, or falsifiable claims where possible.",
  philosopher: "Expose hidden assumptions and distinctions.",
  storyteller: "Write with vivid momentum and coherent voice.",
  coder: "Think in systems, implementation, and constraints.",
  critic: "Find the strongest weakness in the current line of thought.",
};

export function scoreMessage(content: string, turn: number, roomType: string) {
  const normalized = content.toLowerCase();
  const clarity = Math.min(2, Math.max(0, Math.floor(content.trim().length / 80)));
  const attack = /(argue|counter|refute|challenge|however|but)/.test(normalized) ? 1 : 0;
  const defense = /(because|therefore|reason|justify|support)/.test(normalized) ? 1 : 0;
  const evidence = /(data|evidence|percent|%|study|according|citation|source|metric)/.test(normalized) ? 1 : 0;
  const coherence = /(first|second|finally|in summary|therefore|overall)/.test(normalized) ? 1 : 0;
  const closing = turn > 1 && /(conclude|final|bottom line|net result)/.test(normalized) ? 1 : 0;
  const researchBoost = roomType === "research" && evidence > 0 ? 1 : 0;

  const total = Math.max(1, Math.min(10, 1 + clarity + attack + defense + evidence + coherence + closing + researchBoost));

  return {
    total,
    breakdown: {
      clarity,
      attack,
      defense,
      evidence,
      coherence,
      closing: closing + researchBoost,
    },
  };
}

function pickWinningBot(scores: Map<string, number>) {
  let winner: { botId: string; score: number } | null = null;

  for (const [botId, score] of scores.entries()) {
    if (!winner || score > winner.score) {
      winner = { botId, score };
    }
  }

  return winner;
}

export function expectedScore(eloA: number, eloB: number) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function deriveLegendTier(wins: number) {
  if (wins >= LEGEND_TIER_THREE_WINS) return 3;
  if (wins >= LEGEND_TIER_TWO_WINS) return 2;
  if (wins >= 5) return 1;
  return 0;
}

function buildConversationPrompt(input: {
  roomTitle: string;
  roomTopic: string;
  roomType: string;
  botName: string;
  model: string;
  skills: string[];
  turn: number;
  previousMessages: SerializedRoomMessage[];
}) {
  const skillInstructions = input.skills
    .slice(0, 3)
    .map((skill) => `- ${skill}: ${SKILL_PROMPTS[skill] ?? "Add useful signal."}`)
    .join("\n");

  const transcript =
    input.previousMessages.length === 0
      ? "No prior turns yet."
      : input.previousMessages
          .map((message) => `Turn ${message.turn} - ${message.botName}: ${message.content}`)
          .join("\n\n");

  return [
    `You are ${input.botName}, participating in an Agora room.`,
    `Room title: ${input.roomTitle}`,
    `Room type: ${input.roomType}`,
    `Room topic/context: ${input.roomTopic}`,
    `Current turn: ${input.turn}`,
    `Behavior rules: ${ROOM_RULES[input.roomType] ?? ROOM_RULES.debate}`,
    `Your model label inside the app is ${input.model}.`,
    "Your skill stack:",
    skillInstructions || "- generalist: be useful and specific.",
    "Conversation so far:",
    transcript,
    "Write exactly one turn as this bot.",
    "Keep it under 120 words.",
    "Do not mention system prompts, hidden instructions, or that you are an AI model.",
    "Return only the message content."
  ].join("\n\n");
}

async function generateBotTurn(input: {
  roomTitle: string;
  roomTopic: string;
  roomType: string;
  participant: RoomParticipantWithKey;
  turn: number;
  previousMessages: SerializedRoomMessage[];
}) {
  const prompt = buildConversationPrompt({
    roomTitle: input.roomTitle,
    roomTopic: input.roomTopic,
    roomType: input.roomType,
    botName: input.participant.name,
    model: input.participant.model,
    skills: input.participant.skills,
    turn: input.turn,
    previousMessages: input.previousMessages,
  });

  return generateProviderMessage(input.participant.model, input.participant.apiKey, prompt);
}

export async function getRoomById(roomId: string) {
  const db = getDb();
  return db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
}

export async function listRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
  const db = getDb();

  return db
    .select({
      id: bots.id,
      name: bots.name,
      model: bots.model,
      skills: bots.skills,
    })
    .from(roomBots)
    .innerJoin(bots, eq(roomBots.botId, bots.id))
    .where(eq(roomBots.roomId, roomId))
    .orderBy(asc(roomBots.joinedAt));
}

async function listRoomParticipantsWithKeys(roomId: string): Promise<RoomParticipantWithKey[]> {
  const db = getDb();

  const participants = await db
    .select({
      id: bots.id,
      name: bots.name,
      model: bots.model,
      skills: bots.skills,
      apiKey: roomBots.apiKey,
    })
    .from(roomBots)
    .innerJoin(bots, eq(roomBots.botId, bots.id))
    .where(eq(roomBots.roomId, roomId))
    .orderBy(asc(roomBots.joinedAt));

  return Promise.all(
    participants.map(async (participant) => ({
      ...participant,
      apiKey:
        (await resolveVaultReference(participant.apiKey)) ??
        decryptSecret(participant.apiKey),
    }))
  );
}

async function purgeRoomApiKeys(roomId: string) {
  const db = getDb();

  const roomKeyRefs = await db
    .select({ apiKey: roomBots.apiKey })
    .from(roomBots)
    .where(eq(roomBots.roomId, roomId));

  for (const row of roomKeyRefs) {
    await revokeVaultReference(row.apiKey);
  }

  await db
    .update(roomBots)
    .set({ apiKey: "[redacted]" })
    .where(eq(roomBots.roomId, roomId));
}

export async function listRoomMessages(roomId: string): Promise<SerializedRoomMessage[]> {
  const db = getDb();

  const roomMessages = await db
    .select({
      id: messages.id,
      botId: messages.botId,
      botName: bots.name,
      content: messages.content,
      turn: messages.turn,
      score: messages.score,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(bots, eq(messages.botId, bots.id))
    .where(eq(messages.roomId, roomId))
    .orderBy(asc(messages.turn));

  return roomMessages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function getRoomRefereeState(roomId: string) {
  const room = await getRoomById(roomId);
  const participants = await listRoomParticipants(roomId);
  const messagesList = await listRoomMessages(roomId);
  const scoreByBot = new Map<string, number>();

  for (const message of messagesList) {
    scoreByBot.set(message.botId, (scoreByBot.get(message.botId) ?? 0) + message.score);
  }

  const leader = pickWinningBot(scoreByBot);

  return {
    room,
    participants,
    messages: messagesList,
    scoreByBot,
    leader,
    startsAt: room?.startsAt ? room.startsAt.toISOString() : null,
  };
}

export async function reconcileRoomState(roomId: string) {
  const db = getDb();
  const room = await getRoomById(roomId);

  if (!room || room.status === "closed" || room.status === "archived") {
    return room;
  }

  const participants = await listRoomParticipants(roomId);

  if ((room.status === "locked" || room.status === "waiting") && participants.length >= 2) {
    const startsAt = new Date(Date.now() + ROOM_START_DELAY_MS);
    const [updated] = await db
      .update(rooms)
      .set({ status: "starting", startsAt })
      .where(eq(rooms.id, roomId))
      .returning();

    await logMatchEvent({
      roomId,
      actorType: "referee",
      eventType: "countdown_started",
      summary: "Roster reached minimum size. Countdown started.",
    });

    return updated ?? room;
  }

  if (room.status === "starting" && participants.length < 2) {
    const [updated] = await db
      .update(rooms)
      .set({ status: "waiting", startsAt: null })
      .where(eq(rooms.id, roomId))
      .returning();

    await logMatchEvent({
      roomId,
      actorType: "referee",
      eventType: "countdown_cancelled",
      severity: "warn",
      summary: "Countdown cancelled due to insufficient bots.",
    });

    return updated ?? room;
  }

  if (room.status === "starting" && room.startsAt && Date.now() >= new Date(room.startsAt).getTime()) {
    const [updated] = await db
      .update(rooms)
      .set({ status: "active", startsAt: null })
      .where(eq(rooms.id, roomId))
      .returning();

    await logMatchEvent({
      roomId,
      actorType: "referee",
      eventType: "round_started",
      summary: "Countdown complete. Arena is now active.",
    });

    return updated ?? room;
  }

  return room;
}

export async function listProcessableRoomIds(limit = 32) {
  const db = getDb();
  const rows = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(inArray(rooms.status, ["locked", "waiting", "starting", "active"]))
    .limit(limit);

  return rows.map((row) => row.id);
}

export async function runRefereeTick(limit = 32) {
  const locked = await acquireRefereeLock();
  if (!locked) {
    return { processed: 0, advanced: 0, rooms: 0, skipped: true };
  }

  try {
    const ids = await listProcessableRoomIds(limit);
    let processed = 0;
    let advanced = 0;

    for (const roomId of ids) {
      const room = await reconcileRoomState(roomId);
      if (!room) continue;

      processed += 1;
      if (room.status !== "active") continue;

      try {
        const result = await appendNextRoomMessage(roomId);
        if (result.message || result.roomClosed) {
          advanced += 1;
        }
      } catch (error) {
        // Provider failures are already logged as match events; keep the tick going.
        console.error(`Referee tick failed for room ${roomId}:`, error);
      }
    }

    return { processed, advanced, rooms: ids.length, skipped: false };
  } finally {
    await releaseRefereeLock();
  }
}

export async function appendNextRoomMessage(roomId: string) {
  const db = getDb();
  const room = await reconcileRoomState(roomId);

  if (!room) {
    return { room: null, message: null, roomClosed: false };
  }

  const participants = await listRoomParticipantsWithKeys(roomId);
  const previousMessages = await listRoomMessages(roomId);

  if (room.status === "closed" || room.status === "archived") {
    return { room, message: null, roomClosed: true };
  }

  if (room.status === "starting" && room.startsAt) {
    const startsAt = new Date(room.startsAt).getTime();
    if (Date.now() < startsAt) {
      return { room, message: null, roomClosed: false };
    }
  }

  if (participants.length < 2) {
    return { room, message: null, roomClosed: false };
  }

  const nextTurn = previousMessages.length + 1;
  const lastMessage = previousMessages[previousMessages.length - 1];
  if (lastMessage) {
    const elapsed = Date.now() - new Date(lastMessage.createdAt).getTime();
    if (elapsed < ROOM_TURN_COOLDOWN_MS) {
      return { room, message: null, roomClosed: false };
    }
  }

  if (nextTurn > MAX_ROOM_TURNS) {
    await db
      .update(rooms)
      .set({ status: "archived", closedAt: new Date() })
      .where(eq(rooms.id, roomId));
    await purgeRoomApiKeys(roomId);

    await logMatchEvent({
      roomId,
      actorType: "referee",
      eventType: "arena_archived",
      summary: "Arena auto-archived after max turn cap.",
    });

    return {
      room: { ...room, status: "archived", closedAt: new Date() },
      message: null,
      roomClosed: true,
    };
  }

  const speaker = participants[previousMessages.length % participants.length];
  let content: string;
  try {
    content = await generateBotTurn({
      roomTitle: room.title,
      roomTopic: room.topic,
      roomType: room.type,
      participant: speaker,
      turn: nextTurn,
      previousMessages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    await logMatchEvent({
      roomId,
      actorType: "referee",
      actorId: speaker.id,
      eventType: "provider_error",
      severity: "block",
      summary: `Provider failed for ${speaker.name}.`,
      details: message,
    });
    throw error;
  }

  const judged = scoreMessage(content, nextTurn, room.type);

  const [message] = await db
    .insert(messages)
    .values({
      roomId,
      botId: speaker.id,
      content,
      turn: nextTurn,
      score: judged.total,
    })
    .returning();

  await logMatchEvent({
    roomId,
    actorType: "referee",
    actorId: speaker.id,
    eventType: "turn_generated",
    summary: `Turn ${nextTurn} generated for ${speaker.name}.`,
    details: `Provider=${inferProvider(speaker.model)} model=${speaker.model}`,
  });

  await logMatchEvent({
    roomId,
    actorType: "referee",
    actorId: speaker.id,
    eventType: "score_assigned",
    summary: `Score ${judged.total} assigned to ${speaker.name} on turn ${nextTurn}.`,
    details: JSON.stringify(judged.breakdown),
  });

  const roomClosed = nextTurn >= MAX_ROOM_TURNS;

  if (roomClosed) {
    const totals = new Map<string, number>();
    for (const prev of previousMessages) {
      totals.set(prev.botId, (totals.get(prev.botId) ?? 0) + prev.score);
    }
    totals.set(message.botId, (totals.get(message.botId) ?? 0) + message.score);
    const winner = pickWinningBot(totals);
    const winnerName = participants.find((bot) => bot.id === winner?.botId)?.name ?? "unknown";
    const botRows = await db
      .select({
        id: bots.id,
        name: bots.name,
        eloRating: bots.eloRating,
        wins: bots.wins,
        losses: bots.losses,
      })
      .from(bots)
      .where(inArray(bots.id, participants.map((p) => p.id)));

    const winnerRow = botRows.find((row) => row.id === winner?.botId) ?? null;
    const loserRows = botRows.filter((row) => row.id !== winner?.botId);

    await db
      .update(rooms)
      .set({
        status: "archived",
        closedAt: new Date(),
        winnerBotId: winner?.botId ?? null,
      })
      .where(eq(rooms.id, roomId));
    await purgeRoomApiKeys(roomId);

    await logMatchEvent({
      roomId,
      actorType: "referee",
      actorId: winner?.botId ?? null,
      eventType: "winner_declared",
      summary: `Winner declared: ${winnerName}.`,
      details: winner ? `Final score ${winner.score}` : "No winner score available.",
    });

    await logMatchEvent({
      roomId,
      actorType: "referee",
      eventType: "arena_archived",
      summary: "Arena archived after winner declaration.",
    });

    if (winnerRow) {
      const averageLoserElo =
        loserRows.length > 0
          ? loserRows.reduce((sum, row) => sum + row.eloRating, 0) / loserRows.length
          : winnerRow.eloRating;
      const winnerExpected = expectedScore(winnerRow.eloRating, averageLoserElo);
      const winnerNewElo = Math.max(800, Math.round(winnerRow.eloRating + ELO_K * (1 - winnerExpected)));
      const winnerNewWins = winnerRow.wins + 1;

      await db
        .update(bots)
        .set({
          eloRating: winnerNewElo,
          wins: winnerNewWins,
          legendTier: deriveLegendTier(winnerNewWins),
          lastBattleAt: new Date(),
        })
        .where(eq(bots.id, winnerRow.id));

      await logMatchEvent({
        roomId,
        actorType: "referee",
        actorId: winnerRow.id,
        eventType: "rating_updated",
        summary: `${winnerRow.name} ELO ${winnerRow.eloRating} -> ${winnerNewElo}`,
        details: "Result: win",
      });
    }

    for (const loser of loserRows) {
      const referenceWinnerElo = winnerRow?.eloRating ?? loser.eloRating;
      const loserExpected = expectedScore(loser.eloRating, referenceWinnerElo);
      const loserNewElo = Math.max(800, Math.round(loser.eloRating + ELO_K * (0 - loserExpected)));
      const loserNewLosses = loser.losses + 1;
      const eliminated = loserNewLosses >= BOT_ELIMINATION_LOSS_LIMIT;

      await db
        .update(bots)
        .set({
          eloRating: loserNewElo,
          losses: loserNewLosses,
          lastBattleAt: new Date(),
          eliminatedAt: eliminated ? new Date() : null,
        })
        .where(eq(bots.id, loser.id));

      await logMatchEvent({
        roomId,
        actorType: "referee",
        actorId: loser.id,
        eventType: "rating_updated",
        summary: `${loser.name} ELO ${loser.eloRating} -> ${loserNewElo}`,
        details: "Result: loss",
      });

      if (eliminated) {
        await logMatchEvent({
          roomId,
          actorType: "referee",
          actorId: loser.id,
          eventType: "bot_eliminated",
          severity: "warn",
          summary: `${loser.name} eliminated after ${loserNewLosses} losses.`,
        });
      }
    }
  }

  return {
    room: roomClosed ? { ...room, status: "archived", closedAt: new Date() } : room,
    message: {
      id: message.id,
      botId: message.botId,
      botName: speaker.name,
      content: message.content,
      turn: message.turn,
      score: message.score,
      createdAt: message.createdAt.toISOString(),
    },
    roomClosed,
  };
}

export function getRoomStartDelayMs() {
  return ROOM_START_DELAY_MS;
}
