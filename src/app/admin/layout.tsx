import React from 'react';
import { AdminNav } from '@/components/layout/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-warm-100 flex flex-col">
      <AdminNav />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
