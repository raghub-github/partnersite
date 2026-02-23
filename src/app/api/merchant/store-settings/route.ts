import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuditActor, logMerchantAudit } from '@/lib/audit-merchant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveStoreId(db: ReturnType<typeof getSupabase>, storeIdParam: string): Promise<number | null> {
  const { data, error } = await db
    .from('merchant_stores')
    .select('id')
    .eq('store_id', storeIdParam)
    .single();
  if (error || !data) return null;
  return data.id as number;
}

/**
 * GET /api/merchant/store-settings?storeId=GMMC1001
 * Returns delivery mode from merchant_store_settings (self_delivery, platform_delivery).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const db = getSupabase();
    const internalId = await resolveStoreId(db, storeId);
    if (internalId === null) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const [settingsResult, storeResult] = await Promise.all([
      db.from('merchant_store_settings').select('self_delivery, platform_delivery, delivery_priority, auto_accept_orders, settings_metadata').eq('store_id', internalId).maybeSingle(),
      db.from('merchant_stores').select('delivery_radius_km, full_address, landmark, city, state, postal_code, latitude, longitude').eq('store_id', storeId).maybeSingle(),
    ]);

    const { data: settingsData, error: settingsError } = settingsResult;
    const { data: storeData } = storeResult;

    if (settingsError && settingsError.code !== 'PGRST116') {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    const deliveryRadiusKm = storeData?.delivery_radius_km != null && !Number.isNaN(Number(storeData.delivery_radius_km))
      ? Number(storeData.delivery_radius_km)
      : undefined;

    const metadata = settingsData?.settings_metadata as Record<string, unknown> | null | undefined;
    const preparationBufferMinutes =
      typeof metadata?.preparation_buffer_minutes === 'number' && !Number.isNaN(metadata.preparation_buffer_minutes)
        ? Number(metadata.preparation_buffer_minutes)
        : undefined;

    const address =
      storeData &&
      (storeData.full_address != null ||
        storeData.landmark != null ||
        storeData.city != null ||
        storeData.state != null ||
        storeData.postal_code != null ||
        storeData.latitude != null ||
        storeData.longitude != null)
        ? {
            full_address: storeData.full_address ?? undefined,
            landmark: storeData.landmark ?? undefined,
            city: storeData.city ?? undefined,
            state: storeData.state ?? undefined,
            postal_code: storeData.postal_code ?? undefined,
            latitude: storeData.latitude != null && !Number.isNaN(Number(storeData.latitude)) ? Number(storeData.latitude) : undefined,
            longitude: storeData.longitude != null && !Number.isNaN(Number(storeData.longitude)) ? Number(storeData.longitude) : undefined,
          }
        : undefined;

    return NextResponse.json({
      self_delivery: settingsData?.self_delivery ?? false,
      platform_delivery: settingsData?.platform_delivery ?? true,
      delivery_priority: settingsData?.delivery_priority ?? (settingsData?.self_delivery ? 'SELF' : 'GATIMITRA'),
      auto_accept_orders: settingsData?.auto_accept_orders ?? false,
      ...(preparationBufferMinutes !== undefined && { preparation_buffer_minutes: preparationBufferMinutes }),
      ...(deliveryRadiusKm !== undefined && { delivery_radius_km: deliveryRadiusKm }),
      ...(address && { address }),
    });
  } catch (err) {
    console.error('[store-settings GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/merchant/store-settings
 * Body: { storeId, self_delivery?, platform_delivery?, delivery_radius_km?, address?: {...}, auto_accept_orders?, preparation_buffer_minutes? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = body?.storeId;
    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const db = getSupabase();
    const internalId = await resolveStoreId(db, storeId);
    if (internalId === null) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const self_delivery = typeof body.self_delivery === 'boolean' ? body.self_delivery : undefined;
    const platform_delivery = typeof body.platform_delivery === 'boolean' ? body.platform_delivery : undefined;
    const delivery_radius_km = typeof body.delivery_radius_km === 'number' && !Number.isNaN(body.delivery_radius_km) && body.delivery_radius_km >= 0
      ? body.delivery_radius_km
      : undefined;
    const addressPayload = body?.address && typeof body.address === 'object' ? body.address : undefined;
    const auto_accept_orders = typeof body.auto_accept_orders === 'boolean' ? body.auto_accept_orders : undefined;
    const preparation_buffer_minutes =
      typeof body.preparation_buffer_minutes === 'number' && !Number.isNaN(body.preparation_buffer_minutes) && body.preparation_buffer_minutes >= 0 && body.preparation_buffer_minutes <= 120
        ? body.preparation_buffer_minutes
        : undefined;

    const hasDeliveryPayload = self_delivery !== undefined || platform_delivery !== undefined || delivery_radius_km !== undefined;
    const hasAddressPayload =
      addressPayload &&
      (addressPayload.full_address !== undefined ||
        addressPayload.landmark !== undefined ||
        addressPayload.city !== undefined ||
        addressPayload.state !== undefined ||
        addressPayload.postal_code !== undefined ||
        addressPayload.latitude !== undefined ||
        addressPayload.longitude !== undefined);
    const hasOperationsPayload = auto_accept_orders !== undefined || preparation_buffer_minutes !== undefined;

    if (!hasDeliveryPayload && !hasAddressPayload && !hasOperationsPayload) {
      return NextResponse.json({ success: true });
    }

    if (hasDeliveryPayload || hasOperationsPayload) {
      const { data: existing } = await db
        .from('merchant_store_settings')
        .select('id, settings_metadata')
        .eq('store_id', internalId)
        .maybeSingle();

      const payload: Record<string, unknown> = {
        store_id: internalId,
        updated_at: new Date().toISOString(),
      };
      if (self_delivery !== undefined) payload.self_delivery = self_delivery;
      if (platform_delivery !== undefined) payload.platform_delivery = platform_delivery;
      if (auto_accept_orders !== undefined) payload.auto_accept_orders = auto_accept_orders;
      if (preparation_buffer_minutes !== undefined) {
        const currentMeta = (existing?.settings_metadata as Record<string, unknown>) || {};
        payload.settings_metadata = { ...currentMeta, preparation_buffer_minutes };
      }

      if (existing?.id != null) {
        const { error: updateErr } = await db
          .from('merchant_store_settings')
          .update(payload)
          .eq('store_id', internalId);
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      } else {
        const { error: insertErr } = await db.from('merchant_store_settings').insert(payload);
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    const storeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (delivery_radius_km !== undefined) storeUpdates.delivery_radius_km = delivery_radius_km;
    if (hasAddressPayload && addressPayload) {
      if (addressPayload.full_address !== undefined) storeUpdates.full_address = addressPayload.full_address;
      if (addressPayload.landmark !== undefined) storeUpdates.landmark = addressPayload.landmark;
      if (addressPayload.city !== undefined) storeUpdates.city = addressPayload.city;
      if (addressPayload.state !== undefined) storeUpdates.state = addressPayload.state;
      if (addressPayload.postal_code !== undefined) storeUpdates.postal_code = addressPayload.postal_code;
      if (addressPayload.latitude !== undefined) storeUpdates.latitude = addressPayload.latitude;
      if (addressPayload.longitude !== undefined) storeUpdates.longitude = addressPayload.longitude;
    }
    if (Object.keys(storeUpdates).length > 1) {
      const { error: storeUpdateErr } = await db
        .from('merchant_stores')
        .update(storeUpdates)
        .eq('store_id', String(storeId).trim());
      if (storeUpdateErr) return NextResponse.json({ error: storeUpdateErr.message }, { status: 500 });
    }

    if (hasDeliveryPayload) {
      const actor = await getAuditActor();
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
      const ua = req.headers.get('user-agent') || null;
      const modeLabel = self_delivery === true ? 'Self delivery' : 'GatiMitra (platform) delivery';
      await logMerchantAudit(db, {
        entity_type: 'STORE',
        entity_id: internalId,
        action: 'UPDATE',
        action_field: 'DELIVERY_MODE',
        old_value: { self_delivery: self_delivery === true ? false : true },
        new_value: { self_delivery: !!self_delivery, platform_delivery: platform_delivery !== false },
        ...actor,
        ip_address: ip,
        user_agent: ua,
        audit_metadata: { description: `Delivery mode changed to ${modeLabel}` },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[store-settings PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
