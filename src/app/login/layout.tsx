import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In — AutoHue',
  description: 'Sign in to your AutoHue account to sort car photos by color.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
