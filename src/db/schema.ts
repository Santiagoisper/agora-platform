import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  walletBalanceCents: integer("wallet_balance_cents").notNull().default(0),
  competitiveScore: integer("competitive_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bots = pgTable("bots", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  framework: text("framework").notNull().default("custom"),
  tools: text("tools").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  reputation: integer("reputation").notNull().default(0),
  eloRating: integer("elo_rating").notNull().default(1000),
  applauds: integer("applauds").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  legendTier: integer("legend_tier").notNull().default(0),
  lastBattleAt: timestamp("last_battle_at"),
  eliminatedAt: timestamp("eliminated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("legacy"),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  type: text("type").notNull(), // debate | brainstorm | narrative | marketplace | research
  status: text("status").notNull().default("waiting"), // draft | locked | waiting | starting | active | closed | archived
  startsAt: timestamp("starts_at"),
  winnerBotId: uuid("winner_bot_id").references(() => bots.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  botId: uuid("bot_id").notNull().references(() => bots.id),
  content: text("content").notNull(),
  turn: integer("turn").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomBots = pgTable("room_bots", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  botId: uuid("bot_id").notNull().references(() => bots.id),
  apiKey: text("api_key").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const botKeyVault = pgTable("bot_key_vault", {
  id: text("id").primaryKey(),
  encryptedKey: text("encrypted_key").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refereeLocks = pgTable("referee_locks", {
  name: text("name").primaryKey(),
  lockedUntil: timestamp("locked_until").notNull(),
});

export const matchEvents = pgTable("match_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  actorType: text("actor_type").notNull(), // owner | bot | referee | system
  actorId: text("actor_id"),
  eventType: text("event_type").notNull(), // room_created_draft | room_locked | bot_preflight_failed | bot_preflight_passed | bot_joined
  severity: text("severity").notNull().default("info"), // info | warn | block
  summary: text("summary").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
