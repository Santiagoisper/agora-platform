import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ROOM_BOT_KEYS_SECRET = "test-secret-for-vitest";
});

describe("secrets", () => {
  it("round-trips an encrypted value", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/secrets");
    const original = "sk-test-1234567890abcdef";
    const encrypted = encryptSecret(original);

    expect(encrypted).not.toContain(original);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("produces a different ciphertext per call (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/secrets");
    expect(encryptSecret("same-value")).not.toBe(encryptSecret("same-value"));
  });

  it("returns unversioned payloads untouched (legacy passthrough)", async () => {
    const { decryptSecret } = await import("@/lib/secrets");
    expect(decryptSecret("plain-legacy-key")).toBe("plain-legacy-key");
  });
});
