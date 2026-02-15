import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/onboarding/payment-status?merchantParentId=123
 * Returns whether this parent has already completed onboarding payment (status = captured).
 * Used to skip payment step when user returns after logout or navigates back.
 */
export async function GET(request: NextRequest) {
  try {
    const merchantParentId = request.nextUrl.searchParams.get("merchantParentId");
    if (!merchantParentId) {
      return NextResponse.json(
        { success: false, error: "merchantParentId is required" },
        { status: 400 }
      );
    }
    const parentId = Number(merchantParentId);
    if (!Number.isFinite(parentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid merchantParentId" },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("merchant_onboarding_payments")
      .select("id, status, captured_at")
      .eq("merchant_parent_id", parentId)
      .eq("status", "captured")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[onboarding/payment-status] Error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to check payment status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: !!data,
      capturedAt: data?.captured_at ?? null,
    });
  } catch (e) {
    console.error("[onboarding/payment-status] Error:", e);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
