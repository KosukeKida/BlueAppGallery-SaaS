'use client';

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
  isDiscovering?: boolean;
}

const RESOURCE_LABELS: Record<string, { icon: string; label: string }> = {
  COMPUTE_POOL: { icon: '🖥', label: 'Compute Pool' },
  POSTGRES_INSTANCE: { icon: '🗄', label: 'Postgres Instance' },
  SERVICE: { icon: '⚙', label: 'Service' },
};

// Filter out Snowflake CLI default comments
function cleanComment(comment: string | null): string | null {
  if (!comment) return null;
  if (comment.toUpperCase() === 'GENERATED_BY_SNOWFLAKECLI') return null;
  return comment;
}

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m remaining`;
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
  isDiscovering,
}: AppDetailDialogProps) {
  if (!app) return null;

  const displayName = app.display_name || app.app_name;
  const icon = app.icon_emoji || '📦';
  const comment = cleanComment(app.app_comment);

  // Build resources list
  const resources: { type: string; name: string }[] = [];
  if (app.compute_pool) resources.push({ type: 'COMPUTE_POOL', name: app.compute_pool });
  if (app.postgres_instance) resources.push({ type: 'POSTGRES_INSTANCE', name: app.postgres_instance });
  if (app.service_name) resources.push({ type: 'SERVICE', name: app.service_name });

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
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
            <span className="text-sm font-medium">{isRunning ? 'Running' : 'Stopped'}</span>
            {app.gallery_compatible && (
              <Badge variant="secondary" className="text-xs">Gallery Compatible</Badge>
            )}
          </div>

          {/* Lease info (when running) */}
          {isRunning && lease && (
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Active Lease</span>
                <span className="text-xs text-green-600 dark:text-green-400">
                  {formatTimeRemaining(lease.expires_at)}
                </span>
              </div>
              <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                Started {new Date(lease.created_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Endpoint (when running) */}
          {isRunning && app.endpoint_url && (
            <div>
              <h4 className="text-sm font-medium mb-1">Endpoint</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                  {app.endpoint_url}
                </code>
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
          {isRunning && onOpen && (
            <Button
              variant="default"
              onClick={() => onOpen(app)}
              disabled={isDiscovering}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDiscovering ? 'Connecting...' : 'Open App ↗'}
            </Button>
          )}
          {!isRunning && onLaunch && (
            <Button onClick={() => { onOpenChange(false); onLaunch(app); }}>
              Launch
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
