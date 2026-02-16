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
 * GET /api/onboarding/payment-status?merchantParentId=123&merchantStoreId=GMMC1001
 * Returns whether this store has already completed onboarding payment (status = captured).
 * Checks by store_id first, falls back to parent_id if store_id not provided.
 * Used to skip payment step when user returns after logout or navigates back.
 */
export async function GET(request: NextRequest) {
  try {
    const merchantParentId = request.nextUrl.searchParams.get("merchantParentId");
    const merchantStoreId = request.nextUrl.searchParams.get("merchantStoreId"); // Store public ID (e.g., GMMC1001)
    
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
    
    // If store_id is provided, check payment by store_id
    if (merchantStoreId) {
      // Get numeric store ID from public store_id
      const { data: storeRow } = await db
        .from("merchant_stores")
        .select("id")
        .eq("store_id", merchantStoreId)
        .eq("parent_id", parentId)
        .maybeSingle();
      
      if (storeRow?.id) {
        const { data, error } = await db
          .from("merchant_onboarding_payments")
          .select("id, status, captured_at")
          .eq("merchant_store_id", storeRow.id)
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
          checkedBy: "store_id",
        });
      }
    }
    
    // Fallback: check by parent_id (for backward compatibility)
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
      checkedBy: "parent_id",
    });
  } catch (e) {
    console.error("[onboarding/payment-status] Error:", e);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
