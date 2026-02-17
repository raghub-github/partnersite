'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MXLayoutWhite } from '@/components/MXLayoutWhite';
import { fetchRestaurantById as fetchStoreById } from '@/lib/database';
import { MerchantStore } from '@/lib/merchantStore';
import { DEMO_RESTAURANT_ID as DEMO_STORE_ID } from '@/lib/constants';
import { 
  Star, 
  MessageSquare, 
  AlertTriangle, 
  Send, 
  UserCheck, 
  UserPlus, 
  UserX, 
  Filter,
  Calendar,
  CheckCircle,
  Inbox,
  X,
  Clock,
  AlertCircle
} from 'lucide-react';
import { SkeletonReviewRow } from '@/components/PageSkeleton';
import { getTicketAttachmentViewUrl } from '@/lib/ticket-attachment-url';

const dummyReviews = [
  {
    id: 1,
    user: 'Amit Kumar',
    date: '2026-01-10',
    type: 'Review',
    message: 'Great food and fast delivery! The biryani was perfectly spiced and arrived steaming hot. Highly recommended for family dinners.',
    response: 'Thank you for your feedback, Amit! We\'re thrilled you enjoyed our biryani. We look forward to serving you again soon!',
    userType: 'repeated',
    rating: 5,
    orderCount: 12
  },
  {
    id: 2,
    user: 'Priya Singh',
    date: '2026-01-09',
    type: 'Complaint',
    message: 'Order was delayed by 45 minutes and food arrived cold. Very disappointing experience for a special occasion.',
    response: '',
    userType: 'new',
    orderCount: 1
  },
  {
    id: 3,
    user: 'Rahul Sharma',
    date: '2026-01-08',
    type: 'Review',
    message: 'The desserts were absolutely fantastic! The chocolate lava cake was rich and gooey, exactly as described. Will definitely order again.',
    response: 'Glad you enjoyed it, Rahul! Our pastry chef will be delighted to hear your feedback about the lava cake.',
    userType: 'repeated',
    rating: 4,
    orderCount: 8
  },
  {
    id: 4,
    user: 'Sneha Verma',
    date: '2026-01-07',
    type: 'Complaint',
    message: 'Received the wrong item in my order - ordered paneer tikka but got chicken tikka instead. As a vegetarian, this was very upsetting.',
    response: 'We sincerely apologize for this serious error, Sneha. We\'ve addressed this with our kitchen team and will offer a full refund plus credit for your next order.',
    userType: 'fraud',
    orderCount: 3,
    fraudFlag: 'Multiple refund requests'
  },
  {
    id: 5,
    user: 'Raj Patel',
    date: '2026-01-06',
    type: 'Review',
    message: 'Consistently excellent quality across multiple orders. The packaging is always secure and the delivery team is polite.',
    response: 'Thank you for being a loyal customer, Raj! We appreciate your continued trust in our service.',
    userType: 'repeated',
    rating: 5,
    orderCount: 25
  },
  {
    id: 6,
    user: 'Neha Gupta',
    date: '2026-01-05',
    type: 'Complaint',
    message: 'Missing one item from my order of 5 dishes. Customer service was responsive but still inconvenient.',
    response: 'We\'re sorry for the incomplete order, Neha. The missing item has been refunded and we\'ve added bonus credit to your account.',
    userType: 'new',
    orderCount: 2
  },
  {
    id: 7,
    user: 'Vikram Joshi',
    date: '2026-01-04',
    type: 'Review',
    message: 'Excellent value for money. The lunch combo is perfect for office meals. Keep up the good work!',
    response: '',
    userType: 'repeated',
    rating: 4,
    orderCount: 15
  },
  {
    id: 8,
    user: 'Anjali Desai',
    date: '2026-01-03',
    type: 'Complaint',
    message: 'Food quality has declined over the last two orders. The butter chicken lacked the usual richness and creaminess.',
    response: 'Thank you for bringing this to our attention, Anjali. Our head chef is investigating and we\'ll reach out personally.',
    userType: 'repeated',
    orderCount: 18
  }
];

const UserInsightsContent = () => {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState(dummyReviews);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const [showQueueView, setShowQueueView] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [ticketReply, setTicketReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    reviews: 0,
    complaints: 0,
    repeatedUsers: 0,
    newUsers: 0,
    fraudUsers: 0
  });

  // Get store ID
  useEffect(() => {
    const getStoreId = async () => {
      let id = searchParams?.get('storeId') ?? null;

      if (!id) {
        id = typeof window !== 'undefined' ? localStorage.getItem('selectedStoreId') : null;
      }

      if (!id) {
        id = DEMO_STORE_ID;
      }

      setStoreId(id);
    };

    getStoreId();
  }, [searchParams]);

  // Load store data
  useEffect(() => {
    if (!storeId) return;

    const loadStore = async () => {
      try {
        const storeData = await fetchStoreById(storeId);
        if (storeData) {
          setStore(storeData as MerchantStore);
        }
      } catch (error) {
        console.error('Error loading store:', error);
      }
    };

    loadStore();
  }, [storeId]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    
    // Calculate stats
    const total = dummyReviews.length;
    const reviews = dummyReviews.filter(r => r.type === 'Review').length;
    const complaints = dummyReviews.filter(r => r.type === 'Complaint').length;
    const repeatedUsers = dummyReviews.filter(r => r.userType === 'repeated').length;
    const newUsers = dummyReviews.filter(r => r.userType === 'new').length;
    const fraudUsers = dummyReviews.filter(r => r.userType === 'fraud').length;
    
    setStats({ total, reviews, complaints, repeatedUsers, newUsers, fraudUsers });
    
    return () => clearTimeout(timer);
  }, []);

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch('/api/merchant/tickets/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleQueueOpen = () => {
    setShowQueueView(true);
    fetchTickets();
  };

  const handleBackToInsights = () => {
    setShowQueueView(false);
    setShowTicketDetail(false);
    setSelectedTicket(null);
  };

  const fetchTicketMessages = async (ticketId: number) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/merchant/tickets/messages?ticket_id=${ticketId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setTicketMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleTicketClick = (ticket: any) => {
    setSelectedTicket(ticket);
    setShowTicketDetail(true);
    fetchTicketMessages(ticket.id);
  };

  const handleBackToQueue = () => {
    setShowTicketDetail(false);
    setSelectedTicket(null);
    setTicketReply('');
    setTicketMessages([]);
  };

  const handleSendReply = async () => {
    if (!ticketReply.trim() || !selectedTicket) return;
    
    setReplyLoading(true);
    try {
      const res = await fetch('/api/merchant/tickets/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          message: ticketReply.trim()
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setTicketReply('');
        // Refresh messages to show the new reply
        fetchTicketMessages(selectedTicket.id);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleResponseChange = (id: string, value: string) => {
    setResponseText((prev) => ({ ...prev, [id]: value }));
  };

  const handleSendResponse = (id: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        String(r.id) === id ? { ...r, response: responseText[id] || '' } : r
      )
    );
    setResponseText((prev) => ({ ...prev, [id]: '' }));
  };

  const filteredReviews = filter === 'all' 
    ? reviews 
    : filter === 'review' 
    ? reviews.filter(r => r.type === 'Review')
    : reviews.filter(r => r.type === 'Complaint');

  const getUserTypeTag = (userType: string, fraudFlag = '') => {
    const config = {
      repeated: { 
        icon: <UserCheck size={14} />, 
        text: 'Repeated User', 
        bg: 'bg-blue-50', 
        textColor: 'text-blue-700',
        border: 'border-blue-100'
      },
      new: { 
        icon: <UserPlus size={14} />, 
        text: 'New User', 
        bg: 'bg-green-50', 
        textColor: 'text-green-700',
        border: 'border-green-100'
      },
      fraud: { 
        icon: <UserX size={14} />, 
        text: fraudFlag || 'Fraud Risk', 
        bg: 'bg-red-50', 
        textColor: 'text-red-700',
        border: 'border-red-100'
      }
    };
    
    const tag = config[userType as keyof typeof config] ?? config.new;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${tag.bg} ${tag.textColor} ${tag.border} border`}>
        {tag.icon}
        {tag.text}
      </span>
    );
  };

  const getReviewTypeTag = (type: string) => {
    return type === 'Review' ? (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100">
        <Star size={12} />
        Review
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
        <AlertTriangle size={12} />
        Complaint
      </span>
    );
  };

  return (
    <MXLayoutWhite restaurantName={store?.store_name} restaurantId={storeId || DEMO_STORE_ID}>
      <div className="max-w-6xl mx-auto p-4 relative min-h-screen" style={{ paddingBottom: showTicketDetail && selectedTicket && (selectedTicket.status === 'OPEN' || selectedTicket.status === 'IN_PROGRESS' || selectedTicket.status === 'CLOSED' || selectedTicket.status === 'RESOLVED') ? '120px' : '0px' }}>
        {/* Show Queue View or User Insights */}
        {showQueueView ? (
          showTicketDetail && selectedTicket ? (
            /* Ticket Detail Panel - Compact Chat */
            <>
            <div className="flex flex-col bg-white border border-gray-200 overflow-hidden rounded-lg md:max-w-6xl md:mx-auto h-[calc(100dvh-6rem)] sm:h-[calc(100vh-120px)] min-h-[300px]">
              {/* Chat Header - Fixed */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={handleBackToQueue}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-sm font-bold text-gray-900 truncate">{selectedTicket.subject}</h1>
                      <p className="text-xs text-gray-500 font-mono">#{selectedTicket.ticket_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedTicket.status === 'OPEN' ? 'bg-blue-50 text-blue-700' :
                      selectedTicket.status === 'IN_PROGRESS' ? 'bg-yellow-50 text-yellow-700' :
                      selectedTicket.status === 'RESOLVED' ? 'bg-green-50 text-green-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {selectedTicket.status || 'OPEN'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedTicket.priority === 'HIGH' ? 'bg-red-50 text-red-700' :
                      selectedTicket.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                      selectedTicket.priority === 'MEDIUM' ? 'bg-orange-50 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
                
                {/* Compact Ticket Info - Below Header */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {selectedTicket.ticket_category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(selectedTicket.created_at).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'short'
                    })}
                  </span>
                  {selectedTicket.assigned_to_agent_name && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {selectedTicket.assigned_to_agent_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <>
                    {/* Original Ticket Message - Merchant */}
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {selectedTicket.raised_by_name ? selectedTicket.raised_by_name.charAt(0).toUpperCase() : 'M'}
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-gray-900 text-xs">
                            {selectedTicket.raised_by_name || 'Merchant'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(selectedTicket.created_at).toLocaleDateString('en-IN', { 
                              day: 'numeric', 
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg rounded-tl-none border border-gray-200 p-2.5 shadow-sm">
                          <p className="text-xs text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                          {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {selectedTicket.attachments.map((url: string, idx: number) => (
                                <a 
                                  key={idx}
                                  href={getTicketAttachmentViewUrl(url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700 hover:bg-orange-100"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  File {idx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>


                    {/* All Messages from Database */}
                    {ticketMessages.map((msg) => (
                      <div key={msg.id} className={`flex items-start gap-2 ${msg.sender_type !== 'MERCHANT' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                          msg.sender_type === 'MERCHANT' 
                            ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
                            : msg.sender_type === 'AGENT'
                            ? 'bg-gradient-to-br from-green-500 to-green-600'
                            : 'bg-gradient-to-br from-blue-500 to-blue-600'
                        }`}>
                          {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : 
                           msg.sender_type === 'AGENT' ? 'A' : 'S'}
                        </div>
                        <div className="flex-1 max-w-[85%]">
                          <div className={`flex items-baseline gap-2 mb-0.5 ${msg.sender_type !== 'MERCHANT' ? 'justify-end' : ''}`}>
                            <span className={`text-xs text-gray-500 ${msg.sender_type !== 'MERCHANT' ? 'order-1' : ''}`}>
                              {new Date(msg.created_at).toLocaleDateString('en-IN', { 
                                day: 'numeric', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="font-semibold text-gray-900 text-xs">
                              {msg.sender_name || (msg.sender_type === 'AGENT' ? 'Support Team' : 'Merchant')}
                            </span>
                          </div>
                          <div className={`rounded-lg p-2.5 shadow-sm ${
                            msg.sender_type === 'MERCHANT'
                              ? 'bg-white border border-gray-200 rounded-tl-none'
                              : msg.sender_type === 'AGENT'
                              ? 'bg-green-50 border border-green-200 rounded-tr-none'
                              : 'bg-blue-50 border border-blue-200 rounded-tr-none'
                          }`}>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap">{msg.message_text}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {msg.attachments.map((url: string, idx: number) => (
                                  <a 
                                    key={idx}
                                    href={getTicketAttachmentViewUrl(url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:opacity-80 ${
                                      msg.sender_type === 'MERCHANT'
                                        ? 'bg-orange-50 border border-orange-200 text-orange-700'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                    }`}
                                  >
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    File {idx + 1}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Resolution Message - Support Agent */}
                    {selectedTicket.resolution && (
                      <>
                        <div className="flex justify-center my-1">
                          <div className="px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 flex items-center gap-1">
                            <CheckCircle size={10} />
                            Ticket Resolved
                          </div>
                        </div>
                        <div className="flex items-start gap-2 flex-row-reverse">
                          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                            <CheckCircle size={14} />
                          </div>
                          <div className="flex-1 max-w-[85%]">
                            <div className="flex items-baseline gap-2 mb-0.5 justify-end">
                              <span className="text-xs text-gray-500">
                                {selectedTicket.resolved_at && new Date(selectedTicket.resolved_at).toLocaleDateString('en-IN', { 
                                  day: 'numeric', 
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="font-semibold text-gray-900 text-xs">
                                {selectedTicket.resolved_by_name || 'Support Team'}
                              </span>
                            </div>
                            <div className="bg-green-50 rounded-lg rounded-tr-none border border-green-200 p-2.5 shadow-sm">
                              <p className="text-xs text-gray-800 whitespace-pre-wrap">{selectedTicket.resolution}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Chat Input - Fixed at Bottom of Screen */}
            {(selectedTicket.status === 'OPEN' || selectedTicket.status === 'IN_PROGRESS') && (
              <div className="fixed bottom-0 bg-white border-t border-gray-200 p-3 sm:p-4 left-16 md:left-64 right-0" style={{ zIndex: 1100, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
                <div className="max-w-6xl mx-auto flex gap-3">
                  <textarea
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    placeholder="Type your message here..."
                    rows={1}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (ticketReply.trim() && !replyLoading) {
                          handleSendReply();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!ticketReply.trim() || replyLoading}
                    className={`px-4 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all flex-shrink-0 ${
                      ticketReply.trim() && !replyLoading
                        ? 'bg-orange-600 text-white hover:bg-orange-700' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {replyLoading ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        <Send size={16} />
                        Send
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center max-w-6xl mx-auto">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            )}

            {/* Closed/Resolved Message - Fixed at Bottom */}
            {(selectedTicket.status === 'CLOSED' || selectedTicket.status === 'RESOLVED') && !selectedTicket.resolution && (
              <div className="fixed bottom-0 bg-gray-50 border-t border-gray-200 p-3 sm:p-4 left-16 md:left-64 right-0" style={{ zIndex: 1100, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
                <div className="max-w-6xl mx-auto text-center">
                  <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This ticket has been {selectedTicket.status.toLowerCase()}. No further replies allowed.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Queue View - Full Page */
          <div>
            {/* Queue Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToInsights}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-2">
                    <Inbox className="text-orange-600" size={28} />
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">My Queue</h1>
                      <p className="text-sm text-gray-600 mt-0.5">Store & GatiMitra concern tickets</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tickets Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-lg font-bold text-gray-900">{tickets.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-blue-200 p-2.5 shadow-sm">
                <div className="text-xs text-gray-500">Open</div>
                <div className="text-lg font-bold text-blue-600">
                  {tickets.filter(t => t.status === 'OPEN').length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-yellow-200 p-2.5 shadow-sm">
                <div className="text-xs text-gray-500">In Progress</div>
                <div className="text-lg font-bold text-yellow-600">
                  {tickets.filter(t => t.status === 'IN_PROGRESS').length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-2.5 shadow-sm">
                <div className="text-xs text-gray-500">Resolved</div>
                <div className="text-lg font-bold text-green-600">
                  {tickets.filter(t => t.status === 'RESOLVED').length}
                </div>
              </div>
            </div>

            {/* Tickets List */}
            <div className="space-y-2">
              {ticketsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-3">
                      <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-2.5 bg-gray-200 rounded w-full mb-1"></div>
                      <div className="h-2.5 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    onClick={() => handleTicketClick(ticket)}
                    className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
                  >
                    {/* Compact Ticket Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ticket.status === 'OPEN' ? 'bg-blue-50 text-blue-700' :
                          ticket.status === 'IN_PROGRESS' ? 'bg-yellow-50 text-yellow-700' :
                          ticket.status === 'RESOLVED' ? 'bg-green-50 text-green-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {ticket.status || 'OPEN'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ticket.priority === 'HIGH' ? 'bg-red-50 text-red-700' :
                          ticket.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          ticket.priority === 'MEDIUM' ? 'bg-orange-50 text-orange-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {ticket.priority || 'MEDIUM'}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">#{ticket.ticket_id}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short'
                        })}
                      </div>
                    </div>

                    {/* Compact Ticket Content */}
                    <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{ticket.subject}</h4>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{ticket.description}</p>

                    {/* Compact Ticket Meta */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 text-xs font-medium">
                        {ticket.ticket_title?.replace(/_/g, ' ').substring(0, 20)}
                      </span>
                      {ticket.assigned_to_agent_name && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                          {ticket.assigned_to_agent_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Inbox className="text-gray-400" size={28} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 mb-1">No tickets yet</h3>
                  <p className="text-sm text-gray-500">Your store tickets will appear here</p>
                </div>
              )}
            </div>
          </div>
          )
        ) : (
          /* User Insights View */
          <div>
        {/* Compact Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {/* Spacer for hamburger menu on left (mobile) */}
            <div className="md:hidden w-12"></div>
            {/* Heading on right for mobile, left for desktop */}
            <div className="ml-auto md:ml-0">
              <h1 className="text-2xl font-bold text-gray-900">User Insights</h1>
              <p className="text-sm text-gray-600 mt-1">Monitor customer feedback and respond to reviews</p>
            </div>
            <button
              onClick={handleQueueOpen}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 transition-all shadow-sm"
            >
              <Inbox size={18} />
              My Queue
            </button>
          </div>
        </div>

        {/* Compact Stats Overview */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5">Total</div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
              <Star size={12} />
              Reviews
            </div>
            <div className="text-xl font-bold text-green-600">{stats.reviews}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
              <AlertTriangle size={12} />
              Complaints
            </div>
            <div className="text-xl font-bold text-amber-600">{stats.complaints}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5">Repeated</div>
            <div className="text-xl font-bold text-blue-600">{stats.repeatedUsers}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5">New</div>
            <div className="text-xl font-bold text-green-600">{stats.newUsers}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-0.5">Fraud</div>
            <div className="text-xl font-bold text-red-600">{stats.fraudUsers}</div>
          </div>
        </div>

        {/* Compact Navigation Filters */}
        <div className="flex flex-wrap items-center justify-between mb-5">
          <div className="flex space-x-1 mb-3 md:mb-0">
            <button
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-all ${filter === 'review' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setFilter('review')}
            >
              <Star size={14} />
              Reviews
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-all ${filter === 'complaint' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setFilter('complaint')}
            >
              <AlertTriangle size={14} />
              Complaints
            </button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Filter size={14} />
            <span>Showing {filteredReviews.length} of {reviews.length}</span>
          </div>
        </div>

        {/* Compact Reviews/Complaints List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonReviewRow key={i} />)
          ) : filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Compact Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold text-sm">
                      {review.user.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm">{review.user}</h3>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar size={10} />
                          {review.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {getReviewTypeTag(review.type)}
                        {getUserTypeTag(review.userType, review.fraudFlag)}
                        {review.orderCount && (
                          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            {review.orderCount} orders
                          </span>
                        )}
                        {review.rating && (
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={12} 
                                className={`${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500">#{review.id.toString().padStart(4, '0')}</div>
                  </div>
                </div>

                {/* Compact Message */}
                <div className="mb-3">
                  <p className="text-sm text-gray-800 pl-2 border-l-2 border-gray-300 py-1 px-3 bg-gray-50 rounded-r">
                    {review.message}
                  </p>
                </div>

                {/* Compact Response Section */}
                {review.response ? (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-green-800 font-medium mb-1.5 text-xs">
                      <CheckCircle size={14} />
                      Store Response
                    </div>
                    <p className="text-sm text-green-900">{review.response}</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex flex-col md:flex-row gap-2">
                      <input
                        type="text"
                        className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your response..."
                        value={responseText[String(review.id)] || ''}
                        onChange={(e) => handleResponseChange(String(review.id), e.target.value)}
                      />
                      <button
                        className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${responseText[String(review.id)] ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        onClick={() => handleSendResponse(String(review.id))}
                        disabled={!responseText[String(review.id)]}
                      >
                        <Send size={14} />
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="text-gray-400" size={20} />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">No feedback found</h3>
              <p className="text-sm text-gray-500">There are no {filter === 'all' ? '' : filter} entries to display.</p>
            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </MXLayoutWhite>
  );
};

const UserInsightsPage = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    }>
      <UserInsightsContent />
    </Suspense>
  );
};

export default UserInsightsPage;