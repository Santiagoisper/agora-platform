import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireSessionUserId, setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { normalizeDisplayName, normalizeHandle } from "@/lib/users";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

async function parsePayload(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return req.json();
  }

  const formData = await req.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const body = await parsePayload(req);
    const displayName = normalizeDisplayName(String(body.displayName ?? ""));
    const handle = normalizeHandle(String(body.handle ?? ""));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!displayName || !handle || !email || password.length < 8) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (existing) {
      return NextResponse.json({ error: "Account already exists for this session" }, { status: 409 });
    }

    const emailTaken = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (emailTaken) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      displayName,
      handle,
      plan: "free",
    });

    const response = NextResponse.redirect(new URL("/vestuario", req.url));
    setSessionCookie(response, userId);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
