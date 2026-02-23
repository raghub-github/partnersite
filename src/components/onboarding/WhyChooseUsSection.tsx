'use client';

import {
  Zap,
  Shield,
  TrendingUp,
  HeadphonesIcon,
  type LucideIcon,
} from 'lucide-react';

const BENEFITS: {
  icon: LucideIcon;
  heading: string;
  description: string;
  gradient: string;
}[] = [
  {
    icon: Zap,
    heading: 'Quick onboarding',
    description: 'Get verified and go live in 24–48 hours with our streamlined process.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Shield,
    heading: 'Secure & reliable',
    description: 'Your data and payouts are protected with industry-standard security.',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: TrendingUp,
    heading: 'Grow your business',
    description: 'Reach more customers and increase orders with our delivery network.',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: HeadphonesIcon,
    heading: 'Dedicated support',
    description: 'Our team is here to help you succeed with fast, friendly support.',
    gradient: 'from-violet-500 to-purple-600',
  },
];

export function WhyChooseUsSection() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
          Why choose GatiMitra
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, heading, description, gradient }) => (
          <article
            key={heading}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50"
          >
            <div
              className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${gradient} p-3 text-white shadow-md transition-transform duration-300 group-hover:scale-105`}
            >
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">
              {heading}
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              {description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
