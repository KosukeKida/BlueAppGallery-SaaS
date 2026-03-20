'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppCard, type AppCatalogItem } from '@/components/gallery/app-card';
import { PromotionCard, type PromotionCardData } from '@/components/gallery/promotion-card';
import { LaunchDialog } from '@/components/gallery/launch-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SetupWizard } from '@/components/onboarding/setup-wizard';
import { AppDetailDialog } from '@/components/gallery/app-detail-dialog';
import { useAllLaunches } from '@/hooks/use-launch-progress';
import { removeLaunchProgress } from '@/lib/launch-state';

const FAVORITES_KEY = 'gallery_favorites';

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

interface ActiveLease {
  id: string;
  compute_pool: string;
  app_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

interface RecentLease {
  app_name: string;
  created_at: string;
}

export default function GalleryPage() {
  const [dbApps, setDbApps] = useState<AppCatalogItem[]>([]);
  const [promoCards, setPromoCards] = useState<PromotionCardData[]>([]);
  const [leases, setLeases] = useState<ActiveLease[]>([]);
  const [recentAppNames, setRecentAppNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConnections, setHasConnections] = useState(true);
  const [hasCatalog, setHasCatalog] = useState(true);
  const [launchApp, setLaunchApp] = useState<AppCatalogItem | null>(null);
  const [detailApp, setDetailApp] = useState<AppCatalogItem | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites on mount
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const apps = dbApps;

  // Lightweight lease refresh (Supabase-only, no Snowflake API call)
  const refreshLeasesQuick = useCallback(async () => {
    try {
      const res = await fetch('/api/leases?quick=true');
      if (res.ok) {
        const data = await res.json();
        const allLeases: ActiveLease[] = data.leases || [];
        setLeases(allLeases.filter((l) => l.status === 'ACTIVE'));

        const seen = new Set<string>();
        const recent: string[] = [];
        for (const l of allLeases) {
          if (l.app_name && !seen.has(l.app_name)) {
            seen.add(l.app_name);
            recent.push(l.app_name);
            if (recent.length >= 5) break;
          }
        }
        setRecentAppNames(recent);
      }
    } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async () => {
    // Catalog is the critical path — show cards as soon as it arrives
    const catalogRes = await fetch('/api/catalog');
    if (catalogRes.ok) {
      const data = await catalogRes.json();
      const catalog = data.catalog || [];
      setDbApps(catalog);
      setHasCatalog(catalog.length > 0);
    }
    setLoading(false);

    // Load the rest in parallel without blocking card display
    const [leasesRes, connRes, promoRes] = await Promise.all([
      fetch('/api/leases?quick=true'),
      fetch('/api/connections'),
      fetch('/api/promotions'),
    ]);
    if (leasesRes.ok) {
      const data = await leasesRes.json();
      const allLeases: ActiveLease[] = data.leases || [];
      setLeases(allLeases.filter((l) => l.status === 'ACTIVE'));

      const seen = new Set<string>();
      const recent: string[] = [];
      for (const l of allLeases) {
        if (l.app_name && !seen.has(l.app_name)) {
          seen.add(l.app_name);
          recent.push(l.app_name);
          if (recent.length >= 5) break;
        }
      }
      setRecentAppNames(recent);
    }
    if (connRes.ok) {
      const data = await connRes.json();
      setHasConnections((data.connections || []).length > 0);
    }
    if (promoRes.ok) {
      const data = await promoRes.json();
      setPromoCards(data.cards || []);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fast poll every 10s (Supabase-only) for near-real-time card updates
  // Full Snowflake sync every 60s to detect watchdog-expired leases
  useEffect(() => {
    let tick = 0;
    const poll = async () => {
      tick++;
      const useQuick = tick % 6 !== 0;
      try {
        const res = await fetch(`/api/leases${useQuick ? '?quick=true' : ''}`);
        if (res.ok) {
          const data = await res.json();
          const allLeases: ActiveLease[] = data.leases || [];
          setLeases(allLeases.filter((l) => l.status === 'ACTIVE'));
        }
      } catch { /* silent */ }
    };
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-close LaunchDialog when Gallery card turns green (lease confirmed)
  useEffect(() => {
    if (launchApp && isRunning(launchApp)) {
      const timer = setTimeout(() => {
        toast.success(`${launchApp.display_name || launchApp.app_name} is running!`, {
          description: 'Click the card to open.',
          duration: 5_000,
        });
        setLaunchApp(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [launchApp, leases]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categories derived from apps
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const app of apps) {
      if (app.category) cats.add(app.category);
    }
    return [...cats].sort();
  }, [apps]);

  // Filter
  const filtered = useMemo(() => {
    let result = apps;
    if (selectedCategory) {
      result = result.filter((a) => a.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          (a.display_name || a.app_name).toLowerCase().includes(q) ||
          (a.app_comment || '').toLowerCase().includes(q) ||
          (a.category || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [apps, selectedCategory, search]);

  // Recent apps from lease history
  const recentApps = useMemo(() => {
    if (recentAppNames.length === 0) return [];
    return recentAppNames
      .map((name) => apps.find((a) => a.app_name === name))
      .filter((a): a is AppCatalogItem => !!a);
  }, [recentAppNames, apps]);

  const showRecent = recentApps.length > 0 && !search.trim() && !selectedCategory;
  const recentAppIds = useMemo(
    () => showRecent ? new Set(recentApps.map((a) => a.id)) : new Set<string>(),
    [recentApps, showRecent]
  );

  const favoriteApps = useMemo(
    () => filtered.filter((a) => favorites.has(a.id) && !recentAppIds.has(a.id)),
    [filtered, favorites, recentAppIds]
  );
  const otherApps = useMemo(
    () => filtered.filter((a) => !favorites.has(a.id) && !recentAppIds.has(a.id)),
    [filtered, favorites, recentAppIds]
  );

  const toggleFavorite = (appId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      saveFavorites(next);
      return next;
    });
  };

  // Running status based on compute pool
  const isRunning = (app: AppCatalogItem) =>
    leases.some((l) => l.compute_pool === app.compute_pool);

  // Find active lease for an app
  const getActiveLease = (app: AppCatalogItem) =>
    leases.find((l) => l.compute_pool === app.compute_pool) ?? null;

  // Clean up launch-state
  const activeLaunches = useAllLaunches();
  useEffect(() => {
    for (const launch of activeLaunches) {
      if (launch.status === 'ready') {
        const matchedApp = apps.find((a) => a.id === launch.appId);
        if (matchedApp && isRunning(matchedApp)) {
          removeLaunchProgress(launch.appId);
          continue;
        }
      }
      if (Date.now() - launch.startedAt > 5 * 60 * 1000) {
        removeLaunchProgress(launch.appId);
      }
    }
  }, [activeLaunches, leases, apps]); // eslint-disable-line react-hooks/exhaustive-deps

  const [discovering, setDiscovering] = useState<string | null>(null);

  // Extend lease
  const handleExtend = async (leaseId: string, durationMinutes: number) => {
    const res = await fetch(`/api/leases/${leaseId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error('Failed to extend lease', { description: data.error });
      return;
    }
    toast.success(`Extended by ${durationMinutes} minutes`);
    await refreshLeasesQuick();
  };

  // Stop lease
  const handleStop = async (leaseId: string) => {
    const res = await fetch(`/api/leases/${leaseId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      toast.error('Failed to stop app', { description: data.error });
      return;
    }
    toast.success('App stopped');
    setDetailApp(null);
    setLeases((prev) => prev.filter((l) => l.id !== leaseId));
  };

  // Open SPCS endpoint URL in a new tab
  const openEndpoint = (rawUrl: string) => {
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    window.open(url, '_blank', 'noopener');
  };

  // Card click → always show detail dialog
  const handleAppClick = (app: AppCatalogItem) => {
    setDetailApp(app);
  };

  // Open button → resolve endpoint and open
  const handleOpenApp = async (app: AppCatalogItem) => {
    if (!(app.service_name || app.app_name)) return;

    setDiscovering(app.id);
    try {
      const res = await fetch('/api/leases/check-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: app.app_name,
          endpointUrl: null,
        }),
      });
      const data = await res.json();
      if (data.ready && data.ingress_url) {
        setDbApps((prev) =>
          prev.map((a) =>
            a.id === app.id ? { ...a, endpoint_url: data.ingress_url } : a
          )
        );
        // Also update detailApp if it's the same app
        setDetailApp((prev) =>
          prev?.id === app.id ? { ...prev, endpoint_url: data.ingress_url } : prev
        );
        openEndpoint(data.ingress_url);
        setDiscovering(null);
        return;
      }
    } catch {
      if (app.endpoint_url) {
        openEndpoint(app.endpoint_url);
        setDiscovering(null);
        return;
      }
    }
    setDiscovering(null);
    toast.error('Endpoint not ready', {
      description: 'The app may still be starting up. Try again in a moment.',
    });
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Gallery</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[160px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const renderCards = (appList: AppCatalogItem[], keyPrefix = '') =>
    appList.map((app) => (
      <AppCard
        key={`${keyPrefix}${app.id}`}
        app={app}
        isRunning={isRunning(app)}
        isDiscovering={discovering === app.id}
        isFavorite={favorites.has(app.id)}
        onToggleFavorite={toggleFavorite}
        onClick={handleAppClick}
        onOpen={handleOpenApp}
      />
    ));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Gallery</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {apps.length} app{apps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/catalog">Manage Catalog</Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search apps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className="cursor-pointer"
        >
          <Badge
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer"
          >
            All
          </Badge>
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() =>
              setSelectedCategory(selectedCategory === cat ? null : cat)
            }
            className="cursor-pointer"
          >
            <Badge
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer"
            >
              {cat}
            </Badge>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No apps match your search</p>
          <p className="text-sm">
            Try a different keyword or clear the filter.
          </p>
        </div>
      ) : (
        <>
          {/* Recent apps section */}
          {showRecent && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <span>🕐</span> Recently Used
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {renderCards(recentApps, 'recent-')}
              </div>
            </div>
          )}

          {/* Favorites section */}
          {favoriteApps.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <span className="text-yellow-500">★</span> Favorites
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {renderCards(favoriteApps)}
              </div>
            </div>
          )}

          {/* All apps (with promotion cards interleaved) */}
          <div>
            {favoriteApps.length > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {selectedCategory || 'All Apps'} ({otherApps.length})
              </h3>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {(() => {
                // Hide promos when searching or filtering
                if (search.trim() || selectedCategory) return renderCards(otherApps);

                const sortedPromos = [...promoCards].sort((a, b) => a.position - b.position);
                const items: React.ReactNode[] = [];
                let promoIdx = 0;
                let appIdx = 0;
                let gridIdx = 0;

                while (appIdx < otherApps.length || promoIdx < sortedPromos.length) {
                  if (promoIdx < sortedPromos.length && sortedPromos[promoIdx].position <= gridIdx) {
                    const promo = sortedPromos[promoIdx];
                    items.push(<PromotionCard key={`promo-${promo.id}`} card={promo} />);
                    promoIdx++;
                  } else if (appIdx < otherApps.length) {
                    const app = otherApps[appIdx];
                    items.push(
                      <AppCard
                        key={app.id}
                        app={app}
                        isRunning={isRunning(app)}
                        isDiscovering={discovering === app.id}
                        isFavorite={favorites.has(app.id)}
                        onToggleFavorite={toggleFavorite}
                        onClick={handleAppClick}
                        onOpen={handleOpenApp}
                      />
                    );
                    appIdx++;
                  } else {
                    break;
                  }
                  gridIdx++;
                }
                return items;
              })()}
            </div>
          </div>
        </>
      )}

      {/* Setup wizard for first-time users */}
      {!loading && <SetupWizard hasConnections={hasConnections} hasCatalog={hasCatalog} />}

      {/* App detail dialog — shown for both running and stopped apps */}
      <AppDetailDialog
        open={!!detailApp}
        onOpenChange={(open) => {
          if (!open) setDetailApp(null);
        }}
        app={detailApp}
        isRunning={detailApp ? isRunning(detailApp) : false}
        lease={detailApp ? getActiveLease(detailApp) : null}
        onLaunch={(app) => setLaunchApp(app)}
        onOpen={handleOpenApp}
        onExtend={handleExtend}
        onStop={handleStop}
        isDiscovering={detailApp ? discovering === detailApp.id : false}
      />

      {/* Launch dialog */}
      <LaunchDialog
        open={!!launchApp}
        onOpenChange={(open) => {
          if (!open) setLaunchApp(null);
        }}
        app={launchApp}
        onSuccess={() => {
          const cp = launchApp?.compute_pool;
          if (cp) {
            setLeases((prev) => {
              if (prev.some((l) => l.compute_pool === cp)) return prev;
              return [...prev, {
                id: `optimistic-${Date.now()}`,
                compute_pool: cp,
                app_name: launchApp.app_name,
                status: 'ACTIVE',
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
              }];
            });
          }
          refreshLeasesQuick();
        }}
      />
    </div>
  );
}
