import { getDb } from "@/db";
import { users } from "@/db/schema";
import { setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

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
    const body = await parsePayload(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const response = NextResponse.redirect(new URL("/vestuario", req.url));
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
