import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { validateMerchantFromSession } from "@/lib/auth/validate-merchant";
import { getMerchantMenuPath, getOnboardingR2Path } from "@/lib/r2-paths";
import { uploadToR2, deleteFromR2, deleteFromR2ByPrefix, toStoredDocumentUrl } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** CSV: min 1 row, max 500. Required header: at least "item_name" or "name", and "price" or "base_price". */
const CSV_MIN_ROWS = 1;
const CSV_MAX_ROWS = 500;
const CSV_REQUIRED_HEADERS = [
  ["item_name", "name"],
  ["price", "base_price", "selling_price"],
];

function parseCsvRowCountAndHeaders(text: string): { rowCount: number; headers: string[]; error?: string } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rowCount: 0, headers: [], error: "CSV is empty" };
  const headerLine = lines[0];
  const headers = headerLine.split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const rowCount = Math.max(0, lines.length - 1);
  if (rowCount < CSV_MIN_ROWS) return { rowCount, headers, error: `Minimum ${CSV_MIN_ROWS} data row(s) required (excluding header).` };
  if (rowCount > CSV_MAX_ROWS) return { rowCount, headers, error: `Maximum ${CSV_MAX_ROWS} data rows allowed. You have ${rowCount}.` };
  const hasName = CSV_REQUIRED_HEADERS[0].some((h) => headers.includes(h));
  const hasPrice = CSV_REQUIRED_HEADERS[1].some((h) => headers.includes(h));
  if (!hasName) return { rowCount, headers, error: `CSV must have a column named one of: ${CSV_REQUIRED_HEADERS[0].join(", ")}.` };
  if (!hasPrice) return { rowCount, headers, error: `CSV must have a column named one of: ${CSV_REQUIRED_HEADERS[1].join(", ")}.` };
  return { rowCount, headers };
}

/**
 * POST /api/merchant/menu-upload
 * Upload a menu file (CSV or image) and replace any existing menu file for the store.
 * - Fetches current menu media, deletes from R2 and DB, uploads new file, inserts new row.
 * - Items will be added later by agent; upload is in "pending" (no extra status column; source_entity remains ONBOARDING_*).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateMerchantFromSession({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
    });
    if (!validation.isValid || validation.merchantParentId == null) {
      return NextResponse.json({ error: validation.error ?? "Merchant not found" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const storeId = formData.get("storeId") as string | null;
    const menuUploadMode = (formData.get("menuUploadMode") as string) || "";

    if (!file || !storeId || !["CSV", "IMAGE"].includes(menuUploadMode)) {
      return NextResponse.json(
        { error: "Missing file, storeId, or invalid menuUploadMode (use CSV or IMAGE)." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const { data: store } = await db
      .from("merchant_stores")
      .select("id, store_id, parent_id")
      .eq("store_id", String(storeId).trim())
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const { data: parent } = await db
      .from("merchant_parents")
      .select("id, parent_merchant_id")
      .eq("id", store.parent_id)
      .maybeSingle();
    if (!parent || parent.id !== validation.merchantParentId) {
      return NextResponse.json({ error: "Store not accessible" }, { status: 403 });
    }
    const parentMerchantCode = (parent as { parent_merchant_id?: string }).parent_merchant_id || String(store.parent_id);

    if (menuUploadMode === "CSV") {
      const text = await file.text();
      const parsed = parseCsvRowCountAndHeaders(text);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
    }

    const menuPath = getMerchantMenuPath(store.store_id, parentMerchantCode);
    const isImage = menuUploadMode === "IMAGE";
    const ext = isImage
      ? (file.name.split(".").pop()?.toLowerCase() || "jpg")
      : "csv";
    const safeName = isImage ? `menu_card_${Date.now()}.${ext}` : `menu_sheet_${Date.now()}.${ext}`;
    const r2Key = `${menuPath}/${safeName}`;

    const { data: existingRows } = await db
      .from("merchant_store_media_files")
      .select("id, r2_key")
      .eq("store_id", store.id)
      .eq("media_scope", "MENU_REFERENCE");

    const keysToDelete: string[] = (existingRows || []).map((r: { r2_key: string }) => r.r2_key).filter(Boolean);

    // Remove old onboarding menu objects from R2 (so previous menu image/CSV from onboarding is removed)
    const onboardingMenuImagesPrefix = getOnboardingR2Path(parentMerchantCode, store.store_id, "MENU_IMAGES");
    const onboardingMenuCsvPrefix = getOnboardingR2Path(parentMerchantCode, store.store_id, "MENU_CSV");
    try {
      await deleteFromR2ByPrefix(onboardingMenuImagesPrefix);
      await deleteFromR2ByPrefix(onboardingMenuCsvPrefix);
    } catch (e) {
      console.warn("[menu-upload] R2 delete-by-prefix (onboarding menu) failed:", e);
    }

    await uploadToR2(file, r2Key);

    if (keysToDelete.length > 0) {
      await db
        .from("merchant_store_media_files")
        .delete()
        .eq("store_id", store.id)
        .eq("media_scope", "MENU_REFERENCE");
      for (const key of keysToDelete) {
        try {
          await deleteFromR2(key);
        } catch (e) {
          console.warn("[menu-upload] R2 delete failed for key:", key, e);
        }
      }
    }

    const publicUrl = toStoredDocumentUrl(r2Key);
    const sourceEntity = isImage ? "ONBOARDING_MENU_IMAGE" : "ONBOARDING_MENU_SHEET";
    const mimeType = isImage ? (file.type || "image/*") : "text/csv";

    await db.from("merchant_store_media_files").insert({
      store_id: store.id,
      media_scope: "MENU_REFERENCE",
      source_entity: sourceEntity,
      source_entity_id: null,
      original_file_name: file.name || safeName,
      r2_key: r2Key,
      public_url: publicUrl ?? `/api/attachments/proxy?key=${encodeURIComponent(r2Key)}`,
      mime_type: mimeType,
      is_active: true,
      verification_status: "PENDING",
      uploaded_by: user.id,
    });

    // Log activity so it shows in store activity (who uploaded)
    await db.from("merchant_store_activity_log").insert({
      store_id: store.id,
      activity_type: "MENU_FILE_UPLOADED",
      activity_reason: isImage ? "Menu image uploaded; pending verification." : "Menu CSV uploaded; pending verification.",
      activity_reason_code: isImage ? "MENU_IMAGE_UPLOAD" : "MENU_CSV_UPLOAD",
      activity_notes: JSON.stringify({ fileName: file.name || safeName, r2_key: r2Key, media_file_scope: "MENU_REFERENCE" }),
      actioned_by: "MERCHANT",
      actioned_by_id: null,
      actioned_by_name: user.email?.split("@")[0] ?? user.user_metadata?.name ?? "Merchant",
      actioned_by_email: user.email ?? null,
    });

    return NextResponse.json({ success: true, key: r2Key });
  } catch (err: any) {
    console.error("[merchant/menu-upload]", err);
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}
