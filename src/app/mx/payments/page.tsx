'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { MXLayoutWhite } from '@/components/MXLayoutWhite'
import { fetchRestaurantById, fetchRestaurantByName } from '@/lib/database'
import { Restaurant } from '@/lib/types'
import { DEMO_RESTAURANT_ID } from '@/lib/constants'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { CreditCard, TrendingUp, Package, X, Wallet, ArrowDownToLine } from 'lucide-react'
import { PageSkeletonGeneric } from '@/components/PageSkeleton'
import { Toaster, toast } from 'sonner'
import { MobileHamburgerButton } from '@/components/MobileHamburgerButton'

export const dynamic = 'force-dynamic'

function PaymentsContent() {
  const searchParams = useSearchParams()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // Wallet Balance
  const [walletBalance, setWalletBalance] = useState(45320) // Demo amount

  // Default empty data
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderData, setOrderData] = useState<any[]>([])
  const [deliveryData, setDeliveryData] = useState<any[]>([])
  const [cancelledData, setCancelledData] = useState<any[]>([])

  const [stats, setStats] = useState({
    todayRevenue: 24500,
    todayOrders: 18,
    avgOrderValue: 1361,
    growthPercent: 15,
    paidOrders: 156,
    pendingPayments: 12,
    failedPayments: 2
  })

  useEffect(() => {
    const getRestaurantId = () => {
      let id = searchParams?.get('restaurantId') ?? searchParams?.get('storeId')
      if (!id && typeof window !== 'undefined') {
        id = localStorage.getItem('selectedStoreId') ?? localStorage.getItem('selectedRestaurantId')
      }
      if (!id) id = DEMO_RESTAURANT_ID
      setRestaurantId(id)
    }
    getRestaurantId()
  }, [searchParams])

  useEffect(() => {
    if (!restaurantId) return
    const loadData = async () => {
      setIsLoading(true)
      try {
        let data = await fetchRestaurantById(restaurantId)
        if (!data && !restaurantId.match(/^GMM\d{4}$/)) {
          data = await fetchRestaurantByName(restaurantId)
        }
        if (data) setRestaurant(data as unknown as Restaurant)
      } catch (error) {
        console.error('Error loading payments:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [restaurantId])

  // Add handleWithdrawal function to fix ReferenceError
  const handleWithdrawal = async () => {
    if (!withdrawalAmount) return;
    setIsWithdrawing(true);
    // Simulate withdrawal process
    setTimeout(() => {
      setWalletBalance((prev) => prev - Number(withdrawalAmount));
      setWithdrawalAmount('');
      setShowWithdrawal(false);
      setIsWithdrawing(false);
      toast.success('Withdrawal request submitted!');
    }, 1500);
  }

  if (isLoading) {
    return (
      <MXLayoutWhite restaurantName={restaurant?.restaurant_name} restaurantId={restaurantId || ''}>
        <PageSkeletonGeneric />
      </MXLayoutWhite>
    )
  }

  return (
    <>
      <Toaster />
      <MXLayoutWhite restaurantName={restaurant?.restaurant_name} restaurantId={restaurantId || DEMO_RESTAURANT_ID}>
        <div className="min-h-screen bg-white px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header with Wallet */}
            <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 md:py-5 mb-8">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  {/* Hamburger menu on left (mobile) */}
                  <MobileHamburgerButton />
                  {/* Heading - properly aligned */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Payments & Wallet</h1>
                    <p className="text-sm text-gray-600 mt-0.5">Track revenue and manage your store wallet</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <button
                  onClick={() => setShowWithdrawal(true)}
                  className="px-4 py-2.5 rounded-lg font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
                >
                  <ArrowDownToLine size={18} />
                  Withdraw Money
                </button>
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    showAnalytics
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  {showAnalytics ? '📊 Hide Analytics' : '📊 View Analytics'}
                </button>
              </div>
            </div>
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 overflow-hidden">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="text-white" size={24} />
                      <h2 className="text-xl font-bold text-white">Withdraw Money</h2>
                    </div>
                    <button
                      onClick={() => setShowWithdrawal(false)}
                      className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-4">
                    {/* Wallet Balance */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <p className="text-sm text-emerald-600 font-medium">Available Balance</p>
                      <p className="text-3xl font-bold text-emerald-700 mt-1">₹{walletBalance.toLocaleString('en-IN')}</p>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3.5 text-gray-600 font-medium">₹</span>
                        <input
                          type="number"
                          value={withdrawalAmount}
                          onChange={(e) => setWithdrawalAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                          disabled={isWithdrawing}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Minimum: ₹100 | Maximum: ₹{walletBalance.toLocaleString('en-IN')}</p>
                    </div>

                    {/* Bank Details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Withdraw To</label>
                      <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" disabled>
                        <option>Primary Bank Account (****1234)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Funds will arrive in 2-3 business days</p>
                    </div>

                    {/* Terms */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold">Note:</span> Withdrawal charges may apply. Check your bank's policies.
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-200">
                    <button
                      onClick={() => setShowWithdrawal(false)}
                      disabled={isWithdrawing}
                      className="flex-1 px-4 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleWithdrawal}
                      disabled={isWithdrawing || !withdrawalAmount}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isWithdrawing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Withdraw'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white p-6 mb-8 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Wallet Balance</p>
                  <h2 className="text-4xl font-bold mt-2">₹{walletBalance.toLocaleString('en-IN')}</h2>
                  <p className="text-emerald-100 text-sm mt-1">Ready to withdraw anytime</p>
                </div>
                <Wallet size={64} className="text-emerald-300 opacity-50" />
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-600 font-medium">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.todayRevenue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-emerald-600 mt-2">+12% vs yesterday</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-600 font-medium">Today's Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayOrders}</p>
                <p className="text-xs text-emerald-600 mt-2">+8% vs yesterday</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-600 font-medium">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.avgOrderValue}</p>
                <p className="text-xs text-emerald-600 mt-2">+5% vs yesterday</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-600 font-medium">Growth Rate</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.growthPercent}%</p>
                <p className="text-xs text-gray-600 mt-2">Month on month</p>
              </div>
            </div>

            {/* Payment Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Payment Status Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-200 hover:shadow-md transition-shadow">
                  <p className="text-sm text-emerald-600 font-medium">Paid Orders</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.paidOrders}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200 hover:shadow-md transition-shadow">
                  <p className="text-sm text-yellow-600 font-medium">Pending Payments</p>
                  <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendingPayments}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200 hover:shadow-md transition-shadow">
                  <p className="text-sm text-red-600 font-medium">Failed Payments</p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{stats.failedPayments}</p>
                </div>
              </div>
            </div>

            {showAnalytics && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">📊 Analytics Dashboard</h2>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">💰 Revenue Trend (Last 30 Days)</h3>
                    <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg">
                      No data available
                    </div>
                  </div>

                  {/* Orders Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Daily Orders (Last 30 Days)</h3>
                    <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg">
                      No data available
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </MXLayoutWhite>
    </>
  )
}

import { Suspense } from 'react';

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
