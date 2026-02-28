import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Panel — AutoHue',
  description: 'Manage users, subscriptions, and platform settings.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
