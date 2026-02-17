import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const { data, error } = await db
      .from('merchant_store_settings')
      .select('self_delivery, platform_delivery')
      .eq('store_id', internalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ self_delivery: false, platform_delivery: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      self_delivery: data?.self_delivery ?? false,
      platform_delivery: data?.platform_delivery ?? true,
    });
  } catch (err) {
    console.error('[store-settings GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/merchant/store-settings
 * Body: { storeId: string, self_delivery?: boolean, platform_delivery?: boolean }
 * Upserts merchant_store_settings for the store (delivery mode persisted here).
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
    if (self_delivery === undefined && platform_delivery === undefined) {
      return NextResponse.json({ success: true });
    }

    const { data: existing } = await db
      .from('merchant_store_settings')
      .select('id')
      .eq('store_id', internalId)
      .single();

    const payload: Record<string, unknown> = {
      store_id: internalId,
      updated_at: new Date().toISOString(),
    };
    if (self_delivery !== undefined) payload.self_delivery = self_delivery;
    if (platform_delivery !== undefined) payload.platform_delivery = platform_delivery;

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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[store-settings PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
