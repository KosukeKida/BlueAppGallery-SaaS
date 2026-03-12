'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const mainNavItems = [
  { href: '/gallery', label: 'Gallery', icon: '🖥' },
  { href: '/leases', label: 'Leases', icon: '⏱' },
];

const settingsNavItems = [
  { href: '/settings/general', label: 'General', icon: '⚙', minRole: 'member' as const },
  { href: '/settings/connections', label: 'Connections', icon: '🔌', minRole: 'admin' as const },
  { href: '/settings/catalog', label: 'App Catalog', icon: '📋', minRole: 'admin' as const },
  { href: '/settings/members', label: 'Members', icon: '👥', minRole: 'admin' as const },
  { href: '/settings/audit-log', label: 'Audit Log', icon: '📜', minRole: 'admin' as const },
];

type Role = 'owner' | 'admin' | 'member';

const ROLE_LEVEL: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

function hasAccess(userRole: Role, minRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

interface SidebarProps {
  userEmail: string;
  userRole?: Role;
}

export function Sidebar({ userEmail, userRole = 'member' }: SidebarProps) {
  const pathname = usePathname();

  const renderNavItem = (item: { href: string; label: string; icon: string }) => {
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

  const visibleSettings = settingsNavItems.filter(
    (item) => hasAccess(userRole, item.minRole)
  );

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">App Gallery</h1>
        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {mainNavItems.map(renderNavItem)}
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
