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

/** Get local day (0=Sun..6=Sat) and time-in-minutes in the store's timezone */
function getStoreLocalTime(now: Date, timezone: string): { dayIndex: number; nowMinutes: number } {
  const tz = timezone || 'Asia/Kolkata';
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' });
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayStr = dayFormatter.format(now).toLowerCase();
  const dayIndex = dayNames.indexOf(dayStr);
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeStr = timeFormatter.format(now);
  const [h, m] = timeStr.split(':').map(Number);
  const nowMinutes = (h ?? 0) * 60 + (m ?? 0);
  return { dayIndex, nowMinutes };
}

function isWithinOperatingHours(
  oh: Record<string, unknown>,
  now: Date,
  storeTimezone?: string | null
): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const { dayIndex, nowMinutes } = storeTimezone
    ? getStoreLocalTime(now, storeTimezone)
    : { dayIndex: now.getDay(), nowMinutes: now.getHours() * 60 + now.getMinutes() };
  const day = dayNames[dayIndex];
  const isOpen = oh[`${day}_open`] === true;
  if (!isOpen) return false;
  if (oh.is_24_hours === true) return true;

  const slot1Start = oh[`${day}_slot1_start`] as string | null;
  const slot1End = oh[`${day}_slot1_end`] as string | null;
  const slot2Start = oh[`${day}_slot2_start`] as string | null;
  const slot2End = oh[`${day}_slot2_end`] as string | null;

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const inSlot = (start: string, end: string) => {
    let s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s) e += 24 * 60;
    return nowMinutes >= s && nowMinutes < e;
  };

  if (slot1Start && slot1End && inSlot(slot1Start, slot1End)) return true;
  if (slot2Start && slot2End && inSlot(slot2Start, slot2End)) return true;
  return false;
}

async function ensureAvailabilityRow(db: ReturnType<typeof getSupabase>, storeInternalId: number) {
  const { data } = await db.from('merchant_store_availability').select('id').eq('store_id', storeInternalId).single();
  if (data) return;
  await db.from('merchant_store_availability').insert({
    store_id: storeInternalId,
    is_available: true,
    is_accepting_orders: true,
  });
}

/**
 * GET /api/store-operations?store_id=GMMC1001
 * Returns current effective status, manual_close_until, and whether auto-open is enabled.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('store_id');
    if (!storeId) return NextResponse.json({ error: 'store_id is required' }, { status: 400 });

    const db = getSupabase();
    const storeInternalId = await resolveStoreId(db, storeId);
    if (!storeInternalId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const { data: store } = await db
      .from('merchant_stores')
      .select('operational_status, is_accepting_orders, timezone')
      .eq('id', storeInternalId)
      .single();

    const { data: avail } = await db
      .from('merchant_store_availability')
      .select('manual_close_until, auto_open_from_schedule')
      .eq('store_id', storeInternalId)
      .single();

    const now = new Date();
    let effectiveStatus = (store?.operational_status as string) || 'CLOSED';
    let manualCloseUntil = avail?.manual_close_until ? new Date(avail.manual_close_until) : null;

    const { data: oh } = await db
      .from('merchant_store_operating_hours')
      .select('*')
      .eq('store_id', storeInternalId)
      .single();

    const storeTz = (store as { timezone?: string } | null)?.timezone || 'Asia/Kolkata';
    const withinHours = oh
      ? isWithinOperatingHours(oh as Record<string, unknown>, now, storeTz)
      : false;

    if (!manualCloseUntil && effectiveStatus === 'CLOSED' && (avail?.auto_open_from_schedule !== false) && withinHours) {
      await db.from('merchant_stores').update({
        operational_status: 'OPEN',
        is_accepting_orders: true,
      }).eq('id', storeInternalId);
      await db.from('merchant_store_availability').update({
        is_available: true,
        is_accepting_orders: true,
      }).eq('store_id', storeInternalId);
      effectiveStatus = 'OPEN';
    }

    if (manualCloseUntil && now >= manualCloseUntil) {
      const autoOpen = avail?.auto_open_from_schedule !== false;
      if (autoOpen) {
        if (oh && isWithinOperatingHours(oh as Record<string, unknown>, now, storeTz)) {
          await db.from('merchant_stores').update({
            operational_status: 'OPEN',
            is_accepting_orders: true,
          }).eq('id', storeInternalId);
          await db.from('merchant_store_availability').update({
            manual_close_until: null,
            is_available: true,
            is_accepting_orders: true,
          }).eq('store_id', storeInternalId);
          effectiveStatus = 'OPEN';
          manualCloseUntil = null;
        } else {
          await db.from('merchant_store_availability').update({ manual_close_until: null }).eq('store_id', storeInternalId);
          manualCloseUntil = null;
          effectiveStatus = (store?.operational_status as string) || 'CLOSED';
        }
      } else {
        await db.from('merchant_store_availability').update({ manual_close_until: null }).eq('store_id', storeInternalId);
        manualCloseUntil = null;
      }
    }

    // Auto-close when store is OPEN but outside operating hours (respects schedule)
    if (
      !manualCloseUntil &&
      effectiveStatus === 'OPEN' &&
      (avail?.auto_open_from_schedule !== false) &&
      oh &&
      !withinHours
    ) {
      await db
        .from('merchant_stores')
        .update({ operational_status: 'CLOSED', is_accepting_orders: false })
        .eq('id', storeInternalId);
      await db
        .from('merchant_store_availability')
        .update({ is_available: false, is_accepting_orders: false })
        .eq('store_id', storeInternalId);
      effectiveStatus = 'CLOSED';
    }

    return NextResponse.json({
      operational_status: effectiveStatus,
      is_accepting_orders: effectiveStatus === 'OPEN',
      manual_close_until: manualCloseUntil ? manualCloseUntil.toISOString() : null,
      auto_open_from_schedule: avail?.auto_open_from_schedule ?? true,
    });
  } catch (err) {
    console.error('[store-operations GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/store-operations
 * Body: { store_id, action: 'manual_close' | 'manual_open', duration_minutes?: number }
 * - manual_close: requires duration_minutes (e.g. 30, 60). Sets manual_close_until = now + duration.
 * - manual_open: clears manual_close_until and sets OPEN.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = body.store_id;
    const action = body.action;
    const durationMinutes = body.duration_minutes;

    if (!storeId || !action) {
      return NextResponse.json({ error: 'store_id and action are required' }, { status: 400 });
    }

    const db = getSupabase();
    const storeInternalId = await resolveStoreId(db, storeId);
    if (!storeInternalId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    await ensureAvailabilityRow(db, storeInternalId);

    const now = new Date();

    if (action === 'manual_open') {
      await db.from('merchant_stores').update({
        operational_status: 'OPEN',
        is_accepting_orders: true,
      }).eq('id', storeInternalId);
      await db.from('merchant_store_availability').update({
        manual_close_until: null,
        is_available: true,
        is_accepting_orders: true,
      }).eq('store_id', storeInternalId);
      return NextResponse.json({
        success: true,
        operational_status: 'OPEN',
        manual_close_until: null,
      });
    }

    if (action === 'manual_close') {
      const mins = typeof durationMinutes === 'number' ? durationMinutes : parseInt(String(durationMinutes || 30), 10);
      if (mins < 1 || mins > 1440) {
        return NextResponse.json({ error: 'duration_minutes must be between 1 and 1440' }, { status: 400 });
      }
      const until = new Date(now.getTime() + mins * 60 * 1000);

      await db.from('merchant_stores').update({
        operational_status: 'CLOSED',
        is_accepting_orders: false,
      }).eq('id', storeInternalId);
      await db.from('merchant_store_availability').update({
        manual_close_until: until.toISOString(),
        is_available: false,
        is_accepting_orders: false,
      }).eq('store_id', storeInternalId);

      return NextResponse.json({
        success: true,
        operational_status: 'CLOSED',
        manual_close_until: until.toISOString(),
        reopens_at: until.toISOString(),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[store-operations POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
