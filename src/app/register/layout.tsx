import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account — AutoHue',
  description: 'Sign up for AutoHue and start sorting car photos by color with AI.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
