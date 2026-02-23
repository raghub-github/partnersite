'use client';

import Link from 'next/link';
import { ChefHat, Store, ArrowRight, FileCheck, Clock, CreditCard, HelpCircle, Percent, Wallet, CheckCircle2 } from 'lucide-react';

export default function AuthHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="GatiMitra" className="h-8 w-auto object-contain" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Partner Portal</span>
      </header>

      {/* Main */}
      <main className="flex flex-col items-center px-4 py-8 sm:py-12 pb-16">
        <div className="w-full max-w-lg flex flex-col items-center">
          {/* Hero + Actions – compact width */}
          <div className="w-full max-w-sm">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-auto items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 mb-5 px-3 py-2">
              <img src="/logo.png" alt="GatiMitra" className="h-10 w-auto object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Welcome to GatiMitra
            </h1>
            <p className="text-sm text-slate-600 mb-1">
              Manage your store and grow your business
            </p>
            <p className="text-xs text-slate-500">
              Join thousands of restaurant partners
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 mb-12">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="flex items-center gap-2.5">
                <Store className="h-4 w-4" />
                Join GatiMitra as a merchant
              </span>
              <ArrowRight className="h-4 w-4 opacity-80" />
            </Link>
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:bg-slate-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="flex items-center gap-2.5">
                <ChefHat className="h-4 w-4 text-blue-600" />
                Sign in to your partner account
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
          </div>

          {/* For Restaurants – What you need to know */}
          <div className="w-full space-y-6 text-left">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">
              For Restaurants – Start deliveries through GatiMitra
            </h2>

            {/* Mandatory Documents */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                <FileCheck className="h-4 w-4 text-green-600" />
                Mandatory Documents
              </h3>
              <p className="text-xs text-slate-600 mb-3">Keep these ready for a smooth onboarding:</p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span><strong>PAN Card</strong> – Only valid adult PAN cards are accepted.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span><strong>FSSAI License Certificate</strong> – A valid FSSAI license is required.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span><strong>Bank Details</strong> – Copy of cancelled cheque or bank passbook.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span><strong>Restaurant Delivery Menu</strong> – Complete menu you want to list for online orders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span><strong>One Food Image</strong> – Used as your restaurant’s cover image on GatiMitra.</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-200">
                <strong>Optional:</strong> GST Certificate – Required only if applicable based on the provided PAN.
              </p>
            </section>

            {/* Go live timeline */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                How long to go live?
              </h3>
              <p className="text-xs text-slate-700">
                Once all mandatory documents are submitted and onboarding is completed, we typically take <strong>24–48 hours</strong> to verify documents and set up your menu. If everything is correct, your restaurant will start accepting orders in this timeframe. If any document is rejected, go-live may be delayed until corrected documents are resubmitted.
              </p>
            </section>

            {/* Onboarding fee */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                One-time onboarding fee
              </h3>
              <p className="text-xs text-slate-700 mb-2">
                GatiMitra charges a one-time onboarding fee covering document verification, menu setup and digitization, platform configuration, quality checks, and merchant onboarding support and training.
              </p>
              <p className="text-xs text-slate-700">
                <strong>The fee is collected once during the onboarding process.</strong>
              </p>
            </section>

            {/* Support */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <HelpCircle className="h-4 w-4 text-slate-600" />
                Help and support
              </h3>
              <p className="text-xs text-slate-700 mb-2">Our support team is ready to help.</p>
              <p className="text-xs text-slate-700">
                Email us at:{' '}
                <a href="mailto:support@gatimitra.com" className="text-blue-600 hover:underline font-medium">
                  support@gatimitra.com
                </a>
                . We respond within 2–3 hours.
              </p>
            </section>

            {/* Commission */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <Percent className="h-4 w-4 text-slate-600" />
                Commission
              </h3>
              <p className="text-xs text-slate-700">
                GatiMitra charges a commission for order processing, platform hosting, marketing, logistics support, technology, and customer support. Rates may vary by city, location, and restaurant category. Your exact commission will be shared during onboarding.
              </p>
            </section>

            {/* Payouts */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <Wallet className="h-4 w-4 text-green-600" />
                Payouts
              </h3>
              <p className="text-xs text-slate-700">
                Two payouts every week – <strong>Tuesday</strong> and <strong>Friday</strong>. Payments are transferred directly to your registered bank account.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
