'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MXLayoutWhite } from '@/components/MXLayoutWhite';
import { Toaster, toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Package,
  UtensilsCrossed,
  AlertTriangle,
  Star,
  Store,
  Bell,
  BellOff,
  X,
  Printer,
  ChevronLeft,
  Sparkles,
  LayoutGrid,
  List,
  Phone,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import { useFoodOrders, type OrdersFoodRow, type FoodOrderStats } from '@/hooks/useFoodOrders';
import { PageSkeletonOrders } from '@/components/PageSkeleton';
import { fetchStoreById } from '@/lib/database';
import { MerchantStore } from '@/lib/merchantStore';
import { DEMO_RESTAURANT_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

// orders_food_status enum: CREATED, ACCEPTED, PREPARING, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED, RTO, CANCELLED
const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Created',
  NEW: 'Created', // backward compat
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready',
  OUT_FOR_DELIVERY: 'Dispatch',
  DELIVERED: 'Delivered',
  RTO: 'RTO',
  CANCELLED: 'Cancelled',
};

const STATUS_FILTERS = [
  { id: 'CREATED', label: 'Created', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'ACCEPTED', label: 'Accepted', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'PREPARING', label: 'Preparing', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'READY_FOR_PICKUP', label: 'Ready', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'OUT_FOR_DELIVERY', label: 'Dispatch', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'RTO', label: 'RTO', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

function formatVegNonVeg(v: string | null): string {
  if (!v || v === 'na') return '—';
  if (v === 'veg') return '🥗 Veg';
  if (v === 'non_veg') return '🍗 Non-Veg';
  if (v === 'mixed') return '🥗🍗 Mixed';
  return v;
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

function useNewOrderSound(enabled: boolean) {
  const play = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const audio = new Audio('/notification.wav');
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch {}
  }, [enabled]);

  return play;
}

const ORDERS_STORAGE_KEY = 'food-orders-ui';

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeInternalId, setStoreInternalId] = useState<number | null>(null);
  const [orders, setOrders] = useState<OrdersFoodRow[]>([]);
  const [stats, setStats] = useState<FoodOrderStats | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrdersFoodRow | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState<OrdersFoodRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [dispatchModal, setDispatchModal] = useState<OrdersFoodRow | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState<Set<number>>(new Set());
  const [otpCache, setOtpCache] = useState<Record<number, { otp_code: string; otp_type: string }>>({});
  const [loading, setLoading] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const s = localStorage.getItem(ORDERS_STORAGE_KEY);
      return s ? JSON.parse(s).notifyEnabled !== false : true;
    } catch { return true; }
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean | null>(null);
  const [showCloseDurationModal, setShowCloseDurationModal] = useState(false);
  const [closeDurationMins, setCloseDurationMins] = useState(30);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    if (typeof window === 'undefined') return 'card';
    try {
      const s = localStorage.getItem(ORDERS_STORAGE_KEY);
      const v = s ? JSON.parse(s).viewMode : null;
      return v === 'list' || v === 'card' ? v : 'card';
    } catch { return 'card'; }
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const hasNotifiedNew = useRef<Set<number>>(new Set());

  const updateUrlParams = useCallback((updates: { filter?: string; orderId?: string | null }) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (updates.filter !== undefined) {
      if (updates.filter === 'all') params.delete('filter');
      else params.set('filter', updates.filter);
    }
    if (updates.orderId !== undefined) {
      if (!updates.orderId) params.delete('orderId');
      else params.set('orderId', updates.orderId);
    }
    const q = params.toString();
    const path = `${window.location.pathname}${q ? `?${q}` : ''}`;
    router.replace(path, { scroll: false });
  }, [searchParams, router]);

  const persistLocal = useCallback((key: 'viewMode' | 'notifyEnabled', value: unknown) => {
    if (typeof window === 'undefined') return;
    try {
      const s = localStorage.getItem(ORDERS_STORAGE_KEY);
      const prev = s ? JSON.parse(s) : {};
      const next = { ...prev, [key]: value };
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const openOrder = useCallback((order: OrdersFoodRow) => {
    setSelectedOrder(order);
    setRightPanelOpen(true);
    updateUrlParams({ orderId: String(order.order_id || order.id) });
  }, [updateUrlParams]);

  const closeOrderPanel = useCallback(() => {
    setRightPanelOpen(false);
    setSelectedOrder(null);
    updateUrlParams({ orderId: null });
  }, [updateUrlParams]);

  const handleFilterChange = useCallback((f: string) => {
    setFilter(f);
    setRightPanelOpen(false);
    setSelectedOrder(null);
    setFilterDrawerOpen(false);
    updateUrlParams({ filter: f, orderId: null });
  }, [updateUrlParams]);
  const { subscribe } = useFoodOrders(storeId, storeInternalId);
  const playNewOrderSound = useNewOrderSound(notifyEnabled);

  useEffect(() => {
    let id = searchParams?.get('storeId') || searchParams?.get('store_id');
    if (!id && typeof window !== 'undefined') id = localStorage.getItem('selectedStoreId');
    if (!id) id = DEMO_RESTAURANT_ID;
    setStoreId(id);
  }, [searchParams]);

  useEffect(() => {
    const f = searchParams?.get('filter');
    if (f && ['all', 'active', 'CREATED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO', 'CANCELLED'].includes(f)) {
      setFilter(f === 'NEW' ? 'CREATED' : f);
    }
  }, [searchParams]);

  const orderIdFromUrl = searchParams?.get('orderId') || null;

  useEffect(() => {
    if (loading || orders.length === 0) return;
    if (!orderIdFromUrl) return;
    const id = parseInt(orderIdFromUrl, 10);
    if (isNaN(id)) return;
    const order = orders.find((o) => o.order_id === String(id) || o.id === id);
    if (order) {
      setSelectedOrder(order);
      setRightPanelOpen(true);
    }
  }, [loading, orderIdFromUrl, orders]);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const s = await fetchStoreById(storeId);
      if (s) {
        setStore(s as MerchantStore);
        setStoreInternalId((s as MerchantStore).id);
        const ms = s as MerchantStore;
        setIsStoreOpen(ms.operational_status === 'OPEN' || !!ms.is_accepting_orders);
      }
    })();
  }, [storeId]);

  const fetchStoreStatus = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/store-operations?store_id=${encodeURIComponent(storeId)}`);
      const data = await res.json();
      if (data.operational_status !== undefined) {
        setIsStoreOpen(data.operational_status === 'OPEN');
      }
    } catch {}
  }, [storeId]);

  useEffect(() => {
    fetchStoreStatus();
  }, [fetchStoreStatus]);

  // Realtime: auto-update store status when it changes in DB (merchant_stores, merchant_store_availability, merchant_store_operating_hours)
  useEffect(() => {
    if (!storeInternalId || !storeId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`store_status:${storeInternalId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'merchant_stores', filter: `id=eq.${storeInternalId}` },
        () => { fetchStoreStatus(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'merchant_store_availability', filter: `store_id=eq.${storeInternalId}` },
        () => { fetchStoreStatus(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merchant_store_operating_hours', filter: `store_id=eq.${storeInternalId}` },
        () => { fetchStoreStatus(); }
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [storeInternalId, storeId, fetchStoreStatus]);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/food-orders?store_id=${encodeURIComponent(storeId)}&limit=200`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const fetchStats = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/food-orders/stats?store_id=${encodeURIComponent(storeId)}`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {}
  }, [storeId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 15000);
    return () => clearInterval(t);
  }, [fetchStats]);

  useEffect(() => {
    if (!storeInternalId || !storeId) return;
    const unsub = subscribe(
      (row) => {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === row.id);
          if (exists) return prev.map((o) => (o.id === row.id ? row : o));
          if (row.order_status === 'CREATED' || row.order_status === 'NEW' || !row.order_status) {
            if (notifyEnabled) {
              toast.success(`New Order #${row.order_id}`, { duration: 5000 });
              if (!hasNotifiedNew.current.has(row.id)) {
                hasNotifiedNew.current.add(row.id);
                playNewOrderSound();
              }
            }
          }
          return [row, ...prev];
        });
      },
      (row) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === row.id ? row : o))
        );
        if (selectedOrder?.id === row.id) setSelectedOrder(row);
      }
    );
    return unsub;
  }, [storeInternalId, storeId, subscribe, notifyEnabled, playNewOrderSound, selectedOrder?.id]);

  const fetchOtp = useCallback(
    async (orderId: number) => {
      if (!storeId) return;
      try {
        const res = await fetch(`/api/food-orders/${orderId}/otp?store_id=${encodeURIComponent(storeId)}`);
        const data = await res.json();
        if (res.ok && data.otp_code) {
          setOtpCache((prev) => ({ ...prev, [orderId]: { otp_code: data.otp_code, otp_type: data.otp_type || 'PICKUP' } }));
        }
      } catch {}
    },
    [storeId]
  );

  const validateOtp = useCallback(
    async (orderId: number) => {
      if (!storeId || !otpInput.trim()) return;
      try {
        const res = await fetch(`/api/food-orders/${orderId}/validate-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: storeId, otp: otpInput.trim() }),
        });
        const data = await res.json();
        if (data.valid) {
          setOtpVerified((prev) => new Set(prev).add(orderId));
          toast.success('OTP verified');
        } else {
          toast.error(data.error || 'Invalid OTP');
        }
      } catch {
        toast.error('Validation failed');
      }
    },
    [storeId, otpInput]
  );

  const handleStoreToggle = useCallback(async () => {
    if (!storeId) return;
    if (isStoreOpen) {
      setShowCloseDurationModal(true);
      return;
    }
    try {
      const res = await fetch('/api/store-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, action: 'manual_open' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsStoreOpen(true);
        setStore((prev) => (prev ? { ...prev, operational_status: 'OPEN', is_accepting_orders: true } : prev));
        toast.success('Store opened successfully');
      } else {
        toast.error(data.error || 'Failed to open store');
      }
    } catch {
      toast.error('Failed to open store');
    }
  }, [storeId, isStoreOpen]);

  const handleConfirmClose = useCallback(async () => {
    if (!storeId || closeDurationMins < 1) return;
    try {
      const res = await fetch('/api/store-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, action: 'manual_close', duration_minutes: closeDurationMins }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsStoreOpen(false);
        setStore((prev) => (prev ? { ...prev, operational_status: 'CLOSED', is_accepting_orders: false } : prev));
        setShowCloseDurationModal(false);
        toast.success(`Store closed for ${closeDurationMins} minutes`);
      } else {
        toast.error(data.error || 'Failed to close store');
      }
    } catch {
      toast.error('Failed to close store');
    }
  }, [storeId, closeDurationMins]);

  const updateStatus = useCallback(
    async (order: OrdersFoodRow, newStatus: string, extra?: { rejected_reason?: string }) => {
      setActionLoading(order.id);
      const payload = { store_id: storeId, status: newStatus, ...extra };

      const tryUpdate = async (): Promise<{ ok: boolean; data: unknown }> => {
        const res = await fetch(`/api/food-orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        return { ok: res.ok, data };
      };

      try {
        let result = await tryUpdate();
        if (!result.ok) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await tryUpdate();
        }
        if (!result.ok) {
          toast.error((result.data as { error?: string })?.error || 'Failed to update');
          return;
        }
        const data = result.data as { order?: OrdersFoodRow };
        if (data?.order) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? (data.order as OrdersFoodRow) : o)));
          if (selectedOrder?.id === order.id) {
            setSelectedOrder(data.order);
            if (newStatus === 'DELIVERED') {
              closeOrderPanel();
            }
          }
          if (newStatus === 'OUT_FOR_DELIVERY') setDispatchModal(null);
        }
        toast.success(`Order status updated to ${newStatus}`);
      } catch {
        toast.error('Failed to update order');
      } finally {
        setActionLoading(null);
      }
    },
    [storeId, selectedOrder, closeOrderPanel]
  );

  const norm = (s: string | null | undefined) => (s === 'NEW' ? 'CREATED' : s || 'CREATED');
  const filteredOrders =
    filter === 'all'
      ? orders
      : filter === 'active'
        ? orders.filter((o) =>
            ['CREATED', 'NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'RTO'].includes(o.order_status || 'CREATED')
          )
        : orders.filter((o) => norm(o.order_status) === filter);

  const counts: Record<string, number> = {};
  orders.forEach((o) => {
    const s = norm(o.order_status);
    counts[s] = (counts[s] || 0) + 1;
  });

  if (loading && orders.length === 0) {
    return (
      <MXLayoutWhite restaurantName={store?.store_name} restaurantId={storeId || ''} leftSidebarCollapsed>
        <PageSkeletonOrders />
      </MXLayoutWhite>
    );
  }

  const mobileStatsExtra = stats ? (
    <div className="grid grid-cols-1 gap-2.5 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Avg Prep</span>
        <span className="font-semibold text-gray-900">{stats.avgPreparationTimeMinutes}m</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Revenue</span>
        <span className="font-semibold text-gray-900">₹{stats.totalRevenueToday.toFixed(0)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Completion</span>
        <span className="font-semibold text-gray-900">{stats.completionRatePercent}%</span>
      </div>
    </div>
  ) : null;

  return (
    <MXLayoutWhite restaurantName={store?.store_name} restaurantId={storeId || ''} leftSidebarCollapsed mobileMenuExtra={mobileStatsExtra}>
      <Toaster position="top-right" richColors />
      <div className="flex h-full min-h-0 bg-gray-50 relative flex-col">
        {/* Header: full width, extends over sidebar area so controls align with right sidebar */}
        <header id="food-orders-header" className="sticky top-0 z-20 bg-white border-b border-gray-200 shrink-0">
          <div className="w-full px-3 sm:px-4 py-2 sm:py-3">
            {/* Mobile: 2 rows (Row 1 = Today+Active, Row 2 = Filter + status + sound). Desktop: single row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
              {/* Row 1 (mobile) / Left (desktop): On mobile Today+Active on right. On desktop title + all stats on left */}
              <div className="flex justify-end md:justify-start md:flex-1 md:items-center md:gap-3 min-w-0 overflow-x-auto hide-scrollbar">
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <Sparkles className="w-5 h-5 text-orange-500 shrink-0" />
                  <span className="font-semibold text-gray-900 whitespace-nowrap">Food Orders</span>
                </div>
                {stats && (
                  <div className="flex items-center gap-2 shrink-0">
                    <StatBadge label="Today" value={String(stats.ordersToday)} />
                    <StatBadge label="Active" value={String(stats.activeOrders)} accent />
                  </div>
                )}
                {stats && (
                  <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
                    <StatBadge label="Avg Prep" value={`${stats.avgPreparationTimeMinutes}m`} />
                    <StatBadge label="Revenue" value={`₹${stats.totalRevenueToday.toFixed(0)}`} />
                    <StatBadge label="Completion" value={`${stats.completionRatePercent}%`} />
                  </div>
                )}
              </div>
              {/* Row 2 (mobile) / Right (desktop): Filter, status button, sound (+ grid toggle on desktop) */}
              <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 lg:w-64 lg:pl-4">
                <button
                  onClick={() => setFilterDrawerOpen(true)}
                  className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 whitespace-nowrap"
                  title="Filter orders"
                >
                  <SlidersHorizontal size={14} />
                  Filter
                </button>
              <button
                onClick={handleStoreToggle}
                disabled={isStoreOpen === null}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  isStoreOpen === null
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isStoreOpen
                      ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                }`}
                title={isStoreOpen === null ? 'Loading store status...' : isStoreOpen ? 'Click to close store' : 'Click to open store'}
              >
                <Store size={14} className="shrink-0" />
                <span className="hidden min-[400px]:inline">{isStoreOpen === null ? 'Loading...' : isStoreOpen ? 'Store Open' : 'Store Closed'}</span>
                <span className="min-[400px]:hidden">{isStoreOpen === null ? '...' : isStoreOpen ? 'Open' : 'Closed'}</span>
              </button>
              <div className="hidden md:flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => { setViewMode('card'); persistLocal('viewMode', 'card'); }}
                  className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  title="Card view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => { setViewMode('list'); persistLocal('viewMode', 'list'); }}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>
              <button
                onClick={() => { setNotifyEnabled((v) => { const n = !v; persistLocal('notifyEnabled', n); return n; }); }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  notifyEnabled ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}
                title={notifyEnabled ? 'Disable new order sound' : 'Enable new order sound'}
              >
                {notifyEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                <span className="hidden sm:inline">{notifyEnabled ? 'Sound On' : 'Sound Off'}</span>
              </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 lg:pr-64">
          <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-col lg:flex-row flex-1 min-h-0">
            {/* Desktop (lg+): When order open, split layout. Mobile: full-screen overlay on card click */}
            {rightPanelOpen && selectedOrder ? (
              <>
                {/* Order details: inline on desktop (lg+), full-screen overlay on mobile */}
                <div className="hidden lg:flex flex-1 min-w-0 border-r border-gray-200 bg-white flex-col overflow-hidden order-1">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Order #{selectedOrder.order_id}</h3>
                  <button
                    onClick={closeOrderPanel}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
                  <DetailSection title="Status">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        (selectedOrder.order_status || 'CREATED') === 'CREATED' || (selectedOrder.order_status || '') === 'NEW'
                          ? 'bg-red-100 text-red-800'
                          : (selectedOrder.order_status || '') === 'DELIVERED'
                            ? 'bg-green-100 text-green-800'
                            : (selectedOrder.order_status || '') === 'CANCELLED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {STATUS_LABEL[selectedOrder.order_status || 'CREATED'] || selectedOrder.order_status || 'CREATED'}
                    </span>
                  </DetailSection>
                  <DetailSection title="Restaurant">
                    <div className="space-y-0.5">
                      <p className="font-medium text-gray-900">{selectedOrder.restaurant_name || '—'}</p>
                      {selectedOrder.restaurant_phone && (
                        <a
                          href={`tel:${selectedOrder.restaurant_phone}`}
                          className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1.5"
                        >
                          <Phone size={12} />
                          {selectedOrder.restaurant_phone}
                        </a>
                      )}
                    </div>
                  </DetailSection>
                  <DetailSection title="Items & Value">
                    <p className="font-medium">
                      {selectedOrder.food_items_count ?? '—'} items • ₹{Number(selectedOrder.food_items_total_value || 0).toFixed(2)}
                    </p>
                  </DetailSection>
                  <DetailSection title="Prep time">
                    {selectedOrder.preparation_time_minutes ?? '—'} min
                  </DetailSection>
                  {selectedOrder.delivery_instructions && (
                    <DetailSection title="Instructions">
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <MapPin size={14} /> {selectedOrder.delivery_instructions}
                      </span>
                    </DetailSection>
                  )}
                  <DetailSection title="Flags">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedOrder.requires_utensils && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded flex items-center gap-1">
                          <UtensilsCrossed size={12} /> Utensils
                        </span>
                      )}
                      {selectedOrder.is_fragile && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded">⚠ Fragile</span>
                      )}
                      {selectedOrder.is_high_value && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded flex items-center gap-1">
                          <Star size={12} /> High Value
                        </span>
                      )}
                      {selectedOrder.veg_non_veg && selectedOrder.veg_non_veg !== 'na' && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                          {formatVegNonVeg(selectedOrder.veg_non_veg)}
                        </span>
                      )}
                      {(!selectedOrder.requires_utensils && !selectedOrder.is_fragile && !selectedOrder.is_high_value && (!selectedOrder.veg_non_veg || selectedOrder.veg_non_veg === 'na')) && (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </div>
                  </DetailSection>
                  {selectedOrder.rejected_reason && (
                    <DetailSection title="Rejection reason">
                      <p className="text-red-700 text-sm">{selectedOrder.rejected_reason}</p>
                    </DetailSection>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <DetailSection title="Created">{formatTimeAgo(selectedOrder.created_at)}</DetailSection>
                    <DetailSection title="Updated">{formatTimeAgo(selectedOrder.updated_at)}</DetailSection>
                    {selectedOrder.accepted_at && (
                      <DetailSection title="Accepted">{formatTimeAgo(selectedOrder.accepted_at)}</DetailSection>
                    )}
                    {selectedOrder.prepared_at && (
                      <DetailSection title="Prepared">{formatTimeAgo(selectedOrder.prepared_at)}</DetailSection>
                    )}
                    {selectedOrder.dispatched_at && (
                      <DetailSection title="Dispatched">{formatTimeAgo(selectedOrder.dispatched_at)}</DetailSection>
                    )}
                    {selectedOrder.delivered_at && (
                      <DetailSection title="Delivered">{formatTimeAgo(selectedOrder.delivered_at)}</DetailSection>
                    )}
                    {selectedOrder.cancelled_at && (
                      <DetailSection title="Cancelled">{formatTimeAgo(selectedOrder.cancelled_at)}</DetailSection>
                    )}
                  </div>
                  {(selectedOrder.order_status === 'READY_FOR_PICKUP' || selectedOrder.order_status === 'OUT_FOR_DELIVERY') && (
                    <DetailSection title="OTP">
                      {otpCache[selectedOrder.id] ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{otpCache[selectedOrder.id].otp_code}</span>
                          <span className="text-xs text-slate-600">({otpCache[selectedOrder.id].otp_type})</span>
                          {otpVerified.has(selectedOrder.id) && (
                            <span className="text-green-600 text-xs font-medium">✓ Verified</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => fetchOtp(selectedOrder.id)}
                          className="text-orange-600 text-sm font-medium"
                        >
                          Show OTP
                        </button>
                      )}
                    </DetailSection>
                  )}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <ActionBtns
                      order={selectedOrder}
                      onAccept={() => updateStatus(selectedOrder, 'ACCEPTED')}
                      onReject={() => {
                        setRejectModal(selectedOrder);
                        closeOrderPanel();
                      }}
                      onPreparing={() => updateStatus(selectedOrder, 'PREPARING')}
                      onReady={() => updateStatus(selectedOrder, 'READY_FOR_PICKUP')}
                      onDispatch={() => {
                        fetchOtp(selectedOrder.id);
                        setDispatchModal(selectedOrder);
                        setOtpInput('');
                      }}
                      onComplete={() => updateStatus(selectedOrder, 'DELIVERED')}
                      onRto={() => updateStatus(selectedOrder, 'RTO')}
                      loading={actionLoading === selectedOrder.id}
                      otpVerified={otpVerified.has(selectedOrder.id)}
                    />
                  </div>
                </div>
              </div>

                {/* Mobile: Order details panel beside sidebar - card-based layout */}
                <div className="lg:hidden flex-1 min-w-0 flex flex-col overflow-hidden order-1">
                  <OrderDetailMobile
                    order={selectedOrder}
                    onClose={closeOrderPanel}
                    statusLabel={STATUS_LABEL[selectedOrder.order_status || 'CREATED'] || selectedOrder.order_status || 'CREATED'}
                    formatVegNonVeg={formatVegNonVeg}
                    formatTimeAgo={formatTimeAgo}
                    otpCode={otpCache[selectedOrder.id]?.otp_code}
                    otpType={otpCache[selectedOrder.id]?.otp_type}
                    otpVerified={otpVerified.has(selectedOrder.id)}
                    onFetchOtp={() => fetchOtp(selectedOrder.id)}
                    onAccept={() => updateStatus(selectedOrder, 'ACCEPTED')}
                    onReject={() => { setRejectModal(selectedOrder); closeOrderPanel(); }}
                    onPreparing={() => updateStatus(selectedOrder, 'PREPARING')}
                    onReady={() => updateStatus(selectedOrder, 'READY_FOR_PICKUP')}
                    onDispatch={() => { fetchOtp(selectedOrder.id); setDispatchModal(selectedOrder); setOtpInput(''); }}
                    onComplete={() => updateStatus(selectedOrder, 'DELIVERED')}
                    onRto={() => updateStatus(selectedOrder, 'RTO')}
                    actionLoading={actionLoading === selectedOrder.id}
                  />
                </div>

                {/* Right: Cards column - desktop only when order open (hidden on mobile) */}
                <div className="hidden lg:flex w-64 shrink-0 flex-col overflow-hidden pl-4 order-2">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 hide-scrollbar">
                    <div className="space-y-3 pr-1">
                      {filteredOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          selected={selectedOrder?.id === order.id}
                          onClick={() => openOrder(order)}
                          onAccept={() => updateStatus(order, 'ACCEPTED')}
                          onReject={() => setRejectModal(order)}
                          onPreparing={() => updateStatus(order, 'PREPARING')}
                          onReady={() => updateStatus(order, 'READY_FOR_PICKUP')}
                          onDispatch={() => {
                            fetchOtp(order.id);
                            setDispatchModal(order);
                            setOtpInput('');
                          }}
                          onRto={() => updateStatus(order, 'RTO')}
                          onComplete={() => updateStatus(order, 'DELIVERED')}
                          loading={actionLoading === order.id}
                          otpCode={otpCache[order.id]?.otp_code}
                          otpType={otpCache[order.id]?.otp_type}
                          otpVerified={otpVerified.has(order.id)}
                          onFetchOtp={() => fetchOtp(order.id)}
                          statusLabel={STATUS_LABEL[order.order_status || 'CREATED'] || order.order_status}
                        />
                      ))}
                    </div>
                    {filteredOrders.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Package className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-sm font-medium">No orders in this filter</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
            {/* Main order cards / list - full width when no order open */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-w-0 min-h-0 hide-scrollbar" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              {viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    selected={selectedOrder?.id === order.id}
                    onClick={() => openOrder(order)}
                    onAccept={() => updateStatus(order, 'ACCEPTED')}
                    onReject={() => setRejectModal(order)}
                    onPreparing={() => updateStatus(order, 'PREPARING')}
                    onReady={() => updateStatus(order, 'READY_FOR_PICKUP')}
                    onDispatch={() => {
                      fetchOtp(order.id);
                      setDispatchModal(order);
                      setOtpInput('');
                    }}
                    onRto={() => updateStatus(order, 'RTO')}
                    onComplete={() => updateStatus(order, 'DELIVERED')}
                    loading={actionLoading === order.id}
                    otpCode={otpCache[order.id]?.otp_code}
                    otpType={otpCache[order.id]?.otp_type}
                    otpVerified={otpVerified.has(order.id)}
                    onFetchOtp={() => fetchOtp(order.id)}
                    statusLabel={STATUS_LABEL[order.order_status || 'CREATED'] || order.order_status}
                  />
                ))}
              </div>
              ) : (
              <div className="space-y-1">
                {filteredOrders.map((order) => (
                  <OrderListRow
                    key={order.id}
                    order={order}
                    selected={selectedOrder?.id === order.id}
                    onClick={() => openOrder(order)}
                    onAccept={() => updateStatus(order, 'ACCEPTED')}
                    onReject={() => setRejectModal(order)}
                    onPreparing={() => updateStatus(order, 'PREPARING')}
                    onReady={() => updateStatus(order, 'READY_FOR_PICKUP')}
                    onDispatch={() => { fetchOtp(order.id); setDispatchModal(order); setOtpInput(''); }}
                    onRto={() => updateStatus(order, 'RTO')}
                    onComplete={() => updateStatus(order, 'DELIVERED')}
                    loading={actionLoading === order.id}
                    otpCode={otpCache[order.id]?.otp_code}
                    otpType={otpCache[order.id]?.otp_type}
                    otpVerified={otpVerified.has(order.id)}
                    onFetchOtp={() => fetchOtp(order.id)}
                    statusLabel={STATUS_LABEL[order.order_status || 'CREATED'] || order.order_status}
                  />
                ))}
              </div>
              )}
              {filteredOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Package className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No orders in this filter</p>
                </div>
              )}
            </div>
              </>
            )}

            {/* Right filters sidebar - fixed on right, starts below header */}
            <div className="hidden lg:flex fixed right-0 top-16 bottom-0 w-64 flex-col border-l border-gray-200 bg-white shadow-lg z-30">
              <div className="flex-1 overflow-y-auto hide-scrollbar p-3 pb-20 space-y-1">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                    filter === 'all' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  onClick={() => handleFilterChange('active')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
                    filter === 'active' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Active
                  <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {orders.filter((o) =>
                      ['CREATED', 'NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'RTO'].includes(
                        o.order_status || 'CREATED'
                      )
                    ).length}
                  </span>
                </button>
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFilterChange(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
                      filter === f.id ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {f.label}
                    {(counts[f.id] || 0) > 0 && (
                      <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                        {counts[f.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setFilterDrawerOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-64 max-w-[85vw] min-w-[240px] bg-white border-l border-gray-200 z-50 lg:hidden overflow-y-auto hide-scrollbar shadow-xl" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
            <div className="p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">Filter by status</h3>
              <button onClick={() => setFilterDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-3 space-y-1">
              <button
                onClick={() => handleFilterChange('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                  filter === 'all' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => handleFilterChange('active')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
                  filter === 'active' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Active
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {orders.filter((o) =>
                    ['CREATED', 'NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'RTO'].includes(
                      o.order_status || 'CREATED'
                    )
                  ).length}
                </span>
              </button>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFilterChange(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
                    filter === f.id ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                  {(counts[f.id] || 0) > 0 && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                      {counts[f.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-2">Reject Order #{rejectModal.order_id}</h3>
            <p className="text-sm text-gray-600 mb-3">Provide a reason (optional):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm min-h-[80px]"
              placeholder="e.g. Item unavailable, Store closed..."
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateStatus(rejectModal, 'CANCELLED', {
                    rejected_reason: rejectReason || 'No reason provided',
                  });
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch confirmation modal */}
      {dispatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-sm w-full p-4 sm:p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-2">Confirm Dispatch - Order #{dispatchModal.order_id}</h3>
            <p className="text-sm text-gray-600 mb-3">Validate OTP with rider before dispatching.</p>
            {!otpCache[dispatchModal.id] && (
              <button
                onClick={() => fetchOtp(dispatchModal.id)}
                className="mb-3 w-full py-2 border border-orange-300 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50"
              >
                Show OTP
              </button>
            )}
            {otpCache[dispatchModal.id] && (
              <div className="mb-3 px-3 py-2 bg-slate-100 rounded-lg">
                <span className="text-xs text-slate-600">{otpCache[dispatchModal.id].otp_type || 'Pickup'} OTP: </span>
                <span className="font-mono font-bold text-lg">{otpCache[dispatchModal.id].otp_code}</span>
              </div>
            )}
            {!otpVerified.has(dispatchModal.id) ? (
              <>
                <input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter OTP from rider"
                  className="w-full px-3 py-2 border rounded-lg mb-2 text-center font-mono"
                  maxLength={6}
                />
                <button
                  onClick={() => validateOtp(dispatchModal.id)}
                  className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium mb-2"
                >
                  Validate OTP
                </button>
              </>
            ) : (
              <p className="text-green-600 text-sm font-medium mb-3">✓ OTP verified</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDispatchModal(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => otpVerified.has(dispatchModal.id) && updateStatus(dispatchModal, 'OUT_FOR_DELIVERY')}
                disabled={!otpVerified.has(dispatchModal.id)}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close duration modal */}
      {showCloseDurationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Close Store Temporarily</h3>
            <p className="text-sm text-gray-600 mb-4">Store will auto-reopen based on your operating hours after the selected duration.</p>
            <select
              value={closeDurationMins}
              onChange={(e) => setCloseDurationMins(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg mb-4"
            >
              {[15, 30, 60, 120, 240].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseDurationModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Close for {closeDurationMins} min
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
    </MXLayoutWhite>
  );
}

function StatBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
        accent ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
      }`}
    >
      <span className="opacity-80">{label}:</span> <span className="font-semibold">{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase mb-1 break-words">{title}</p>
      <div className="text-sm text-gray-900 break-words">{children}</div>
    </div>
  );
}

function OrderDetailMobile({
  order,
  onClose,
  statusLabel,
  formatVegNonVeg,
  formatTimeAgo,
  otpCode,
  otpType,
  otpVerified,
  onFetchOtp,
  onAccept,
  onReject,
  onPreparing,
  onReady,
  onDispatch,
  onComplete,
  onRto,
  actionLoading,
}: {
  order: OrdersFoodRow;
  onClose: () => void;
  statusLabel: string;
  formatVegNonVeg: (v: string | null) => string;
  formatTimeAgo: (s: string) => string;
  otpCode?: string;
  otpType?: string;
  otpVerified?: boolean;
  onFetchOtp: () => void;
  onAccept: () => void;
  onReject: () => void;
  onPreparing: () => void;
  onReady: () => void;
  onDispatch: () => void;
  onComplete: () => void;
  onRto: () => void;
  actionLoading: boolean;
}) {
  const status = order.order_status || 'CREATED';
  const statusColor =
    status === 'CREATED' || status === 'NEW'
      ? 'bg-red-100 text-red-800'
      : status === 'DELIVERED'
        ? 'bg-green-100 text-green-800'
        : status === 'CANCELLED'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-blue-100 text-blue-800';
  const totalValue = Number(order.food_items_total_value || 0).toFixed(2);
  const hasFlags =
    order.requires_utensils ||
    order.is_fragile ||
    order.is_high_value ||
    (order.veg_non_veg && order.veg_non_veg !== 'na');

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-gray-50"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header Card */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-bold text-gray-900 text-lg">#{order.order_id}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 -m-2 hover:bg-gray-100 rounded-lg touch-manipulation shrink-0"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 hide-scrollbar min-h-0">
        {/* Restaurant Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Restaurant</p>
          <p className="font-semibold text-gray-900 text-base">{order.restaurant_name || '—'}</p>
          {order.restaurant_phone && (
            <a
              href={`tel:${order.restaurant_phone}`}
              className="mt-1.5 inline-flex items-center gap-2 text-orange-600 font-medium text-sm hover:text-orange-700"
            >
              <Phone size={16} />
              {order.restaurant_phone}
            </a>
          )}
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-gray-600">Items</span>
              <span className="font-semibold text-gray-900">{order.food_items_count ?? '—'} items</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-600">Total Value</span>
              <span className="font-bold text-lg text-gray-900">₹{totalValue}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-600">Prep Time</span>
              <span className="font-medium text-gray-900">{order.preparation_time_minutes ?? '—'} min</span>
            </div>
          </div>
        </div>

        {/* Instructions Card (if any) */}
        {order.delivery_instructions && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MapPin size={14} />
              Delivery Instructions
            </p>
            <p className="text-sm font-medium text-amber-900">{order.delivery_instructions}</p>
          </div>
        )}

        {/* Flags Card */}
        {hasFlags && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Flags</p>
            <div className="flex flex-wrap gap-2">
              {order.requires_utensils && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg flex items-center gap-1.5 font-medium">
                  <UtensilsCrossed size={14} /> Utensils
                </span>
              )}
              {order.is_fragile && (
                <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm rounded-lg font-medium">⚠ Fragile</span>
              )}
              {order.is_high_value && (
                <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm rounded-lg flex items-center gap-1.5 font-medium">
                  <Star size={14} /> High Value
                </span>
              )}
              {order.veg_non_veg && order.veg_non_veg !== 'na' && (
                <span className="px-3 py-1.5 bg-green-100 text-green-800 text-sm rounded-lg font-medium">
                  {formatVegNonVeg(order.veg_non_veg)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Rejected Reason (if any) */}
        {order.rejected_reason && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">Rejection Reason</p>
            <p className="text-sm text-red-900">{order.rejected_reason}</p>
          </div>
        )}

        {/* Timestamps Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Updated</p>
              <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.updated_at)}</p>
            </div>
            {order.accepted_at && (
              <div>
                <p className="text-xs text-gray-500">Accepted</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.accepted_at)}</p>
              </div>
            )}
            {order.prepared_at && (
              <div>
                <p className="text-xs text-gray-500">Prepared</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.prepared_at)}</p>
              </div>
            )}
            {order.dispatched_at && (
              <div>
                <p className="text-xs text-gray-500">Dispatched</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.dispatched_at)}</p>
              </div>
            )}
            {order.delivered_at && (
              <div>
                <p className="text-xs text-gray-500">Delivered</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.delivered_at)}</p>
              </div>
            )}
            {order.cancelled_at && (
              <div>
                <p className="text-xs text-gray-500">Cancelled</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(order.cancelled_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* OTP Card (when applicable) */}
        {(status === 'READY_FOR_PICKUP' || status === 'OUT_FOR_DELIVERY') && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">OTP Verification</p>
            {otpCode ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono font-bold text-lg text-gray-900">{otpCode}</span>
                <span className="text-xs text-gray-600">({otpType || 'PICKUP'})</span>
                {otpVerified && (
                  <span className="text-green-600 text-sm font-medium">✓ Verified</span>
                )}
              </div>
            ) : (
              <button
                onClick={onFetchOtp}
                className="text-orange-600 font-semibold text-sm hover:text-orange-700"
              >
                Show OTP
              </button>
            )}
          </div>
        )}

        {/* Action Buttons Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <ActionBtns
            order={order}
            onAccept={onAccept}
            onReject={onReject}
            onPreparing={onPreparing}
            onReady={onReady}
            onDispatch={onDispatch}
            onComplete={onComplete}
            onRto={onRto}
            loading={actionLoading}
            otpVerified={otpVerified}
          />
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  selected,
  onClick,
  onAccept,
  onReject,
  onPreparing,
  onReady,
  onDispatch,
  onComplete,
  onRto,
  loading,
  otpCode,
  otpType,
  otpVerified,
  onFetchOtp,
  statusLabel,
}: {
  order: OrdersFoodRow;
  selected: boolean;
  onClick: () => void;
  onAccept: () => void;
  onReject?: () => void;
  onPreparing: () => void;
  onReady: () => void;
  onDispatch: () => void;
  onComplete: () => void;
  onRto: () => void;
  loading: boolean;
  otpCode?: string;
  otpType?: string;
  otpVerified?: boolean;
  onFetchOtp?: () => void;
  statusLabel?: string;
}) {
  const status = order.order_status || 'CREATED';
  const isNew = status === 'CREATED' || status === 'NEW';
  const value = Number(order.food_items_total_value || 0);
  const label = statusLabel ?? STATUS_LABEL[status] ?? status;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`rounded-lg border-2 p-3 sm:p-3.5 cursor-pointer transition-all overflow-hidden min-w-0 touch-manipulation active:scale-[0.99] ${
        selected
          ? 'border-orange-500 bg-orange-50 shadow-md'
          : isNew
            ? 'border-red-300 bg-red-50/50 ring-2 ring-red-200/50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm">#{order.order_id}</p>
          <p className="text-xs text-gray-600 truncate">{order.restaurant_name || '—'}</p>
        </div>
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            status === 'CREATED' || status === 'NEW'
              ? 'bg-red-100 text-red-800'
              : status === 'DELIVERED' || status === 'CANCELLED'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-blue-100 text-blue-800'
          }`}
          title={status}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 flex-wrap">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatTimeAgo(order.created_at)}
        </span>
        <span>•</span>
        <span>{order.food_items_count ?? 0} items</span>
        <span>•</span>
        <span className="font-semibold text-gray-900">₹{value.toFixed(0)}</span>
        {order.preparation_time_minutes != null && (
          <>
            <span>•</span>
            <span>{order.preparation_time_minutes}m prep</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {order.veg_non_veg === 'veg' && (
          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">🥗 Veg</span>
        )}
        {order.veg_non_veg === 'non_veg' && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded">🍗 Non-Veg</span>
        )}
        {order.veg_non_veg === 'mixed' && (
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded">🥗🍗 Mixed</span>
        )}
        {order.is_high_value && (
          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded flex items-center gap-0.5">
            <Star size={10} /> High
          </span>
        )}
        {order.is_fragile && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">⚠ Fragile</span>
        )}
        {order.requires_utensils && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded flex items-center gap-0.5">
            <UtensilsCrossed size={10} /> Utensils
          </span>
        )}
      </div>
      {order.delivery_instructions && (
        <p className="text-xs text-amber-700 mb-2 flex items-center gap-1 truncate" title={order.delivery_instructions}>
          <AlertTriangle size={12} /> {order.delivery_instructions}
        </p>
      )}
      {(status === 'READY_FOR_PICKUP' || status === 'OUT_FOR_DELIVERY') && (otpCode || onFetchOtp) && (
        <div className="mb-2 px-2 py-1 bg-slate-100 rounded text-xs flex items-center justify-between">
          <span className="text-slate-600">OTP ({otpType || 'PICKUP'}):</span>
          {otpCode ? (
            <span className="font-mono font-bold text-slate-900">{otpCode}</span>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onFetchOtp?.(); }} className="text-orange-600 font-medium">Show</button>
          )}
          {otpVerified && <span className="text-green-600 text-[10px]">✓ Verified</span>}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
        >
          Details <ChevronRight size={14} />
        </button>
        <ActionBtns
          order={order}
          onAccept={onAccept}
          onReject={onReject}
          onPreparing={onPreparing}
          onReady={onReady}
          onDispatch={onDispatch}
          onComplete={onComplete}
          onRto={onRto}
          loading={loading}
          otpVerified={otpVerified}
          compact
        />
      </div>
    </div>
  );
}

function OrderListRow({
  order,
  selected,
  onClick,
  onAccept,
  onReject,
  onPreparing,
  onReady,
  onDispatch,
  onRto,
  onComplete,
  loading,
  otpCode,
  otpType,
  otpVerified,
  onFetchOtp,
  statusLabel,
}: {
  order: OrdersFoodRow;
  selected: boolean;
  onClick: () => void;
  onAccept: () => void;
  onReject?: () => void;
  onPreparing: () => void;
  onReady: () => void;
  onDispatch: () => void;
  onRto: () => void;
  onComplete: () => void;
  loading: boolean;
  otpCode?: string;
  otpType?: string;
  otpVerified?: boolean;
  onFetchOtp?: () => void;
  statusLabel?: string;
}) {
  const status = order.order_status || 'CREATED';
  const value = Number(order.food_items_total_value || 0);
  const label = statusLabel ?? STATUS_LABEL[status] ?? status;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`flex items-center gap-2 sm:gap-3 rounded-lg border px-3 py-2.5 sm:py-2 cursor-pointer transition-all overflow-hidden min-w-0 touch-manipulation active:scale-[0.99] ${
        selected
          ? 'border-orange-500 bg-orange-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            status === 'CREATED' || status === 'NEW'
              ? 'bg-red-100 text-red-800'
              : status === 'DELIVERED' || status === 'CANCELLED'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-blue-100 text-blue-800'
          }`}
          title={status}
        >
          {label}
        </span>
        <span className="font-bold text-gray-900 text-sm shrink-0">#{order.order_id}</span>
        <span className="text-xs text-gray-600 truncate min-w-0">{order.restaurant_name || '—'}</span>
        <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">
          <Clock size={10} />
          {formatTimeAgo(order.created_at)}
        </span>
        <span className="text-xs text-gray-700 shrink-0">
          {order.food_items_count ?? 0} items · ₹{value.toFixed(0)}
          {order.preparation_time_minutes != null && ` · ${order.preparation_time_minutes}m prep`}
        </span>
        {(status === 'READY_FOR_PICKUP' || status === 'OUT_FOR_DELIVERY') && (otpCode || onFetchOtp) && (
          <span className="text-xs shrink-0">
            OTP: {otpCode ? <span className="font-mono font-bold">{otpCode}</span> : <button onClick={(e) => { e.stopPropagation(); onFetchOtp?.(); }} className="text-orange-600">Show</button>}
          </span>
        )}
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <ActionBtns
          order={order}
          onAccept={onAccept}
          onReject={onReject}
          onPreparing={onPreparing}
          onReady={onReady}
          onDispatch={onDispatch}
          onComplete={onComplete}
          onRto={onRto}
          loading={loading}
          otpVerified={otpVerified}
          compact
        />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="text-xs font-medium text-orange-600 hover:text-orange-700 shrink-0 flex items-center gap-0.5"
      >
        Details <ChevronRight size={14} />
      </button>
    </div>
  );
}

function ActionBtns({
  order,
  onAccept,
  onReject,
  onPreparing,
  onReady,
  onDispatch,
  onComplete,
  onRto,
  loading,
  compact,
  otpVerified,
}: {
  order: OrdersFoodRow;
  onAccept: () => void;
  onReject?: () => void;
  onPreparing: () => void;
  onReady: () => void;
  onDispatch: () => void;
  onComplete: () => void;
  onRto?: () => void;
  loading: boolean;
  compact?: boolean;
  otpVerified?: boolean;
}) {
  const status = order.order_status || 'CREATED';
  const dis = loading;

  if (status === 'CREATED' || status === 'NEW') {
    return (
      <div className={`flex ${compact ? 'gap-2' : 'gap-2'} flex-wrap items-center`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          disabled={dis}
          className={`${compact ? 'px-4 py-2 text-sm font-semibold' : 'px-5 py-2.5 text-base font-semibold'} bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 shadow-sm`}
        >
          Accept
        </button>
        {onReject && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            disabled={dis}
            className={`${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'} bg-red-100 text-red-700 rounded font-medium hover:bg-red-200 disabled:opacity-50`}
          >
            Reject
          </button>
        )}
      </div>
    );
  }
  if (status === 'ACCEPTED') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPreparing();
        }}
        disabled={dis}
        className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-amber-600 text-white rounded font-medium hover:bg-amber-700 disabled:opacity-50`}
      >
        Preparing
      </button>
    );
  }
  if (status === 'PREPARING') {
    return (
      <div className={`flex ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
        <button
          onClick={(e) => { e.stopPropagation(); onReady(); }}
          disabled={dis}
          className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:opacity-50`}
        >
          Ready
        </button>
        {onRto && (
          <button
            onClick={(e) => { e.stopPropagation(); onRto(); }}
            disabled={dis}
            className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-orange-100 text-orange-700 rounded font-medium hover:bg-orange-200 disabled:opacity-50`}
          >
            RTO
          </button>
        )}
      </div>
    );
  }
  if (status === 'READY_FOR_PICKUP') {
    return (
      <div className={`flex ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
        <button
          onClick={(e) => { e.stopPropagation(); onDispatch(); }}
          disabled={dis}
          className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-purple-600 text-white rounded font-medium hover:bg-purple-700 disabled:opacity-50`}
        >
          Dispatch
        </button>
        {onRto && (
          <button
            onClick={(e) => { e.stopPropagation(); onRto(); }}
            disabled={dis}
            className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-orange-100 text-orange-700 rounded font-medium hover:bg-orange-200 disabled:opacity-50`}
          >
            RTO
          </button>
        )}
      </div>
    );
  }
  if (status === 'OUT_FOR_DELIVERY') {
    return (
      <div className={`flex ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          disabled={dis}
          className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50`}
        >
          Complete
        </button>
        {onRto && (
          <button
            onClick={(e) => { e.stopPropagation(); onRto(); }}
            disabled={dis}
            className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-orange-100 text-orange-700 rounded font-medium hover:bg-orange-200 disabled:opacity-50`}
          >
            RTO
          </button>
        )}
      </div>
    );
  }
  return null;
}

export default function FoodOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
