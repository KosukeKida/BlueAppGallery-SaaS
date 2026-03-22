'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { InfraSidebar } from './infra-sidebar';

interface TenantInfo {
  id: string;
  name: string;
  role: string;
}

interface MobileShellProps {
  userEmail: string;
  userRole: 'owner' | 'admin' | 'member';
  isSaasOwner: boolean;
  activeTenantId?: string;
  activeTenantName?: string;
  tenants?: TenantInfo[];
  children: React.ReactNode;
}

export function MobileShell({ userEmail, userRole, isSaasOwner, activeTenantId, activeTenantName, tenants, children }: MobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={userEmail}
        userRole={userRole}
        isSaasOwner={isSaasOwner}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTenantId={activeTenantId}
        activeTenantName={activeTenantName}
        tenants={tenants}
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
