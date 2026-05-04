import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "agora_session";

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not set");
  }

  return secret;
}

function signUserId(userId: string) {
  return createHmac("sha256", getSessionSecret()).update(userId).digest("base64url");
}

export function createSessionCookieValue(userId: string) {
  return `${userId}.${signUserId(userId)}`;
}

export function createNewSessionCookieValue() {
  return createSessionCookieValue(randomUUID());
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionCookieValue(userId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function readSessionUserId(cookieValue?: string | null) {
  if (!cookieValue) {
    return null;
  }

  const [userId, signature] = cookieValue.split(".");

  if (!userId || !signature) {
    return null;
  }

  const expected = signUserId(userId);
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);

  if (expectedBytes.length !== signatureBytes.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBytes, signatureBytes)) {
    return null;
  }

  return userId;
}

export async function requireSessionUserId() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const userId = readSessionUserId(sessionValue);

  if (!userId) {
    throw new Error("Unauthenticated session");
  }

  return userId;
}
