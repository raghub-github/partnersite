import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// You may want to move these to env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// POST: Save or update outlet timings
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { store_id, same_for_all, force_24_hours, closed_day, closed_days, updated_by_email, updated_by_at, ...timings } = body;
  if (!store_id) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
  }

  // If email is not provided in body, try to get from Supabase session cookie (optional fallback)
  let userEmail = updated_by_email;
  if (!userEmail) {
    try {
      const cookieStore = await cookies();
      const supabaseAccessToken = cookieStore.get('sb-access-token')?.value;
      if (supabaseAccessToken) {
        const { data: { user } } = await supabase.auth.getUser(supabaseAccessToken);
        userEmail = user?.email || '';
      }
    } catch (e) {
      userEmail = '';
    }
  }

  // Get store bigint id from merchant_stores
  const { data: storeData, error: storeError } = await supabase
    .from('merchant_stores')
    .select('id')
    .eq('store_id', store_id)
    .single();
  if (storeError || !storeData) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  const storeBigIntId = storeData.id;

  // Get existing record first to preserve fields not being updated
  const { data: existingRecord } = await supabase
    .from('merchant_store_operating_hours')
    .select('*')
    .eq('store_id', storeBigIntId)
    .single();

  // Calculate closed_days array from individual day _open flags if not explicitly provided
  let finalClosedDays: string[] | null = null;
  if (closed_days !== undefined) {
    // Use provided closed_days array
    finalClosedDays = Array.isArray(closed_days) && closed_days.length > 0 ? closed_days : null;
  } else if (closed_day !== undefined) {
    // Legacy: single closed_day parameter
    finalClosedDays = closed_day ? [closed_day] : null;
  } else {
    // Auto-calculate from _open flags in timings
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const closedList: string[] = [];
    for (const day of days) {
      const dayOpen = timings[`${day}_open`];
      if (dayOpen === false || dayOpen === null) {
        closedList.push(day);
      }
    }
    finalClosedDays = closedList.length > 0 ? closedList : null;
  }

  // Merge existing data with new data (new data takes precedence)
  const mergedData = {
    ...(existingRecord || {}),
    store_id: storeBigIntId,
    ...timings,
    same_for_all_days: same_for_all !== undefined ? same_for_all : (existingRecord?.same_for_all_days ?? false),
    is_24_hours: force_24_hours !== undefined ? force_24_hours : (existingRecord?.is_24_hours ?? false),
    closed_days: finalClosedDays,
    updated_by_email: userEmail,
    updated_by_at: updated_by_at || new Date().toISOString(),
  };

  // Remove id from merged data if it exists (upsert will handle it)
  delete (mergedData as any).id;

  // Validate slot times before upsert to prevent constraint violations
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    const slot1Start = mergedData[`${day}_slot1_start`];
    const slot1End = mergedData[`${day}_slot1_end`];
    const slot2Start = mergedData[`${day}_slot2_start`];
    const slot2End = mergedData[`${day}_slot2_end`];
    
    // Validate slot1: if both are set, end must be > start
    if (slot1Start && slot1End) {
      if (slot1End <= slot1Start) {
        // For 24 hours (00:00 to 00:00), convert to 00:00 to 23:59
        if (slot1Start === '00:00' && slot1End === '00:00' && mergedData.is_24_hours) {
          mergedData[`${day}_slot1_end`] = '23:59';
        } else {
          return NextResponse.json({ 
            error: `Invalid time slot for ${day}: end time (${slot1End}) must be greater than start time (${slot1Start})`,
            constraint: 'slot_order_chk',
            day,
            slot1Start,
            slot1End,
          }, { status: 400 });
        }
      }
    }
    
    // Validate slot2: if both are set, end must be > start
    if (slot2Start && slot2End) {
      if (slot2End <= slot2Start) {
        return NextResponse.json({ 
          error: `Invalid time slot2 for ${day}: end time (${slot2End}) must be greater than start time (${slot2Start})`,
          constraint: 'slot_order_chk',
          day,
          slot2Start,
          slot2End,
        }, { status: 400 });
      }
    }
  }

  // Upsert (insert or update) into merchant_store_operating_hours
  const { error } = await supabase
    .from('merchant_store_operating_hours')
    .upsert([mergedData], { onConflict: 'store_id' });

  if (error) {
    console.error('Database error saving timings:', error);
    return NextResponse.json({ 
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// GET: Fetch outlet timings for a store
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const store_id = searchParams.get('store_id');
  if (!store_id) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('merchant_store_operating_hours')
    .select('*')
    .eq('store_id', store_id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
