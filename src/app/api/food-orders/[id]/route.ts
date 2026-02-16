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

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['ACCEPTED', 'CANCELLED'],
  NEW: ['ACCEPTED', 'CANCELLED'], // backward compat
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED', 'RTO'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'CANCELLED', 'RTO'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RTO'],
  DELIVERED: [],
  CANCELLED: [],
  RTO: [],
};

/**
 * PATCH /api/food-orders/[id]
 * Body: { store_id: string, status: string, rejected_reason?: string }
 * Updates order status with proper timestamps.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const storeId = body.store_id;
    const newStatus = (body.status || '').toUpperCase();
    const rejectedReason = body.rejected_reason || null;

    if (!storeId || !newStatus) {
      return NextResponse.json({ error: 'store_id and status are required' }, { status: 400 });
    }

    const db = getSupabase();
    const storeInternalId = await resolveStoreId(db, storeId);
    if (storeInternalId === null) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const orderIdNum = parseInt(id, 10);
    if (isNaN(orderIdNum)) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await db
      .from('orders_food')
      .select('id, order_id, order_status, merchant_store_id')
      .eq('id', orderIdNum)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (existing.merchant_store_id !== storeInternalId) {
      return NextResponse.json({ error: 'Order does not belong to this store' }, { status: 403 });
    }

    const currentStatus = (existing.order_status || 'CREATED').toUpperCase().replace('NEW', 'CREATED');
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Invalid transition from ${currentStatus} to ${newStatus}`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      order_status: newStatus,
      updated_at: now,
    };

    if (newStatus === 'ACCEPTED') updates.accepted_at = now;
    else if (newStatus === 'PREPARING') updates.prepared_at = null;
    else if (newStatus === 'READY_FOR_PICKUP') updates.prepared_at = now;
    else if (newStatus === 'OUT_FOR_DELIVERY') {
      const { data: otpRow } = await db.from('order_food_otps').select('verified_at').eq('order_id', existing.order_id).maybeSingle();
      if (otpRow && !otpRow.verified_at) {
        return NextResponse.json({ error: 'OTP must be validated before dispatch' }, { status: 400 });
      }
      updates.dispatched_at = now;
    } else if (newStatus === 'DELIVERED') updates.delivered_at = now;
    else if (newStatus === 'CANCELLED') {
      updates.cancelled_at = now;
      if (rejectedReason) updates.rejected_reason = rejectedReason;
    } else if (newStatus === 'RTO') {
      updates.is_rto = true;
      updates.rto_at = now;
      try {
        await db.rpc('convert_food_order_otp_to_rto', { p_order_id: existing.order_id });
      } catch (e) {
        console.error('[RTO convert]', e);
      }
    }

    const { data, error } = await db
      .from('orders_food')
      .update(updates)
      .eq('id', orderIdNum)
      .eq('merchant_store_id', storeInternalId)
      .select()
      .single();

    if (error) {
      console.error('[food-orders PATCH] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data });
  } catch (err) {
    console.error('[food-orders PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
