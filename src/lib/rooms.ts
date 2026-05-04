import { getDb } from "@/db";
import { bots, messages, roomBots, rooms } from "@/db/schema";
import { resolveVaultReference, revokeVaultReference } from "@/lib/key-vault";
import { decryptSecret } from "@/lib/secrets";
import { asc, eq } from "drizzle-orm";

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
  createdAt: string;
}

const MAX_ROOM_TURNS = 12;
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4": "claude-3-5-haiku-20241022",
  "claude-sonnet-4": "claude-sonnet-4-20250514",
  "claude-opus-4": "claude-opus-4-20250514",
};

function inferProvider(model: string) {
  if (model.startsWith("claude-")) return "anthropic";
  return "openai";
}

function mapAnthropicModel(model: string) {
  return ANTHROPIC_MODEL_MAP[model] ?? model;
}

function extractOpenAIText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const output = (data as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return null;

  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if ((part as { type?: string }).type === "output_text") {
        const text = (part as { text?: string }).text;
        if (typeof text === "string" && text.trim()) {
          chunks.push(text.trim());
        }
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n\n") : null;
}

function extractAnthropicText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const content = (data as { content?: unknown[] }).content;
  if (!Array.isArray(content)) return null;

  const chunks = content
    .filter(
      (part): part is { type: string; text: string } =>
        !!part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
    )
    .map((part) => part.text.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks.join("\n\n") : null;
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

async function generateOpenAIMessage(model: string, apiKey: string, prompt: string) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "text",
        },
      },
      max_output_tokens: 220,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "OpenAI request failed";
    throw new Error(message);
  }

  const text = extractOpenAIText(data);
  if (!text) {
    throw new Error("OpenAI returned no text output");
  }

  return text;
}

async function generateAnthropicMessage(model: string, apiKey: string, prompt: string) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: mapAnthropicModel(model),
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Anthropic request failed";
    throw new Error(message);
  }

  const text = extractAnthropicText(data);
  if (!text) {
    throw new Error("Anthropic returned no text output");
  }

  return text;
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

  if (inferProvider(input.participant.model) === "anthropic") {
    return generateAnthropicMessage(input.participant.model, input.participant.apiKey, prompt);
  }

  return generateOpenAIMessage(input.participant.model, input.participant.apiKey, prompt);
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

  return participants.map((participant) => ({
    ...participant,
    apiKey:
      resolveVaultReference(participant.apiKey) ??
      decryptSecret(participant.apiKey),
  }));
}

async function purgeRoomApiKeys(roomId: string) {
  const db = getDb();

  const roomKeyRefs = await db
    .select({ apiKey: roomBots.apiKey })
    .from(roomBots)
    .where(eq(roomBots.roomId, roomId));

  for (const row of roomKeyRefs) {
    revokeVaultReference(row.apiKey);
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

export async function appendNextRoomMessage(roomId: string) {
  const db = getDb();
  const room = await getRoomById(roomId);

  if (!room) {
    return { room: null, message: null, roomClosed: false };
  }

  const participants = await listRoomParticipantsWithKeys(roomId);
  const previousMessages = await listRoomMessages(roomId);

  if (room.status === "closed") {
    return { room, message: null, roomClosed: true };
  }

  if (participants.length < 2) {
    return { room, message: null, roomClosed: false };
  }

  const nextTurn = previousMessages.length + 1;

  if (nextTurn > MAX_ROOM_TURNS) {
    await db
      .update(rooms)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(rooms.id, roomId));
    await purgeRoomApiKeys(roomId);

    return {
      room: { ...room, status: "closed", closedAt: new Date() },
      message: null,
      roomClosed: true,
    };
  }

  const speaker = participants[previousMessages.length % participants.length];
  const content = await generateBotTurn({
    roomTitle: room.title,
    roomTopic: room.topic,
    roomType: room.type,
    participant: speaker,
    turn: nextTurn,
    previousMessages,
  });

  const [message] = await db
    .insert(messages)
    .values({
      roomId,
      botId: speaker.id,
      content,
      turn: nextTurn,
    })
    .returning();

  const roomClosed = nextTurn >= MAX_ROOM_TURNS;

  if (roomClosed) {
    await db
      .update(rooms)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(rooms.id, roomId));
    await purgeRoomApiKeys(roomId);
  }

  return {
    room: roomClosed ? { ...room, status: "closed", closedAt: new Date() } : room,
    message: {
      id: message.id,
      botId: message.botId,
      botName: speaker.name,
      content: message.content,
      turn: message.turn,
      createdAt: message.createdAt.toISOString(),
    },
    roomClosed,
  };
}
