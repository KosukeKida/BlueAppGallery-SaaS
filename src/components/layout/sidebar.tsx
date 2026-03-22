'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TenantSwitcher } from './tenant-switcher';

type Role = 'owner' | 'admin' | 'member';
type Visibility = Role | 'saas_owner';

const ROLE_LEVEL: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole: Visibility;
  newTab?: boolean;
}

const mainNavItems: NavItem[] = [
  { href: '/gallery', label: 'Gallery', icon: '🖥', minRole: 'member' },
  { href: '/leases', label: 'Leases', icon: '⏱', minRole: 'member' },
  { href: '/insights', label: 'Usage Insights', icon: '📊', minRole: 'member' },
  { href: '/user-guide', label: 'User Guide', icon: '📖', minRole: 'member' },
];

const settingsNavItems: NavItem[] = [
  { href: '/settings/general', label: 'General', icon: '⚙', minRole: 'member' },
  { href: '/settings/catalog', label: 'App Catalog', icon: '📋', minRole: 'admin' },
  { href: '/settings/schedules', label: 'Schedules', icon: '🕐', minRole: 'admin' },
  { href: '/settings/connections', label: 'Connections', icon: '🔌', minRole: 'owner' },
  { href: '/settings/members', label: 'Members', icon: '👥', minRole: 'owner' },
  { href: '/settings/audit-log', label: 'Audit Log', icon: '📜', minRole: 'owner' },
  { href: '/setup-guide', label: 'Setup Guide', icon: '🔧', minRole: 'owner', newTab: true },
];

const saasAdminNavItems: NavItem[] = [
  { href: '/settings/promotions', label: 'Promotions', icon: '📢', minRole: 'saas_owner' },
];

interface TenantInfo {
  id: string;
  name: string;
  role: string;
}

interface SidebarProps {
  userEmail: string;
  userRole?: Role;
  isSaasOwner?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  activeTenantId?: string;
  activeTenantName?: string;
  tenants?: TenantInfo[];
}

export function Sidebar({ userEmail, userRole = 'member', isSaasOwner = false, isOpen, onClose, activeTenantId, activeTenantName, tenants }: SidebarProps) {
  const pathname = usePathname();

  const canAccess = (minRole: Visibility): boolean => {
    if (minRole === 'saas_owner') return isSaasOwner;
    return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
  };

  const renderNavItem = (item: NavItem) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        <span className="text-base">{item.icon}</span>
        {item.label}
        {item.newTab && <span className="text-xs text-muted-foreground ml-auto">↗</span>}
      </Link>
    );
  };

  const visibleMain = mainNavItems.filter((item) => canAccess(item.minRole));
  const visibleSettings = settingsNavItems.filter((item) => canAccess(item.minRole));
  const visibleSaasAdmin = saasAdminNavItems.filter((item) => canAccess(item.minRole));

  const sidebarContent = (
    <>
      <div className="p-4 border-b space-y-1.5">
        <img src="/logo-gallery.svg" alt="Blue App Gallery" className="h-10 w-auto" />
        {activeTenantId && activeTenantName && tenants ? (
          <TenantSwitcher
            activeTenantId={activeTenantId}
            activeTenantName={activeTenantName}
            tenants={tenants}
          />
        ) : null}
        <p className="text-xs text-muted-foreground truncate px-3">{userEmail}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleMain.map(renderNavItem)}
        {visibleSettings.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Settings
              </p>
            </div>
            {visibleSettings.map(renderNavItem)}
          </>
        )}
        {visibleSaasAdmin.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SaaS Admin
              </p>
            </div>
            {visibleSaasAdmin.map(renderNavItem)}
          </>
        )}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        <span className="font-brand font-bold" style={{ color: '#0E2A47' }}>Blue App Works</span>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-muted/30 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r flex flex-col md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
