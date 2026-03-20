'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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
}

const mainNavItems: NavItem[] = [
  { href: '/gallery', label: 'Gallery', icon: '🖥', minRole: 'member' },
  { href: '/leases', label: 'Leases', icon: '⏱', minRole: 'member' },
  { href: '/insights', label: 'Usage Insights', icon: '📊', minRole: 'member' },
];

const settingsNavItems: NavItem[] = [
  { href: '/settings/general', label: 'General', icon: '⚙', minRole: 'member' },
  { href: '/user-guide', label: 'User Guide', icon: '📖', minRole: 'member' },
  { href: '/settings/catalog', label: 'App Catalog', icon: '📋', minRole: 'admin' },
  { href: '/settings/schedules', label: 'Schedules', icon: '🕐', minRole: 'admin' },
  { href: '/settings/connections', label: 'Connections', icon: '🔌', minRole: 'owner' },
  { href: '/settings/members', label: 'Members', icon: '👥', minRole: 'owner' },
  { href: '/settings/audit-log', label: 'Audit Log', icon: '📜', minRole: 'owner' },
  { href: '/setup-guide', label: 'Setup Guide', icon: '🔧', minRole: 'owner' },
  { href: '/settings/promotions', label: 'Promotions', icon: '📢', minRole: 'saas_owner' },
];

interface SidebarProps {
  userEmail: string;
  userRole?: Role;
  isSaasOwner?: boolean;
}

export function Sidebar({ userEmail, userRole = 'member', isSaasOwner = false }: SidebarProps) {
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
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        <span className="text-base">{item.icon}</span>
        {item.label}
      </Link>
    );
  };

  const visibleMain = mainNavItems.filter((item) => canAccess(item.minRole));
  const visibleSettings = settingsNavItems.filter((item) => canAccess(item.minRole));

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">App Gallery</h1>
        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
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
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Snowflake App Gallery
      </div>
    </aside>
  );
}
