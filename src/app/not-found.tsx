import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card rounded-3xl p-10 text-center max-w-md red-accent-top">
        <div className="text-7xl font-heading font-black text-racing-500 mb-4">404</div>
        <h2 className="text-xl font-heading font-black mb-2">Page Not Found</h2>
        <p className="text-white/40 text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-racing px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-home mr-2" />Home
          </Link>
          <Link href="/sort" className="btn-carbon px-6 py-2.5 rounded-xl text-sm font-bold">
            <i className="fas fa-palette mr-2" />Sort Photos
          </Link>
        </div>
      </div>
    </div>
  );
}
