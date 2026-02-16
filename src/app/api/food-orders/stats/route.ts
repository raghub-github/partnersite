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
 * GET /api/food-orders/stats?store_id=GMMC1001
 * Returns analytics: orders today, active orders, avg prep time, revenue today, completion rate
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }

    const db = getSupabase();
    const storeInternalId = await resolveStoreId(db, storeId);
    if (storeInternalId === null) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const { data: orders, error } = await db
      .from('orders_food')
      .select('id, order_status, created_at, food_items_total_value, preparation_time_minutes, prepared_at')
      .eq('merchant_store_id', storeInternalId)
      .gte('created_at', todayStartIso);

    if (error) {
      console.error('[food-orders/stats] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = orders || [];
    const activeStatuses = ['CREATED', 'NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

    const ordersToday = list.length;
    const activeOrders = list.filter((o) => activeStatuses.includes((o.order_status || 'CREATED')));
    const deliveredToday = list.filter((o) => (o.order_status || '').toUpperCase() === 'DELIVERED');
    const totalRevenue = deliveredToday.reduce((sum, o) => sum + Number(o.food_items_total_value || 0), 0);

    const preparedWithTime = list.filter((o) => o.prepared_at && o.created_at);
    const prepTimes: number[] = preparedWithTime.map((o) => {
      const created = new Date(o.created_at).getTime();
      const prepared = new Date(o.prepared_at!).getTime();
      return Math.round((prepared - created) / 60000);
    });
    const avgPrepTime = prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : 0;

    const completionRate = ordersToday > 0 ? Math.round((deliveredToday.length / ordersToday) * 100) : 0;

    return NextResponse.json({
      ordersToday,
      activeOrders: activeOrders.length,
      avgPreparationTimeMinutes: avgPrepTime,
      totalRevenueToday: totalRevenue,
      completionRatePercent: completionRate,
    });
  } catch (err) {
    console.error('[food-orders/stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
