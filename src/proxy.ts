import { createNewSessionCookieValue, readSessionUserId, SESSION_COOKIE_NAME } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = readSessionUserId(sessionValue);

  if (!userId) {
    const nextSessionValue = createNewSessionCookieValue();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("cookie", `${SESSION_COOKIE_NAME}=${nextSessionValue}`);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: nextSessionValue,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
