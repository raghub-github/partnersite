'use client';

import Link from 'next/link';
import { ChefHat, Store, ArrowRight, ChevronDown } from 'lucide-react';
import { WhyChooseUsSection } from '@/components/onboarding/WhyChooseUsSection';
import { NeededDocumentsSection } from '@/components/onboarding/NeededDocumentsSection';
import { FAQSection } from '@/components/onboarding/FAQSection';

export default function AuthHome() {
  const scrollToContent = () => {
    document.getElementById('below-fold')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="GatiMitra" className="h-8 w-auto object-contain" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Partner Portal
        </span>
      </header>

      {/* First screen: hero block – full viewport, centered, wider text + scroll hint */}
      <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 sm:px-6 py-8 sm:py-10">
        {/* Centered content – more width for text */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center">
          {/* Logo */}
          <div className="inline-flex h-20 w-24 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/60 mb-6 px-5 py-3">
            <img src="/logo.png" alt="GatiMitra" className="h-12 sm:h-14 w-auto object-contain" />
          </div>
          <p className="text-base font-medium text-slate-500 tracking-wide mb-2">GatiMitra</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4 max-w-xl mx-auto">
            Welcome to GatiMitra
          </h1>
          <p className="text-base sm:text-lg text-slate-600 mb-2 max-w-md mx-auto leading-relaxed">
            Manage your store and grow your business
          </p>
          <p className="text-sm sm:text-base text-slate-500 mb-10 max-w-md mx-auto">
            Join thousands of restaurant partners
          </p>

          {/* Buttons – wider */}
          <div className="w-full max-w-md space-y-4 mb-10">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none active:translate-y-0"
            >
              <span className="flex items-center gap-2.5">
                <Store className="h-5 w-5" />
                Join GatiMitra as a merchant
              </span>
              <ArrowRight className="h-5 w-5 opacity-80" />
            </Link>
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow focus:outline-none active:translate-y-0"
            >
              <span className="flex items-center gap-2.5">
                <ChefHat className="h-5 w-5 text-blue-600" />
                Sign in to your partner account
              </span>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>
          </div>

          {/* For Restaurants – wider, more prominent */}
          <p className="text-base sm:text-lg font-semibold text-slate-700 max-w-lg mx-auto leading-snug">
            For Restaurants – Start deliveries through GatiMitra
          </p>
        </div>

        {/* Scroll hint – animated */}
        <button
          type="button"
          onClick={scrollToContent}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors pb-4 sm:pb-6 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 rounded-lg"
          aria-label="Scroll to see more"
        >
          <span className="text-xs font-medium uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="h-8 w-8 animate-bounce" aria-hidden />
        </button>
      </section>

      {/* Below the fold: scroll to see Why choose, Documents, FAQ */}
      <main id="below-fold" className="px-[5vw] py-12 pb-16">
        <div className="w-full max-w-6xl mx-auto space-y-12 text-left">
          <WhyChooseUsSection />
          <NeededDocumentsSection />
          <FAQSection />
        </div>
      </main>
    </div>
  );
}
