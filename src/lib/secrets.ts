import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SECRET_VERSION = "v1";

function getEncryptionSecret() {
  const secret = process.env.ROOM_BOT_KEYS_SECRET;

  if (!secret) {
    throw new Error("ROOM_BOT_KEYS_SECRET is not set");
  }

  return scryptSync(secret, "agora-room-bot-keys", KEY_LENGTH);
}

export function encryptSecret(value: string) {
  const key = getEncryptionSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    SECRET_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string) {
  const [version, ivBase64, authTagBase64, encryptedBase64] = payload.split(".");

  if (version !== SECRET_VERSION) {
    return payload;
  }

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted secret payload");
  }

  const key = getEncryptionSecret();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivBase64, "base64"),
    { authTagLength: AUTH_TAG_LENGTH }
  );

  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
