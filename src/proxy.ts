import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap gate only: checks that a session cookie exists. The signature and the
// user are verified server-side in requireUser()/requireAdmin().
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and any file with an extension (logo.png, favicon.ico, ...).
  matcher: ["/((?!_next/static|_next/image|.*[.].*).*)"],
};
