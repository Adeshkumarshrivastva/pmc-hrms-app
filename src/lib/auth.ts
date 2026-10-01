import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEmployee } from "./queries";

export const SESSION_COOKIE = "session";
const PENDING_COOKIE = "login_phone";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PENDING_SECONDS = 60 * 5;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET env var is required in production");
  return "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Signed, expiring token: base64url(json).hmac */
function pack(data: Record<string, unknown>, seconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + seconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unpack(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge }) as const;

export async function createSession(userId: number) {
  (await cookies()).set(SESSION_COOKIE, pack({ uid: userId }, SESSION_SECONDS), cookieOptions(SESSION_SECONDS));
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Remembers which phone number an OTP was sent to (5 minutes), so the verify step can't target another number.
 * `verified` is set once the OTP has been checked (used by the first-login name step in static mode).
 */
export async function setPendingLogin(phone: string, verified = false) {
  (await cookies()).set(PENDING_COOKIE, pack({ phone, verified }, PENDING_SECONDS), cookieOptions(PENDING_SECONDS));
}

export async function getPendingLogin(): Promise<{ phone: string; verified: boolean } | null> {
  const data = unpack((await cookies()).get(PENDING_COOKIE)?.value);
  return typeof data?.phone === "string" ? { phone: data.phone, verified: data.verified === true } : null;
}

export async function clearPendingLogin() {
  (await cookies()).delete(PENDING_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const data = unpack((await cookies()).get(SESSION_COOKIE)?.value);
  if (typeof data?.uid !== "number") return null;
  const user = await getEmployee(data.uid);
  return user && user.active ? user : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
