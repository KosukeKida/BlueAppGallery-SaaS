'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// Demo App Card - static version without hooks
interface DemoAppCardProps {
  name: string;
  icon: string;
  category?: string;
  version?: string;
  description?: string;
  state: 'stopped' | 'starting' | 'running' | 'always-on';
  progress?: number;
  isFavorite?: boolean;
}

export function DemoAppCard({
  name,
  icon,
  category,
  version,
  description,
  state,
  progress = 0,
  isFavorite = false,
}: DemoAppCardProps) {
  const isRunning = state === 'running' || state === 'always-on';
  const isStarting = state === 'starting';
  const isAlwaysOn = state === 'always-on';

  const ICON_BG: Record<string, string> = {
    Analytics: 'bg-blue-500/15',
    'AI/ML': 'bg-purple-500/15',
    Operations: 'bg-green-500/15',
    Tools: 'bg-orange-500/15',
  };

  const iconBg = ICON_BG[category || ''] || 'bg-muted';

  return (
    <div
      className={cn(
        'relative flex flex-col text-left rounded-xl border bg-card p-4 min-h-[140px]',
        isRunning && !isStarting && 'ring-2 ring-green-500/50 border-green-500/30',
        isStarting && 'ring-2 ring-blue-500/50 border-blue-500/30'
      )}
    >
      {/* Favorite star */}
      <span
        className={cn(
          'absolute top-2 right-2 text-sm',
          isFavorite ? 'text-yellow-500' : 'text-muted-foreground/40'
        )}
      >
        {isFavorite ? '★' : '☆'}
      </span>

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate pr-5">{name}</div>
          <div className="text-xs text-muted-foreground">
            {version && `v${version}`}
            {version && category && ' · '}
            {category}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {description}
        </p>
      )}

      {/* Launch progress bar */}
      {isStarting && (
        <div className="mb-2 space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-blue-600 dark:text-blue-400 animate-pulse">
            {progress > 50 ? 'Waiting for endpoint...' : 'Starting...'}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between">
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          isStarting ? 'text-blue-500' : isRunning ? 'text-green-500' : 'text-muted-foreground'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isStarting ? 'bg-blue-500 animate-pulse' : isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'
          )} />
          {isStarting ? 'Starting' : isAlwaysOn ? 'Available' : isRunning ? 'Running' : 'Stopped'}
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning && !isStarting && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-green-500/15 text-green-600 dark:text-green-400">
              Open ↗
            </span>
          )}
          {!isRunning && !isStarting && !isAlwaysOn && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary">
              Launch ▶
            </span>
          )}
          {isStarting && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 animate-pulse">
              Starting...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Demo Lease Panel - static version
interface DemoLeasePanelProps {
  timeRemaining: string;
  startedAt: string;
  showStopConfirm?: boolean;
}

export function DemoLeasePanel({
  timeRemaining,
  startedAt,
  showStopConfirm = false,
}: DemoLeasePanelProps) {
  return (
    <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-green-800 dark:text-green-200">Active Lease</span>
        <span className="text-xs font-mono text-green-600 dark:text-green-400 tabular-nums">
          {timeRemaining}
        </span>
      </div>
      <div className="text-xs text-green-700 dark:text-green-300">
        Started {startedAt}
      </div>

      {/* Extend buttons */}
      {!showStopConfirm && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-700 dark:text-green-300 shrink-0">Extend:</span>
          {['+30m', '+1h', '+2h'].map((label) => (
            <span
              key={label}
              className="text-xs px-2 py-0.5 rounded border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Stop */}
      {!showStopConfirm ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          Stop App
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600 dark:text-red-400">Stop this app?</span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white">
            Confirm Stop
          </span>
          <span className="text-xs text-muted-foreground">
            Cancel
          </span>
        </div>
      )}
    </div>
  );
}

// Demo Toast Notification
interface DemoToastProps {
  message: string;
  variant?: 'warning' | 'destructive';
}

export function DemoToast({ message, variant = 'warning' }: DemoToastProps) {
  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
      variant === 'warning' && 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200',
      variant === 'destructive' && 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
    )}>
      <span>{variant === 'warning' ? '⚠️' : '🛑'}</span>
      {message}
    </div>
  );
}

// Demo Container with label
interface DemoContainerProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function DemoContainer({ label, children, className }: DemoContainerProps) {
  return (
    <div className={cn('border rounded-lg p-4 bg-background/50', className)}>
      <p className="text-xs text-muted-foreground mb-3 font-medium">{label}</p>
      {children}
    </div>
  );
}
