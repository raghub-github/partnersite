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
 * GET /api/merchant/audit-logs?storeId=GMMC1001&limit=100
 * Returns store status log from merchant_store_status_log (who opened/closed, when, restriction type).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 200);

    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const db = getSupabase();
    const internalId = await resolveStoreId(db, storeId);
    if (internalId === null) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const { data, error } = await db
      .from('merchant_store_status_log')
      .select('id, action, restriction_type, performed_by_id, performed_by_email, performed_by_name, created_at')
      .eq('store_id', internalId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ logs: data ?? [] });
  } catch (err) {
    console.error('[audit-logs]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
