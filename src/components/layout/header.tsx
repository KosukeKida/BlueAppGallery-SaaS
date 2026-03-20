'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LeaseTimer } from './lease-timer';

interface HeaderProps {
  userEmail: string;
  onMenuToggle?: () => void;
}

export function Header({ userEmail, onMenuToggle }: HeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch('/api/auth/callback', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger menu for mobile */}
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        )}
        <LeaseTimer />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">{userEmail}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
