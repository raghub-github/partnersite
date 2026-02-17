"use client";

import React, { useEffect, useState, useRef } from "react";
import { MXLayoutWhite } from "@/components/MXLayoutWhite";
import { fetchRestaurantById as fetchStoreById, updateStoreInfo } from "@/lib/database";
import { uploadImageToR2 } from "@/lib/uploadImageToR2";
import { MerchantStore } from "@/lib/merchantStore";
import { Toaster, toast } from "sonner";
import { 
  Building, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  User, 
  CheckCircle,
  Shield,
  Package,
  Star,
  FileText,
  Edit2,
  Upload,
  DollarSign,
  Hash,
  Tag,
  Calendar,
  Activity,
  Banknote,
  Map,
  Lock,
  Globe,
  Image as ImageIcon,
  Menu
} from "lucide-react";
import { PageSkeletonProfile } from "@/components/PageSkeleton";

export const dynamic = "force-dynamic";

class ProfileErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    // Optionally log error
    // console.error(error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c', background: '#fff0f0' }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page or contact support if this continues.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================= OPERATING DAYS CARD COMPONENT =================
function OperatingDaysCard({ storeId }: { storeId: string | null }) {
  const [days, setDays] = useState<any[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  
  useEffect(() => {
    if (!storeId) return;
    import("@/lib/database").then(mod => {
      mod.fetchStoreOperatingHours(storeId)
        .then((result) => {
          if (Array.isArray(result)) {
            setDays(result);
            setTotalMinutes(result.reduce((sum: number, d: any) => sum + (d.total_duration_minutes || 0), 0));
          }
        })
        .catch((err) => {
          console.error('Error loading operating hours:', err);
          setDays([]);
          setTotalMinutes(0);
        });
    });
  }, [storeId]);

  function formatSlot(start: string, end: string) {
    if (!start || !end) return null;
    return `${start} - ${end}`;
  }

  function minutesToHours(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  function abbreviateDayLabel(dayLabel: string): string {
    const abbreviations: Record<string, string> = {
      'Monday': 'Mon',
      'Tuesday': 'Tue',
      'Wednesday': 'Wed',
      'Thursday': 'Thu',
      'Friday': 'Fri',
      'Saturday': 'Sat',
      'Sunday': 'Sun'
    };
    return abbreviations[dayLabel] || dayLabel;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          Operating Days
        </h3>
        {totalMinutes > 0 && (
          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
            Total: {minutesToHours(totalMinutes)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {days.map((day: any) => (
          <div key={day.day_label} className="flex items-center justify-between text-xs py-1 px-2 rounded border border-gray-100 bg-white">
            <span className="font-medium w-16 text-gray-900">{abbreviateDayLabel(day.day_label)}</span>
            {day.open ? (
              <span className="text-green-700 font-semibold">Open</span>
            ) : (
              <span className="text-red-500 font-semibold">Closed</span>
            )}
            <span className="text-gray-700 flex flex-col items-start min-w-[120px]">
              {day.open && (
                <>
                  {formatSlot(day.slot1_start, day.slot1_end) && (
                    <span className="text-xs leading-tight">{formatSlot(day.slot1_start, day.slot1_end)}</span>
                  )}
                  {formatSlot(day.slot2_start, day.slot2_end) && (
                    <span className="text-xs leading-tight mt-0.5">{formatSlot(day.slot2_start, day.slot2_end)}</span>
                  )}
                  <span className="text-xs text-gray-500 mt-0.5">({minutesToHours(day.total_duration_minutes)})</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [editData, setEditData] = useState<MerchantStore | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmSave, setConfirmSave] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [bankVerification, setBankVerification] = useState<{
    verified: boolean;
    canTryVerify: boolean;
    attemptsToday: number;
    maxAttemptsPerDay: number;
  } | null>(null);
  const [bankVerifying, setBankVerifying] = useState(false);
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [storeDocuments, setStoreDocuments] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const adsInputRef = useRef<HTMLInputElement>(null);

  /* ===== GET STORE ID ===== */
  useEffect(() => {
    const id = localStorage.getItem("selectedStoreId") || localStorage.getItem("selectedRestaurantId");
    if (!id) {
      toast.error("Store ID not found");
      return;
    }
    setStoreId(id);
  }, []);

  /* ===== FETCH DATA ===== */
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([
      fetchStoreById(storeId),
      import("@/lib/database").then(mod => mod.fetchStoreOperatingHours(storeId).catch(() => [])),
      fetchStoreById(storeId).then(async (storeData) => {
        console.log('Store data fetched:', storeData);
        if (storeData?.id) {
          console.log('Store internal ID:', storeData.id, 'Store ID (public):', storeData.store_id);
          const mod = await import("@/lib/database");
          try {
            const [docs, banks] = await Promise.all([
              mod.fetchStoreDocuments(storeData.id).catch((err) => {
                console.error('Error fetching documents:', err);
                return null;
              }),
              mod.fetchStoreBankAccounts(storeData.id).catch((err) => {
                console.error('Error fetching bank accounts:', err);
                return [];
              })
            ]);
            console.log('Fetched results - Documents:', docs ? 'Found' : 'None', 'Bank Accounts:', banks?.length || 0);
            return { docs, banks };
          } catch (error) {
            console.error('Error in fetch promise:', error);
            return { docs: null, banks: [] };
          }
        } else {
          console.warn('Store data missing id field:', storeData);
        }
        return { docs: null, banks: [] };
      })
    ])
      .then(([storeData, hoursData, { docs, banks }]) => {
        const store = storeData as MerchantStore | null;
        if (store) {
          setStore(store);
          setEditData(store);
        }
        if (hoursData && Array.isArray(hoursData)) {
          setOperatingHours(hoursData);
        }
        if (docs) {
          setStoreDocuments(docs);
        }
        // Always set bank accounts array (even if empty) to ensure state is updated
        const bankAccountsArray = Array.isArray(banks) ? banks : [];
        console.log('Setting bank accounts in state:', bankAccountsArray.length, 'accounts');
        if (bankAccountsArray.length > 0) {
          console.log('Bank accounts data:', JSON.stringify(bankAccountsArray, null, 2));
        } else {
          console.log('No bank accounts found in database');
        }
        setBankAccounts(bankAccountsArray);
      })
      .catch((error) => {
        console.error('Error loading profile:', error);
        toast.error("Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  /* ===== BANK VERIFICATION STATUS ===== */
  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/merchant/bank-account/verify/status?storeId=${encodeURIComponent(storeId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.verified !== undefined) {
          setBankVerification({
            verified: data.verified,
            canTryVerify: data.canTryVerify !== false,
            attemptsToday: data.attemptsToday ?? 0,
            maxAttemptsPerDay: data.maxAttemptsPerDay ?? 3,
          });
        }
      })
      .catch(() => {});
  }, [storeId]);

  /* ===== REFRESH BANK ACCOUNTS WHEN STORE CHANGES ===== */
  useEffect(() => {
    if (!store?.id) {
      console.log('Store ID not available for bank accounts refresh');
      return;
    }
    console.log('Refreshing bank accounts for store ID:', store.id);
    import("@/lib/database").then(async (mod) => {
      try {
        const banks = await mod.fetchStoreBankAccounts(store.id);
        const bankAccountsArray = Array.isArray(banks) ? banks : [];
        console.log('Refreshed bank accounts:', bankAccountsArray.length, 'accounts');
        if (bankAccountsArray.length > 0) {
          console.log('Updating bank accounts state with:', JSON.stringify(bankAccountsArray, null, 2));
        }
        setBankAccounts(bankAccountsArray);
      } catch (error) {
        console.error('Error refreshing bank accounts:', error);
        setBankAccounts([]);
      }
    });
  }, [store?.id]);

  /* ===== STORE NAME LOGIC ===== */
  const storeInitial = store?.store_name?.charAt(0).toUpperCase() || "R";
  const isVerified = store?.approval_status === 'APPROVED';

  /* ===== SAVE CHANGES ===== */
  const handleSave = async () => {
    if (!storeId || !editData) return;

    try {
      const updates = {
        store_name: editData.store_name,
        store_email: editData.store_email,
        store_phones: editData.store_phones,
        store_description: editData.store_description,
        cuisine_types: editData.cuisine_types,
        food_categories: editData.food_categories,
        full_address: editData.full_address,
        city: editData.city,
        state: editData.state,
        landmark: editData.landmark,
        postal_code: editData.postal_code,
        latitude: editData.latitude,
        longitude: editData.longitude,
        gst_number: editData.gst_number,
        pan_number: editData.pan_number,
        aadhar_number: editData.aadhar_number,
        fssai_number: editData.fssai_number,
        bank_account_holder: editData.bank_account_holder,
        bank_account_number: editData.bank_account_number,
        bank_ifsc: editData.bank_ifsc,
        bank_name: editData.bank_name,
        min_order_amount: editData.min_order_amount,
        am_name: editData.am_name,
        am_mobile: editData.am_mobile,
        am_email: editData.am_email,
      };
      await updateStoreInfo(storeId, updates);
      setStore(editData);
      setEditingField(null);
      toast.success("Profile updated successfully");

      const hasBank =
        editData.bank_account_holder &&
        editData.bank_account_number &&
        editData.bank_ifsc &&
        editData.bank_name;
      if (
        hasBank &&
        !bankVerification?.verified &&
        bankVerification?.canTryVerify &&
        !bankVerifying
      ) {
        setBankVerifying(true);
        try {
          const res = await fetch("/api/merchant/bank-account/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              storeId,
              bank: {
                account_holder_name: editData.bank_account_holder,
                account_number: editData.bank_account_number,
                ifsc_code: editData.bank_ifsc,
                bank_name: editData.bank_name,
              },
            }),
          });
          const data = await res.json();
          if (data.success) {
            toast.success(data.message || "We sent ₹1 to verify your account. Check back in a few minutes.");
            setTimeout(() => {
              fetch(`/api/merchant/bank-account/verify/status?storeId=${encodeURIComponent(storeId)}`, {
                credentials: "include",
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.success && d.verified !== undefined) {
                    setBankVerification({
                      verified: d.verified,
                      canTryVerify: d.canTryVerify !== false,
                      attemptsToday: d.attemptsToday ?? 0,
                      maxAttemptsPerDay: d.maxAttemptsPerDay ?? 3,
                    });
                  }
                })
                .catch(() => {});
            }, 2000);
          } else {
            toast.error(data.error || "Verification request failed.");
            if (res.status === 429) {
              setBankVerification((prev) =>
                prev ? { ...prev, canTryVerify: false, attemptsToday: prev.maxAttemptsPerDay } : null
              );
            }
          }
        } catch {
          toast.error("Verification request failed. You can try again later.");
        } finally {
          setBankVerifying(false);
        }
      }
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setConfirmSave(false);
    }
  };

  /* ===== IMAGE UPLOAD HANDLERS ===== */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'ads' | 'logo' | 'gallery') => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !storeId) return;

    setUploadingImages(files.map(file => URL.createObjectURL(file)));

    try {
      if (type === 'banner') {
        // Only one banner image
        const file = files[0];
        const signedUrl = await uploadImageToR2(file, 'banners', storeId, 'merchant-assets');
        if (!signedUrl) throw new Error('Banner upload failed');
        await updateStoreInfo(storeId, { banner_url: signedUrl });
        setStore(r => r ? { ...r, banner_url: signedUrl } : r);
        setEditData(r => r ? { ...r, banner_url: signedUrl } : r);
        toast.success("Store banner updated!");
      } else if (type === 'logo') {
        // Only one logo image
        const file = files[0];
        const signedUrl = await uploadImageToR2(file, 'logos', storeId, 'merchant-assets');
        if (!signedUrl) throw new Error('Logo upload failed');
        await updateStoreInfo(storeId, { logo_url: signedUrl });
        setStore(r => r ? { ...r, logo_url: signedUrl } : r);
        setEditData(r => r ? { ...r, logo_url: signedUrl } : r);
        toast.success("Logo updated!");
      } else if (type === 'gallery') {
        // Multiple gallery images
        const uploadGallery = await Promise.all(files.map(file => uploadImageToR2(file, 'gallery', storeId, 'merchant-assets')));
        const validUrls = uploadGallery.filter(Boolean) as string[];
        const currentGallery = store?.gallery_images || [];
        const newGallery = [...currentGallery, ...validUrls].slice(0, 10); // Limit gallery size
        await updateStoreInfo(storeId, { gallery_images: newGallery });
        setStore(r => r ? { ...r, gallery_images: newGallery } : r);
        setEditData(r => r ? { ...r, gallery_images: newGallery } : r);
        toast.success("Gallery images updated!");
      } else if (type === 'ads') {
        // Multiple ads images
        const uploadAds = await Promise.all(files.map(file => uploadImageToR2(file, 'ads', storeId, 'merchant-assets')));
        const validUrls = uploadAds.filter(Boolean) as string[];
        const currentAds = store?.ads_images || [];
        const newAds = [...currentAds, ...validUrls].slice(0, 5); // Keep max 5 images
        await updateStoreInfo(storeId, { ads_images: newAds });
        setStore(r => r ? { ...r, ads_images: newAds } : r);
        setEditData(r => r ? { ...r, ads_images: newAds } : r);
        toast.success("Ads images updated!");
      }

      setUploadingImages([]);
      if (type === 'ads' || type === 'gallery') {
        setShowImageUploadModal(false);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Image upload failed");
      setUploadingImages([]);
    }
  };

  /* ===== REMOVE AD IMAGE ===== */
  const handleRemoveAdImage = async (index: number) => {
    if (!storeId || !store?.ads_images) return;

    const newAds = [...store.ads_images];
    newAds.splice(index, 1);

    try {
      await updateStoreInfo(storeId, { ads_images: newAds });
      setStore(r => r ? { ...r, ads_images: newAds } : r);
      setEditData(r => r ? { ...r, ads_images: newAds } : r);
      toast.success("Image removed!");
    } catch (error) {
      toast.error("Failed to remove image");
    }
  };

  /* ===== FORMATTING FUNCTIONS ===== */
  const formatTime = (timeString?: string) => {
    if (!timeString) return "—";
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timeString;
    }
  };

  // Format operating hours from merchant_store_operating_hours table
  const formatOperatingHours = () => {
    if (!operatingHours || operatingHours.length === 0) return "— — —";
    
    // Find first open day
    const openDay = operatingHours.find((d: any) => d.open && d.slot1_start && d.slot1_end);
    if (!openDay) return "Closed";
    
    const start = formatTime(openDay.slot1_start);
    const end = formatTime(openDay.slot1_end);
    return `${start} - ${end}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatArray = (arr?: string[]) => {
    if (!arr || arr.length === 0) return "—";
    return arr.join(', ');
  };

  const startEditing = (fieldName: string) => {
    setEditingField(fieldName);
  };

  const stopEditing = () => {
    setEditingField(null);
  };

  if (loading) {
    return (
      <MXLayoutWhite restaurantName={editData?.store_name || ''} restaurantId={storeId || ''}>
        <PageSkeletonProfile />
      </MXLayoutWhite>
    );
  }

  if (!store || !editData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Profile not found</div>
      </div>
    );
  }

  return (
    <ProfileErrorBoundary>
      <Toaster position="top-right" richColors />
      <MXLayoutWhite
        restaurantName={store.store_name}
        restaurantId={store.store_id}
      >
        <div className="bg-gray-50 flex-1 flex flex-col overflow-hidden">
          {/* HEADER - Fixed and stable across screen sizes */}
          <header className="sticky top-0 z-20 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="px-4 py-3 md:px-6 md:py-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                {/* Spacer for hamburger menu on left (mobile) */}
                <div className="md:hidden w-12"></div>
                {/* Heading on right for mobile, left for desktop */}
                <div className="min-w-0 flex-1 ml-auto md:ml-0">
                  <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">Merchant Profile</h1>
                  <p className="text-xs md:text-sm text-gray-600 mt-0.5">Manage your restaurant details</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmSave(true)}
                    className="hidden md:inline-flex bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                  >
                    Save Changes
                  </button>
                  <div className="md:hidden relative">
                    <button
                      onClick={() => setMobileMenuOpen((v) => !v)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                      aria-label="Menu"
                    >
                      <Menu size={22} />
                    </button>
                    {mobileMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
                        <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[140px]">
                          <button
                            onClick={() => { setConfirmSave(true); setMobileMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                          >
                            Save Changes
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>
          
          {/* MAIN CONTENT CONTAINER - Scroll only as much as content needs */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar" style={{ scrollBehavior: 'smooth' }}>
            <div className="p-4">
              <div className="max-w-7xl mx-auto w-full">

                {/* MAIN CARD */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
                  {/* STORE HEADER - Card layout on small screens, wide on desktop */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center text-base font-bold">
                            {storeInitial}
                          </div>
                          {isVerified && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white p-0.5 rounded-full">
                              <CheckCircle size={10} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-bold text-gray-900 truncate">
                              {store?.store_name || '—'}
                            </h2>
                            {store?.cuisine_types && store.cuisine_types.length > 0 && (
                              <span className="text-[10px] text-gray-600 shrink-0">
                                • {formatArray(store.cuisine_types)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-gray-600 mt-0.5">
                            <span className="flex items-center gap-1 shrink-0">
                              <MapPin size={10} />
                              {store?.city || '—'}, {store?.state || '—'}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock size={10} />
                              {formatOperatingHours()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* QUICK STATS - Card layout on small screens */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 shrink-0">
                        <div className="text-center px-2 py-1 bg-white rounded-lg border border-gray-200 min-w-[70px]">
                          <div className="text-xs font-bold text-gray-900">{store?.min_order_amount || 0}</div>
                          <div className="text-[10px] text-gray-500">Min Order</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-white rounded-lg border border-gray-200 min-w-[70px]">
                          <div className="text-xs font-bold text-gray-900">{(store?.avg_preparation_time_minutes ?? store?.avg_delivery_time_minutes) || 0}m</div>
                          <div className="text-[10px] text-gray-500">Prep Time</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-white rounded-lg border border-gray-200 min-w-[70px]">
                          <div className="text-xs font-bold text-gray-900">{store?.delivery_radius_km ?? '—'}</div>
                          <div className="text-[10px] text-gray-500">Delivery Radius</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-white rounded-lg border border-gray-200 min-w-[100px]">
                          <div className="text-xs font-bold text-gray-900 truncate">{store?.parent_merchant_id || '—'}</div>
                          <div className="text-[10px] text-gray-500">Parent Merchant ID</div>
                        </div>
                        <div className="text-center px-2 py-1 bg-white rounded-lg border border-gray-200 min-w-[70px]">
                          <div className="text-xs font-bold text-gray-900">
                            {store?.approval_status === 'APPROVED' ? 'Verified' : 'Pending'}
                          </div>
                          <div className="text-[10px] text-gray-500">Status</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONTENT GRID - Compact */}
                  <div className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      
                      {/* COLUMN 1: STORE DETAILS */}
                      <div className="space-y-3">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 m-0">
                              <Building size={16} className="text-blue-600" />
                              Store Details
                            </h3>
                            <label className="inline-flex items-center cursor-pointer ml-2">
                              <span className="text-xs font-medium text-gray-700 mr-2">Pure Veg</span>
                              <input
                                type="checkbox"
                                checked={!!editData?.is_pure_veg}
                                onChange={async (e) => {
                                  if (!storeId || !editData) return;
                                  const newValue = e.target.checked;
                                  const oldValue = editData.is_pure_veg;
                                  // Optimistic update
                                  setEditData({ ...editData, is_pure_veg: newValue });
                                  if (store) setStore({ ...store, is_pure_veg: newValue });
                                  try {
                                    await updateStoreInfo(storeId, { is_pure_veg: newValue });
                                    toast.success(`Store marked as ${newValue ? 'Pure Veg' : 'Not Pure Veg'}`);
                                  } catch (err: any) {
                                    // Revert on error
                                    setEditData({ ...editData, is_pure_veg: oldValue });
                                    if (store) setStore({ ...store, is_pure_veg: oldValue });
                                    toast.error(err?.message || 'Failed to update Pure Veg status');
                                  }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-green-500 transition-all relative">
                                <div className={`absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editData?.is_pure_veg ? 'translate-x-4' : ''}`}></div>
                              </div>
                            </label>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <CompactEditableRow
                              label="Store Name"
                              value={editData?.store_name || ''}
                              isEditing={editingField === 'store_name'}
                              onEdit={() => startEditing('store_name')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, store_name: v })}
                            />
                            <CompactLockedRow
                              label="Store Display Name"
                              value={store.store_display_name || '—'}
                            />
                            <CompactLockedRow
                              label="Cuisine Types"
                              value={Array.isArray(store.cuisine_types) ? store.cuisine_types.join(', ') : (store.cuisine_types || '—')}
                            />
                            <CompactLockedRow
                              label="Food Categories"
                              value={Array.isArray(store.food_categories) ? store.food_categories.join(', ') : (store.food_categories || '—')}
                            />
                            <CompactEditableRow
                              label="Store Email"
                              value={editData.store_email}
                              isEditing={editingField === 'store_email'}
                              onEdit={() => startEditing('store_email')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, store_email: v })}
                            />
                            <CompactEditableRow
                              label="Store Phones"
                              value={formatArray(editData.store_phones)}
                              isEditing={editingField === 'store_phones'}
                              onEdit={() => startEditing('store_phones')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, store_phones: v.split(',').map(s => s.trim()) })}
                            />
                            <CompactEditableRow
                              label="Description"
                              value={editData.store_description}
                              isEditing={editingField === 'store_description'}
                              onEdit={() => startEditing('store_description')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, store_description: v })}
                              multiline
                            />
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <MapPin size={16} className="text-blue-600" />
                            Location
                          </h3>
                          <div className="space-y-2">
                            <CompactEditableRow
                              label="Full Address"
                              value={editData?.full_address || ''}
                              isEditing={editingField === 'full_address'}
                              onEdit={() => startEditing('full_address')}
                              onSave={stopEditing}
                              onChange={(v) => editData && setEditData({ ...editData, full_address: v })}
                              multiline
                            />
                            <CompactEditableRow
                              label="City"
                              value={editData?.city || ''}
                              isEditing={editingField === 'city'}
                              onEdit={() => startEditing('city')}
                              onSave={stopEditing}
                              onChange={(v) => editData && setEditData({ ...editData, city: v })}
                            />
                            <CompactEditableRow
                              label="State"
                              value={editData?.state || ''}
                              isEditing={editingField === 'state'}
                              onEdit={() => startEditing('state')}
                              onSave={stopEditing}
                              onChange={(v) => editData && setEditData({ ...editData, state: v })}
                            />
                            <CompactEditableRow
                              label="Landmark"
                              value={editData.landmark}
                              isEditing={editingField === 'landmark'}
                              onEdit={() => startEditing('landmark')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, landmark: v })}
                            />
                            <CompactEditableRow
                              label="Postal Code"
                              value={editData.postal_code}
                              isEditing={editingField === 'postal_code'}
                              onEdit={() => startEditing('postal_code')}
                              onSave={stopEditing}
                              onChange={(v) => setEditData({ ...editData, postal_code: v })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <CompactEditableRow
                                label="Latitude"
                                value={editData.latitude}
                                isEditing={editingField === 'latitude'}
                                onEdit={() => startEditing('latitude')}
                                onSave={stopEditing}
                                onChange={(v) => setEditData({ ...editData, latitude: parseFloat(v) })}
                              />
                              <CompactEditableRow
                                label="Longitude"
                                value={editData.longitude}
                                isEditing={editingField === 'longitude'}
                                onEdit={() => startEditing('longitude')}
                                onSave={stopEditing}
                                onChange={(v) => setEditData({ ...editData, longitude: parseFloat(v) })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* COLUMN 2: TIMINGS & OPERATIONS */}
                      <div className="space-y-3">
                        <OperatingDaysCard storeId={storeId} />

                        {/* Area Manager and Store Info side by side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <User size={16} className="text-blue-600" />
                              Area Manager
                            </h3>
                            <div className="space-y-2">
                              <CompactEditableRow
                                label="AM Name"
                                value={editData?.am_name || ''}
                                isEditing={editingField === 'am_name'}
                                onEdit={() => startEditing('am_name')}
                                onSave={stopEditing}
                                onChange={(v) => editData && setEditData({ ...editData, am_name: v })}
                              />
                              <CompactEditableRow
                                label="AM Mobile"
                                value={editData?.am_mobile || ''}
                                isEditing={editingField === 'am_mobile'}
                                onEdit={() => startEditing('am_mobile')}
                                onSave={stopEditing}
                                onChange={(v) => editData && setEditData({ ...editData, am_mobile: v })}
                              />
                              <CompactEditableRow
                                label="AM Email"
                                value={editData?.am_email || ''}
                                isEditing={editingField === 'am_email'}
                                onEdit={() => startEditing('am_email')}
                                onSave={stopEditing}
                                onChange={(v) => editData && setEditData({ ...editData, am_email: v })}
                              />
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <Activity size={16} className="text-blue-600" />
                              Store Info
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <Hash size={12} className="text-gray-500" />
                                <span className="text-gray-800">Store ID:</span>
                                <span className="font-semibold text-gray-900">{store?.store_id || '—'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-gray-500" />
                                <span className="text-gray-800">Created:</span>
                                <span className="font-semibold text-gray-900">{store?.created_at ? formatDate(store.created_at) : '—'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Activity size={12} className="text-gray-500" />
                                <span className="text-gray-800">Status:</span>
                                <span className={`font-semibold ${
                                  store?.approval_status === 'APPROVED' ? 'text-green-600' :
                                  store?.approval_status === 'REJECTED' ? 'text-red-600' :
                                  'text-yellow-600'
                                }`}>
                                  {store?.approval_status || 'SUBMITTED'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Activity size={12} className="text-gray-500" />
                                <span className="text-gray-800">Active:</span>
                                <label className="inline-flex items-center cursor-pointer ml-2">
                                  <input
                                    type="checkbox"
                                    checked={!!editData && editData.status === 'ACTIVE'}
                                    onChange={async (e) => {
                                      if (!editData || !store || !storeId) return;
                                      const prevStatus = editData.status;
                                      const prevOperational = editData.operational_status;
                                      // Use correct enum value for status and operational_status
                                      const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE';
                                      const newOperational = e.target.checked ? 'OPEN' : 'CLOSED';
                                      // Optimistically update UI
                                      setEditData({ ...editData, status: newStatus, operational_status: newOperational });
                                      setStore({ ...store, status: newStatus, operational_status: newOperational });
                                      try {
                                        const ok = await updateStoreInfo(storeId, { status: newStatus, operational_status: newOperational });
                                        if (!ok) throw new Error('Update failed');
                                        toast.success(`Store is now ${newStatus} (${newOperational})`);
                                      } catch (err) {
                                        // Revert UI if update fails
                                        setEditData({ ...editData, status: prevStatus, operational_status: prevOperational });
                                        setStore({ ...store, status: prevStatus, operational_status: prevOperational });
                                        toast.error('Failed to update store status');
                                      }
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-green-500 transition-all relative">
                                    <div className={`absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editData?.status === 'ACTIVE' ? 'translate-x-4' : ''}`}></div>
                                  </div>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* COLUMN 3: DOCUMENTS & IMAGES */}
                      <div className="space-y-3">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Shield size={16} className="text-blue-600" />
                            Legal Documents
                          </h3>
                          <div className="space-y-2">
                            {storeDocuments ? (
                              <>
                                {/* PAN Document */}
                                {storeDocuments.pan_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">PAN</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.pan_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.pan_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.pan_is_verified ? 'Verified' :
                                         storeDocuments.pan_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.pan_document_number}</div>
                                    {storeDocuments.pan_holder_name && (
                                      <div className="text-xs text-gray-600">Holder: {storeDocuments.pan_holder_name}</div>
                                    )}
                                    {storeDocuments.pan_document_url && (
                                      <a href={storeDocuments.pan_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}

                                {/* GST Document */}
                                {storeDocuments.gst_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">GST</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.gst_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.gst_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.gst_is_verified ? 'Verified' :
                                         storeDocuments.gst_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.gst_document_number}</div>
                                    {storeDocuments.gst_document_url && (
                                      <a href={storeDocuments.gst_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}

                                {/* Aadhaar Document */}
                                {storeDocuments.aadhaar_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">Aadhaar</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.aadhaar_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.aadhaar_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.aadhaar_is_verified ? 'Verified' :
                                         storeDocuments.aadhaar_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.aadhaar_document_number}</div>
                                    {storeDocuments.aadhaar_holder_name && (
                                      <div className="text-xs text-gray-600">Holder: {storeDocuments.aadhaar_holder_name}</div>
                                    )}
                                    {storeDocuments.aadhaar_document_url && (
                                      <a href={storeDocuments.aadhaar_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}

                                {/* FSSAI Document */}
                                {storeDocuments.fssai_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">FSSAI</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.fssai_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.fssai_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.fssai_is_verified ? 'Verified' :
                                         storeDocuments.fssai_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.fssai_document_number}</div>
                                    {storeDocuments.fssai_document_url && (
                                      <a href={storeDocuments.fssai_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}

                                {/* Trade License */}
                                {storeDocuments.trade_license_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">Trade License</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.trade_license_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.trade_license_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.trade_license_is_verified ? 'Verified' :
                                         storeDocuments.trade_license_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.trade_license_document_number}</div>
                                    {storeDocuments.trade_license_document_url && (
                                      <a href={storeDocuments.trade_license_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}

                                {/* Other Documents */}
                                {storeDocuments.other_document_number && (
                                  <div className="bg-white rounded p-2 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-900">
                                        {storeDocuments.other_document_type || 'Other Document'}
                                      </span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        storeDocuments.other_is_verified ? 'bg-green-100 text-green-700' :
                                        storeDocuments.other_is_expired ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {storeDocuments.other_is_verified ? 'Verified' :
                                         storeDocuments.other_is_expired ? 'Expired' : 'Pending'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">Number: {storeDocuments.other_document_number}</div>
                                    {storeDocuments.other_document_url && (
                                      <a href={storeDocuments.other_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-block">View Document</a>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 text-center py-2">No documents found</p>
                            )}
                          </div>
                        </div>

                        {/* Bank Details Card - Dynamically show UI data or bank_accounts table data */}
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <Banknote size={16} className="text-blue-600" />
                              Bank Details
                              {bankVerification?.verified && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                  <CheckCircle size={12} />
                                  Verified
                                </span>
                              )}
                              {bankVerifying && (
                                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                  Verifying…
                                </span>
                              )}
                              {loading && (
                                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                  Loading…
                                </span>
                              )}
                            </h3>
                            <button
                              onClick={async () => {
                                if (!store?.id) return;
                                console.log('Manual refresh triggered for store ID:', store.id);
                                try {
                                  const mod = await import("@/lib/database");
                                  const banks = await mod.fetchStoreBankAccounts(store.id);
                                  const bankAccountsArray = Array.isArray(banks) ? banks : [];
                                  console.log('Manual refresh result:', bankAccountsArray.length, 'accounts');
                                  setBankAccounts(bankAccountsArray);
                                  if (bankAccountsArray.length > 0) {
                                    toast.success(`Loaded ${bankAccountsArray.length} bank account(s)`);
                                  } else {
                                    toast.info('No bank accounts found in database');
                                  }
                                } catch (error) {
                                  console.error('Manual refresh error:', error);
                                  toast.error('Failed to refresh bank accounts');
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                              title="Refresh bank accounts"
                            >
                              🔄 Refresh
                            </button>
                          </div>
                          {/* Priority: Show bank_accounts table data if available, otherwise show UI (store table) data */}
                          {bankAccounts && Array.isArray(bankAccounts) && bankAccounts.length > 0 ? (
                            // Show data from merchant_store_bank_accounts table
                            <div className="space-y-2">
                              {bankAccounts.map((bank, idx) => (
                                <div key={bank.id || idx} className="bg-white rounded p-2 border border-gray-200">
                                  {bank.is_primary && (
                                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded mb-1 inline-block">Primary</span>
                                  )}
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Account Holder:</span>
                                      <span className="font-semibold text-gray-900">{bank.account_holder_name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Account Number:</span>
                                      <span className="font-semibold text-gray-900">{bank.account_number ? `****${bank.account_number.slice(-4)}` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">IFSC:</span>
                                      <span className="font-semibold text-gray-900">{bank.ifsc_code || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Bank:</span>
                                      <span className="font-semibold text-gray-900">{bank.bank_name || '—'}</span>
                                    </div>
                                    {bank.branch_name && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Branch:</span>
                                        <span className="font-semibold text-gray-900">{bank.branch_name}</span>
                                      </div>
                                    )}
                                    {bank.account_type && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Account Type:</span>
                                        <span className="font-semibold text-gray-900">{bank.account_type}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Verified:</span>
                                      <span className={`font-semibold ${bank.is_verified ? 'text-green-600' : 'text-red-600'}`}>
                                        {bank.is_verified ? 'Yes' : 'No'}
                                      </span>
                                    </div>
                                    {bank.upi_id && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">UPI ID:</span>
                                        <span className="font-semibold text-gray-900">{bank.upi_id}</span>
                                      </div>
                                    )}
                                    {bank.payout_method && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Payout Method:</span>
                                        <span className="font-semibold text-gray-900">{bank.payout_method}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Show UI data from store table if bank_accounts table is empty
                            (store?.bank_account_holder || store?.bank_account_number || store?.bank_ifsc || store?.bank_name) ? (
                              bankVerification?.verified ? (
                                <div className="space-y-1 text-sm">
                                  <CompactLockedRow
                                    label="Account Holder"
                                    value={store?.bank_account_holder || '—'}
                                  />
                                  <CompactLockedRow
                                    label="Account Number"
                                    value={store?.bank_account_number || '—'}
                                  />
                                  <CompactLockedRow
                                    label="IFSC Code"
                                    value={store?.bank_ifsc || '—'}
                                  />
                                  <CompactLockedRow
                                    label="Bank Name"
                                    value={store?.bank_name || '—'}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1 text-sm">
                                  <p className="text-xs text-gray-500 mb-1">
                                    Account holder name must match store or owner name. We will send ₹1 to verify (max 3 attempts per day).
                                  </p>
                                  <CompactEditableRow
                                    label="Account Holder"
                                    value={editData?.bank_account_holder || ''}
                                    isEditing={editingField === "bank_account_holder"}
                                    onEdit={() => setEditingField("bank_account_holder")}
                                    onSave={() => setEditingField(null)}
                                    onChange={(v) => setEditData((d) => (d ? { ...d, bank_account_holder: v } : d))}
                                  />
                                  <CompactEditableRow
                                    label="Account Number"
                                    value={editData?.bank_account_number || ''}
                                    isEditing={editingField === "bank_account_number"}
                                    onEdit={() => setEditingField("bank_account_number")}
                                    onSave={() => setEditingField(null)}
                                    onChange={(v) => setEditData((d) => (d ? { ...d, bank_account_number: v } : d))}
                                  />
                                  <CompactEditableRow
                                    label="IFSC Code"
                                    value={editData?.bank_ifsc || ''}
                                    isEditing={editingField === "bank_ifsc"}
                                    onEdit={() => setEditingField("bank_ifsc")}
                                    onSave={() => setEditingField(null)}
                                    onChange={(v) => setEditData((d) => (d ? { ...d, bank_ifsc: v } : d))}
                                  />
                                  <CompactEditableRow
                                    label="Bank Name"
                                    value={editData?.bank_name || ''}
                                    isEditing={editingField === "bank_name"}
                                    onEdit={() => setEditingField("bank_name")}
                                    onSave={() => setEditingField(null)}
                                    onChange={(v) => setEditData((d) => (d ? { ...d, bank_name: v } : d))}
                                  />
                                  {bankVerification && !bankVerification.canTryVerify && (
                                    <p className="text-xs text-amber-700 mt-1">
                                      Verification limit reached today ({bankVerification.attemptsToday}/{bankVerification.maxAttemptsPerDay}). Try again tomorrow.
                                    </p>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className="space-y-1 text-sm">
                                <p className="text-xs text-gray-500 mb-1">
                                  Account holder name must match store or owner name. We will send ₹1 to verify (max 3 attempts per day).
                                </p>
                                <CompactEditableRow
                                  label="Account Holder"
                                  value={editData?.bank_account_holder || ''}
                                  isEditing={editingField === "bank_account_holder"}
                                  onEdit={() => setEditingField("bank_account_holder")}
                                  onSave={() => setEditingField(null)}
                                  onChange={(v) => setEditData((d) => (d ? { ...d, bank_account_holder: v } : d))}
                                />
                                <CompactEditableRow
                                  label="Account Number"
                                  value={editData?.bank_account_number || ''}
                                  isEditing={editingField === "bank_account_number"}
                                  onEdit={() => setEditingField("bank_account_number")}
                                  onSave={() => setEditingField(null)}
                                  onChange={(v) => setEditData((d) => (d ? { ...d, bank_account_number: v } : d))}
                                />
                                <CompactEditableRow
                                  label="IFSC Code"
                                  value={editData?.bank_ifsc || ''}
                                  isEditing={editingField === "bank_ifsc"}
                                  onEdit={() => setEditingField("bank_ifsc")}
                                  onSave={() => setEditingField(null)}
                                  onChange={(v) => setEditData((d) => (d ? { ...d, bank_ifsc: v } : d))}
                                />
                                <CompactEditableRow
                                  label="Bank Name"
                                  value={editData?.bank_name || ''}
                                  isEditing={editingField === "bank_name"}
                                  onEdit={() => setEditingField("bank_name")}
                                  onSave={() => setEditingField(null)}
                                  onChange={(v) => setEditData((d) => (d ? { ...d, bank_name: v } : d))}
                                />
                                {bankVerification && !bankVerification.canTryVerify && (
                                  <p className="text-xs text-amber-700 mt-1">
                                    Verification limit reached today ({bankVerification.attemptsToday}/{bankVerification.maxAttemptsPerDay}). Try again tomorrow.
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* IMAGE CARDS - HORIZONTAL LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                      {/* STORE BANNER CARD */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">
                              Store Banner
                            </h3>
                            <p className="text-xs text-gray-600">
                              Upload your store banner image
                            </p>
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                            onClick={() => bannerInputRef.current?.click()}
                          >
                            <Upload size={12} />
                            Upload Banner
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            ref={bannerInputRef}
                            style={{ display: "none" }}
                            onChange={(e) => handleImageUpload(e, 'banner')}
                          />
                        </div>
                        {store.banner_url ? (
                          <img
                            src={store.banner_url}
                            alt="Store Banner"
                            className="mt-2 rounded-lg w-full h-48 object-cover"
                          />
                        ) : (
                          <div className="mt-2 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <ImageIcon size={24} className="text-gray-400 mx-auto mb-2" />
                              <p className="text-xs text-gray-500">No banner uploaded</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ADS IMAGES CARD */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">
                              Gallery Images ({store.ads_images?.length || 0}/5)
                            </h3>
                            <p className="text-xs text-gray-600">
                              Upload up to 5 promotional images
                            </p>
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                            onClick={() => setShowImageUploadModal(true)}
                            disabled={(store.ads_images?.length || 0) >= 5}
                          >
                            <Upload size={12} />
                            Upload Ads
                          </button>
                        </div>
                        
                        {/* ADS IMAGES GRID */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {store.ads_images?.map((img, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={img}
                                alt={`Ad ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              <button
                                onClick={() => handleRemoveAdImage(index)}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {uploadingImages.map((img, index) => (
                            <div key={`uploading-${index}`} className="relative">
                              <img
                                src={img}
                                alt="Uploading..."
                                className="w-full h-24 object-cover rounded-lg opacity-50"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            </div>
                          ))}
                          {(!store.ads_images || store.ads_images.length === 0) && uploadingImages.length === 0 && (
                            <div className="col-span-2 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <ImageIcon size={24} className="text-gray-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">No ads images</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Minimal bottom padding - only 5-10px, no extra space */}
              <div className="pb-2"></div>
            </div>
          </div>
        </div>

        {/* IMAGE UPLOAD MODAL */}
        {showImageUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Ads Images</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload promotional images (max 5 total). You can upload {5 - (store.ads_images?.length || 0)} more.
              </p>
              
              <div className="mb-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={adsInputRef}
                      onChange={(e) => handleImageUpload(e, 'ads')}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowImageUploadModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => adsInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Select Images
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SAVE CONFIRM MODAL */}
        {confirmSave && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-5 w-full max-w-sm mx-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Save Changes?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Confirm to update your profile information
              </p>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setConfirmSave(false)}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </MXLayoutWhite>
    </ProfileErrorBoundary>
  );
}

/* ================= COMPACT COMPONENTS ================= */

function CompactEditableRow({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onChange,
  multiline = false,
  prefix = "",
}: {
  label: string;
  value?: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
  multiline?: boolean;
  prefix?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      onSave();
    }
    if (e.key === 'Escape') {
      onSave();
    }
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Edit2 size={12} />
          </button>
        ) : (
          <button
            onClick={onSave}
            className="text-green-600 hover:text-green-800 text-xs"
          >
            Save
          </button>
        )}
      </div>
      {isEditing ? (
        multiline ? (
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={handleKeyDown}
            className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            autoFocus
          />
        ) : (
          <input
            type={label.toLowerCase().includes('time') ? 'time' : 'text'}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={handleKeyDown}
            className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        )
      ) : (
        <div className="text-sm text-gray-900 font-medium truncate">
          {prefix && <span className="text-gray-600">{prefix}</span>}
          {value || <span className="text-gray-400">Not set</span>}
        </div>
      )}
    </div>
  );
}

function CompactLockedRow({
  label,
  value,
}: {
  label: string;
  value?: any;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
          Read Only
        </span>
      </div>
      <div className="text-sm text-gray-900 font-medium">
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}