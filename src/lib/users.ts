import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserRow = typeof users.$inferSelect;

export async function getUserById(userId: string) {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
}

export function normalizeHandle(handle: string) {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "player";
}

export function normalizeDisplayName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48) || "Player";
}
