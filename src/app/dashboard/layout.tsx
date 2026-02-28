import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — AutoHue',
  description: 'View your sorting history, credit usage, and account overview.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
