import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/providers/SessionProvider';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'AutoHue — AI Car Photo Color Sorter',
  description: 'Sort thousands of car photos by color in seconds. AI-powered detection, instant classification, professional results.',
  keywords: ['car photos', 'color sorting', 'AI', 'automotive photography', 'batch processing'],
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'AutoHue — AI Car Photo Color Sorter',
    description: 'Sort thousands of car photos by color in seconds. AI-powered detection, instant classification, professional results.',
    images: [{ url: '/logo.png', width: 1024, height: 683, alt: 'AutoHue Logo' }],
    siteName: 'AutoHue',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoHue — AI Car Photo Color Sorter',
    description: 'Sort thousands of car photos by color in seconds.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="min-h-screen bg-carbon-500 text-white antialiased">
        <div className="racing-mesh" />
        <div className="carbon-texture fixed inset-0 z-[-1] pointer-events-none" />
        <SessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
