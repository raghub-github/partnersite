/**
 * Supabase Auth helpers for merchant dashboard (client-only).
 * Google OAuth and Phone OTP are configured in Supabase Dashboard — no Google client/secret in app .env.
 */

import { createClient } from "@/lib/supabase/client";

export interface AuthResponse {
  success: boolean;
  error?: string;
  data?: {
    url?: string;
    session?: { access_token: string; refresh_token: string; user?: { id: string } };
    user?: { id: string };
  };
}

/** Redirect to Google sign-in (Supabase OAuth). Configure Google in Supabase Dashboard > Authentication > Providers. */
export async function signInWithGoogle(redirectTo?: string): Promise<AuthResponse> {
  try {
    if (typeof window === "undefined") {
      return { success: false, error: "Must be called from the client" };
    }
    const supabase = createClient();
    const baseUrl = window.location.origin;
    const redirectUrl = redirectTo || `${baseUrl}/auth/callback`;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_redirect", "/auth/post-login");
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: "select_account", // Always show Google account picker (like main dashboard)
        },
      },
    });
    if (error) return { success: false, error: error.message };
    if (data?.url) {
      window.location.href = data.url;
      return { success: true, data: { url: data.url } };
    }
    return { success: true, data: data as unknown as AuthResponse["data"] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Request OTP via email (Supabase). Enable Email in Supabase Dashboard; use 8-digit OTP template. */
export async function requestEmailOTP(email: string): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as unknown as AuthResponse["data"] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Verify email OTP (8-digit). */
export async function verifyEmailOTP(email: string, token: string): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as unknown as AuthResponse["data"] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Request OTP via phone (Supabase). Supabase generates 6-digit OTP. Requires Send SMS Hook (e.g. /api/auth/send-sms) or built-in SMS provider. */
export async function requestPhoneOTP(phone: string): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    const normalized = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { channel: "sms" },
    });
    if (error) {
      const msg = error.message || "Unknown error";
      // 422 usually means SMS provider not configured
      if (
        msg.toLowerCase().includes("provider") ||
        msg.toLowerCase().includes("sms") ||
        msg.toLowerCase().includes("422") ||
        msg.toLowerCase().includes("unprocessable")
      ) {
        return {
          success: false,
          error:
            "SMS is not configured. Configure an SMS provider (Twilio, MessageBird, etc.) or a Send SMS Hook in Supabase Dashboard → Authentication → Providers → Phone, then try again.",
        };
      }
      return { success: false, error: msg };
    }
    return { success: true, data: data as unknown as AuthResponse["data"] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Verify phone OTP. */
export async function verifyPhoneOTP(phone: string, token: string): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    const normalized = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token,
      type: "sms",
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as unknown as AuthResponse["data"] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
