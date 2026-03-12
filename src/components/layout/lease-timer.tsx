'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ActiveLease {
  id: string;
  snowflake_lease_id: string;
  compute_pool: string;
  status: string;
  expires_at: string;
}

export function LeaseTimer() {
  const [leases, setLeases] = useState<ActiveLease[]>([]);
  const [now, setNow] = useState(Date.now());
  // Track which leases have had toast notifications fired
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchLeases = useCallback(async () => {
    try {
      const res = await fetch('/api/leases');
      if (res.ok) {
        const data = await res.json();
        const active = (data.leases || []).filter(
          (l: ActiveLease) => l.status === 'ACTIVE'
        );
        setLeases(active);
      }
    } catch {
      // Silently fail — timer is supplementary UI
    }
  }, []);

  // Fetch leases every 30 seconds
  useEffect(() => {
    fetchLeases();
    const interval = setInterval(fetchLeases, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeases]);

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Toast notifications for expiring leases
  useEffect(() => {
    for (const lease of leases) {
      const expiresAt = new Date(lease.expires_at).getTime();
      const remaining = Math.max(0, expiresAt - now);
      const remainingMinutes = remaining / 60_000;
      const key5 = `${lease.id}:5min`;
      const key1 = `${lease.id}:1min`;

      if (remainingMinutes <= 5 && remainingMinutes > 1 && !notifiedRef.current.has(key5)) {
        notifiedRef.current.add(key5);
        toast.warning(`Lease expiring soon`, {
          description: `${lease.compute_pool} expires in ${Math.ceil(remainingMinutes)} minutes. Extend from the Leases page or click the Extend button.`,
          duration: 10_000,
        });
      }

      if (remainingMinutes <= 1 && remainingMinutes > 0 && !notifiedRef.current.has(key1)) {
        notifiedRef.current.add(key1);
        toast.error(`Lease expiring in < 1 minute`, {
          description: `${lease.compute_pool} will be suspended shortly. Extend now to keep your app running.`,
          duration: 15_000,
        });
      }
    }
  }, [leases, now]);

  // Clean up notification tracking when leases disappear
  useEffect(() => {
    const activeIds = new Set(leases.map(l => l.id));
    for (const key of notifiedRef.current) {
      const leaseId = key.split(':')[0];
      if (!activeIds.has(leaseId)) {
        notifiedRef.current.delete(key);
      }
    }
  }, [leases]);

  const handleExtend = async (leaseId: string, computePool: string) => {
    try {
      await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computePool, durationMinutes: 60 }),
      });
      // Clear notifications for this lease so they can fire again if needed
      notifiedRef.current.delete(`${leaseId}:5min`);
      notifiedRef.current.delete(`${leaseId}:1min`);
      toast.success('Lease extended by 60 minutes');
      fetchLeases();
    } catch {
      // Ignore — user can retry from leases page
    }
  };

  if (leases.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {leases.map((lease) => {
        const expiresAt = new Date(lease.expires_at).getTime();
        const remaining = Math.max(0, expiresAt - now);
        const remainingMinutes = Math.floor(remaining / 60_000);
        const remainingSeconds = Math.floor((remaining % 60_000) / 1000);
        const isWarning = remainingMinutes < 10;
        const isCritical = remainingMinutes < 3;

        return (
          <div key={lease.id} className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-xs',
                isCritical && 'border-destructive text-destructive animate-pulse',
                isWarning && !isCritical && 'border-orange-500 text-orange-600'
              )}
            >
              {lease.compute_pool}: {String(remainingMinutes).padStart(2, '0')}:
              {String(remainingSeconds).padStart(2, '0')}
            </Badge>
            {isWarning && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => handleExtend(lease.id, lease.compute_pool)}
              >
                Extend
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
