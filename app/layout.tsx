import './globals.css';
import './opds.css';
import './partner-execution-parity.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import CookieConsent from '@/components/CookieConsent';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Overflow Partner | CAD/CAM Overflow Engineering Support',
  description:
    'Overflow CAD/CAM engineering support for teams that need production-ready drawings, reverse engineering, and technical documentation when capacity is stretched.',
  openGraph: {
    title: 'Overflow Partner | CAD/CAM Overflow Engineering Support',
    description:
      'Production-ready CAD, reverse engineering, and drawing support for engineering teams under delivery pressure.',
    url: siteUrl,
    siteName: 'Overflow Partner',
    type: 'website',
  },
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  twitter: {
    card: 'summary_large_image',
    title: 'Overflow Partner | CAD/CAM Overflow Engineering Support',
    description: 'Overflow CAD/CAM support for teams that need precise engineering output without slowing down.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body>{children}<CookieConsent /><Analytics /><SpeedInsights /></body></html>;
}
