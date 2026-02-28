import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings — AutoHue',
  description: 'Manage your subscription, credits, and profile settings.',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
