import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateMerchantFromSession } from "@/lib/auth/validate-merchant";
import { createClient } from "@supabase/supabase-js";
import { extractR2KeyFromUrl } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Returns a proxy URL for viewing the file in browser (no expiry, works for private R2). */
function toProxyUrl(storedUrlOrKey: string | null | undefined): string | null {
  if (!storedUrlOrKey || typeof storedUrlOrKey !== "string") return null;
  const key = extractR2KeyFromUrl(storedUrlOrKey) || (storedUrlOrKey.includes("://") ? null : storedUrlOrKey.replace(/^\/+/, ""));
  if (!key) return storedUrlOrKey;
  return `/api/attachments/proxy?key=${encodeURIComponent(key)}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const validation = await validateMerchantFromSession({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
    });
    if (!validation.isValid || validation.merchantParentId == null) {
      return NextResponse.json({ success: false, error: validation.error ?? "Merchant not found" }, { status: 403 });
    }

    const storeDbId = req.nextUrl.searchParams.get("storeDbId");
    if (!storeDbId) {
      return NextResponse.json({ success: false, error: "storeDbId required" }, { status: 400 });
    }
    const storeId = Number(storeDbId);
    if (!Number.isFinite(storeId)) {
      return NextResponse.json({ success: false, error: "Invalid storeDbId" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: store } = await db
      .from("merchant_stores")
      .select("id, parent_id")
      .eq("id", storeId)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }
    const { data: parent } = await db
      .from("merchant_parents")
      .select("id")
      .eq("id", store.parent_id)
      .maybeSingle();
    if (!parent || parent.id !== validation.merchantParentId) {
      return NextResponse.json({ success: false, error: "Store not accessible" }, { status: 403 });
    }

    const { data: menuMedia } = await db
      .from("merchant_store_media_files")
      .select("public_url, r2_key, source_entity, verification_status, created_at, uploaded_by, original_file_name")
      .eq("store_id", storeId)
      .eq("media_scope", "MENU_REFERENCE")
      .eq("is_active", true);

    if (!menuMedia || menuMedia.length === 0) {
      return NextResponse.json({
        success: true,
        menuSpreadsheetUrl: null,
        menuImageUrls: [],
        menuSpreadsheetFileName: null,
        menuImageFileNames: [],
        menuSpreadsheetVerificationStatus: null,
        menuImageVerificationStatuses: [],
        menuSpreadsheetUploadedAt: null,
      });
    }

    const sheetRow = menuMedia.find((m: { source_entity?: string }) => m.source_entity === "ONBOARDING_MENU_SHEET");
    const imageRows = menuMedia.filter((m: { source_entity?: string }) => m.source_entity === "ONBOARDING_MENU_IMAGE");
    const rawSheet = sheetRow?.r2_key || sheetRow?.public_url || null;
    const rawImages = imageRows.map((r: { public_url?: string; r2_key?: string }) => r.r2_key || r.public_url).filter(Boolean) as string[];

    const menuSpreadsheetUrl = toProxyUrl(rawSheet);
    const menuImageUrls = rawImages.map((u) => toProxyUrl(u)).filter((u): u is string => !!u);
    const menuSpreadsheetFileName = (sheetRow as { original_file_name?: string })?.original_file_name ?? null;
    const menuImageFileNames = imageRows.map((r: { original_file_name?: string }) => r.original_file_name ?? "Menu image");

    return NextResponse.json({
      success: true,
      menuSpreadsheetUrl: menuSpreadsheetUrl ?? null,
      menuImageUrls: menuImageUrls.filter((u): u is string => !!u),
      menuSpreadsheetFileName,
      menuImageFileNames,
      menuSpreadsheetVerificationStatus: (sheetRow as { verification_status?: string })?.verification_status ?? null,
      menuImageVerificationStatuses: imageRows.map((r: { verification_status?: string }) => r.verification_status ?? "PENDING"),
      menuSpreadsheetUploadedAt: (sheetRow as { created_at?: string })?.created_at ?? null,
    });
  } catch (e) {
    console.error("[store-menu-media-signed]", e);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
