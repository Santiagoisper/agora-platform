import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_STATE_COOKIE = "agora_google_oauth_state";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const clientId = requiredEnv("GOOGLE_CLIENT_ID");
    const redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

    const state = randomBytes(24).toString("hex");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("access_type", "online");

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: GOOGLE_STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/vestuario?auth_error=google_not_configured", req.url));
  }
}
