'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_FILTERS = [
  { value: 'all', label: 'All Actions' },
  { value: 'LEASE_STARTED', label: 'Lease Started' },
  { value: 'LEASE_EXTENDED', label: 'Lease Extended' },
  { value: 'LEASE_STOPPED', label: 'Lease Stopped' },
  { value: 'LEASE_START_ERROR', label: 'Start Error' },
  { value: 'LEASE_STOP_ERROR', label: 'Stop Error' },
  { value: 'LEASE_EXPIRED_SYNC', label: 'Expired (Sync)' },
];

function actionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action.includes('ERROR')) return 'destructive';
  if (action.includes('STOPPED') || action.includes('EXPIRED')) return 'secondary';
  if (action.includes('STARTED')) return 'default';
  return 'outline';
}

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [offset, setOffset] = useState(0);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (actionFilter !== 'all') {
      params.set('action', actionFilter);
    }

    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries || []);
      setTotalCount(data.total_count || 0);
    }
    setLoading(false);
  }, [actionFilter, offset]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    setOffset(0);
  }, [actionFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Activity history for your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No audit log entries found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={actionBadgeVariant(entry.action)}>
                          {entry.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {entry.target_type}
                          {entry.target_id && ` / ${entry.target_id}`}
                        </span>
                      </div>
                      {entry.details && (
                        <p className="text-xs text-muted-foreground font-mono max-w-lg truncate">
                          {typeof entry.details === 'object'
                            ? JSON.stringify(entry.details)
                            : String(entry.details)}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap ml-4">
                      <div>{new Date(entry.created_at).toLocaleString()}</div>
                      {entry.performed_by && (
                        <div className="font-mono truncate max-w-[120px]">
                          {entry.performed_by.slice(0, 8)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= totalCount}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
