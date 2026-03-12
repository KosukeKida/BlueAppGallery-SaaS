'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LeaseTimer } from './lease-timer';

interface HeaderProps {
  userEmail: string;
}

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch('/api/auth/callback', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <LeaseTimer />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{userEmail}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
