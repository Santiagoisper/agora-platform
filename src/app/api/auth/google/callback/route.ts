import { getDb } from "@/db";
import { users } from "@/db/schema";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { normalizeDisplayName, normalizeHandle } from "@/lib/users";
import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_STATE_COOKIE = "agora_google_oauth_state";

type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function uniqueHandle(base: string) {
  const db = getDb();
  let candidate = normalizeHandle(base);
  let index = 1;

  while (true) {
    const found = await db.query.users.findFirst({ where: eq(users.handle, candidate) });
    if (!found) {
      return candidate;
    }

    index += 1;
    candidate = normalizeHandle(`${base}-${index}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const stateCookie = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;

    if (!code || !state || !stateCookie || state !== stateCookie) {
      return NextResponse.redirect(new URL("/vestuario?auth_error=google_state", req.url));
    }

    const clientId = requiredEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      console.error("Google token exchange failed:", detail);
      return NextResponse.redirect(new URL("/vestuario?auth_error=google_token", req.url));
    }

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      cache: "no-store",
    });

    if (!userInfoResponse.ok) {
      const detail = await userInfoResponse.text();
      console.error("Google userinfo failed:", detail);
      return NextResponse.redirect(new URL("/vestuario?auth_error=google_profile", req.url));
    }

    const profile = (await userInfoResponse.json()) as GoogleUserInfo;
    if (!profile.email || !profile.email_verified) {
      return NextResponse.redirect(new URL("/vestuario?auth_error=google_email", req.url));
    }

    const db = getDb();
    const email = profile.email.toLowerCase();
    let user = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (!user) {
      const displayName = normalizeDisplayName(profile.name ?? profile.given_name ?? "Google Player");
      const handleSeed = normalizeHandle((profile.name ?? email.split("@")[0]).replace(/\s+/g, "-"));
      const handle = await uniqueHandle(handleSeed);

      const userId = randomUUID();
      const passwordHash = await hashPassword(randomUUID());

      await db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        displayName,
        handle,
        plan: "free",
      });

      user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    } else {
      const duplicateHandle = await db.query.users.findFirst({
        where: and(eq(users.handle, user.handle), ne(users.id, user.id)),
      });
      if (duplicateHandle) {
        const repaired = await uniqueHandle(user.handle);
        await db.update(users).set({ handle: repaired }).where(eq(users.id, user.id));
      }
    }

    if (!user) {
      return NextResponse.redirect(new URL("/vestuario?auth_error=google_account", req.url));
    }

    const response = NextResponse.redirect(new URL("/vestuario", req.url));
    response.cookies.set({
      name: GOOGLE_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/vestuario?auth_error=google_unknown", req.url));
  }
}
