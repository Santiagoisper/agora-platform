import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { botKeyVault } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { eq, lte } from "drizzle-orm";

const ROOM_BOT_KEY_TTL_MS = 1000 * 60 * 60 * 2;
const VAULT_PREFIX = "vault:";

async function cleanupExpiredEntries() {
  const db = getDb();
  await db.delete(botKeyVault).where(lte(botKeyVault.expiresAt, new Date()));
}

export async function createVaultReference(secret: string) {
  await cleanupExpiredEntries();

  const referenceId = randomUUID();
  const db = getDb();

  await db.insert(botKeyVault).values({
    id: referenceId,
    encryptedKey: encryptSecret(secret),
    expiresAt: new Date(Date.now() + ROOM_BOT_KEY_TTL_MS),
  });

  return `${VAULT_PREFIX}${referenceId}`;
}

export async function resolveVaultReference(reference: string) {
  if (!reference.startsWith(VAULT_PREFIX)) {
    return null;
  }

  const referenceId = reference.slice(VAULT_PREFIX.length);
  const db = getDb();
  const entry = await db.query.botKeyVault.findFirst({
    where: eq(botKeyVault.id, referenceId),
  });

  if (!entry) {
    return null;
  }

  if (entry.expiresAt.getTime() <= Date.now()) {
    await db.delete(botKeyVault).where(eq(botKeyVault.id, referenceId));
    return null;
  }

  return decryptSecret(entry.encryptedKey);
}

export async function revokeVaultReference(reference: string) {
  if (!reference.startsWith(VAULT_PREFIX)) {
    return;
  }

  const referenceId = reference.slice(VAULT_PREFIX.length);
  const db = getDb();
  await db.delete(botKeyVault).where(eq(botKeyVault.id, referenceId));
}
