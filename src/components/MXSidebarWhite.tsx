'use client'

import React, { useState, useEffect } from 'react'
import { useMerchantSession } from '@/context/MerchantSessionContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Zap,
  CreditCard,
  Settings,
  User,
  Users,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Store,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import LogoutConfirmModal from './LogoutConfirmModal'

const MOBILE_BREAKPOINT = 767

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: number | string
  submenu?: SidebarItem[]
}

interface MXSidebarWhiteProps {
  restaurantName?: string
  restaurantId?: string
  /** Sidebar position: 'left' (default) or 'right' */
  position?: 'left' | 'right'
  /** When true, show icons only (collapsed mode) */
  collapsed?: boolean
  /** Called when user toggles expand/collapse */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Optional content shown inside the mobile hamburger overlay (e.g. Avg Prep, Revenue, Completion) */
  mobileMenuExtra?: React.ReactNode
  /** Optional filters/stats content shown in sidebar (desktop and mobile) */
  sidebarFilters?: React.ReactNode
}

export const MXSidebarWhite: React.FC<MXSidebarWhiteProps> = ({
  restaurantName = 'Store',
  restaurantId,
  position = 'left',
  collapsed = false,
  onCollapsedChange,
  mobileMenuExtra,
  sidebarFilters,
}) => {
  const isRight = position === 'right';
  // Defer screen size until after mount to avoid hydration mismatch (server has no window).
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsSmallScreen(mq.matches);
    const handler = () => setIsSmallScreen(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // On small/mobile: always collapsed. Use isSmallScreen only after mount so server and first client paint match.
  const effectiveCollapsed = (hasMounted && isSmallScreen) ? true : collapsed;
  const isDesktopSidebar = !(hasMounted && isSmallScreen);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['dashboard']);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // On mobile: keep sidebar closed on any route change and on load/reload (never open automatically).
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  // Listen for custom event to close sidebar from filter buttons
  useEffect(() => {
    const handleCloseSidebar = () => {
      setMobileMenuOpen(false);
    };
    const handleOpenSidebar = () => {
      setMobileMenuOpen(true);
    };
    window.addEventListener('closeMobileSidebar', handleCloseSidebar);
    window.addEventListener('openMobileSidebar', handleOpenSidebar);
    return () => {
      window.removeEventListener('closeMobileSidebar', handleCloseSidebar);
      window.removeEventListener('openMobileSidebar', handleOpenSidebar);
    };
  }, []);

  const merchantSession = useMerchantSession();
  const userEmail = merchantSession?.user?.email ?? merchantSession?.user?.phone ?? 'Merchant';
  const userName = userEmail && userEmail.includes('@') ? userEmail.split('@')[0] : 'Merchant';

  const navigationItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />, 
      href: '/mx/dashboard'
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: <ClipboardList size={20} />, 
      href: '/mx/food-orders'
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: <UtensilsCrossed size={20} />, 
      href: '/mx/menu'
    },
    {
      id: 'offers',
      label: 'Offers',
      icon: <Zap size={20} />, 
      href: '/mx/offers'
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: <CreditCard size={20} />, 
      href: '/mx/payments'
    },
    {
      id: 'user-insights',
      label: 'User Insights',
      icon: <Users size={20} />, 
      href: '/mx/user-insights'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} />, 
      href: '/mx/store-settings'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User size={20} />, 
      href: '/mx/profile'
    }
  ]

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    )
  }

  const isActive = (href: string) => (pathname || '') === href || (pathname || '').startsWith(href + '?')

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('restaurantId')
      localStorage.removeItem('restaurantName')
      localStorage.removeItem('selectedStoreId')
      localStorage.removeItem('storeList')
      if (merchantSession?.logout) {
        await merchantSession.logout()
        return
      }
      router.push('/auth/login')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Error logging out:', errorMessage)
      router.push('/auth/login')
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const NavLinkWithTooltip = ({ item }: { item: SidebarItem }) => {
    const isItemActive = isActive(item.href);
    const link = (
      <Link
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center rounded-lg transition-all duration-200 font-medium text-sm ${
          effectiveCollapsed
            ? 'justify-center w-10 h-10'
            : 'w-full gap-3 px-4 py-3'
        } ${
          isItemActive
            ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-600'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={`flex-shrink-0 ${isItemActive ? 'text-orange-600' : 'text-gray-500'}`}>
          {item.icon}
        </span>
        {!effectiveCollapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
    if (effectiveCollapsed) {
      return (
        <div key={item.id} className="relative group">
          {link}
          {/* Floating card-style tooltip beside icon - only on hover-capable devices */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-[100] pointer-events-none [@media(hover:none)]:hidden">
            <span className="inline-block px-3 py-2 bg-gray-100/95 backdrop-blur-sm border border-gray-200/80 text-gray-800 text-xs font-medium rounded-xl shadow-md whitespace-nowrap">
              {item.label}
            </span>
          </div>
        </div>
      );
    }
    return <div key={item.id}>{link}</div>;
  };

  const SidebarContent = () => (
    <>
      {/* Header: Store icon, store id, name (no collapse button here) */}
      <div className={`flex items-center border-b border-gray-200 ${effectiveCollapsed ? 'justify-center gap-1 p-2' : 'justify-between gap-2 p-6'}`}>
        <div className={`flex items-center ${effectiveCollapsed ? '' : 'gap-3 flex-1 min-w-0'}`}>
          <div className={`rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 ${effectiveCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
            <Store size={effectiveCollapsed ? 16 : 20} className="text-white" />
          </div>
          {!effectiveCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-orange-600">{restaurantId || 'ID'}</p>
              <h1 className="text-sm font-bold text-gray-900 truncate">{restaurantName || 'Store'}</h1>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 hide-scrollbar ${effectiveCollapsed ? 'px-3 py-4 flex flex-col items-center gap-1' : 'p-4 space-y-0.5'}`}>
        {navigationItems.map((item) => (
          <NavLinkWithTooltip key={item.id} item={item} />
        ))}
      </nav>

      {/* Sidebar Filters - shown when not collapsed */}
      {sidebarFilters && !effectiveCollapsed && (
        <div className="px-4 pb-3 border-t border-gray-200">
          <div className="pt-3">
            {sidebarFilters}
          </div>
        </div>
      )}

      {/* Collapse/Expand – just above profile */}
      {onCollapsedChange && isDesktopSidebar && (
        <div className={`border-t border-gray-200 ${effectiveCollapsed ? 'flex justify-center py-2' : 'px-4 py-2'}`}>
          <button
            onClick={() => onCollapsedChange(!effectiveCollapsed)}
            className={`p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 ${effectiveCollapsed ? '' : 'w-full flex items-center justify-center'}`}
            title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {effectiveCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      )}

      {/* Footer: User Profile */}
      <div className={`border-t border-gray-200 ${effectiveCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`relative group ${effectiveCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => setShowProfileMenu((v) => !v)}
            className={`w-full flex items-center rounded-lg transition-colors hover:bg-gray-100 text-sm font-medium focus:outline-none ${
              effectiveCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            {!effectiveCollapsed && (
              <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                <span className="font-semibold text-gray-900 truncate">{userName}</span>
                <span className="text-xs text-gray-500 truncate">{userEmail}</span>
              </div>
            )}
            {!effectiveCollapsed && <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {effectiveCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-[100] pointer-events-none [@media(hover:none)]:hidden">
              <span className="inline-block px-3 py-2 bg-gray-100/95 backdrop-blur-sm border border-gray-200/80 text-gray-800 text-xs font-medium rounded-xl shadow-md whitespace-nowrap">{userName}</span>
            </div>
          )}
          {showProfileMenu && !effectiveCollapsed && (
            <div className="absolute left-0 bottom-14 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fade-in">
              <button
                onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true); }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-red-600 rounded-lg transition-colors hover:bg-red-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )

  // Single return: desktop sidebar (hidden on small) + mobile hamburger (visible only on small).
  // This prevents the icon strip from ever showing on mobile during load/refresh.
  return (
    <>
      {/* Desktop: fixed sidebar — hidden on viewport < 768px so never visible on mobile load */}
      <aside className={`hidden md:flex flex-col h-screen bg-white fixed top-0 z-50 shrink-0 transition-all duration-200 ${effectiveCollapsed ? 'w-16' : 'w-64'} ${isRight ? 'right-0 border-l border-gray-200 shadow-lg' : 'left-0 border-r border-gray-200 shadow-lg'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger + overlay only — visible on viewport < 768px from first paint */}
      <div className="md:hidden">
        {/* Note: Hamburger button is now handled in the page header, not here */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-[55]"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />
            <aside className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white border-r border-gray-200 shadow-xl z-[60] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <Store size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-orange-600">{restaurantId || 'ID'}</p>
                    <h1 className="text-sm font-bold text-gray-900 truncate">{restaurantName || 'Store'}</h1>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="p-3 space-y-0.5">
                {navigationItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        router.push(item.href);
                      }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm ${
                        active
                          ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className={active ? 'text-orange-600' : 'text-gray-500'}>{item.icon}</span>
                      <span>{item.label}</span>
                      {item.badge != null && (
                        <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              {sidebarFilters && (
                <div className="mx-3 mb-3 border-t border-gray-200 pt-3" data-mobile-sidebar>
                  {sidebarFilters}
                </div>
              )}
              {mobileMenuExtra && (
                <div className="mx-3 mb-3 p-3 rounded-xl border border-gray-200 bg-gray-50/90 shadow-sm">
                  {mobileMenuExtra}
                </div>
              )}
              <div className="p-3 border-t border-gray-200">
                <div className="flex items-center gap-3 px-4 py-3 text-gray-700">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setShowLogoutModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-red-600 rounded-lg transition-colors hover:bg-red-50 text-sm font-medium"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </aside>
          </>
        )}
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </>
  )
}
