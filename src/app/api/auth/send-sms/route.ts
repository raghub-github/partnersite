/**
 * Send SMS Hook - Called by Supabase Auth when sending phone OTP.
 *
 * Supabase generates the 6-digit OTP. This hook ONLY delivers it via MSG91.
 * DO NOT use MSG91 OTP API (api/v5/otp) - use Text SMS API to send the OTP as message content.
 *
 * Flow: User requests OTP → Supabase generates OTP → Supabase calls this hook
 * → We send OTP via MSG91 Text SMS → User receives and enters OTP → Supabase verifies.
 */

import { NextRequest, NextResponse } from "next/server";

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const SEND_SMS_HOOK_SECRET = process.env.SUPABASE_SEND_SMS_HOOK_SECRET;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
  if (digits.startsWith("91") && digits.length > 12) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function POST(req: NextRequest) {
  try {
    if (!MSG91_AUTH_KEY) {
      console.error("[send-sms] MSG91_AUTH_KEY not configured");
      return NextResponse.json({ error: "SMS not configured" }, { status: 500 });
    }

    const body = await req.json();

    if (SEND_SMS_HOOK_SECRET) {
      const provided = req.headers.get("x-supabase-hook-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
      if (provided !== SEND_SMS_HOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const phone = (body?.user?.phone ?? body?.phone ?? "").trim();
    const otp = (body?.sms?.otp ?? body?.otp ?? body?.token ?? "").trim();

    if (!phone || !otp) {
      return NextResponse.json({ error: "Missing phone or otp" }, { status: 400 });
    }

    const mobile = normalizePhone(phone);
    if (mobile.length < 10) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }

    const message = `Your verification code is ${otp}. Do not share.`;
    const sender = process.env.MSG91_SENDER_ID || "GMMSMS";

    const res = await fetch("https://api.msg91.com/api/v2/sendsms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        sender,
        route: "4",
        country: "91",
        sms: [{ message, to: [mobile] }],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || (data.type && data.type === "error")) {
      console.error("[send-sms] MSG91 error:", data.message || res.statusText);
      return NextResponse.json({ error: "SMS delivery failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("[send-sms]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
