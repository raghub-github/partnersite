'use client'

import React, { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MXLayoutWhite } from '@/components/MXLayoutWhite'
import { fetchRestaurantById as fetchStoreById, fetchRestaurantByName as fetchStoreByName } from '@/lib/database'
import { MerchantStore } from '@/lib/merchantStore'
import { DEMO_RESTAURANT_ID as DEMO_STORE_ID } from '@/lib/constants'
import {
  Power,
  Truck,
  Clock,
  AlertCircle,
  BarChart3,
  Package,
  TrendingUp,
  Users,
  Monitor,
  Smartphone,
  Activity,
  Pause,
  UtensilsCrossed,
  Tag,
  FileBarChart,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { Toaster, toast } from 'sonner'
import { Suspense } from 'react'


import { useMerchantSession } from '@/context/MerchantSessionContext';
import { PageSkeletonDashboard } from '@/components/PageSkeleton';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic'

// Helper Component: Stat Card
interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: 'orange' | 'blue' | 'emerald' | 'purple'
}

/** Show time with hours, minutes, seconds (no 00:00); HH:MM becomes HH:MM:00 */
function formatTimeHMS(t: string): string {
  if (!t) return '00:00:00'
  const parts = t.split(':')
  if (parts.length === 2) return `${t}:00`
  if (parts.length === 1) return `${t.padStart(2, '0')}:00:00`
  return t
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    orange: 'bg-orange-500/10 border-orange-200',
    blue: 'bg-blue-500/10 border-blue-200',
    emerald: 'bg-emerald-500/10 border-emerald-200',
    purple: 'bg-purple-500/10 border-purple-200'
  }
  const textColors = {
    orange: 'text-orange-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    purple: 'text-purple-700'
  }
  return (
    <div className={`bg-white rounded-xl border ${colorClasses[color]} p-3 shadow-sm hover:shadow-md transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-600 font-medium truncate">{title}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{value}</p>
        </div>
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${textColors[color]}`}>{icon}</div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const merchantSession = useMerchantSession();
  const router = useRouter()
  const searchParams = useSearchParams()
  const [store, setStore] = useState<MerchantStore | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  // Store Status & Delivery Mode (synced with store-operations API / merchant_store_availability)
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [mxDeliveryEnabled, setMxDeliveryEnabled] = useState(false)
  const [openingTime, setOpeningTime] = useState('09:00')
  const [closingTime, setClosingTime] = useState('23:00')
  const [todayDate, setTodayDate] = useState('')
  const [todaySlots, setTodaySlots] = useState<{ start: string; end: string }[]>([])
  const [lastToggleBy, setLastToggleBy] = useState<string | null>(null)
  const [lastToggleType, setLastToggleType] = useState<string | null>(null)
  const [lastToggledByName, setLastToggledByName] = useState<string | null>(null)
  const [lastToggledById, setLastToggledById] = useState<string | null>(null)
  const [restrictionType, setRestrictionType] = useState<string | null>(null)
  const [withinHoursButRestricted, setWithinHoursButRestricted] = useState(false)
  const [lastToggledAt, setLastToggledAt] = useState<string | null>(null)
  const [opensAt, setOpensAt] = useState<string | null>(null)
  const [countdownTick, setCountdownTick] = useState(0)

  // Store close: popup modal (no in-card expansion)
  const [showClosePopup, setShowClosePopup] = useState(false)
  const [closeConfirmLoading, setCloseConfirmLoading] = useState(false)
  const [toggleClosureType, setToggleClosureType] = useState<'temporary' | 'today' | 'manual_hold' | null>(null)
  const [closureDate, setClosureDate] = useState<string>('')
  const [closureTime, setClosureTime] = useState<string>('12:00')
  const [statsDate, setStatsDate] = useState<string>('')
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false)
  const [showToggleOnWarning, setShowToggleOnWarning] = useState(false)
  const [toggleOnLoading, setToggleOnLoading] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [modalStatus, setModalStatus] = useState<{ status: string; reason?: string }>({ status: '', reason: '' })
  // Manual close: reason is mandatory
  const [closeReason, setCloseReason] = useState<string>('')
  const [closeReasonOther, setCloseReasonOther] = useState<string>('')
  
  const [pendingOrders, setPendingOrders] = useState(0)
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [preparingOrders, setPreparingOrders] = useState(0)
  const [outForDelivery, setOutForDelivery] = useState(0)
  const [deliveredToday, setDeliveredToday] = useState(0)
  const [cancelledOrders, setCancelledOrders] = useState(0)
  const [revenueToday, setRevenueToday] = useState(0)
  const [avgPrepTime, setAvgPrepTime] = useState(0)
  const [acceptanceRate, setAcceptanceRate] = useState(0)
  const [orderMode, setOrderMode] = useState<'dashboard' | 'pos'>('dashboard')
  const [posIntegrationActive, setPosIntegrationActive] = useState(false)
  const [showPosIntegrateModal, setShowPosIntegrateModal] = useState(false)
  const [ordersTrend, setOrdersTrend] = useState<{ day: string; orders: number }[]>([])
  const [revenueByDay, setRevenueByDay] = useState<{ d: string; rev: number }[]>([])
  const [categoryDistribution, setCategoryDistribution] = useState<{ name: string; value: number; color: string }[]>([])
  const [hourlyHeatmap, setHourlyHeatmap] = useState<{ hour: number; count: number; pct: number }[]>([])
  const [weeklyPerformance, setWeeklyPerformance] = useState<{ w: string; orders: number }[]>([])
  const [deliverySuccessRate, setDeliverySuccessRate] = useState<{ d: string; rate: number }[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [statusLog, setStatusLog] = useState<{ id: number; action: string; restriction_type: string | null; close_reason: string | null; performed_by_name: string | null; performed_by_id: string | null; performed_by_email: string | null; created_at: string }[]>([])

  // Get store ID and default stats date (today)
  useEffect(() => {
    const getStoreId = async () => {
      let id = searchParams?.get('storeId') ?? null

      if (!id) {
        id = typeof window !== 'undefined' ? localStorage.getItem('selectedStoreId') : null
      }

      if (!id) {
        id = DEMO_STORE_ID
      }

      setStoreId(id)
    }

    getStoreId()
  }, [searchParams])

  useEffect(() => {
    if (statsDate === '' && typeof window !== 'undefined') {
      setStatsDate(new Date().toISOString().slice(0, 10))
    }
  }, [])

  // Load store data
  useEffect(() => {
    if (!storeId) return

    const loadStore = async () => {
      setIsLoading(true)
      try {
        let storeData = await fetchStoreById(storeId)

        if (storeData && (storeData as any).notFound) {
          setStore(null)
          toast.error('Your store is not in our database. Please check your registration or contact support.')
          setIsLoading(false)
          return
        }

        if (!storeData && !storeId.match(/^GMM\d{4}$/)) {
          storeData = await fetchStoreByName(storeId)
        }

        if (storeData) {
          setStore(storeData as MerchantStore)
          // Modal logic: if not APPROVED, show modal
          if (storeData.approval_status !== 'APPROVED') {
            setModalStatus({ status: storeData.approval_status ?? '', reason: storeData.approval_reason ?? '' })
            setShowStatusModal(true)
          }
        }
      } catch (error) {
        console.error('Error loading store:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStore()
  }, [storeId])

  // Fetch store operations (same API as Food Orders header) – open/closed, today's slots, activity
  const fetchStoreOperations = React.useCallback(async () => {
    if (!storeId) return
    try {
      const res = await fetch(`/api/store-operations?store_id=${encodeURIComponent(storeId)}`)
      const data = await res.json()
      if (res.ok) {
        setIsStoreOpen(data.operational_status === 'OPEN')
        setOpensAt(data.opens_at ?? null)
        setTodayDate(data.today_date || '')
        setTodaySlots(data.today_slots || [])
        setLastToggleBy(data.last_toggled_by_email || null)
        setLastToggleType(data.last_toggle_type || null)
        setLastToggledByName(data.last_toggled_by_name || null)
        setLastToggledById(data.last_toggled_by_id || null)
        setRestrictionType(data.restriction_type || null)
        setWithinHoursButRestricted(data.within_hours_but_restricted === true)
        setLastToggledAt(data.last_toggled_at || null)
        if ((data.today_slots?.length ?? 0) > 0) {
          const first = data.today_slots[0]
          setOpeningTime(first.start || '09:00')
          setClosingTime(first.end || '23:00')
        }
      }
    } catch {
      // keep current state
    }
  }, [storeId])

  useEffect(() => {
    if (storeId) fetchStoreOperations()
  }, [storeId, fetchStoreOperations])

  // When close popup opens, set default date (today, local) and time (now + 10 min) for Temporary Closed
  useEffect(() => {
    if (showClosePopup) {
      const now = new Date()
      const y = now.getFullYear()
      const m = (now.getMonth() + 1).toString().padStart(2, '0')
      const d = now.getDate().toString().padStart(2, '0')
      setClosureDate(`${y}-${m}-${d}`)
      const in10 = new Date(now.getTime() + 10 * 60 * 1000)
      setClosureTime(`${in10.getHours().toString().padStart(2, '0')}:${in10.getMinutes().toString().padStart(2, '0')}`)
    }
  }, [showClosePopup])

  // Realtime: update store status when DB changes (no refresh)
  const storeInternalId = (store as { id?: number } | null)?.id ?? null
  useEffect(() => {
    if (!storeInternalId || !storeId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`dashboard_store:${storeInternalId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchant_stores', filter: `id=eq.${storeInternalId}` }, () => { fetchStoreOperations() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchant_store_availability', filter: `store_id=eq.${storeInternalId}` }, () => { fetchStoreOperations() })
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [storeInternalId, storeId, fetchStoreOperations])

  // Live countdown: update every 1s; when it hits zero, refetch so status flips to Open without refresh
  useEffect(() => {
    if (!isStoreOpen && opensAt && !withinHoursButRestricted) {
      const t = setInterval(() => {
        const ms = new Date(opensAt).getTime() - Date.now()
        if (ms <= 0) {
          fetchStoreOperations()
          return
        }
        setCountdownTick((n) => n + 1)
      }, 1000)
      return () => clearInterval(t)
    }
  }, [isStoreOpen, opensAt, withinHoursButRestricted, fetchStoreOperations])

  // Delivery mode from merchant_store_settings (self_delivery)
  const fetchDeliverySettings = React.useCallback(async () => {
    if (!storeId) return
    try {
      const res = await fetch(`/api/merchant/store-settings?storeId=${encodeURIComponent(storeId)}`)
      const data = await res.json()
      if (res.ok) setMxDeliveryEnabled(data.self_delivery === true)
    } catch {
      // keep default false
    }
  }, [storeId])

  useEffect(() => {
    fetchDeliverySettings()
  }, [fetchDeliverySettings])

  // Store status log for Recent activities & Audit log
  useEffect(() => {
    if (!storeId) return
    fetch(`/api/merchant/store-status-log?storeId=${encodeURIComponent(storeId)}&limit=30`)
      .then((res) => res.json())
      .then((data) => { if (data.logs) setStatusLog(data.logs); })
      .catch(() => setStatusLog([]))
  }, [storeId, isStoreOpen])

  // KPIs from same source as Orders page: /api/food-orders/stats (orders_food); optional date filter
  const fetchStats = React.useCallback(async () => {
    if (!storeId) return
    try {
      const url = statsDate
        ? `/api/food-orders/stats?store_id=${encodeURIComponent(storeId)}&date=${encodeURIComponent(statsDate)}`
        : `/api/food-orders/stats?store_id=${encodeURIComponent(storeId)}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) {
        setPendingOrders(data.pendingCount ?? 0)
        setAcceptedCount(data.acceptedTodayCount ?? 0)
        setPreparingOrders(data.preparingCount ?? 0)
        setOutForDelivery(data.outForDeliveryCount ?? 0)
        setDeliveredToday(data.deliveredTodayCount ?? 0)
        setCancelledOrders(data.cancelledTodayCount ?? 0)
        setRevenueToday(data.totalRevenueToday ?? 0)
        setAvgPrepTime(data.avgPreparationTimeMinutes ?? 0)
        setAcceptanceRate(data.acceptanceRatePercent ?? 0)
      }
    } catch {
      // keep current state
    }
  }, [storeId, statsDate])

  // Charts from dashboard-analytics (orders_food, last 7 days / 4 weeks)
  const fetchCharts = React.useCallback(async () => {
    if (!storeId) return
    setAnalyticsLoading(true)
    fetch(`/api/dashboard-analytics?store_id=${encodeURIComponent(storeId)}`)
      .then((res) => res.json())
      .then((data) => {
        setOrdersTrend(Array.isArray(data.ordersTrend) ? data.ordersTrend : [])
        setRevenueByDay(Array.isArray(data.revenueByDay) ? data.revenueByDay : [])
        setCategoryDistribution(Array.isArray(data.categoryDistribution) ? data.categoryDistribution : [])
        setHourlyHeatmap(Array.isArray(data.hourlyHeatmap) ? data.hourlyHeatmap : [])
        setWeeklyPerformance(Array.isArray(data.weeklyPerformance) ? data.weeklyPerformance : [])
        setDeliverySuccessRate(Array.isArray(data.deliverySuccessRate) ? data.deliverySuccessRate : [])
      })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, [storeId])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 15000)
    return () => clearInterval(t)
  }, [fetchStats])

  useEffect(() => {
    fetchCharts()
  }, [fetchCharts])

  // Fetch POS integration status for this store (and refetch when window regains focus, e.g. after returning from Store Settings)
  useEffect(() => {
    if (!storeId) return
    const checkPos = async () => {
      try {
        const res = await fetch(`/api/merchant/pos-integration?storeId=${encodeURIComponent(storeId)}`)
        if (res.ok) {
          const data = await res.json()
          setPosIntegrationActive(data?.active === true)
        }
      } catch {
        setPosIntegrationActive(false)
      }
    }
    checkPos()
    const onFocus = () => checkPos()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [storeId])
  
  const handleSwitchOrderMode = () => {
    if (orderMode === 'dashboard') {
      if (!posIntegrationActive) {
        setShowPosIntegrateModal(true)
        return
      }
      setOrderMode('pos')
      toast.success('Switched to POS. Orders will be managed via your POS.')
    } else {
      setOrderMode('dashboard')
      toast.success('Switched to GatiMitra Dashboard orders.')
    }
  }
  
  // Status Modal Component
  const StatusModal = () => {
    if (!showStatusModal) return null
    
    // Determine color based on status
    const getStatusColor = () => {
      switch(modalStatus.status) {
        case 'SUBMITTED': return 'text-blue-600'
        case 'UNDER_VERIFICATION': return 'text-yellow-600'
        case 'REJECTED': return 'text-red-600'
        case 'ERROR': return 'text-red-600'
        default: return 'text-gray-700'
      }
    }
    
    return (
      <Dialog 
        open={showStatusModal} 
        onClose={() => {}} 
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white/95 backdrop-blur-md p-8 shadow-2xl border border-gray-200">
            {/* Store Status Title with Color */}
            <Dialog.Title className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>
              Store Status
            </Dialog.Title>
            
            <div className="mb-6">
              {modalStatus.status === 'SUBMITTED' && (
                <div className="space-y-2">
                  <span className="text-lg font-semibold text-blue-700">📋 Submission Received</span>
                  <p className="text-sm text-gray-600">Your store is submitted and under review. We'll notify you once verified.</p>
                </div>
              )}
              {modalStatus.status === 'UNDER_VERIFICATION' && (
                <div className="space-y-2">
                  <span className="text-lg font-semibold text-yellow-700">🔍 Verification in Progress</span>
                  <p className="text-sm text-gray-600">Our team is currently verifying your store details. This usually takes 24-48 hours.</p>
                </div>
              )}
              {modalStatus.status === 'REJECTED' && (
                <div className="space-y-2">
                  <span className="text-lg font-semibold text-red-700">❌ Registration Rejected</span>
                  <p className="text-sm text-gray-600">Your store registration could not be approved.</p>
                </div>
              )}
              {modalStatus.status === 'ERROR' && (
                <div className="space-y-2">
                  <span className="text-lg font-semibold text-red-700">⚠️ Error Occurred</span>
                  <p className="text-sm text-gray-600">{modalStatus.reason}</p>
                </div>
              )}
              
              {/* Fallback for unknown status */}
              {modalStatus.status && !['SUBMITTED','UNDER_VERIFICATION','REJECTED','ERROR'].includes(modalStatus.status) && (
                <div className="space-y-2">
                  <span className="text-lg font-semibold text-gray-700">📊 Status: {modalStatus.status}</span>
                  {modalStatus.reason && (
                    <p className="text-sm text-gray-600">{modalStatus.reason}</p>
                  )}
                </div>
              )}
              
              {modalStatus.reason && modalStatus.status === 'REJECTED' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800">Reason for rejection:</p>
                  <p className="text-sm text-red-700 mt-1">{modalStatus.reason}</p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => {
                setShowStatusModal(false)
                router.push('/auth/search')
              }}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
            >
              Back to Home
            </button>
          </Dialog.Panel>
        </div>
      </Dialog>
    )
  }

  const handleStoreToggle = () => {
    if (isStoreOpen) {
      setShowClosePopup(true)
      setToggleClosureType(null)
    } else {
      setShowToggleOnWarning(true)
    }
  }

  const handleConfirmToggleOn = async () => {
    if (!storeId) return
    setToggleOnLoading(true)
    try {
      const res = await fetch('/api/store-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, action: 'manual_open' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        await fetchStoreOperations()
        setShowToggleOnWarning(false)
        toast.success('Store is now OPEN. Orders are being accepted!')
      } else {
        toast.error(data.error || 'Failed to open store')
      }
    } catch {
      toast.error('Failed to open store')
    } finally {
      setToggleOnLoading(false)
    }
  }

  const handleClosePopupConfirm = () => {
    if (!toggleClosureType) {
      toast.error('Please select closure type')
      return
    }
    if (toggleClosureType === 'temporary') {
      if (!closureDate || !closureTime) {
        toast.error('Please select date and time for reopening')
        return
      }
      const closedUntil = new Date(`${closureDate}T${closureTime}:00`)
      if (closedUntil.getTime() <= Date.now()) {
        toast.error('Reopening date and time must be in the future')
        return
      }
    }
    if (!closeReason || closeReason.trim() === '') {
      toast.error('Please select a reason for closing')
      return
    }
    if (closeReason === 'Other' && (!closeReasonOther || closeReasonOther.trim() === '')) {
      toast.error('Please enter the reason in "Other"')
      return
    }
    void handleFinalCloseConfirm()
  }

  const handleFinalCloseConfirm = async () => {
    if (!storeId || !toggleClosureType) return
    setCloseConfirmLoading(true)

    const now = new Date()
    let durationMinutes: number | undefined

    if (toggleClosureType === 'temporary') {
      const closedUntil = new Date(`${closureDate}T${closureTime}:00`)
      durationMinutes = Math.max(1, Math.round((closedUntil.getTime() - now.getTime()) / (1000 * 60)))
    } else if (toggleClosureType === 'today') {
      const [h, m] = openingTime.split(':').map(Number)
      const tomorrowOpen = new Date(now)
      tomorrowOpen.setDate(tomorrowOpen.getDate() + 1)
      tomorrowOpen.setHours(h, m, 0, 0)
      durationMinutes = Math.max(1, Math.round((tomorrowOpen.getTime() - now.getTime()) / (1000 * 60)))
    }
    // manual_hold: no duration; API will set block_auto_open

    const reasonText = closeReason === 'Other' ? (closeReasonOther?.trim() || 'Other') : closeReason
    const body: { store_id: string; action: string; closure_type: string; duration_minutes?: number; close_reason?: string } = {
      store_id: storeId,
      action: 'manual_close',
      closure_type: toggleClosureType,
      close_reason: reasonText,
    }
    if (durationMinutes != null) body.duration_minutes = durationMinutes

    try {
      const res = await fetch('/api/store-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        await fetchStoreOperations()
        setShowClosePopup(false)
        setToggleClosureType(null)
        setCloseReason('')
        setCloseReasonOther('')
        if (toggleClosureType === 'manual_hold') toast.success('Store closed. It will only open when you turn it ON.')
        else if (toggleClosureType === 'temporary') {
          const until = new Date(`${closureDate}T${closureTime}:00`)
          toast.success(`Store closed until ${until.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. You can also turn it ON manually anytime.`)
        } else toast.success(`Store closed for today. Reopens tomorrow at ${openingTime}`)
      } else {
        toast.error(data.error || 'Failed to close store')
      }
    } catch {
      toast.error('Failed to close store')
    } finally {
      setCloseConfirmLoading(false)
    }
  }

  const handleCancelClosePopup = () => {
    if (closeConfirmLoading) return
    setShowClosePopup(false)
    setToggleClosureType(null)
    setClosureDate('')
    setClosureTime('12:00')
    setCloseReason('')
    setCloseReasonOther('')
  }

  const handleMXDeliveryToggle = async () => {
    const newValue = !mxDeliveryEnabled
    try {
      const res = await fetch('/api/merchant/store-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: storeId || '', self_delivery: newValue }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMxDeliveryEnabled(newValue)
        toast.success(newValue ? '✅ Self Delivery enabled' : '✅ GatiMitra Delivery enabled')
      } else {
        toast.error(data.error || 'Failed to update delivery mode')
      }
    } catch {
      toast.error('Failed to update delivery mode')
    }
  }

  if (isLoading) {
    return (
      <MXLayoutWhite restaurantName={store?.store_name} restaurantId={storeId || ''}>
        <PageSkeletonDashboard />
      </MXLayoutWhite>
    )
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'backdrop-blur-sm bg-white/95',
          duration: 4000,
        }}
      />
      <StatusModal />
      {/* POS not integrated – block switch until integration is active */}
      {showPosIntegrateModal && (
        <Dialog open={showPosIntegrateModal} onClose={() => setShowPosIntegrateModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-100">
                  <Smartphone size={24} className="text-amber-600" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">Integrate POS first</Dialog.Title>
                  <p className="text-sm text-gray-600">Switch to POS only after integration is active</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                Complete POS registration in Store Settings and ask your POS partner to initiate the integration. Once it is active, you can switch to &quot;Orders managed via POS&quot; from the dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPosIntegrateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPosIntegrateModal(false)
                    router.push('/mx/store-settings?tab=pos')
                  }}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700"
                >
                  Go to POS setup
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
      {/* Store close options – popup; z-[100] so overlay covers and blurs sidebar */}
      {showClosePopup && (
        <Dialog open={showClosePopup} onClose={handleCancelClosePopup} className="relative z-[100]">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200">
              <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">How would you like to close your store?</Dialog.Title>
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 ${toggleClosureType === 'temporary' ? 'bg-orange-50 border-orange-400' : 'border-gray-200 hover:border-orange-200'}`}>
                  <input type="radio" name="closureType" checked={toggleClosureType === 'temporary'} onChange={() => setToggleClosureType('temporary')} className="w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Temporary Closed</p>
                    <p className="text-xs text-gray-600">Close until a specific date and time. Reopens automatically then, or turn ON manually anytime.</p>
                  </div>
                </label>
                {toggleClosureType === 'temporary' && (
                  <div className="ml-7 space-y-3 p-3 rounded-lg bg-orange-50/50 border border-orange-200">
                    <p className="text-xs font-semibold text-gray-700">Reopen on (date and time):</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-gray-500 block mb-1">Date</label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => setClosureDate(e.target.value)}
                          min={(() => {
                            const n = new Date()
                            return `${n.getFullYear()}-${(n.getMonth() + 1).toString().padStart(2, '0')}-${n.getDate().toString().padStart(2, '0')}`
                          })()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-gray-500 block mb-1">Time</label>
                        <input
                          type="time"
                          value={closureTime}
                          onChange={(e) => setClosureTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-600">Store stays closed until this date & time, or until you turn it ON manually.</p>
                  </div>
                )}
                <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 ${toggleClosureType === 'today' ? 'bg-red-50 border-red-400' : 'border-gray-200 hover:border-red-200'}`}>
                  <input type="radio" name="closureType" checked={toggleClosureType === 'today'} onChange={() => setToggleClosureType('today')} className="w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Close for Today</p>
                    <p className="text-xs text-gray-600">Reopen tomorrow at {formatTimeHMS(openingTime)}</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 ${toggleClosureType === 'manual_hold' ? 'bg-amber-50 border-amber-400' : 'border-gray-200 hover:border-amber-200'}`}>
                  <input type="radio" name="closureType" checked={toggleClosureType === 'manual_hold'} onChange={() => setToggleClosureType('manual_hold')} className="w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Until I manually turn it ON</p>
                    <p className="text-xs text-gray-600">Store stays OFF even during operating hours until you turn it ON</p>
                  </div>
                </label>
              </div>
              {/* Reason for closing (mandatory when manually closing) */}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold text-gray-700 block">
                  Reason for closing <span className="text-red-500">*</span>
                </label>
                <select
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="">Select reason</option>
                  <option value="Staff shortage">Staff shortage</option>
                  <option value="Inventory restock">Inventory restock</option>
                  <option value="Device issue / electricity">Device issue / electricity</option>
                  <option value="Run out of Gas">Run out of Gas</option>
                  <option value="Payment issue">Payment issue</option>
                  <option value="Rush of offline orders">Rush of offline orders</option>
                  <option value="Equipment issue">Equipment issue</option>
                  <option value="Holiday / Off">Holiday / Off</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Personal / Emergency">Personal / Emergency</option>
                  <option value="Kitchen / Prep area issue">Kitchen / Prep area issue</option>
                  <option value="Supplier delay">Supplier delay</option>
                  <option value="Other">Other</option>
                </select>
                {closeReason === 'Other' && (
                  <input
                    type="text"
                    value={closeReasonOther}
                    onChange={(e) => setCloseReasonOther(e.target.value)}
                    placeholder="Enter reason"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={handleCancelClosePopup} disabled={closeConfirmLoading} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={handleClosePopupConfirm} disabled={!toggleClosureType || !closeReason?.trim() || (closeReason === 'Other' && !closeReasonOther?.trim()) || (toggleClosureType === 'temporary' && (!closureDate || !closureTime)) || closeConfirmLoading} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                  {closeConfirmLoading ? <><Loader2 size={18} className="animate-spin" /> Confirming...</> : 'Confirm'}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
      {/* Turn Store ON modal: outside layout so overlay covers full viewport (including sidebar) */}
      {showToggleOnWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[100] p-4" aria-hidden="true">
          <div className="backdrop-blur-md bg-white/95 rounded-2xl shadow-2xl max-w-sm w-full p-6 border-2 border-emerald-200">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-50 flex items-center justify-center">
                <Power size={28} className="text-emerald-600" />
              </div>
            </div>

            <div className="text-center space-y-2 mb-6">
              <h3 className="text-lg font-bold text-gray-900">Turn Store ON?</h3>
              <p className="text-sm text-gray-600">
                Your store will be OPEN and customers can place orders. Make sure you&apos;re ready to accept orders!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 mb-6">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ <strong>Orders will start coming immediately!</strong> Be prepared to receive and process them.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => !toggleOnLoading && setShowToggleOnWarning(false)}
                disabled={toggleOnLoading}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-semibold hover:bg-gray-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggleOn}
                disabled={toggleOnLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-md hover:shadow-lg disabled:opacity-80 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {toggleOnLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Turning ON...
                  </>
                ) : (
                  'Yes, Turn ON'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <MXLayoutWhite
        restaurantName={store?.store_name || 'Dashboard'}
        restaurantId={storeId || DEMO_STORE_ID}
      >
        <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] overflow-hidden w-full">
          <div className="dashboard-scroll hide-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-5">
            <div className="max-w-[1600px] mx-auto space-y-5">
              {/* Compact header – minimal height */}
              <div className="shrink-0 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-1.5 bg-[#f8fafc] border-b border-gray-200/60">
                <div className="flex items-center justify-between gap-2">
                  {/* Spacer for hamburger menu on left (mobile) */}
                  <div className="md:hidden w-12"></div>
                  {/* Heading on right for mobile, left for desktop */}
                  <div className="ml-auto md:ml-0">
                    <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Dashboard</h1>
                    <p className="text-[10px] text-gray-500">GatiMitra · Operations command center</p>
                  </div>
                </div>
              </div>

              {/* Three compact cards: Ordering mode | Store Status | Delivery status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ordering mode */}
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-500/10">
                        <Monitor size={16} className="text-orange-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Ordering mode</p>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[120px]">
                          {orderMode === 'dashboard' ? 'GatiMitra Orders' : 'POS'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSwitchOrderMode}
                      className="text-[10px] font-semibold text-orange-600 hover:text-orange-700 px-2 py-1 rounded-lg border border-orange-200 hover:bg-orange-50"
                    >
                      Switch
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {orderMode === 'dashboard' ? 'Receiving in GatiMitra' : 'Via POS'}
                  </p>
                </div>

                {/* Store Status – accountability, restriction badges, color coding */}
                <div className={`rounded-xl border-2 shadow-sm hover:shadow-md transition-all p-4 ${
                  isStoreOpen
                    ? 'bg-gradient-to-br from-emerald-50/90 to-green-50/70 border-emerald-200'
                    : restrictionType === 'MANUAL_HOLD'
                      ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/70 border-amber-300'
                      : 'bg-gradient-to-br from-red-50/90 to-rose-50/70 border-red-200'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Store Status</p>
                      <p className="text-xs font-bold text-gray-900">{formatTimeHMS(openingTime)} – {formatTimeHMS(closingTime)}</p>
                    </div>
                    <button
                      onClick={handleStoreToggle}
                      className={`p-2 rounded-xl shadow-md ${
                        isStoreOpen ? 'bg-emerald-500 text-white hover:bg-emerald-600' : restrictionType === 'MANUAL_HOLD' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      <Power size={18} />
                    </button>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-2 p-2 rounded-lg border ${
                    isStoreOpen ? 'bg-emerald-100/40 border-emerald-300' : restrictionType === 'MANUAL_HOLD' ? 'bg-amber-100/40 border-amber-300' : 'bg-red-100/40 border-red-300'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-emerald-500 animate-pulse' : restrictionType === 'MANUAL_HOLD' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-bold ${
                      isStoreOpen ? 'text-emerald-700' : restrictionType === 'MANUAL_HOLD' ? 'text-amber-800' : 'text-red-700'
                    }`}>
                      {isStoreOpen ? 'Open' : restrictionType === 'MANUAL_HOLD' ? 'Waiting manual activation' : 'Closed'}
                    </span>
                  </div>
                  {!isStoreOpen && restrictionType && (
                    <p className="text-[10px] font-medium mt-1.5">
                      {restrictionType === 'TEMPORARY' && <span className="text-orange-700">Temporarily closed</span>}
                      {restrictionType === 'CLOSED_TODAY' && <span className="text-red-700">Closed for today</span>}
                      {restrictionType === 'MANUAL_HOLD' && <span className="text-amber-700">Waiting manual activation</span>}
                    </p>
                  )}
                  {!isStoreOpen && (() => {
                    const lastClosed = statusLog.find((l) => l.action === 'CLOSED')
                    return lastClosed?.close_reason ? (
                      <p className="text-[10px] font-medium mt-1.5 text-gray-700 bg-white/60 rounded px-2 py-1 border border-gray-200/80">
                        Reason: <span className="font-semibold text-gray-900">{lastClosed.close_reason}</span>
                      </p>
                    ) : null
                  })()}
                  {(lastToggledByName || lastToggleBy || lastToggleType) && lastToggledAt && (
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      Last: {lastToggleType === 'AUTO_OPEN' ? 'Auto on' : lastToggleType === 'AUTO_CLOSE' ? 'Auto closed' : (
                        <>{isStoreOpen ? 'Opened' : 'Closed'} by {lastToggledByName || lastToggleBy || 'Merchant'}{lastToggledById ? ` (ID: ${lastToggledById})` : ''} · {new Date(lastToggledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</>
                      )}
                    </p>
                  )}
                  {withinHoursButRestricted && (
                    <p className="text-[10px] text-amber-800 mt-1.5 font-medium bg-amber-100/60 rounded px-2 py-1">Store is within operating hours but remains OFF due to manual restriction.</p>
                  )}
                  {!isStoreOpen && opensAt && !withinHoursButRestricted && (() => {
                    const ms = new Date(opensAt).getTime() - Date.now()
                    if (ms <= 0) return <p className="text-[10px] text-red-600 mt-1 font-medium">Opens now</p>
                    const h = Math.floor(ms / 3600000)
                    const m = Math.floor((ms % 3600000) / 60000)
                    const s = Math.floor((ms % 60000) / 1000)
                    if (h === 0 && m === 0 && s === 0) return <p className="text-[10px] text-red-600 mt-1 font-medium">Opens now</p>
                    return (
                      <p className="text-[10px] text-red-700 mt-1 font-medium" title="Updates every second. Store will open automatically at zero.">
                        Opens in {h}h {m}m {s}s
                      </p>
                    )
                  })()}
                  {todayDate && (isStoreOpen || !opensAt) && !withinHoursButRestricted && (
                    <p className="text-[10px] text-gray-500 mt-1 truncate">
                      {todaySlots.length > 0 ? todaySlots.map((s) => `${formatTimeHMS(s.start)}–${formatTimeHMS(s.end)}`).join(', ') : 'No slots'}
                    </p>
                  )}
                </div>

                {/* Delivery status */}
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-violet-500/10">
                        <Truck size={16} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Delivery mode</p>
                        <p className="text-xs font-bold text-gray-900">
                          {mxDeliveryEnabled ? 'Self delivery' : 'GatiMitra Delivery'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleMXDeliveryToggle}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mxDeliveryEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform ${mxDeliveryEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {mxDeliveryEnabled ? 'Your riders' : 'Platform riders'}
                  </p>
                </div>
              </div>

              {/* ═══ DATE FILTER + ORDER FLOW (one horizontal line, order flow full width right) ═══ */}
              <div className="flex flex-wrap items-stretch gap-4 mb-2">
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar size={16} className="text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Date:</span>
                  <input
                    type="date"
                    value={statsDate}
                    onChange={(e) => setStatsDate(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setStatsDate(new Date().toISOString().slice(0, 10))}
                    className="text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    Today
                  </button>
                </div>
                <div className="flex-1 min-w-[280px] bg-gradient-to-r from-white to-slate-50/80 rounded-xl border border-orange-200/60 shadow-md hover:shadow-lg transition-shadow px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-4 rounded-full bg-orange-500" />
                    Order flow {statsDate ? `(${statsDate})` : ''}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 py-1">
                    {['Placed', 'Accepted', 'Preparing', 'Delivered'].map((step, i) => (
                      <React.Fragment key={step}>
                        <div className="flex items-center gap-2 group">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-transform group-hover:scale-105 ${i === 0 ? 'bg-orange-500 text-white ring-2 ring-orange-200' : i === 3 ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                            {[pendingOrders, acceptedCount, preparingOrders, deliveredToday][i]}
                          </div>
                          <span className="text-xs font-semibold text-gray-800">{step}</span>
                        </div>
                        {i < 3 && <ArrowRight size={14} className="text-orange-300 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* ═══ TOP KPI METRICS (8 compact cards) ═══ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <StatCard title="Pending" value={pendingOrders} icon={<Package size={18} />} color="orange" />
                <StatCard title="Preparing" value={preparingOrders} icon={<Users size={18} />} color="blue" />
                <StatCard title="Out for Delivery" value={outForDelivery} icon={<Truck size={18} />} color="purple" />
                <StatCard title="Delivered Today" value={deliveredToday} icon={<TrendingUp size={18} />} color="emerald" />
                <StatCard title="Cancelled" value={cancelledOrders} icon={<XCircle size={18} />} color="orange" />
                <StatCard title="Today's Revenue" value={`₹${(revenueToday / 1000).toFixed(0)}k`} icon={<BarChart3 size={18} />} color="purple" />
                <StatCard title="Avg Prep (min)" value={avgPrepTime} icon={<Clock size={18} />} color="blue" />
                <StatCard title="Acceptance %" value={`${acceptanceRate}%`} icon={<CheckCircle2 size={18} />} color="emerald" />
              </div>

              {/* ═══ ANALYTICS & GRAPHS (from orders_food) ═══ */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Orders trend (last 7 days)</h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ordersTrend.length ? ordersTrend : [{ day: 'Mon', orders: 0 }, { day: 'Tue', orders: 0 }, { day: 'Wed', orders: 0 }, { day: 'Thu', orders: 0 }, { day: 'Fri', orders: 0 }, { day: 'Sat', orders: 0 }, { day: 'Sun', orders: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Revenue analytics</h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueByDay.length ? revenueByDay : [{ d: 'Mon', rev: 0 }, { d: 'Tue', rev: 0 }, { d: 'Wed', rev: 0 }, { d: 'Thu', rev: 0 }, { d: 'Fri', rev: 0 }, { d: 'Sat', rev: 0 }, { d: 'Sun', rev: 0 }]}>
                        <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="d" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Area type="monotone" dataKey="rev" stroke="#8b5cf6" fill="url(#revGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Order category distribution (Veg / Non-Veg)</h3>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryDistribution.length ? categoryDistribution : [{ name: 'No data', value: 1, color: '#e2e8f0' }]} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                          {(categoryDistribution.length ? categoryDistribution : [{ name: 'No data', value: 1, color: '#e2e8f0' }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Hourly order heatmap</h3>
                  <div className="flex items-end gap-1 h-[100px]">
                    {(hourlyHeatmap.length ? hourlyHeatmap : [10,11,12,13,14,15,16,17,18,19,20,21].map((hour) => ({ hour, count: 0, pct: 0 }))).map((item, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                        <div className="w-full rounded-t bg-orange-400 min-h-[6px]" style={{ height: `${item.pct || 0}%` }} title={`${item.hour}:00 · ${item.count || 0} orders`} />
                        <span className="text-[9px] text-gray-500">{item.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Weekly performance</h3>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyPerformance.length ? weeklyPerformance : [{ w: 'W1', orders: 0 }, { w: 'W2', orders: 0 }, { w: 'W3', orders: 0 }, { w: 'W4', orders: 0 }]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <XAxis dataKey="w" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 11 }} />
                        <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery success rate (last 7 days)</h3>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={deliverySuccessRate.length ? deliverySuccessRate : [{ d: 'Mon', rate: 100 }, { d: 'Tue', rate: 100 }, { d: 'Wed', rate: 100 }, { d: 'Thu', rate: 100 }, { d: 'Fri', rate: 100 }, { d: 'Sat', rate: 100 }, { d: 'Sun', rate: 100 }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: unknown) => [String(v) + '%', 'Success rate']} />
                      <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ═══ RECENT ACTIVITIES (from merchant_store_status_log) ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Recent activities</h3>
                  <div className="overflow-x-auto max-h-[260px] overflow-y-auto hide-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-2 font-semibold text-gray-600 w-16">Time</th>
                          <th className="py-2 px-2 font-semibold text-gray-600">Action</th>
                          <th className="py-2 px-2 font-semibold text-gray-600">By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusLog.length === 0 ? (
                          <tr><td colSpan={3} className="py-4 px-2 text-gray-500 text-center">No activity yet. Store open/close will appear here.</td></tr>
                        ) : (
                          statusLog.map((log) => (
                            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                              <td className="py-2 px-2">
                                <span className={log.action === 'OPEN' ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{log.action === 'OPEN' ? 'Store opened' : 'Store closed'}</span>
                                {log.restriction_type && <span className="text-gray-500 ml-1">({log.restriction_type.replace('_', ' ')})</span>}
                                {log.action === 'CLOSED' && log.close_reason && <span className="text-gray-500 ml-1">· {log.close_reason}</span>}
                              </td>
                              <td className="py-2 px-2 text-gray-700">{log.performed_by_name || log.performed_by_email || '—'}{log.performed_by_id ? ` (${log.performed_by_id})` : ''}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900">Audit log snapshot</h3>
                    <Link href={storeId ? `/mx/audit-logs?storeId=${encodeURIComponent(storeId)}` : '/mx/audit-logs'} className="text-xs font-semibold text-orange-600 hover:text-orange-700">View full audit logs</Link>
                  </div>
                  <div className="overflow-x-auto max-h-[260px] overflow-y-auto hide-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-2 font-semibold text-gray-600">Who</th>
                          <th className="py-2 px-2 font-semibold text-gray-600">Action</th>
                          <th className="py-2 px-2 font-semibold text-gray-600">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusLog.length === 0 ? (
                          <tr><td colSpan={3} className="py-4 px-2 text-gray-500 text-center">No audit entries yet.</td></tr>
                        ) : (
                          statusLog.slice(0, 15).map((log) => (
                            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-2 px-2 font-medium text-gray-900">{log.performed_by_name || log.performed_by_email || 'System'}{log.performed_by_id ? ` (ID: ${log.performed_by_id})` : ''}</td>
                              <td className="py-2 px-2 text-gray-700">{log.action === 'OPEN' ? 'Store opened' : 'Store closed'}{log.restriction_type ? ` · ${log.restriction_type}` : ''}{log.action === 'CLOSED' && log.close_reason ? ` · ${log.close_reason}` : ''}</td>
                              <td className="py-2 px-2 text-gray-500">{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ═══ PERFORMANCE INSIGHTS (from orders_food KPIs) + QUICK ACTIONS ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Performance insights</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="py-2 px-2 text-left font-semibold text-gray-600">Metric</th>
                          <th className="py-2 px-2 text-right font-semibold text-gray-600">Today</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Pending orders</td><td className="py-2 px-2 text-right font-medium">{pendingOrders}</td></tr>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Preparing</td><td className="py-2 px-2 text-right font-medium">{preparingOrders}</td></tr>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Delivered today</td><td className="py-2 px-2 text-right font-medium text-emerald-600">{deliveredToday}</td></tr>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Cancelled today</td><td className="py-2 px-2 text-right font-medium text-red-600">{cancelledOrders}</td></tr>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Revenue today</td><td className="py-2 px-2 text-right font-medium">₹{revenueToday.toLocaleString()}</td></tr>
                        <tr className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">Avg prep (min)</td><td className="py-2 px-2 text-right font-medium">{avgPrepTime}</td></tr>
                        <tr><td className="py-2 px-2 text-gray-700">Acceptance rate</td><td className="py-2 px-2 text-right font-medium text-emerald-600">{acceptanceRate}%</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Quick actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                      <Pause size={16} /> Pause orders
                    </button>
                    <button onClick={() => router.push('/mx/menu')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-sm font-medium text-orange-700 transition-colors">
                      <UtensilsCrossed size={16} /> Update menu
                    </button>
                    <button onClick={() => router.push('/mx/offers')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-sm font-medium text-violet-700 transition-colors">
                      <Tag size={16} /> Add offer
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                      <FileBarChart size={16} /> View reports
                    </button>
                    <button onClick={handleSwitchOrderMode} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-sm font-medium text-amber-700 transition-colors">
                      <Monitor size={16} /> Switch ordering mode
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </MXLayoutWhite>
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}