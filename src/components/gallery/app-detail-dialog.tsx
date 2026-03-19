'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AppCatalogItem } from '@/components/gallery/app-card';

interface LeaseInfo {
  id: string;
  compute_pool: string;
  app_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

interface AppDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: AppCatalogItem | null;
  isRunning?: boolean;
  lease?: LeaseInfo | null;
  onLaunch?: (app: AppCatalogItem) => void;
  onOpen?: (app: AppCatalogItem) => void;
  onExtend?: (leaseId: string, durationMinutes: number) => Promise<void>;
  onStop?: (leaseId: string) => Promise<void>;
  isDiscovering?: boolean;
}

const RESOURCE_LABELS: Record<string, { icon: string; label: string }> = {
  COMPUTE_POOL: { icon: '🖥', label: 'Compute Pool' },
  POSTGRES_INSTANCE: { icon: '🗄', label: 'Postgres Instance' },
  SERVICE: { icon: '⚙', label: 'Service' },
};

const EXTEND_PRESETS = [
  { label: '+30m', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '+2h', minutes: 120 },
];

// Filter out Snowflake CLI default comments
function cleanComment(comment: string | null): string | null {
  if (!comment) return null;
  if (comment.toUpperCase() === 'GENERATED_BY_SNOWFLAKECLI') return null;
  return comment;
}

function computeTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins < 60) return `${mins}m ${secs}s remaining`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m remaining`;
}

export function AppDetailDialog({
  open,
  onOpenChange,
  app,
  isRunning,
  lease,
  onLaunch,
  onOpen,
  onExtend,
  onStop,
  isDiscovering,
}: AppDetailDialogProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [extendingMinutes, setExtendingMinutes] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const isStreamlitWh = app?.app_type === 'streamlit_wh';
  const effectiveRunning = isStreamlitWh || isRunning;

  // Live countdown timer for lease expiry
  useEffect(() => {
    if (!lease?.expires_at || !isRunning || isStreamlitWh) return;
    const update = () => setTimeRemaining(computeTimeRemaining(lease.expires_at));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lease?.expires_at, isRunning, isStreamlitWh]);

  // Reset transient state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowStopConfirm(false);
      setIsStopping(false);
      setExtendingMinutes(null);
      setCopied(false);
    }
  }, [open]);

  if (!app) return null;

  const displayName = app.display_name || app.app_name;
  const icon = app.icon_emoji || '📦';
  const comment = cleanComment(app.app_comment);

  // Build resources list
  const resources: { type: string; name: string }[] = [];
  if (app.compute_pool) resources.push({ type: 'COMPUTE_POOL', name: app.compute_pool });
  if (app.postgres_instance) resources.push({ type: 'POSTGRES_INSTANCE', name: app.postgres_instance });
  if (app.service_name) resources.push({ type: 'SERVICE', name: app.service_name });

  const handleCopyEndpoint = async () => {
    if (!app.endpoint_url) return;
    const url = /^https?:\/\//i.test(app.endpoint_url) ? app.endpoint_url : `https://${app.endpoint_url}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExtend = async (minutes: number) => {
    if (!lease || !onExtend) return;
    setExtendingMinutes(minutes);
    try {
      await onExtend(lease.id, minutes);
    } finally {
      setExtendingMinutes(null);
    }
  };

  const handleStop = async () => {
    if (!lease || !onStop) return;
    setIsStopping(true);
    try {
      await onStop(lease.id);
    } finally {
      setIsStopping(false);
      setShowStopConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <div>{displayName}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {app.app_version && `v${app.app_version}`}
                {app.app_version && app.category && ' · '}
                {app.category}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Details for {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${effectiveRunning ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
            <span className="text-sm font-medium">
              {isStreamlitWh ? 'Available' : effectiveRunning ? 'Running' : 'Stopped'}
            </span>
            {app.gallery_compatible && (
              <Badge variant="secondary" className="text-xs">Gallery Compatible</Badge>
            )}
            {isStreamlitWh && (
              <Badge variant="outline" className="text-xs">Always On</Badge>
            )}
          </div>

          {/* Lease management panel (running, lease-based apps only) */}
          {isRunning && !isStreamlitWh && lease && (
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 space-y-3">
              {/* Header: lease status + countdown */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Active Lease</span>
                <span className="text-xs font-mono text-green-600 dark:text-green-400 tabular-nums">
                  {timeRemaining}
                </span>
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">
                Started {new Date(lease.created_at).toLocaleString()}
              </div>

              {/* Extend buttons */}
              {onExtend && !showStopConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 dark:text-green-300 shrink-0">Extend:</span>
                  {EXTEND_PRESETS.map(({ label, minutes }) => (
                    <button
                      key={minutes}
                      type="button"
                      disabled={extendingMinutes !== null}
                      onClick={() => handleExtend(minutes)}
                      className="text-xs px-2 py-0.5 rounded border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                    >
                      {extendingMinutes === minutes ? '...' : label}
                    </button>
                  ))}
                </div>
              )}

              {/* Stop with inline confirmation */}
              {onStop && (
                <div>
                  {!showStopConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowStopConfirm(true)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Stop App
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 dark:text-red-400">Stop this app?</span>
                      <button
                        type="button"
                        disabled={isStopping}
                        onClick={handleStop}
                        className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isStopping ? 'Stopping...' : 'Confirm Stop'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowStopConfirm(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Endpoint (when running) */}
          {effectiveRunning && app.endpoint_url && (
            <div>
              <h4 className="text-sm font-medium mb-1">Endpoint</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                  {app.endpoint_url}
                </code>
                <button
                  type="button"
                  onClick={handleCopyEndpoint}
                  className="shrink-0 text-xs px-2 py-1.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Description */}
          {comment && (
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {comment}
              </p>
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Resources</h4>
              <div className="rounded-md border divide-y">
                {resources.map((r) => {
                  const meta = RESOURCE_LABELS[r.type] || { icon: '⚙', label: r.type };
                  return (
                    <div key={`${r.type}:${r.name}`} className="flex items-center gap-3 p-2.5">
                      <span className="text-base">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{meta.label}</div>
                        <div className="text-xs text-muted-foreground font-mono break-all">{r.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Technical info */}
          <div>
            <h4 className="text-sm font-medium mb-1">Technical Info</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">App Name</dt>
              <dd className="font-mono truncate">{app.app_name}</dd>
              {app.last_synced_at && (
                <>
                  <dt className="text-muted-foreground">Last Synced</dt>
                  <dd>{new Date(app.last_synced_at).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {effectiveRunning && onOpen && (
            <Button
              variant="default"
              onClick={() => onOpen(app)}
              disabled={isDiscovering}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDiscovering ? 'Connecting...' : 'Open App ↗'}
            </Button>
          )}
          {!effectiveRunning && onLaunch && (
            <Button onClick={() => { onOpenChange(false); onLaunch(app); }}>
              Launch
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
