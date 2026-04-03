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
    default: 'FireVision IPTV — Self-Hosted Android TV IPTV Player & Management Console',
    template: '%s | FireVision IPTV',
  },
  description:
    'FireVision IPTV is a self-hosted IPTV management console for Android TV and Fire TV. Import M3U playlists, manage channels, pair devices, and monitor streams — all from one dashboard.',
  keywords: [
    'IPTV',
    'Android TV',
    'Fire TV',
    'IPTV player',
    'self-hosted IPTV',
    'M3U player',
    'channel management',
    'IPTV server',
    'streaming',
    'Fire TV IPTV app',
    'open source IPTV',
  ],
  authors: [{ name: 'Akshay Nikhare', url: 'https://github.com/akshaynikhare' }],
  creator: 'Akshay Nikhare',
  publisher: 'CAD Native',
  alternates: {
    canonical: 'https://tv.cadnative.com',
    types: {
      'text/plain': '/llms.txt',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'FireVision IPTV — Self-Hosted IPTV for Android TV',
    description:
      'Import M3U playlists, pair Fire TV devices, manage channels, and monitor streams. Open-source and self-hosted.',
    url: 'https://tv.cadnative.com',
    siteName: 'FireVision IPTV',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FireVision IPTV — Self-hosted IPTV management console with channel management, device pairing, and stream monitoring',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FireVision IPTV — Self-Hosted IPTV for Android TV',
    description:
      'Import M3U playlists, pair Fire TV devices, manage channels, and monitor streams. Open-source.',
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
