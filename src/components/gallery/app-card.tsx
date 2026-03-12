'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useLaunchProgress } from '@/hooks/use-launch-progress';

export interface AppCatalogItem {
  id: string;
  app_name: string;
  display_name: string | null;
  icon_emoji: string | null;
  app_version: string | null;
  app_status: string | null;
  app_comment: string | null;
  category: string | null;
  is_visible: boolean;
  sort_order: number;
  last_synced_at: string | null;
  compute_pool: string | null;
  service_name: string | null;
  postgres_instance: string | null;
  endpoint_url: string | null;
  gallery_compatible: boolean;
}

interface AppCardProps {
  app: AppCatalogItem;
  isRunning?: boolean;
  isDiscovering?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (appId: string) => void;
  onClick?: (app: AppCatalogItem) => void;
}

const ICON_BG: Record<string, string> = {
  Analytics: 'bg-blue-500/15',
  'AI/ML': 'bg-purple-500/15',
  Operations: 'bg-green-500/15',
  Governance: 'bg-red-500/15',
  Tools: 'bg-orange-500/15',
};

export function AppCard({ app, isRunning, isDiscovering, isFavorite, onToggleFavorite, onClick }: AppCardProps) {
  const displayName = app.display_name || app.app_name;
  const icon = app.icon_emoji || '📦';
  const iconBg = ICON_BG[app.category || ''] || 'bg-muted';

  const launchProgress = useLaunchProgress(app.id);
  const isLaunching = launchProgress && (launchProgress.status === 'starting' || launchProgress.status === 'polling');
  const isReady = launchProgress?.status === 'ready';
  // Treat launch-ready as running so text/button stay green until leases catch up
  const effectiveRunning = isRunning || isReady;

  return (
    <button
      type="button"
      onClick={() => onClick?.(app)}
      className={cn(
        'group relative flex flex-col text-left rounded-xl border bg-card p-4',
        'hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer',
        effectiveRunning && !isLaunching && 'ring-2 ring-green-500/50 border-green-500/30',
        isLaunching && 'ring-2 ring-blue-500/50 border-blue-500/30'
      )}
    >
      {/* Favorite star */}
      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(app.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onToggleFavorite(app.id);
            }
          }}
          className={cn(
            'absolute top-2 right-2 text-sm transition-opacity',
            isFavorite
              ? 'opacity-100 text-yellow-500'
              : 'opacity-0 group-hover:opacity-60 text-muted-foreground'
          )}
        >
          {isFavorite ? '★' : '☆'}
        </span>
      )}

      {/* Header: Icon + Name + Version */}
      <div className="flex items-start gap-3 mb-2">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate pr-5">{displayName}</div>
          <div className="text-xs text-muted-foreground">
            {app.app_version ? `v${app.app_version}` : ''}
            {app.app_version && app.category ? ' · ' : ''}
            {app.category || ''}
          </div>
        </div>
      </div>

      {/* Description */}
      {app.app_comment && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {app.app_comment}
        </p>
      )}

      {/* Launch progress bar (when launching in background) */}
      {isLaunching && (
        <div className="mb-2 space-y-1">
          <Progress value={launchProgress.progress} className="h-1.5" />
          <p className="text-[10px] text-blue-600 dark:text-blue-400 animate-pulse">
            {launchProgress.status === 'polling' ? 'Waiting for endpoint...' : 'Starting...'}
          </p>
        </div>
      )}

      {/* Footer: Status + Action */}
      <div className="mt-auto flex items-center justify-between">
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          isLaunching ? 'text-blue-500' : effectiveRunning ? 'text-green-500' : 'text-muted-foreground'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isLaunching ? 'bg-blue-500 animate-pulse' : effectiveRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'
          )} />
          {isLaunching ? 'Starting' : effectiveRunning ? 'Running' : 'Stopped'}
        </div>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-md transition-colors',
          isLaunching
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 animate-pulse'
            : isDiscovering
              ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 animate-pulse'
              : effectiveRunning
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-primary/10 text-primary'
        )}>
          {isLaunching ? 'Starting...' : isDiscovering ? 'Connecting...' : effectiveRunning ? 'Open ↗' : 'Launch ▶'}
        </span>
      </div>
    </button>
  );
}
