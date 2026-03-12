/**
 * Global in-memory store for background app launch state.
 * Shared between LaunchDialog (sets state) and AppCard (reads state).
 * Uses a simple pub/sub pattern to avoid React context boilerplate.
 */

export interface LaunchProgress {
  appId: string;
  appName: string;
  status: 'starting' | 'polling' | 'ready' | 'error';
  progress: number; // 0-100
  endpointUrl?: string | null;
  startedAt: number;
}

type Listener = () => void;

const launches = new Map<string, LaunchProgress>();
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

export function setLaunchProgress(appId: string, state: LaunchProgress) {
  launches.set(appId, state);
  notify();
}

export function removeLaunchProgress(appId: string) {
  launches.delete(appId);
  notify();
}

export function getLaunchProgress(appId: string): LaunchProgress | undefined {
  return launches.get(appId);
}

export function getAllLaunches(): LaunchProgress[] {
  return Array.from(launches.values());
}

export function subscribeLaunches(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
