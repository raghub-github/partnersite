import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/merchant/area-manager?storeId=GMMxxxx
 * Returns Area Manager details for the store (name, email, mobile, id).
 * Uses service role to bypass RLS. Falls back to denormalized am_* fields if area_manager_id is null.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const db = getSupabase();

    // 1. Get store with area_manager_id and denormalized am_* fields
    const { data: storeData, error: storeError } = await db
      .from('merchant_stores')
      .select('area_manager_id, am_name, am_mobile, am_email')
      .eq('store_id', String(storeId).trim())
      .maybeSingle();

    if (storeError) {
      console.error('[area-manager] store fetch error:', storeError);
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }
    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // 2. If area_manager_id exists, fetch from area_managers → system_users
    if (storeData.area_manager_id != null) {
      const { data: amData, error: amError } = await db
        .from('area_managers')
        .select('id, user_id')
        .eq('id', storeData.area_manager_id)
        .maybeSingle();

      if (!amError && amData) {
        let name = 'Not set';
        let email = 'Not set';
        let mobile = 'Not set';

        if (amData.user_id != null) {
          const { data: userData, error: userError } = await db
            .from('system_users')
            .select('id, full_name, email, mobile')
            .eq('id', amData.user_id)
            .maybeSingle();

          if (!userError && userData) {
            name = userData.full_name || 'Not set';
            email = userData.email || 'Not set';
            mobile = userData.mobile || 'Not set';
          }
        }

        return NextResponse.json({
          success: true,
          areaManager: {
            id: amData.id,
            name,
            email,
            mobile,
          },
        });
      }

      // area_manager_id is set but no row in area_managers (e.g. data gap) — still show assigned ID
      return NextResponse.json({
        success: true,
        areaManager: {
          id: storeData.area_manager_id,
          name: 'Not set',
          email: 'Not set',
          mobile: 'Not set',
        },
      });
    }

    // 3. Fallback: use denormalized am_name, am_mobile, am_email from merchant_stores
    if (storeData.am_name || storeData.am_mobile || storeData.am_email) {
      return NextResponse.json({
        success: true,
        areaManager: {
          id: storeData.area_manager_id ?? null,
          name: storeData.am_name || 'Not set',
          email: storeData.am_email || 'Not set',
          mobile: storeData.am_mobile || 'Not set',
        },
      });
    }

    // 4. No area manager assigned
    return NextResponse.json({
      success: true,
      areaManager: null,
    });
  } catch (err) {
    console.error('[area-manager]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
