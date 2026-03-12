'use client';

import { useEffect, useState } from 'react';
import {
  getLaunchProgress,
  getAllLaunches,
  subscribeLaunches,
  type LaunchProgress,
} from '@/lib/launch-state';

/** Subscribe to a single app's launch progress */
export function useLaunchProgress(appId: string): LaunchProgress | undefined {
  const [state, setState] = useState<LaunchProgress | undefined>(() => getLaunchProgress(appId));

  useEffect(() => {
    const unsubscribe = subscribeLaunches(() => {
      setState(getLaunchProgress(appId));
    });
    return unsubscribe;
  }, [appId]);

  return state;
}

/** Subscribe to all active launches */
export function useAllLaunches(): LaunchProgress[] {
  const [all, setAll] = useState<LaunchProgress[]>(() => getAllLaunches());

  useEffect(() => {
    const unsubscribe = subscribeLaunches(() => {
      setAll(getAllLaunches());
    });
    return unsubscribe;
  }, []);

  return all;
}
