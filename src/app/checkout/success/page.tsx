'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CheckoutSuccessPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/dashboard';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card rounded-3xl p-10 text-center max-w-md red-accent-top animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-check text-green-500 text-3xl" />
        </div>
        <h1 className="text-2xl font-heading font-black mb-2">Payment Successful!</h1>
        <p className="text-white/40 text-sm mb-6">
          Your subscription has been activated. You now have access to all features in your plan.
        </p>
        <p className="text-white/20 text-xs mb-6">
          Redirecting to dashboard in {countdown}s...
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-racing px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-chart-bar mr-2" />Go to Dashboard
          </Link>
          <Link href="/sort" className="btn-carbon px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-palette mr-2" />Start Sorting
          </Link>
        </div>
      </div>
    </div>
  );
}
