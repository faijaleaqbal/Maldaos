import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { IssuesProvider } from '@/context/IssuesContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'CampusPulse | Malda College Campus Operations & AI Reporting',
  description:
    'Institutional operations and AI-assisted campus incident reporting platform for Malda College, West Bengal. Estd. 1944.',
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
        <AuthProvider>
          <IssuesProvider>
            <Navbar />
            <main className="flex-1 pb-20 md:pb-10">
              {children}
            </main>
            <BottomNav />
          </IssuesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
