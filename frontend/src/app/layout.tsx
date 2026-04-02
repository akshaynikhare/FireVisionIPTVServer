import type { Metadata } from 'next';
import { Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/query-provider';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tv.cadnative.com'),
  title: {
    default: 'FireVision IPTV',
    template: '%s | FireVision IPTV',
  },
  description:
    'FireVision IPTV — Channel Management & Administration. Self-hosted server for your Android TV IPTV player.',
  keywords: [
    'IPTV',
    'Android TV',
    'Fire TV',
    'channel management',
    'self-hosted',
    'M3U',
    'streaming',
  ],
  authors: [{ name: 'CAD Native', url: 'https://tv.cadnative.com' }],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'FireVision IPTV',
    description:
      'Self-hosted IPTV management console — channel lists, device pairing & server management.',
    url: 'https://tv.cadnative.com',
    siteName: 'FireVision IPTV',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FireVision IPTV Management Console',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FireVision IPTV',
    description:
      'Self-hosted IPTV management console — channel lists, device pairing & server management.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${manrope.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
