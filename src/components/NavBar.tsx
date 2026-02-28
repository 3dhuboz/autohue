'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;
  const linkClass = (path: string) =>
    `transition-colors ${isActive(path) ? 'text-racing-500' : 'text-white/40 hover:text-white'}`;

  const isAdmin = session?.user?.role === 'ADMIN';
  const isAuth = status === 'authenticated';

  return (
    <header className="border-b border-white/5 glass-card-solid sticky top-0 z-50">
      <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="AutoHue" width={44} height={44} className="w-11 h-11 object-contain" priority />
          <span className="font-heading text-lg font-bold">
            <span className="text-white">Auto</span>
            <span className="text-racing-500">Hue</span>
          </span>
          {pathname.startsWith('/admin') && (
            <span className="bg-racing-600/20 text-racing-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {isAuth ? (
            <>
              <Link href="/sort" className={linkClass('/sort')}>Sort Photos</Link>
              <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
              <Link href="/account" className={linkClass('/account')}>Account</Link>
              {isAdmin && (
                <Link href="/admin" className={linkClass('/admin')}>Admin</Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-white/30 hover:text-white/60 transition-colors ml-2"
                title="Sign out"
              >
                <i className="fas fa-sign-out-alt" />
              </button>
            </>
          ) : (
            <>
              <Link href="/sort" className={linkClass('/sort')}>Sort Photos</Link>
              <Link href="/login" className={linkClass('/login')}>Log In</Link>
              <Link href="/register" className="btn-racing px-4 py-1.5 rounded-lg text-xs font-bold">
                Get Started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-white/40 hover:text-white transition-colors"
          title="Toggle menu"
        >
          <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 px-6 py-4 space-y-3 bg-carbon-900/95 backdrop-blur-xl">
          {isAuth ? (
            <>
              <MobileLink href="/sort" label="Sort Photos" icon="fa-palette" active={isActive('/sort')} onClick={() => setMobileOpen(false)} />
              <MobileLink href="/dashboard" label="Dashboard" icon="fa-chart-bar" active={isActive('/dashboard')} onClick={() => setMobileOpen(false)} />
              <MobileLink href="/account" label="Account" icon="fa-user" active={isActive('/account')} onClick={() => setMobileOpen(false)} />
              {isAdmin && (
                <MobileLink href="/admin" label="Admin" icon="fa-shield-alt" active={isActive('/admin')} onClick={() => setMobileOpen(false)} />
              )}
              <button
                onClick={() => { signOut({ callbackUrl: '/' }); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full text-left text-sm text-white/30 hover:text-white/60 py-2"
              >
                <i className="fas fa-sign-out-alt w-4 text-center" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <MobileLink href="/sort" label="Sort Photos" icon="fa-palette" active={isActive('/sort')} onClick={() => setMobileOpen(false)} />
              <MobileLink href="/login" label="Log In" icon="fa-sign-in-alt" active={isActive('/login')} onClick={() => setMobileOpen(false)} />
              <MobileLink href="/register" label="Get Started" icon="fa-rocket" active={isActive('/register')} onClick={() => setMobileOpen(false)} />
            </>
          )}
        </div>
      )}
    </header>
  );
}

function MobileLink({ href, label, icon, active, onClick }: {
  href: string; label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 text-sm py-2 transition-colors ${active ? 'text-racing-500' : 'text-white/40 hover:text-white'}`}
    >
      <i className={`fas ${icon} w-4 text-center`} /> {label}
    </Link>
  );
}
