'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AppCatalogItem } from '@/components/gallery/app-card';

interface LeaseResourceEntry {
  name: string;
  type: string;
}

interface ActiveLease {
  id: string;
  compute_pool: string;
  app_name?: string;
  resources?: LeaseResourceEntry[];
  status: string;
}

interface PoolItem {
  name: string;
  isRunning: boolean;
}

interface PgItem {
  name: string;
}

export function InfraSidebar() {
  const [dbApps, setDbApps] = useState<AppCatalogItem[]>([]);
  const [leases, setLeases] = useState<ActiveLease[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  const fetchData = useCallback(async () => {
    const [catalogRes, leasesRes] = await Promise.all([
      fetch('/api/catalog'),
      fetch('/api/leases'),
    ]);
    if (catalogRes.ok) {
      const data = await catalogRes.json();
      setDbApps(data.catalog || []);
    }
    if (leasesRes.ok) {
      const data = await leasesRes.json();
      setLeases(
        (data.leases || []).filter((l: ActiveLease) => l.status === 'ACTIVE')
      );
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const apps = dbApps;

  // Build a set of running resource names from lease resources array
  const runningResources = useMemo(() => {
    const running = new Set<string>();
    for (const lease of leases) {
      if (lease.resources && Array.isArray(lease.resources)) {
        for (const r of lease.resources) {
          running.add(r.name);
        }
      }
      if (lease.compute_pool) {
        running.add(lease.compute_pool);
      }
    }
    return running;
  }, [leases]);

  // Flat list of unique compute pools
  const pools = useMemo(() => {
    const poolMap = new Map<string, PoolItem>();
    for (const app of apps) {
      const poolName = app.compute_pool;
      if (!poolName || poolMap.has(poolName)) continue;
      poolMap.set(poolName, {
        name: poolName,
        isRunning: runningResources.has(poolName),
      });
    }
    return [...poolMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apps, runningResources]);

  // Flat list of unique postgres instances
  const pgInstances = useMemo(() => {
    const pgMap = new Map<string, PgItem>();
    for (const app of apps) {
      const pgName = app.postgres_instance;
      if (!pgName || pgMap.has(pgName)) continue;
      pgMap.set(pgName, { name: pgName });
    }
    return [...pgMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apps]);

  const runningCount = pools.filter((p) => p.isRunning).length;

  // Toggle button (always visible)
  const toggleButton = (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className="hidden xl:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 w-6 h-12 items-center justify-center bg-muted border border-r-0 rounded-l-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
      title={isOpen ? 'Hide Infrastructure' : 'Show Infrastructure'}
    >
      <span className="text-xs">{isOpen ? '›' : '‹'}</span>
    </button>
  );

  if (!isOpen) {
    return toggleButton;
  }

  return (
    <>
      {toggleButton}
      <aside className="hidden xl:flex w-64 border-l bg-muted/30 flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-sm font-bold">Infrastructure</h2>
          <p className="text-xs text-muted-foreground">
            {runningCount}/{pools.length} pools running
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Compute Pools — flat list */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
              Compute Pools
            </div>
            {pools.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">None</p>
            ) : (
              <div className="space-y-0.5">
                {pools.map((pool) => (
                  <div
                    key={pool.name}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="text-base">🖥</span>
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        pool.isRunning
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-muted-foreground/50'
                      )}
                    />
                    <span className="font-medium text-xs truncate flex-1">
                      {pool.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Postgres Instances — flat list */}
          {pgInstances.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
                Postgres Instances
              </div>
              <div className="space-y-0.5">
                {pgInstances.map((pg) => (
                  <div
                    key={pg.name}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="text-sm">🐘</span>
                    <span className="font-medium text-xs truncate flex-1">
                      {pg.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
