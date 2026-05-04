import { randomUUID } from "crypto";

const ROOM_BOT_KEY_TTL_MS = 1000 * 60 * 60 * 2;
const VAULT_PREFIX = "vault:";

type VaultEntry = {
  value: string;
  expiresAt: number;
};

const globalVault = globalThis as typeof globalThis & {
  __agoraRoomBotKeyVault?: Map<string, VaultEntry>;
};

function getVault() {
  if (!globalVault.__agoraRoomBotKeyVault) {
    globalVault.__agoraRoomBotKeyVault = new Map<string, VaultEntry>();
  }

  return globalVault.__agoraRoomBotKeyVault;
}

function cleanupExpiredEntries() {
  const now = Date.now();
  const vault = getVault();

  for (const [key, entry] of vault.entries()) {
    if (entry.expiresAt <= now) {
      vault.delete(key);
    }
  }
}

export function createVaultReference(secret: string) {
  cleanupExpiredEntries();

  const referenceId = randomUUID();
  getVault().set(referenceId, {
    value: secret,
    expiresAt: Date.now() + ROOM_BOT_KEY_TTL_MS,
  });

  return `${VAULT_PREFIX}${referenceId}`;
}

export function resolveVaultReference(reference: string) {
  cleanupExpiredEntries();

  if (!reference.startsWith(VAULT_PREFIX)) {
    return null;
  }

  const referenceId = reference.slice(VAULT_PREFIX.length);
  const entry = getVault().get(referenceId);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    getVault().delete(referenceId);
    return null;
  }

  return entry.value;
}

export function revokeVaultReference(reference: string) {
  if (!reference.startsWith(VAULT_PREFIX)) {
    return;
  }

  const referenceId = reference.slice(VAULT_PREFIX.length);
  getVault().delete(referenceId);
}
