/**
 * Merchant session table: one active session per device.
 * On login we deactivate any existing session for this device_id, then create a new one.
 * Identity is merchant_id (merchant_parents.id); email/phone are not used for session blocking.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SESSION_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

/** Deactivate all active sessions for this device_id (so new login takes over). */
export async function deactivateSessionsForDevice(deviceId: string): Promise<void> {
  const db = getSupabase();
  await db
    .from("merchant_sessions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .eq("is_active", true);
}

/** Create a new merchant session for this device. Call after deactivateSessionsForDevice. */
export async function createMerchantSession(params: {
  merchantId: number;
  deviceId: string;
  refreshTokenHash?: string | null;
}): Promise<{ id: string; expiresAt: string }> {
  const db = getSupabase();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  const { data, error } = await db
    .from("merchant_sessions")
    .insert({
      merchant_id: params.merchantId,
      device_id: params.deviceId,
      refresh_token_hash: params.refreshTokenHash ?? null,
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id, expires_at")
    .single();
  if (error) {
    console.error("[merchant-session-db] createMerchantSession error:", error);
    throw new Error("Failed to create session");
  }
  return { id: data.id, expiresAt: data.expires_at };
}

/** Generate a stable device id (for cookie). */
export function generateDeviceId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}
