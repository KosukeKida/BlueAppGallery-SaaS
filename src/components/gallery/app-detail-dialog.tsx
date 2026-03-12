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

interface AppDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: AppCatalogItem | null;
  isRunning?: boolean;
  onLaunch?: (app: AppCatalogItem) => void;
}

const RESOURCE_LABELS: Record<string, { icon: string; label: string }> = {
  COMPUTE_POOL: { icon: '🖥', label: 'Compute Pool' },
  POSTGRES_INSTANCE: { icon: '🗄', label: 'Postgres Instance' },
  SERVICE: { icon: '⚙', label: 'Service' },
};

export function AppDetailDialog({ open, onOpenChange, app, isRunning, onLaunch }: AppDetailDialogProps) {
  if (!app) return null;

  const displayName = app.display_name || app.app_name;
  const icon = app.icon_emoji || '📦';

  // Build resources list
  const resources: { type: string; name: string }[] = [];
  if (app.compute_pool) resources.push({ type: 'COMPUTE_POOL', name: app.compute_pool });
  if (app.postgres_instance) resources.push({ type: 'POSTGRES_INSTANCE', name: app.postgres_instance });
  if (app.service_name) resources.push({ type: 'SERVICE', name: app.service_name });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            {app.app_status && app.app_status !== 'READY' && (
              <Badge variant="secondary" className="text-xs">{app.app_status}</Badge>
            )}
          </div>

          {/* Description */}
          {app.app_comment && (
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {app.app_comment}
              </p>
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Required Resources</h4>
              <div className="rounded-md border divide-y">
                {resources.map((r) => {
                  const meta = RESOURCE_LABELS[r.type] || { icon: '⚙', label: r.type };
                  return (
                    <div key={`${r.type}:${r.name}`} className="flex items-center gap-3 p-2.5">
                      <span className="text-base">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{meta.label}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{r.name}</div>
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
              {app.endpoint_url && (
                <>
                  <dt className="text-muted-foreground">Endpoint</dt>
                  <dd className="font-mono truncate">{app.endpoint_url}</dd>
                </>
              )}
              {app.last_synced_at && (
                <>
                  <dt className="text-muted-foreground">Last Synced</dt>
                  <dd>{new Date(app.last_synced_at).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
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
