'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { AppCatalogItem } from '@/components/gallery/app-card';
import type { ComputePoolInfo, ServiceInfo, PostgresInstanceInfo } from '@/types/infra';

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

export function InfraSidebar() {
  const [dbApps, setDbApps] = useState<AppCatalogItem[]>([]);
  const [leases, setLeases] = useState<ActiveLease[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

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
      // New format: check resources array
      if (lease.resources && Array.isArray(lease.resources)) {
        for (const r of lease.resources) {
          running.add(r.name);
        }
      }
      // Legacy: compute_pool field
      if (lease.compute_pool) {
        running.add(lease.compute_pool);
      }
    }
    return running;
  }, [leases]);

  // Build compute pools (grouped by where the app RUNS)
  const pools = useMemo(() => {
    const poolMap = new Map<string, ComputePoolInfo>();
    for (const app of apps) {
      const poolName = app.compute_pool;
      if (!poolName) continue;
      if (!poolMap.has(poolName)) {
        const isRunning = runningResources.has(poolName);
        poolMap.set(poolName, {
          name: poolName,
          size: '',
          isRunning,
          apps: [],
        });
      }
      poolMap.get(poolName)!.apps.push(app);
    }
    return [...poolMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apps, leases, runningResources]);

  // Build services (grouped by service_name)
  const services = useMemo(() => {
    const svcMap = new Map<string, ServiceInfo>();
    for (const app of apps) {
      const svcName = app.service_name;
      if (!svcName) continue;
      if (!svcMap.has(svcName)) {
        svcMap.set(svcName, {
          name: svcName,
          isRunning: runningResources.has(svcName),
          apps: [],
        });
      }
      svcMap.get(svcName)!.apps.push(app);
    }
    return [...svcMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apps, runningResources]);

  // Build postgres instances (grouped by which DB the app CONNECTS TO)
  const pgInstances = useMemo(() => {
    const pgMap = new Map<string, PostgresInstanceInfo>();
    for (const app of apps) {
      const pgName = app.postgres_instance;
      if (!pgName) continue;
      if (!pgMap.has(pgName)) {
        pgMap.set(pgName, { name: pgName, apps: [] });
      }
      pgMap.get(pgName)!.apps.push(app);
    }
    return [...pgMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apps]);

  // Expand all sections on first data load
  useEffect(() => {
    if (!initialized && (pools.length > 0 || services.length > 0 || pgInstances.length > 0)) {
      const keys = [
        ...pools.map((p) => `pool:${p.name}`),
        ...services.map((s) => `svc:${s.name}`),
        ...pgInstances.map((pg) => `pg:${pg.name}`),
      ];
      setExpanded(new Set(keys));
      setInitialized(true);
    }
  }, [pools, services, pgInstances, initialized]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const runningPools = pools.filter((p) => p.isRunning).length;
  const runningServices = services.filter((s) => s.isRunning).length;
  const totalRunning = runningPools + runningServices;
  const totalResources = pools.length + services.length;

  return (
    <aside className="hidden xl:flex w-72 border-l bg-muted/30 flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-sm font-bold">Infrastructure</h2>
        <p className="text-xs text-muted-foreground">
          {totalRunning}/{totalResources} resources running
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ── Compute Pools section ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Compute Pools
          </div>
          {pools.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2">None</p>
          ) : (
            <div className="space-y-1">
              {pools.map((pool) => {
                const key = `pool:${pool.name}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={pool.name}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="text-[10px] w-3 text-center text-muted-foreground">
                        {isOpen ? '▼' : '▶'}
                      </span>
                      <span className="text-base">🖥</span>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          pool.isRunning
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-muted-foreground/50'
                        )}
                      />
                      <span className="font-medium text-xs truncate flex-1 text-left">
                        {pool.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        {pool.size}
                      </Badge>
                    </button>

                    {isOpen && (
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-border/50 pl-3">
                        {pool.apps.map((app) => (
                          <div
                            key={app.id}
                            className="flex items-center gap-2 px-1 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm leading-none">
                              {app.icon_emoji || '📦'}
                            </span>
                            <span className="truncate flex-1">
                              {app.display_name || app.app_name}
                            </span>
                            {app.postgres_instance && (
                              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                → {app.postgres_instance}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Services section ── */}
        {services.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
              Services
            </div>
            <div className="space-y-1">
              {services.map((svc) => {
                const key = `svc:${svc.name}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={svc.name}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="text-[10px] w-3 text-center text-muted-foreground">
                        {isOpen ? '▼' : '▶'}
                      </span>
                      <span className="text-base">&#9881;</span>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          svc.isRunning
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-muted-foreground/50'
                        )}
                      />
                      <span className="font-medium text-xs truncate flex-1 text-left">
                        {svc.name}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-border/50 pl-3">
                        {svc.apps.map((app) => (
                          <div
                            key={app.id}
                            className="flex items-center gap-2 px-1 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm leading-none">
                              {app.icon_emoji || '📦'}
                            </span>
                            <span className="truncate flex-1">
                              {app.display_name || app.app_name}
                            </span>
                            {app.compute_pool && (
                              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                on {app.compute_pool}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Postgres Instances section ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Postgres Instances
          </div>
          {pgInstances.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2">None</p>
          ) : (
            <div className="space-y-1">
              {pgInstances.map((pg) => {
                const key = `pg:${pg.name}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={pg.name}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="text-[10px] w-3 text-center text-muted-foreground">
                        {isOpen ? '▼' : '▶'}
                      </span>
                      <span className="text-sm">🐘</span>
                      <span className="font-medium text-xs truncate flex-1 text-left">
                        {pg.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {pg.apps.length} app{pg.apps.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-border/50 pl-3">
                        {pg.apps.map((app) => (
                          <div
                            key={app.id}
                            className="flex items-center gap-2 px-1 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm leading-none">
                              {app.icon_emoji || '📦'}
                            </span>
                            <span className="truncate flex-1">
                              {app.display_name || app.app_name}
                            </span>
                            {app.compute_pool && (
                              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                on {app.compute_pool}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground">
        SPCS Infrastructure
      </div>
    </aside>
  );
}
