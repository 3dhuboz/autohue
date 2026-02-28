'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card rounded-3xl p-10 text-center max-w-md red-accent-top">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl" />
        </div>
        <h2 className="text-xl font-heading font-black mb-2">Something went wrong</h2>
        <p className="text-white/40 text-sm mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-racing px-6 py-2.5 rounded-xl text-sm font-bold"
          >
            <i className="fas fa-redo mr-2" />Try Again
          </button>
          <Link href="/" className="btn-carbon px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-home mr-2" />Home
          </Link>
        </div>
      </div>
    </div>
  );
}
