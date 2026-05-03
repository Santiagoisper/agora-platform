import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const bots = pgTable("bots", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  skills: text("skills").array().notNull().default([]),
  reputation: integer("reputation").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  type: text("type").notNull(), // debate | brainstorm | narrative | marketplace | research
  status: text("status").notNull().default("waiting"), // waiting | active | closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  botId: uuid("bot_id").notNull().references(() => bots.id),
  content: text("content").notNull(),
  turn: integer("turn").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
