import { timingSafeEqual } from "node:crypto";

/**
 * TEMPORARY: a fixed OTP for every number so the login flow can be built and tested.
 * To go live, replace these two functions with an SMS provider (MSG91, Twilio, ...):
 * generate a random code in sendOtp(), store its hash with an expiry, and compare in checkOtp().
 */
const DEV_OTP = process.env.DEV_OTP ?? "628791";

export async function sendOtp(phone: string): Promise<void> {
  console.log(`[otp] (dev) OTP for ${phone} is ${DEV_OTP}`);
}

export async function checkOtp(_phone: string, code: string): Promise<boolean> {
  const a = Buffer.from(code.trim());
  const b = Buffer.from(DEV_OTP);
  return a.length === b.length && timingSafeEqual(a, b);
}
