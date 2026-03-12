'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useHeartbeat } from '@/hooks/use-heartbeat';

interface Lease {
  id: string;
  snowflake_lease_id: string;
  compute_pool: string;
  status: string;
  expires_at: string | null;
  initiated_by: string;
  created_at: string;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const;
    case 'STOPPED':
      return 'secondary' as const;
    case 'EXPIRED':
      return 'outline' as const;
    case 'ERROR':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
};

function formatRemaining(expiresAt: string | null): string {
  if (!expiresAt) return '-';
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const minutes = Math.floor(remaining / 60_000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<Lease | null>(null);

  // Find the first active lease for heartbeat
  const activeLease = leases.find((l) => l.status === 'ACTIVE');
  useHeartbeat({
    leaseId: activeLease?.id ?? null,
    enabled: !!activeLease,
  });

  const fetchLeases = useCallback(async () => {
    try {
      const res = await fetch('/api/leases');
      if (res.ok) {
        const data = await res.json();
        setLeases(data.leases || []);
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeases();
    const interval = setInterval(fetchLeases, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeases]);

  const handleStop = async (lease: Lease) => {
    setStopping(lease.id);
    try {
      const res = await fetch(`/api/leases/${lease.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to stop lease');
      }
      await fetchLeases();
    } catch {
      alert('Failed to stop lease');
    }
    setStopping(null);
    setConfirmStop(null);
  };

  const handleExtend = async (lease: Lease) => {
    try {
      const res = await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computePool: lease.compute_pool,
          durationMinutes: 60,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || data.error || 'Failed to extend');
      }
      await fetchLeases();
    } catch {
      alert('Failed to extend lease');
    }
  };

  // Tick every 60s to update countdown displays
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const activeCount = leases.filter((l) => l.status === 'ACTIVE').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Lease Management</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount} active lease{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLeases}>
          Refresh
        </Button>
      </div>

      {/* Active Leases Summary Cards */}
      {activeCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {leases
            .filter((l) => l.status === 'ACTIVE')
            .map((lease) => (
              <Card key={lease.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{lease.compute_pool}</span>
                    <Badge variant="default">ACTIVE</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold mb-2">
                    {formatRemaining(lease.expires_at)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExtend(lease)}
                    >
                      Extend +1h
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmStop(lease)}
                      disabled={stopping === lease.id}
                    >
                      {stopping === lease.id ? 'Stopping...' : 'Stop'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* All Leases Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : leases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No leases found. Start one from the Gallery.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compute Pool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lease ID</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((lease) => (
                <TableRow key={lease.id}>
                  <TableCell className="font-medium">
                    {lease.compute_pool}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(lease.status)}>
                      {lease.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {lease.snowflake_lease_id?.slice(0, 8) ?? '-'}
                  </TableCell>
                  <TableCell>
                    {lease.status === 'ACTIVE'
                      ? formatRemaining(lease.expires_at)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(lease.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {lease.status === 'ACTIVE' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExtend(lease)}
                        >
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setConfirmStop(lease)}
                          disabled={stopping === lease.id}
                        >
                          Stop
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Stop Confirmation Dialog */}
      <AlertDialog
        open={!!confirmStop}
        onOpenChange={(open) => {
          if (!open) setConfirmStop(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Lease?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the compute lease for{' '}
              <strong>{confirmStop?.compute_pool}</strong>. Running applications
              will be terminated. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmStop && handleStop(confirmStop)}
            >
              Stop Lease
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
