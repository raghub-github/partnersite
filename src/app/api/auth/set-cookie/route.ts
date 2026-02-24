import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { initializeSession } from "@/lib/auth/session-manager";
import { validateMerchantFromSession } from "@/lib/auth/validate-merchant";
import {
  deactivateSessionsForDevice,
  createMerchantSession,
  generateDeviceId,
} from "@/lib/auth/merchant-session-db";
import { deviceIdCookie } from "@/lib/auth/auth-cookie-names";

/**
 * POST /api/auth/set-cookie
 * Call after successful login. Validates merchant by id/phone/email (any match).
 * Deactivates any existing session for this device, creates new merchant_sessions row,
 * sets Supabase session and custom session cookies. Never blocks on email mismatch.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { access_token?: string; refresh_token?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
    const { access_token, refresh_token } = body ?? {};
    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { success: false, error: "Missing tokens", code: "MISSING_TOKENS" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const response = NextResponse.json({ success: true });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data.session?.user) {
      return NextResponse.json(
        { success: false, error: "No session after setSession", code: "NO_SESSION" },
        { status: 400 }
      );
    }

    const validation = await validateMerchantFromSession(data.session.user);
    if (!validation.isValid) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Not authorized for merchant dashboard.",
        },
        { status: 403 }
      );
    }

    const merchantId = validation.merchantParentId!;
    const deviceIdCookieName = deviceIdCookie();
    const existingDeviceId = cookieStore.get(deviceIdCookieName)?.value?.trim();
    const deviceId = existingDeviceId || generateDeviceId();

    try {
      await deactivateSessionsForDevice(deviceId);
      await createMerchantSession({
        merchantId,
        deviceId,
        refreshTokenHash: null,
      });
    } catch (sessionDbErr) {
      console.error("[set-cookie] merchant_sessions error (table may not exist yet):", sessionDbErr);
      // Continue: set cookies even if merchant_sessions insert fails (e.g. migration not run)
    }

    const cookieManager = {
      set: (name: string, value: string, options: Record<string, unknown>) => {
        cookieStore.set(name, value, options as any);
        response.cookies.set(name, value, options as any);
      },
    };
    initializeSession(cookieManager);

    const deviceCookieOpts = {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
    cookieManager.set(deviceIdCookieName, deviceId, deviceCookieOpts);

    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "set-cookie error";
    return NextResponse.json(
      { success: false, error: message, code: "SET_COOKIE_ERROR" },
      { status: 500 }
    );
  }
}
