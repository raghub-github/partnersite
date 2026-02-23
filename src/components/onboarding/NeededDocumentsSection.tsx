'use client';

import {
  FileCheck,
  CheckCircle2,
  CreditCard,
  Landmark,
  UtensilsCrossed,
  Image,
  type LucideIcon,
} from 'lucide-react';

const DOCUMENTS: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: CreditCard,
    title: 'PAN Card',
    detail: 'Only valid adult PAN cards are accepted.',
  },
  {
    icon: FileCheck,
    title: 'FSSAI License Certificate',
    detail: 'A valid FSSAI license is required.',
  },
  {
    icon: Landmark,
    title: 'Bank Details',
    detail: 'Copy of cancelled cheque or bank passbook.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurant Delivery Menu',
    detail: 'Complete menu you want to list for online orders.',
  },
  {
    icon: Image,
    title: 'One Food Image',
    detail: "Used as your restaurant's cover image on GatiMitra.",
  },
];

export function NeededDocumentsSection() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <FileCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
            Documents you need
          </h2>
          <p className="text-xs text-slate-600">
            Keep these ready for a smooth onboarding
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCUMENTS.map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Optional:</span> GST Certificate –
          Required only if applicable based on the provided PAN.
        </p>
      </div>
    </section>
  );
}
