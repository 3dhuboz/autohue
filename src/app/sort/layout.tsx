import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sort Car Photos — AutoHue',
  description: 'Upload and sort car photos by color using AI. Fast, accurate batch processing.',
};

export default function SortLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
