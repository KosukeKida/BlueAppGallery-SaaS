'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { InfraSidebar } from './infra-sidebar';

interface MobileShellProps {
  userEmail: string;
  userRole: 'owner' | 'admin' | 'member';
  isSaasOwner: boolean;
  children: React.ReactNode;
}

export function MobileShell({ userEmail, userRole, isSaasOwner, children }: MobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={userEmail}
        userRole={userRole}
        isSaasOwner={isSaasOwner}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          userEmail={userEmail}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
      <InfraSidebar />
    </div>
  );
}
