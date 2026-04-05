'use client';

import { useCallback, useEffect, useRef } from 'react';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

interface UseHeartbeatOptions {
  leaseId: string | null;
  sessionId?: string;
  enabled?: boolean;
}

export function useHeartbeat({ leaseId, sessionId, enabled = true }: UseHeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!leaseId) return;
    try {
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseId, sessionId }),
      });
    } catch (error) {
      // Best-effort, but log for debugging
      console.debug('[Heartbeat] Failed:', error);
    }
  }, [leaseId, sessionId]);

  useEffect(() => {
    if (!enabled || !leaseId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediately
    sendHeartbeat();

    // Then every 60 seconds
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Pause when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        sendHeartbeat();
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, leaseId, sendHeartbeat]);

  return { sendHeartbeat };
}
