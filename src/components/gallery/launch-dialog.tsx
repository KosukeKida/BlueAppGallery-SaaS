'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AppCatalogItem } from '@/components/gallery/app-card';
import { setLaunchProgress, removeLaunchProgress } from '@/lib/launch-state';

type Step = 'config' | 'starting' | 'success' | 'error';

interface LaunchStep {
  label: string;
  detail?: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

interface LaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: AppCatalogItem | null;
  onSuccess?: () => void;
}

const POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

/** Smooth progress: advances gradually for a more natural feel */
function calcSmoothProgress(step: Step, doneSteps: number, totalSteps: number, elapsed: number): number {
  if (step === 'config') return 0;
  if (step === 'success') return 100;
  if (step === 'error') return 0;

  // Base progress from completed steps
  const base = totalSteps > 0 ? (doneSteps / totalSteps) * 90 : 0;

  // Add gradual progress within current step (max +8%)
  const withinStep = Math.min(8, elapsed / 10000 * 3);

  return Math.min(95, base + withinStep);
}

export function LaunchDialog({ open, onOpenChange, app, onSuccess }: LaunchDialogProps) {
  const [step, setStep] = useState<Step>('config');
  const [durationStr, setDurationStr] = useState('30');
  const [error, setError] = useState('');
  const [launchSteps, setLaunchSteps] = useState<LaunchStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [resolvedEndpointUrl, setResolvedEndpointUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const abortRef = useRef(false);

  const appName = app?.display_name || app?.app_name || '';
  const appId = app?.id || '';
  const hasService = !!app?.service_name;
  const knownEndpointUrl = app?.endpoint_url || null;
  const postSucceededRef = useRef(false);

  const cleanupPolling = useCallback(() => {
    abortRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Update global launch state for AppCard progress
  useEffect(() => {
    if (!appId) return;
    if (step === 'starting') {
      const doneSteps = launchSteps.filter(s => s.status === 'done').length;
      const progress = calcSmoothProgress(step, doneSteps, launchSteps.length, elapsed);
      setLaunchProgress(appId, {
        appId,
        appName,
        status: launchSteps.some(s => s.label.includes('endpoint') && s.status === 'active') ? 'polling' : 'starting',
        progress,
        startedAt: startTimeRef.current || Date.now(),
      });
    } else if (step === 'success') {
      setLaunchProgress(appId, {
        appId,
        appName,
        status: 'ready',
        progress: 100,
        endpointUrl: resolvedEndpointUrl,
        startedAt: startTimeRef.current || Date.now(),
      });
      // Don't auto-remove; Gallery page cleans up when leases state catches up
    } else if (step === 'error') {
      setLaunchProgress(appId, {
        appId,
        appName,
        status: 'error',
        progress: 0,
        startedAt: startTimeRef.current || Date.now(),
      });
      setTimeout(() => removeLaunchProgress(appId), 5_000);
    }
  }, [step, launchSteps, elapsed, appId, appName, resolvedEndpointUrl]);

  // Reset on dialog open / cleanup on close
  useEffect(() => {
    if (open && app) {
      setStep('config');
      setError('');
      setLaunchSteps([]);
      setElapsed(0);
      setResolvedEndpointUrl(null);
      postSucceededRef.current = false;
      abortRef.current = false;
    }
    if (!open) {
      cleanupPolling();
    }
  }, [open, app, cleanupPolling]);

  // When dialog closes (appId changes away), transition stuck launch-state to 'ready'
  // Uses cleanup function to capture the PREVIOUS appId before it becomes ''
  useEffect(() => {
    if (!appId) return;
    return () => {
      // This cleanup runs when appId changes (dialog closes → app becomes null → appId becomes '')
      if (postSucceededRef.current) {
        setLaunchProgress(appId, {
          appId,
          appName,
          status: 'ready',
          progress: 100,
          startedAt: startTimeRef.current || Date.now(),
        });
      }
    };
  }, [appId, appName]);

  const updateStep = (index: number, status: LaunchStep['status']) => {
    setLaunchSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status } : s))
    );
  };

  const pollEndpoint = useCallback((stepIndex: number) => {
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);

    const checkEndpoint = async () => {
      if (abortRef.current) return;

      try {
        const res = await fetch('/api/leases/check-endpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appName: app?.app_name,
            endpointUrl: knownEndpointUrl,
          }),
        });
        const data = await res.json();

        if (data.ready && data.ingress_url) {
          cleanupPolling();
          setResolvedEndpointUrl(data.ingress_url);
          updateStep(stepIndex, 'done');
          setStep('success');
          toast.success(`${appName} is ready!`, {
            description: 'Click to open the application.',
            duration: 8_000,
          });
          return;
        }
      } catch {
        // ignore
      }

      if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
        cleanupPolling();
        updateStep(stepIndex, 'done');
        setStep('success');
        toast.success(`${appName} lease started`, {
          description: 'Endpoint may still be starting. Check back in a moment.',
          duration: 8_000,
        });
      }
    };

    setTimeout(checkEndpoint, 3000);
    pollRef.current = setInterval(checkEndpoint, POLL_INTERVAL_MS);
  }, [app, appName, knownEndpointUrl, cleanupPolling]);

  const handleLaunch = useCallback(async () => {
    if (!app?.app_name) {
      setError('App name is required');
      return;
    }

    setStep('starting');
    setError('');
    startTimeRef.current = Date.now();

    const shouldPollEndpoint = hasService || knownEndpointUrl;
    const steps: LaunchStep[] = [
      {
        label: 'Launching application...',
        detail: 'Starting compute resources via Operator',
        status: 'active',
      },
      {
        label: 'Resuming compute environment...',
        detail: app.compute_pool || 'Auto-detected by Operator',
        status: 'pending',
      },
    ];
    if (shouldPollEndpoint) {
      steps.push({
        label: 'Waiting for application endpoint...',
        detail: 'Checking availability every 10 seconds',
        status: 'pending',
      });
    }
    setLaunchSteps(steps);

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);

    try {
      // Step 1: Call api.launch() via POST /api/leases
      const res = await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: app.app_name,
          durationMinutes: parseInt(durationStr) || 30,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || 'Failed to launch app');
      }

      postSucceededRef.current = true;
      updateStep(0, 'done');

      // Step 2: Compute environment (already done by Operator)
      updateStep(1, 'active');
      await new Promise((r) => setTimeout(r, 1500));
      updateStep(1, 'done');

      const endpointStepIdx = 2;

      if (shouldPollEndpoint) {
        if (timerRef.current) clearInterval(timerRef.current);
        updateStep(endpointStepIdx, 'active');
        pollEndpoint(endpointStepIdx);
        onSuccess?.();
      } else {
        cleanupPolling();
        setStep('success');
        toast.success(`${appName} lease started`);
        onSuccess?.();
      }
    } catch (err) {
      cleanupPolling();
      setError(err instanceof Error ? err.message : 'Launch failed');
      setStep('error');
      setLaunchSteps((prev) =>
        prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s))
      );
    }
  }, [durationStr, app, appName, onSuccess, pollEndpoint, hasService, knownEndpointUrl, cleanupPolling]);

  const handleBackToGallery = () => {
    // Don't cleanup polling — keep it running in background
    abortRef.current = false;
    onOpenChange(false);
  };

  const doneStepCount = launchSteps.filter((s) => s.status === 'done').length;
  const progressValue = calcSmoothProgress(step, doneStepCount, launchSteps.length, elapsed);

  const openEndpoint = (rawUrl: string) => {
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleOpenEndpoint = () => {
    const url = resolvedEndpointUrl || knownEndpointUrl;
    if (url) openEndpoint(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {app?.icon_emoji && <span className="text-xl">{app.icon_emoji}</span>}
            Launch {appName}
          </DialogTitle>
          <DialogDescription>
            {step === 'config' && 'Configure and start a compute lease for this application.'}
            {step === 'starting' && 'Starting application...'}
            {step === 'success' && (resolvedEndpointUrl ? 'Application is ready!' : 'Lease started successfully.')}
            {step === 'error' && 'Launch failed'}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-4 py-2">
            {app?.compute_pool && (
              <div className="space-y-2">
                <Label>Compute Environment</Label>
                <div className="rounded-md border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🖥</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Compute Pool</div>
                      <div className="text-xs text-muted-foreground font-mono">{app.compute_pool}</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Managed by Operator
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="text"
                inputMode="numeric"
                placeholder="30"
                value={durationStr}
                onChange={(e) => {
                  // Allow only digits or empty string
                  const v = e.target.value.replace(/\D/g, '');
                  setDurationStr(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLaunch();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Default 30 minutes. Max 480 minutes (8 hours).
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleLaunch}>Start Lease</Button>
            </div>
          </div>
        )}

        {(step === 'starting' || step === 'success' || step === 'error') && (
          <div className="space-y-4 py-2">
            <Progress value={progressValue} className="h-2" />

            {/* Time estimate */}
            {step === 'starting' && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Elapsed: {formatElapsed(elapsed)}</span>
                <span>Usually takes 1-3 minutes</span>
              </div>
            )}

            <div className="space-y-2.5">
              {launchSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5',
                      s.status === 'done' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                      s.status === 'active' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse',
                      s.status === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                      s.status === 'pending' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {s.status === 'done' && '\u2713'}
                    {s.status === 'active' && '\u2022'}
                    {s.status === 'error' && '\u2715'}
                    {s.status === 'pending' && (i + 1)}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={cn(
                        'text-sm',
                        s.status === 'pending' && 'text-muted-foreground',
                        s.status === 'error' && 'text-destructive'
                      )}
                    >
                      {s.label}
                    </span>
                    {s.detail && (
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {s.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              {step === 'starting' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleBackToGallery}
                  >
                    Back to Gallery
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cleanupPolling();
                      removeLaunchProgress(appId);
                      onOpenChange(false);
                      onSuccess?.();
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {step === 'success' && (
                <>
                  {resolvedEndpointUrl && (
                    <Button onClick={handleOpenEndpoint}>
                      Open App
                    </Button>
                  )}
                  <Button variant={resolvedEndpointUrl ? 'outline' : 'default'} onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </>
              )}
              {step === 'error' && (
                <>
                  <Button variant="outline" onClick={() => { removeLaunchProgress(appId); onOpenChange(false); }}>
                    Close
                  </Button>
                  <Button onClick={() => setStep('config')}>Retry</Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
