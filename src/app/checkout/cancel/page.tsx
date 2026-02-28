import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card rounded-3xl p-10 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-times text-white/30 text-3xl" />
        </div>
        <h1 className="text-2xl font-heading font-black mb-2">Checkout Cancelled</h1>
        <p className="text-white/40 text-sm mb-6">
          No worries — your account has not been charged. You can upgrade at any time.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/#pricing" className="btn-racing px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-tags mr-2" />View Plans
          </Link>
          <Link href="/dashboard" className="btn-carbon px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-arrow-left mr-2" />Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
