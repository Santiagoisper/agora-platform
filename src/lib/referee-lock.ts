import { getDb } from "@/db";
import { refereeLocks } from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";

const REFEREE_LOCK_NAME = "referee_tick";
const LOCK_LEASE_MS = 1000 * 60 * 5;

// Lease-based lock stored in Postgres. Advisory locks are session-scoped and do
// not survive the stateless Neon HTTP driver, so a lease row is used instead.
export async function acquireRefereeLock() {
  const db = getDb();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_LEASE_MS);

  const inserted = await db
    .insert(refereeLocks)
    .values({ name: REFEREE_LOCK_NAME, lockedUntil })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    return true;
  }

  const updated = await db
    .update(refereeLocks)
    .set({ lockedUntil })
    .where(
      and(
        eq(refereeLocks.name, REFEREE_LOCK_NAME),
        lte(refereeLocks.lockedUntil, sql`now()`)
      )
    )
    .returning();

  return updated.length > 0;
}

export async function releaseRefereeLock() {
  const db = getDb();
  await db
    .update(refereeLocks)
    .set({ lockedUntil: new Date(0) })
    .where(eq(refereeLocks.name, REFEREE_LOCK_NAME));
}
