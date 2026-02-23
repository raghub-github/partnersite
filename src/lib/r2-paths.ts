/**
 * R2 folder structure: docs/merchants/{merchant_code}/stores/{store_code}/...
 * Uses merchant code (e.g. GMMP1005) and store code (e.g. GMMC1017) for a consistent main route.
 *
 * Structure (docs bucket):
 *
 *   docs/
 *     merchants/
 *       {parent_merchant_id}/               e.g. GMMP1005 (always use code, not numeric id)
 *         logo/                             parent's logo
 *         assets/                           other parent assets (optional)
 *         draft/                            onboarding in progress (no child store yet)
 *           onboarding/
 *             documents/
 *             menu/images/
 *             menu/csv/
 *             store-media/
 *             store-media/gallery/
 *             bank/
 *             agreements/
 *         stores/
 *           {child_store_code}/             e.g. GMMC1017
 *             onboarding/
 *               documents/
 *               menu/images/
 *               menu/csv/
 *               store-media/
 *               store-media/gallery/
 *               bank/
 *               agreements/
 *             menu/                         post-onboarding menu item images / CSV
 *             assets/                       post-onboarding store assets
 *             offers/
 */

export const R2_DOCS_PREFIX = 'docs';
export const R2_MERCHANT_PREFIX = `${R2_DOCS_PREFIX}/merchants`;

export const R2_ONBOARDING = {
  DOCUMENTS: 'documents',
  MENU_IMAGES: 'menu/images',
  MENU_CSV: 'menu/csv',
  STORE_MEDIA: 'store-media',
  STORE_MEDIA_GALLERY: 'store-media/gallery',
  BANK: 'bank',
  AGREEMENTS: 'agreements',
} as const;

/** Parent root: "docs/merchants/{parentMerchantCode}" — use merchant code (e.g. GMMP1005), not numeric id. */
export function getParentRoot(parentMerchantCode: string): string {
  const id = (parentMerchantCode && String(parentMerchantCode).trim()) || 'unknown';
  return `${R2_MERCHANT_PREFIX}/${id}`;
}

/** Parent logo folder: "merchants/{parentId}/logo" */
export function getParentLogoPath(parentId: string): string {
  return `${getParentRoot(parentId)}/logo`;
}

/** Parent assets folder: "merchants/{parentId}/assets" */
export function getParentAssetsPath(parentId: string): string {
  return `${getParentRoot(parentId)}/assets`;
}

/** Child store root: "merchants/{parentId}/stores/{childStoreCode}" */
export function getChildStoreRoot(parentId: string, childStoreCode: string): string {
  return `${getParentRoot(parentId)}/stores/${String(childStoreCode).trim()}`;
}

/** Draft root (onboarding before child store exists): "merchants/{parentId}/draft" */
export function getDraftRoot(parentId: string): string {
  return `${getParentRoot(parentId)}/draft`;
}

/**
 * Root for onboarding files: either child store or draft.
 * Uses parentId and optionally childStoreId (when created).
 */
export function getOnboardingR2Base(
  parentId: string,
  childStoreId: string | null | undefined
): string {
  const parent = (parentId && String(parentId).trim()) || 'unknown';
  const child = childStoreId && String(childStoreId).trim();
  const root = child ? getChildStoreRoot(parent, child) : getDraftRoot(parent);
  return `${root}/onboarding`;
}

/** Full path for onboarding upload (e.g. "merchants/41/stores/GMMC1011/onboarding/documents") */
export function getOnboardingR2Path(
  parentId: string,
  childStoreId: string | null | undefined,
  subPath: keyof typeof R2_ONBOARDING
): string {
  const base = getOnboardingR2Base(parentId, childStoreId);
  const segment = R2_ONBOARDING[subPath];
  return segment ? `${base}/${segment}` : base;
}

/**
 * Post-onboarding menu: "merchants/{parentId}/stores/{storeId}/menu".
 * If parentId is omitted, falls back to "merchants/{storeId}/menu" for backward compatibility.
 */
export function getMerchantMenuPath(storeId: string, parentId?: string | null): string {
  if (parentId && String(parentId).trim()) {
    return `${getParentRoot(parentId)}/stores/${storeId}/menu`;
  }
  return `${R2_MERCHANT_PREFIX}/${storeId}/menu`;
}

/**
 * Post-onboarding store assets: "merchants/{parentId}/stores/{storeId}/assets".
 * If parentId is omitted, falls back to "merchants/{storeId}/assets".
 */
export function getMerchantAssetsPath(storeId: string, parentId?: string | null): string {
  if (parentId && String(parentId).trim()) {
    return `${getParentRoot(parentId)}/stores/${storeId}/assets`;
  }
  return `${R2_MERCHANT_PREFIX}/${storeId}/assets`;
}

/** Offer images: "merchants/{parentId}/stores/{storeId}/offers" or "merchants/{storeId}/offers" */
export function getOffersR2Path(storeId: string, parentId?: string | null): string {
  if (parentId && String(parentId).trim()) {
    return `${getParentRoot(parentId)}/stores/${storeId}/offers`;
  }
  return `${R2_MERCHANT_PREFIX}/${storeId}/offers`;
}

/**
 * Post-onboarding bank/UPI attachments: "merchants/{parentId}/stores/{storeId}/bank/{fileName}"
 * Used when merchant adds or edits bank/UPI from Payments; fileName should be unique (e.g. proof_{bankAccountId}_{ts}.ext).
 */
export function getMerchantBankAttachmentPath(
  storeId: string,
  fileName: string,
  parentId?: string | null
): string {
  const base = parentId && String(parentId).trim()
    ? `${getParentRoot(parentId)}/stores/${storeId}/bank`
    : `${R2_MERCHANT_PREFIX}/${storeId}/bank`;
  return fileName ? `${base}/${fileName}` : base;
}
