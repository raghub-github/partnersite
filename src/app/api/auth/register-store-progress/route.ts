import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateMerchantFromSession } from "@/lib/auth/validate-merchant";
import { createClient } from "@supabase/supabase-js";
import { logAuthError, shouldClearSession } from "@/lib/auth/auth-error-handler";
import { getR2SignedUrl, extractR2KeyFromUrl, deleteFromR2 } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Returns a fresh R2 signed URL for display; avoids expired URLs. Uses 7-day expiry for progress responses. */
async function toFreshSignedUrl(storedUrlOrKey: string | null | undefined): Promise<string | null> {
  if (!storedUrlOrKey || typeof storedUrlOrKey !== "string") return null;
  const key = extractR2KeyFromUrl(storedUrlOrKey) || (storedUrlOrKey.includes("://") ? null : storedUrlOrKey.replace(/^\/+/, ""));
  if (!key) return storedUrlOrKey;
  try {
    return await getR2SignedUrl(key, 86400 * 7); // 7 days
  } catch {
    return storedUrlOrKey;
  }
}

/** Returns proxy URL for menu files (no expiry; works for private R2). */
function toMenuProxyUrl(storedUrlOrKey: string | null | undefined): string | null {
  if (!storedUrlOrKey || typeof storedUrlOrKey !== "string") return null;
  const key = extractR2KeyFromUrl(storedUrlOrKey) || (storedUrlOrKey.includes("://") ? null : storedUrlOrKey.replace(/^\/+/, ""));
  if (!key) return storedUrlOrKey;
  return `/api/attachments/proxy?key=${encodeURIComponent(key)}`;
}

function toEnumStoreType(raw: string | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  return normalized === "OTHERS" ? "OTHERS" : normalized;
}

type ProgressFlags = {
  step_1_completed: boolean;
  step_2_completed: boolean;
  step_3_completed: boolean;
  step_4_completed: boolean;
  step_5_completed: boolean;
  step_6_completed: boolean;
};

const STEP_KEYS: Array<keyof ProgressFlags> = [
  "step_1_completed",
  "step_2_completed",
  "step_3_completed",
  "step_4_completed",
  "step_5_completed",
  "step_6_completed",
];

/** Shape of form_data we read for step_store.storePublicId; form_data is otherwise unknown. */
type ProgressFormData = { step_store?: { storePublicId?: string }; [key: string]: unknown };

type ProgressRow = ProgressFlags & {
  id: number;
  form_data?: unknown;
  current_step?: number;
  completed_steps?: number;
  [key: string]: unknown;
};

function buildReconciledFlags(params: {
  existingFlags?: Partial<ProgressFlags> | null;
  existingCurrentStep?: number | null;
  normalizedCurrentStep: number;
  mergedFormData?: Record<string, unknown> | null;
  markStepComplete?: boolean;
}): ProgressFlags {
  const {
    existingFlags,
    existingCurrentStep,
    normalizedCurrentStep,
    mergedFormData,
    markStepComplete,
  } = params;

  const nextFlags: ProgressFlags = {
    step_1_completed: !!existingFlags?.step_1_completed,
    step_2_completed: !!existingFlags?.step_2_completed,
    step_3_completed: !!existingFlags?.step_3_completed,
    step_4_completed: !!existingFlags?.step_4_completed,
    step_5_completed: !!existingFlags?.step_5_completed,
    step_6_completed: !!existingFlags?.step_6_completed,
  };

  // Auto-heal older rows: if current_step already moved ahead, prior steps are considered completed.
  const maxReachedStep = Math.max(
    Number.isFinite(Number(existingCurrentStep)) ? Number(existingCurrentStep) : 1,
    normalizedCurrentStep
  );
  for (let i = 1; i < maxReachedStep; i++) {
    nextFlags[`step_${i}_completed` as keyof ProgressFlags] = true;
  }

  // Also infer completion from saved payloads.
  const formData = mergedFormData || {};
  if (formData.step1) nextFlags.step_1_completed = true;
  if (formData.step2) nextFlags.step_2_completed = true;
  if (formData.step3) nextFlags.step_3_completed = true;
  if (formData.step4) nextFlags.step_4_completed = true;
  if (formData.step5) nextFlags.step_5_completed = true;
  if (formData.final) nextFlags.step_6_completed = true;

  if (markStepComplete) {
    nextFlags[`step_${normalizedCurrentStep}_completed` as keyof ProgressFlags] = true;
  }

  return nextFlags;
}

function countCompletedSteps(flags: ProgressFlags) {
  return STEP_KEYS.reduce((acc, key) => acc + (flags[key] ? 1 : 0), 0);
}

async function generateStorePublicId(db: ReturnType<typeof getSupabaseAdmin>) {
  // Use the database function for consistent Store ID generation
  const { data, error } = await db.rpc('generate_unique_store_id');
  if (error) {
    console.error("Error calling generate_unique_store_id function:", error);
    // Fallback to the original logic if the function doesn't exist
    const { data: storeData, error: storeError } = await db
      .from("merchant_stores")
      .select("store_id");
    if (storeError) throw new Error("Unable to generate store id");
    
    // Also check progress table for any pending Store IDs
    const { data: progressData } = await db
      .from("merchant_store_registration_progress")
      .select("form_data");
    
    let maxNum = 1000;
    
    // Check merchant_stores
    for (const row of storeData || []) {
      const match = typeof row.store_id === "string" && row.store_id.match(/^GMMC(\d+)$/);
      if (match) maxNum = Math.max(maxNum, Number(match[1]));
    }
    
    // Check progress table
    for (const row of progressData || []) {
      const storePublicId = (row.form_data as ProgressFormData | null | undefined)?.step_store?.storePublicId;
      if (typeof storePublicId === "string") {
        const match = storePublicId.match(/^GMMC(\d+)$/);
        if (match) maxNum = Math.max(maxNum, Number(match[1]));
      }
    }
    
    return `GMMC${maxNum + 1}`;
  }
  return data;
}

/** Insert merchant_stores row when step 1 is completed (so store_id exists in DB immediately). */
async function insertStoreAfterStep1(
  db: ReturnType<typeof getSupabaseAdmin>,
  params: { parentId: number; step1: any; generatedStoreId: string }
): Promise<{ storeDbId: number; storePublicId: string } | null> {
  const { parentId, step1, generatedStoreId } = params;
  if (!step1?.store_name || !generatedStoreId) return null;

  const ownerFullName =
    typeof step1.owner_full_name === "string" && step1.owner_full_name.trim()
      ? step1.owner_full_name.trim()
      : "Store Owner";

  const payload = {
    store_id: generatedStoreId,
    parent_id: parentId,
    store_name: step1.store_name,
    store_display_name: step1.store_display_name || null,
    store_description: step1.store_description || null,
    store_type: toEnumStoreType(step1.store_type),
    store_email: step1.store_email || null,
    store_phones: Array.isArray(step1.store_phones) ? step1.store_phones : [],
    full_address: "Pending",
    city: "Pending",
    state: "Pending",
    postal_code: "Pending",
    country: "IN",
    current_onboarding_step: 1,
    onboarding_completed: false,
    approval_status: "DRAFT" as const,
    status: "INACTIVE" as const,
    is_active: false,
    is_accepting_orders: false,
    is_available: false,
  };

  const { data, error } = await db
    .from("merchant_stores")
    .insert([payload])
    .select("id, store_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await db
        .from("merchant_stores")
        .select("id, store_id")
        .eq("store_id", generatedStoreId)
        .maybeSingle();
      if (existing)
        return { storeDbId: existing.id as number, storePublicId: existing.store_id as string };
    }
    console.error("[register-store-progress] insertStoreAfterStep1 failed:", error);
    return null;
  }
  return { storeDbId: data.id as number, storePublicId: data.store_id as string };
}

async function upsertStoreDraft(db: ReturnType<typeof getSupabaseAdmin>, params: {
  parentId: number;
  step1: any;
  step2: any;
  existingStoreDbId?: number | null;
  nextStep: number;
}) {
  const { parentId, step1, step2, existingStoreDbId, nextStep } = params;
  if (!step1?.store_name || !step2?.full_address || !step2?.city || !step2?.state || !step2?.postal_code) {
    return null;
  }

  const draftPayload = {
    store_name: step1.store_name,
    store_display_name: step1.store_display_name || null,
    store_description: step1.store_description || null,
    store_email: step1.store_email || null,
    store_phones: step1.store_phones || [],
    full_address: step2.full_address,
    landmark: step2.landmark || null,
    city: step2.city,
    state: step2.state,
    postal_code: step2.postal_code,
    country: step2.country || "IN",
    latitude: step2.latitude,
    longitude: step2.longitude,
    current_onboarding_step: nextStep,
    onboarding_completed: false,
    approval_status: "DRAFT" as const,
    status: "INACTIVE" as const,
    store_type: toEnumStoreType(step1.store_type),
    is_active: false,
    is_accepting_orders: false,
    is_available: false,
    operational_status: "CLOSED" as const,
  };

  if (existingStoreDbId) {
    const { data: storeExists } = await db
      .from("merchant_stores")
      .select("id")
      .eq("id", existingStoreDbId)
      .maybeSingle();
    if (!storeExists) {
      // Store was deleted (e.g. manually); fall through to create new or reuse DRAFT
    } else {
      const { data, error } = await db
        .from("merchant_stores")
        .update(draftPayload)
        .eq("id", existingStoreDbId)
        .select("id, store_id")
        .single();
      if (error) throw new Error(error.message);
      return { storeDbId: data.id as number, storePublicId: data.store_id as string };
    }
  }

  // Ensure only one DRAFT store per parent: reuse existing DRAFT if any (avoids multiple stores from race/double-save)
  const { data: existingDraft } = await db
    .from("merchant_stores")
    .select("id, store_id")
    .eq("parent_id", parentId)
    .eq("approval_status", "DRAFT")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDraft) {
    const { data, error } = await db
      .from("merchant_stores")
      .update(draftPayload)
      .eq("id", existingDraft.id)
      .select("id, store_id")
      .single();
    if (error) throw new Error(error.message);
    return { storeDbId: data.id as number, storePublicId: data.store_id as string };
  }

  const generatedStoreId = await generateStorePublicId(db);
  const { data, error } = await db
    .from("merchant_stores")
    .insert([
      {
        store_id: generatedStoreId,
        parent_id: parentId,
        ...draftPayload,
      },
    ])
    .select("id, store_id")
    .single();
  if (error) throw new Error(error.message);
  return { storeDbId: data.id as number, storePublicId: data.store_id as string };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      // Only log actual errors, not missing sessions
      if (userError.message !== 'Auth session missing!') {
        logAuthError('register-store-progress-GET', userError);
      }
      if (shouldClearSession(userError)) {
        return NextResponse.json({ 
          success: false, 
          error: "Session invalid", 
          code: "SESSION_INVALID" 
        }, { status: 401 });
      }
      return NextResponse.json({ 
        success: false, 
        error: userError.message || "Authentication failed" 
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const validation = await validateMerchantFromSession({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
    });

    if (!validation.isValid || validation.merchantParentId == null) {
      return NextResponse.json(
        { success: false, error: validation.error ?? "Merchant not found" },
        { status: 403 }
      );
    }

    const db = getSupabaseAdmin();
    const storePublicId = req.nextUrl.searchParams.get("storePublicId");
    const forceNew = req.nextUrl.searchParams.get("forceNew") === "1";

    if (forceNew) {
      return NextResponse.json({ success: true, progress: null });
    }

    let progress: ProgressRow | null = null;
    let err: { message?: string } | null = null;

    // First try to find by storePublicId if provided
    if (storePublicId) {
      const byStore = await db
        .from("merchant_store_registration_progress")
        .select("*")
        .eq("parent_id", validation.merchantParentId)
        .neq("registration_status", "COMPLETED")
        .contains("form_data", { step_store: { storePublicId } })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byStore.error) err = byStore.error;
      else if (byStore.data) progress = byStore.data as ProgressRow;
    }

    // If not found by storePublicId, try to find the most recent active progress for this parent
    if (!progress) {
      const byParent = await db
        .from("merchant_store_registration_progress")
        .select("*")
        .eq("parent_id", validation.merchantParentId)
        .neq("registration_status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byParent.error) err = byParent.error;
      else if (byParent.data) progress = byParent.data as ProgressRow;
    }

    // If we found progress but no Store ID is generated yet, and step 1 is completed, generate it
    if (progress && !(progress.form_data as ProgressFormData | null | undefined)?.step_store?.storePublicId && progress.step_1_completed) {
      try {
        const generatedStoreId = await generateStorePublicId(db);
        console.log(`Generated Store ID during GET: ${generatedStoreId} for existing progress`);
        
        const updatedFormData = {
          ...((progress.form_data as any) || {}),
          step_store: {
            ...((progress.form_data as any)?.step_store || {}),
            storePublicId: generatedStoreId,
          },
        };

        // Update the progress record with the generated Store ID
        const { data: updatedProgress, error: updateError } = await db
          .from("merchant_store_registration_progress")
          .update({
            form_data: updatedFormData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", progress.id)
          .select("*")
          .single();

        if (!updateError && updatedProgress) {
          progress = updatedProgress as ProgressRow;
        }
      } catch (error) {
        console.error("Failed to generate Store ID during GET:", error);
      }
    }

    if (err) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch progress" },
        { status: 500 }
      );
    }

    if (!progress) {
      return NextResponse.json({ success: true, progress: null });
    }

    const stepStore = (progress.form_data as any)?.step_store;
    const progressStoreDbId = stepStore?.storeDbId ? Number(stepStore.storeDbId) : null;
    const progressStorePublicId = stepStore?.storePublicId;
    if (progressStoreDbId) {
      const { data: storeExists } = await db
        .from("merchant_stores")
        .select("id")
        .eq("id", progressStoreDbId)
        .maybeSingle();
      if (!storeExists) {
        return NextResponse.json({ success: true, progress: null });
      }
    }

    // Merge merchant_store_documents into form_data.step4 so UI shows saved doc URLs after refresh
    const storeDbId = progressStoreDbId;
    if (storeDbId) {
      const { data: docRow } = await db
        .from("merchant_store_documents")
        .select("*")
        .eq("store_id", storeDbId)
        .maybeSingle();
      if (docRow) {
        const formData = (progress.form_data || {}) as Record<string, unknown>;
        const step4 = (formData.step4 || {}) as Record<string, unknown>;
        const rawPan = docRow.pan_document_url ?? step4.pan_image_url;
        const rawAadharFront = docRow.aadhaar_document_url ?? step4.aadhar_front_url;
        const rawAadharBack = (docRow.aadhaar_document_metadata as any)?.back_url ?? step4.aadhar_back_url;
        const rawGst = docRow.gst_document_url ?? step4.gst_image_url;
        const rawFssai = docRow.fssai_document_url ?? step4.fssai_image_url;
        const rawDrug = docRow.drug_license_document_url ?? step4.drug_license_image_url;
        const rawPharmacist = docRow.pharmacist_certificate_document_url ?? step4.pharmacist_certificate_url;
        const rawPharmacyCouncil = docRow.pharmacy_council_registration_document_url ?? step4.pharmacy_council_registration_url;
        const rawOther = docRow.other_document_url ?? step4.other_document_file_url;
        const [
          pan_image_url,
          aadhar_front_url,
          aadhar_back_url,
          gst_image_url,
          fssai_image_url,
          drug_license_image_url,
          pharmacist_certificate_url,
          pharmacy_council_registration_url,
          other_document_file_url,
        ] = await Promise.all([
          toFreshSignedUrl(rawPan),
          toFreshSignedUrl(rawAadharFront),
          toFreshSignedUrl(rawAadharBack),
          toFreshSignedUrl(rawGst),
          toFreshSignedUrl(rawFssai),
          toFreshSignedUrl(rawDrug),
          toFreshSignedUrl(rawPharmacist),
          toFreshSignedUrl(rawPharmacyCouncil),
          toFreshSignedUrl(rawOther),
        ]);
        const mergedStep4 = {
          ...step4,
          pan_number: docRow.pan_document_number ?? step4.pan_number,
          pan_holder_name: docRow.pan_holder_name ?? step4.pan_holder_name,
          pan_image_url: pan_image_url ?? rawPan,
          aadhar_number: docRow.aadhaar_document_number ?? step4.aadhar_number,
          aadhar_holder_name: docRow.aadhaar_holder_name ?? step4.aadhar_holder_name,
          aadhar_front_url: aadhar_front_url ?? rawAadharFront,
          aadhar_back_url: aadhar_back_url ?? rawAadharBack,
          gst_number: docRow.gst_document_number ?? step4.gst_number,
          gst_image_url: gst_image_url ?? rawGst,
          fssai_number: docRow.fssai_document_number ?? step4.fssai_number,
          fssai_image_url: fssai_image_url ?? rawFssai,
          fssai_expiry_date: docRow.fssai_expiry_date ?? step4.fssai_expiry_date,
          drug_license_number: docRow.drug_license_document_number ?? step4.drug_license_number,
          drug_license_image_url: drug_license_image_url ?? rawDrug,
          drug_license_expiry_date: docRow.drug_license_expiry_date ?? step4.drug_license_expiry_date,
          pharmacist_registration_number: docRow.pharmacist_certificate_document_number ?? step4.pharmacist_registration_number,
          pharmacist_certificate_url: pharmacist_certificate_url ?? rawPharmacist,
          pharmacist_expiry_date: docRow.pharmacist_certificate_expiry_date ?? step4.pharmacist_expiry_date,
          pharmacy_council_registration_url: pharmacy_council_registration_url ?? rawPharmacyCouncil,
          other_document_number: docRow.other_document_number ?? step4.other_document_number,
          other_document_type: docRow.other_document_type ?? step4.other_document_type,
          other_document_name: docRow.other_document_name ?? step4.other_document_name,
          other_document_file_url: other_document_file_url ?? rawOther,
          other_document_expiry_date: docRow.other_expiry_date ?? step4.other_document_expiry_date,
        };
        // Sign bank/UPI attachment URLs (R2 private URLs require signed URLs for viewing)
        const bankData = (step4.bank || {}) as Record<string, unknown>;
        const rawBankProof = bankData.bank_proof_file_url;
        const rawUpiQr = bankData.upi_qr_screenshot_url;
        const [signedBankProof, signedUpiQr] = await Promise.all([
          toFreshSignedUrl(typeof rawBankProof === "string" ? rawBankProof : null),
          toFreshSignedUrl(typeof rawUpiQr === "string" ? rawUpiQr : null),
        ]);
        if (Object.keys(bankData).length > 0) {
          (mergedStep4 as Record<string, unknown>).bank = {
            ...bankData,
            bank_proof_file_url: signedBankProof ?? rawBankProof,
            upi_qr_screenshot_url: signedUpiQr ?? rawUpiQr,
          };
        }
        progress = { ...progress, form_data: { ...formData, step4: mergedStep4 } } as ProgressRow;
      }
      const { data: menuMedia } = await db
        .from("merchant_store_media_files")
        .select("public_url, r2_key, source_entity")
        .eq("store_id", storeDbId)
        .eq("media_scope", "MENU_REFERENCE")
        .eq("is_active", true);
      if (menuMedia && menuMedia.length > 0) {
        const formData = (progress.form_data || {}) as Record<string, unknown>;
        const step3 = (formData.step3 || {}) as Record<string, unknown>;
        const sheetRow = menuMedia.find((m: any) => m.source_entity === "ONBOARDING_MENU_SHEET");
        const imageRows = menuMedia.filter((m: any) => m.source_entity === "ONBOARDING_MENU_IMAGE");
        const rawSheetUrl = (sheetRow?.public_url || sheetRow?.r2_key || step3.menuSpreadsheetUrl) as string | null;
        const rawImageUrls = imageRows.length > 0
          ? imageRows.map((r: any) => r.public_url || r.r2_key).filter(Boolean)
          : (Array.isArray(step3.menuImageUrls) ? step3.menuImageUrls : []);
        const signedSheetUrl = toMenuProxyUrl(rawSheetUrl);
        const signedImageUrls = (rawImageUrls as string[]).map((u) => toMenuProxyUrl(u)).filter((u): u is string => !!u);
        const mergedStep3 = {
          ...step3,
          menuSpreadsheetUrl: signedSheetUrl ?? rawSheetUrl ?? step3.menuSpreadsheetUrl,
          menuImageUrls: signedImageUrls.filter(Boolean).length > 0 ? signedImageUrls : (step3.menuImageUrls ?? []),
        };
        progress = { ...progress, form_data: { ...formData, step3: mergedStep3 } } as ProgressRow;
      }
    }

    const step3 = (progress.form_data as any)?.step3;
    if (step3 && (step3.menuSpreadsheetUrl || (Array.isArray(step3.menuImageUrls) && step3.menuImageUrls.length > 0))) {
      const signedSheet = toMenuProxyUrl(step3.menuSpreadsheetUrl || null);
      const signedImages = (Array.isArray(step3.menuImageUrls) ? step3.menuImageUrls : [])
        .map((u: string) => toMenuProxyUrl(u))
        .filter((u): u is string => !!u);
      const formData = (progress.form_data || {}) as Record<string, unknown>;
      const mergedStep3 = {
        ...step3,
        menuSpreadsheetUrl: signedSheet ?? step3.menuSpreadsheetUrl,
        menuImageUrls: signedImages.filter(Boolean).length > 0 ? signedImages : step3.menuImageUrls,
      };
      progress = { ...progress, form_data: { ...formData, step3: mergedStep3 } } as ProgressRow;
    }

    // Sign bank/UPI URLs whenever step4.bank exists (R2 private URLs require signed URLs for viewing)
    const step4ForBank = (progress.form_data as any)?.step4;
    if (step4ForBank?.bank) {
      const bankData = step4ForBank.bank as Record<string, unknown>;
      const rawBankProof = bankData.bank_proof_file_url;
      const rawUpiQr = bankData.upi_qr_screenshot_url;
      const [signedBankProof, signedUpiQr] = await Promise.all([
        toFreshSignedUrl(typeof rawBankProof === "string" ? rawBankProof : null),
        toFreshSignedUrl(typeof rawUpiQr === "string" ? rawUpiQr : null),
      ]);
      const formData = (progress.form_data || {}) as Record<string, unknown>;
      const step4 = { ...(formData.step4 as Record<string, unknown>), bank: {
        ...bankData,
        bank_proof_file_url: signedBankProof ?? rawBankProof,
        upi_qr_screenshot_url: signedUpiQr ?? rawUpiQr,
      } };
      progress = { ...progress, form_data: { ...formData, step4 } } as ProgressRow;
    }

    // Reconcile stale counters/flags for already-saved rows.
    const reconciledFlags = buildReconciledFlags({
      existingFlags: progress,
      existingCurrentStep: Number(progress.current_step || 1),
      normalizedCurrentStep: Number(progress.current_step || 1),
      mergedFormData: (progress.form_data || {}) as Record<string, unknown>,
      markStepComplete: false,
    });
    const reconciledCompletedSteps = countCompletedSteps(reconciledFlags);

    const needsPatch =
      progress.completed_steps !== reconciledCompletedSteps ||
      STEP_KEYS.some((key) => !!progress[key] !== reconciledFlags[key]);

    if (!needsPatch) {
      return NextResponse.json({ success: true, progress });
    }

    const { data: patchedProgress, error: patchError } = await db
      .from("merchant_store_registration_progress")
      .update({
        ...reconciledFlags,
        completed_steps: reconciledCompletedSteps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id)
      .select("*")
      .single();

    if (patchError) {
      return NextResponse.json({ success: true, progress });
    }

    return NextResponse.json({ success: true, progress: patchedProgress });
  } catch (e) {
    console.error("[register-store-progress][GET]", e);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      // Only log actual errors, not missing sessions
      if (userError.message !== 'Auth session missing!') {
        logAuthError('register-store-progress-PUT', userError);
      }
      if (shouldClearSession(userError)) {
        return NextResponse.json({ 
          success: false, 
          error: "Session invalid", 
          code: "SESSION_INVALID" 
        }, { status: 401 });
      }
      return NextResponse.json({ 
        success: false, 
        error: userError.message || "Authentication failed" 
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const validation = await validateMerchantFromSession({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
    });

    if (!validation.isValid || validation.merchantParentId == null) {
      return NextResponse.json(
        { success: false, error: validation.error ?? "Merchant not found" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      currentStep,
      nextStep,
      markStepComplete = false,
      formDataPatch = {},
      registrationStatus = "IN_PROGRESS",
      storePublicId,
    } = body || {};

    const stepNumber = Number(currentStep || 1);
    const normalizedCurrentStep = Number.isFinite(stepNumber) ? Math.min(Math.max(stepNumber, 1), 9) : 1;
    const normalizedNextStep = Number.isFinite(Number(nextStep))
      ? Math.min(Math.max(Number(nextStep), 1), 9)
      : normalizedCurrentStep;

    const db = getSupabaseAdmin();
    let existingQuery = db
      .from("merchant_store_registration_progress")
      .select("*")
      .eq("parent_id", validation.merchantParentId)
      .neq("registration_status", "COMPLETED");

    if (storePublicId) {
      existingQuery = existingQuery.contains("form_data", { step_store: { storePublicId } });
    }

    const { data: existing, error: fetchError } = await existingQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ success: false, error: "Failed to read progress" }, { status: 500 });
    }

    const mergedFormData: any = {
      ...(existing?.form_data || {}),
      ...(formDataPatch || {}),
    };

    const nextFlags = buildReconciledFlags({
      existingFlags: existing,
      existingCurrentStep: Number(existing?.current_step || 1),
      normalizedCurrentStep,
      mergedFormData,
      markStepComplete: !!markStepComplete,
    });
    const completedSteps = countCompletedSteps(nextFlags);

    let stepStore: { storeDbId: number; storePublicId: string } | null =
      mergedFormData?.step_store?.storeDbId && mergedFormData?.step_store?.storePublicId
        ? {
            storeDbId: Number(mergedFormData.step_store.storeDbId),
            storePublicId: String(mergedFormData.step_store.storePublicId),
          }
        : null;

    // If we have storePublicId but no valid storeDbId, resolve from merchant_stores (e.g. after migration).
    if (mergedFormData?.step_store?.storePublicId && (!stepStore?.storeDbId || stepStore.storeDbId <= 0)) {
      const { data: storeRow } = await db
        .from("merchant_stores")
        .select("id, store_id")
        .eq("store_id", String(mergedFormData.step_store.storePublicId))
        .maybeSingle();
      if (storeRow) {
        stepStore = { storeDbId: storeRow.id as number, storePublicId: storeRow.store_id as string };
        if (!mergedFormData.step_store) mergedFormData.step_store = {};
        mergedFormData.step_store.storeDbId = storeRow.id;
      }
    }

    // When step 1 is completed: ensure we have a store ID and a merchant_stores row (data in DB).
    if (normalizedCurrentStep >= 1 && nextFlags.step_1_completed) {
      const existingPublicId = mergedFormData?.step_store?.storePublicId;
      if (!stepStore?.storeDbId || stepStore.storeDbId <= 0) {
        try {
          const storeIdToUse =
            typeof existingPublicId === "string" && existingPublicId.trim()
              ? existingPublicId.trim()
              : await generateStorePublicId(db);
          if (!mergedFormData.step_store) mergedFormData.step_store = {};
          mergedFormData.step_store.storePublicId = storeIdToUse;

          const inserted = await insertStoreAfterStep1(db, {
            parentId: validation.merchantParentId,
            step1: mergedFormData?.step1,
            generatedStoreId: storeIdToUse,
          });
          if (inserted) {
            mergedFormData.step_store.storeDbId = inserted.storeDbId;
            stepStore = { storeDbId: inserted.storeDbId, storePublicId: inserted.storePublicId };
          } else {
            stepStore = { storeDbId: 0, storePublicId: storeIdToUse };
          }
        } catch (error) {
          console.error("Failed to ensure store row:", error);
          if (!stepStore && existingPublicId)
            stepStore = { storeDbId: 0, storePublicId: String(existingPublicId) };
        }
      }
    }

    if (normalizedCurrentStep >= 2) {
      stepStore = await upsertStoreDraft(db, {
        parentId: validation.merchantParentId,
        step1: mergedFormData?.step1,
        step2: mergedFormData?.step2,
        existingStoreDbId: stepStore?.storeDbId,
        nextStep: normalizedNextStep,
      });
      if (stepStore) {
        mergedFormData.step_store = {
          storeDbId: stepStore.storeDbId,
          storePublicId: stepStore.storePublicId,
        };
      }
    }

    if (stepStore?.storeDbId && mergedFormData?.step3) {
      const menuMode = (mergedFormData.step3 as { menuUploadMode?: string }).menuUploadMode as "IMAGE" | "CSV" | undefined;
      const imageUrls: string[] = menuMode === "CSV" ? [] : (Array.isArray(mergedFormData.step3.menuImageUrls)
        ? mergedFormData.step3.menuImageUrls.filter(Boolean)
        : []);
      const spreadsheetUrl: string | null = menuMode === "IMAGE" ? null : (mergedFormData.step3.menuSpreadsheetUrl || null);
      const mediaCandidates = [
        ...imageUrls.map((url) => {
          const key = typeof url === "string" ? (extractR2KeyFromUrl(url) || (url.includes("://") ? null : url.replace(/^\/+/, "")) || url) : null;
          return {
            store_id: stepStore!.storeDbId,
            media_scope: "MENU_REFERENCE",
            source_entity: "ONBOARDING_MENU_IMAGE",
            public_url: url,
            r2_key: key,
          mime_type: "image/*",
          is_active: true,
        };
        }),
        ...(spreadsheetUrl
          ? [
              {
                store_id: stepStore.storeDbId,
                media_scope: "MENU_REFERENCE",
                source_entity: "ONBOARDING_MENU_SHEET",
                public_url: spreadsheetUrl,
                r2_key: extractR2KeyFromUrl(spreadsheetUrl) || (spreadsheetUrl.includes("://") ? null : spreadsheetUrl.replace(/^\/+/, "")) || spreadsheetUrl,
                mime_type: "application/octet-stream",
                is_active: true,
              },
            ]
          : []),
      ];
      if (mediaCandidates.length > 0) {
        try {
          const { data: existingRows } = await db
            .from("merchant_store_media_files")
            .select("id, r2_key, public_url")
            .eq("store_id", stepStore.storeDbId)
            .eq("media_scope", "MENU_REFERENCE");
          for (const row of existingRows || []) {
            const key = row.r2_key || extractR2KeyFromUrl(row.public_url || "");
            if (key && typeof key === "string") {
              try {
                await deleteFromR2(key);
              } catch (e) {
                console.warn("[register-store-progress] R2 delete failed for key:", key, e);
              }
            }
          }
          await db
            .from("merchant_store_media_files")
            .delete()
            .eq("store_id", stepStore.storeDbId)
            .eq("media_scope", "MENU_REFERENCE");
          await db.from("merchant_store_media_files").insert(mediaCandidates);
        } catch (mediaError: any) {
          console.warn("[register-store-progress] media insert skipped:", mediaError.message);
          // Optional table in rollout phase.
        }
      }
    }

    if (stepStore?.storeDbId && mergedFormData?.step4) {
      const docs = mergedFormData.step4 || {};
      const parseDate = (v: unknown): string | null => {
        if (v == null || v === "") return null;
        if (typeof v === "string") {
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        }
        return null;
      };
      const docRow: any = {
        store_id: stepStore.storeDbId,
        pan_document_number: docs.pan_number || null,
        pan_document_url: docs.pan_image_url || null,
        pan_document_name: docs.pan_image?.name || (docs.pan_image_url ? "pan" : null) || null,
        pan_holder_name: docs.pan_holder_name || null,
        aadhaar_document_number: docs.aadhar_number || null,
        aadhaar_document_url: docs.aadhar_front_url || null,
        aadhaar_document_name: docs.aadhar_front?.name || (docs.aadhar_front_url ? "aadhaar_front" : null) || null,
        aadhaar_holder_name: docs.aadhar_holder_name || null,
        aadhaar_document_metadata:
          docs.aadhar_back_url != null ? { back_url: docs.aadhar_back_url } : {},
        gst_document_number: docs.gst_number || null,
        gst_document_url: docs.gst_image_url || null,
        gst_document_name: docs.gst_image?.name || (docs.gst_image_url ? "gst" : null) || null,
        fssai_document_number: docs.fssai_number || null,
        fssai_document_url: docs.fssai_image_url || null,
        fssai_document_name: docs.fssai_image?.name || (docs.fssai_image_url ? "fssai" : null) || null,
        fssai_expiry_date: parseDate(docs.fssai_expiry_date),
        drug_license_document_number: docs.drug_license_number || null,
        drug_license_document_url: docs.drug_license_image_url || null,
        drug_license_document_name:
          docs.drug_license_image?.name || (docs.drug_license_image_url ? "drug_license" : null) || null,
        drug_license_expiry_date: parseDate(docs.drug_license_expiry_date),
        pharmacist_certificate_document_number: docs.pharmacist_registration_number || null,
        pharmacist_certificate_document_url: docs.pharmacist_certificate_url || null,
        pharmacist_certificate_document_name:
          docs.pharmacist_certificate?.name || (docs.pharmacist_certificate_url ? "pharmacist" : null) || null,
        pharmacist_certificate_expiry_date: parseDate(docs.pharmacist_expiry_date),
        pharmacy_council_registration_document_url: docs.pharmacy_council_registration_url || null,
        pharmacy_council_registration_document_name:
          (docs.pharmacy_council_registration?.name ??
            (docs.pharmacy_council_registration_url ? "pharmacy_council" : null)) || null,
        other_document_number: docs.other_document_number || null,
        other_document_url: docs.other_document_file_url || null,
        other_document_name:
          docs.other_document_file?.name || (docs.other_document_file_url ? "other" : null) || null,
        other_document_type: docs.other_document_type || null,
        other_expiry_date: parseDate(docs.other_document_expiry_date),
      };
      try {
        await db.from("merchant_store_documents").upsert([docRow], { 
          onConflict: "store_id",
          ignoreDuplicates: false 
        });
      } catch (docError: any) {
        // If upsert fails, try update/insert approach
        console.warn("[register-store-progress] documents upsert failed, trying update:", docError);
        
        const { data: existingDoc } = await db
          .from("merchant_store_documents")
          .select("id")
          .eq("store_id", stepStore.storeDbId)
          .single();
        
        if (existingDoc) {
          // Update existing record
          await db
            .from("merchant_store_documents")
            .update(docRow)
            .eq("store_id", stepStore.storeDbId);
        } else {
          // Insert new record
          await db
            .from("merchant_store_documents")
            .insert([docRow]);
        }
      }

      const bank = docs.bank;
      const payoutMethod = bank?.payout_method === "upi" ? "upi" : "bank";
      const hasBankDetails =
        bank &&
        bank.account_holder_name &&
        bank.account_number &&
        bank.ifsc_code &&
        bank.bank_name;
      const hasUpiDetails =
        bank &&
        payoutMethod === "upi" &&
        bank.upi_id &&
        bank.upi_qr_screenshot_url;
      if (hasBankDetails && payoutMethod === "bank") {
        try {
          // First delete existing bank accounts for this store to avoid duplicates
          await db.from("merchant_store_bank_accounts").delete().eq("store_id", stepStore.storeDbId);
          
          await db.from("merchant_store_bank_accounts").insert({
            store_id: stepStore.storeDbId,
            payout_method: "bank",
            account_holder_name: bank.account_holder_name,
            account_number: bank.account_number,
            ifsc_code: bank.ifsc_code,
            bank_name: bank.bank_name,
            branch_name: bank.branch_name || null,
            account_type: bank.account_type || null,
            upi_id: null,
            bank_proof_type: bank.bank_proof_type || null,
            bank_proof_file_url: bank.bank_proof_file_url || null,
            upi_qr_screenshot_url: null,
            is_primary: true,
            is_active: true,
          });
        } catch (bankErr) {
          console.warn("[register-store-progress] bank insert skipped:", bankErr);
        }
      } else if (hasUpiDetails) {
        try {
          // First delete existing bank accounts for this store to avoid duplicates
          await db.from("merchant_store_bank_accounts").delete().eq("store_id", stepStore.storeDbId);
          
          await db.from("merchant_store_bank_accounts").insert({
            store_id: stepStore.storeDbId,
            payout_method: "upi",
            account_holder_name: bank.account_holder_name || bank.upi_id || "UPI",
            account_number: "UPI",
            ifsc_code: "UPI",
            bank_name: "UPI",
            branch_name: null,
            account_type: null,
            upi_id: bank.upi_id || null,
            bank_proof_type: null,
            bank_proof_file_url: null,
            upi_qr_screenshot_url: bank.upi_qr_screenshot_url || null,
            is_primary: true,
            is_active: true,
          });
        } catch (upiErr) {
          console.warn("[register-store-progress] upi insert skipped:", upiErr);
        }
      }
    }

    if (stepStore?.storeDbId) {
      await db
        .from("merchant_stores")
        .update({ current_onboarding_step: normalizedNextStep })
        .eq("id", stepStore.storeDbId);
    }

    if (stepStore?.storeDbId && mergedFormData?.step5) {
      const s5 = mergedFormData.step5 || {};
      await db
        .from("merchant_stores")
        .update({
          cuisine_types: s5.cuisine_types || [],
          food_categories: s5.food_categories || [],
          avg_preparation_time_minutes: s5.avg_preparation_time_minutes ?? 30,
          min_order_amount: s5.min_order_amount ?? 0,
          delivery_radius_km: s5.delivery_radius_km ?? null,
          is_pure_veg: !!s5.is_pure_veg,
          accepts_online_payment: s5.accepts_online_payment !== false,
          accepts_cash: s5.accepts_cash !== false,
          logo_url: s5.logo_url || null,
          banner_url: s5.banner_url || null,
          gallery_images: Array.isArray(s5.gallery_image_urls) ? s5.gallery_image_urls : null,
          current_onboarding_step: normalizedNextStep,
        })
        .eq("id", stepStore.storeDbId);

      const hours = s5.store_hours || {};
      const parseMinutes = (v: string | null | undefined) => {
        if (!v) return null;
        const [h, m] = String(v).split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
      };
      const dayDuration = (d: any) => {
        const closed = !!d?.closed;
        if (closed) return 0;
        const s1 = parseMinutes(d?.slot1_open ?? d?.open);
        const e1 = parseMinutes(d?.slot1_close ?? d?.close);
        const s2 = parseMinutes(d?.slot2_open);
        const e2 = parseMinutes(d?.slot2_close);
        const first = s1 != null && e1 != null && e1 > s1 ? e1 - s1 : 0;
        const second = s2 != null && e2 != null && e2 > s2 ? e2 - s2 : 0;
        return first + second;
      };
      const toTimeOrNull = (v: string | null | undefined): string | null => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === "" ? null : s;
      };
      const dayRow = (d: any) => {
        const closed = !!d?.closed;
        const slot1Start = closed ? null : toTimeOrNull(d?.slot1_open ?? d?.open);
        const slot1End = closed ? null : toTimeOrNull(d?.slot1_close ?? d?.close);
        const slot2Start = closed ? null : toTimeOrNull(d?.slot2_open);
        const slot2End = closed ? null : toTimeOrNull(d?.slot2_close);
        return {
          open: !!(slot1Start && slot1End),
          slot1Start,
          slot1End,
          slot2Start,
          slot2End,
          duration: dayDuration(d),
          closed,
        };
      };
      const monday = dayRow(hours.monday);
      const tuesday = dayRow(hours.tuesday);
      const wednesday = dayRow(hours.wednesday);
      const thursday = dayRow(hours.thursday);
      const friday = dayRow(hours.friday);
      const saturday = dayRow(hours.saturday);
      const sunday = dayRow(hours.sunday);
      const closedDays = ([
        ["monday", monday.closed],
        ["tuesday", tuesday.closed],
        ["wednesday", wednesday.closed],
        ["thursday", thursday.closed],
        ["friday", friday.closed],
        ["saturday", saturday.closed],
        ["sunday", sunday.closed],
      ] as const)
        .filter(([, isClosed]) => isClosed)
        .map(([day]) => day);
      const sameForAllDays =
        JSON.stringify(monday) === JSON.stringify(tuesday) &&
        JSON.stringify(monday) === JSON.stringify(wednesday) &&
        JSON.stringify(monday) === JSON.stringify(thursday) &&
        JSON.stringify(monday) === JSON.stringify(friday) &&
        JSON.stringify(monday) === JSON.stringify(saturday) &&
        JSON.stringify(monday) === JSON.stringify(sunday);
      const is24Hours = [
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
      ].every(
        (d) => !d.closed && d.slot1Start === "00:00" && d.slot1End === "23:59" && !d.slot2Start && !d.slot2End
      );
      const operatingHoursRow: any = {
        store_id: stepStore.storeDbId,
        monday_open: monday.open,
        monday_slot1_start: monday.slot1Start,
        monday_slot1_end: monday.slot1End,
        monday_slot2_start: monday.slot2Start,
        monday_slot2_end: monday.slot2End,
        monday_total_duration_minutes: monday.duration,
        tuesday_open: tuesday.open,
        tuesday_slot1_start: tuesday.slot1Start,
        tuesday_slot1_end: tuesday.slot1End,
        tuesday_slot2_start: tuesday.slot2Start,
        tuesday_slot2_end: tuesday.slot2End,
        tuesday_total_duration_minutes: tuesday.duration,
        wednesday_open: wednesday.open,
        wednesday_slot1_start: wednesday.slot1Start,
        wednesday_slot1_end: wednesday.slot1End,
        wednesday_slot2_start: wednesday.slot2Start,
        wednesday_slot2_end: wednesday.slot2End,
        wednesday_total_duration_minutes: wednesday.duration,
        thursday_open: thursday.open,
        thursday_slot1_start: thursday.slot1Start,
        thursday_slot1_end: thursday.slot1End,
        thursday_slot2_start: thursday.slot2Start,
        thursday_slot2_end: thursday.slot2End,
        thursday_total_duration_minutes: thursday.duration,
        friday_open: friday.open,
        friday_slot1_start: friday.slot1Start,
        friday_slot1_end: friday.slot1End,
        friday_slot2_start: friday.slot2Start,
        friday_slot2_end: friday.slot2End,
        friday_total_duration_minutes: friday.duration,
        saturday_open: saturday.open,
        saturday_slot1_start: saturday.slot1Start,
        saturday_slot1_end: saturday.slot1End,
        saturday_slot2_start: saturday.slot2Start,
        saturday_slot2_end: saturday.slot2End,
        saturday_total_duration_minutes: saturday.duration,
        sunday_open: sunday.open,
        sunday_slot1_start: sunday.slot1Start,
        sunday_slot1_end: sunday.slot1End,
        sunday_slot2_start: sunday.slot2Start,
        sunday_slot2_end: sunday.slot2End,
        sunday_total_duration_minutes: sunday.duration,
        same_for_all_days: sameForAllDays,
        is_24_hours: is24Hours,
        closed_days: closedDays,
      };
      try {
        await db.from("merchant_store_operating_hours").upsert([operatingHoursRow], { 
          onConflict: "store_id",
          ignoreDuplicates: false 
        });
      } catch (hoursError: any) {
        // If upsert fails due to constraint name mismatch, try update/insert approach
        console.warn("[register-store-progress] operating hours upsert failed, trying update:", hoursError);
        
        const { data: existingHours } = await db
          .from("merchant_store_operating_hours")
          .select("id")
          .eq("store_id", stepStore.storeDbId)
          .single();
        
        if (existingHours) {
          // Update existing record
          await db
            .from("merchant_store_operating_hours")
            .update(operatingHoursRow)
            .eq("store_id", stepStore.storeDbId);
        } else {
          // Insert new record
          await db
            .from("merchant_store_operating_hours")
            .insert([operatingHoursRow]);
        }
      }
    }

    const payload = {
      parent_id: validation.merchantParentId,
      store_id: stepStore?.storeDbId || existing?.store_id || null,
      current_step: normalizedNextStep,
      total_steps: 9,
      completed_steps: completedSteps,
      ...nextFlags,
      form_data: mergedFormData,
      registration_status: registrationStatus,
      updated_at: new Date().toISOString(),
      ...(normalizedCurrentStep >= 1 && nextFlags.step_1_completed ? { last_step_completed_at: new Date().toISOString() } : {}),
    };

    if (existing?.id) {
      const { data, error } = await db
        .from("merchant_store_registration_progress")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: "Failed to update progress" }, { status: 500 });
      }
      return NextResponse.json({ success: true, progress: data });
    }

    const { data, error } = await db
      .from("merchant_store_registration_progress")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: "Failed to create progress" }, { status: 500 });
    }

    return NextResponse.json({ success: true, progress: data });
  } catch (e) {
    console.error("[register-store-progress][PUT]", e);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

