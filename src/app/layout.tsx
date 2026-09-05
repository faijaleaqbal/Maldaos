import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { IssuesProvider } from '@/context/IssuesContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'MaldaOS | Malda College Campus Operations & Incident Management',
  description:
    'Institutional operations and incident reporting platform for Malda College, West Bengal. Estd. 1944.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-warm-100 text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-maroon-900 focus:text-gold-300 focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-gold-400 font-medium text-xs"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <IssuesProvider>
            <Navbar />
            <main id="main-content" className="flex-1 pb-24 lg:pb-10">
              {children}
            </main>
            <Footer />
            <BottomNav />
          </IssuesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
