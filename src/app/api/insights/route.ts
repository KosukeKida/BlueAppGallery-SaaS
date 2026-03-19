import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantId } from '@/lib/get-connection';

export const maxDuration = 30;

type Period = 'week' | 'month' | '3months';

function getDateRange(period: Period) {
  const now = new Date();

  if (period === 'week') {
    const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { currentStart, prevStart, prevEnd: new Date(currentStart) };
  }

  if (period === '3months') {
    const currentStart = new Date(now);
    currentStart.setMonth(now.getMonth() - 3);
    currentStart.setDate(1);
    currentStart.setHours(0, 0, 0, 0);
    const prevStart = new Date(currentStart);
    prevStart.setMonth(currentStart.getMonth() - 3);
    return { currentStart, prevStart, prevEnd: new Date(currentStart) };
  }

  // month (default)
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  return { currentStart, prevStart, prevEnd };
}

function durationHours(created_at: string, expires_at: string, status: string): number {
  const start = new Date(created_at).getTime();
  const end = status === 'ACTIVE' ? Date.now() : new Date(expires_at).getTime();
  return Math.max(0, (end - start) / 3_600_000);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') ?? 'month') as Period;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const { currentStart, prevStart, prevEnd } = getDateRange(period);

  // Fetch all data in parallel
  const [currentRes, prevRes, catalogRes] = await Promise.all([
    supabase
      .from('leases')
      .select('id, app_name, status, created_at, expires_at, initiated_by')
      .eq('tenant_id', tenantId)
      .in('status', ['ACTIVE', 'EXPIRED', 'STOPPED'])
      .gte('created_at', currentStart.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('leases')
      .select('id, app_name, initiated_by, created_at, expires_at, status')
      .eq('tenant_id', tenantId)
      .in('status', ['ACTIVE', 'EXPIRED', 'STOPPED'])
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', prevEnd.toISOString()),
    supabase
      .from('app_catalog')
      .select('app_name, display_name, category, icon_emoji')
      .eq('tenant_id', tenantId),
  ]);

  const leases = currentRes.data ?? [];
  const prevLeases = prevRes.data ?? [];
  const catalogMap = new Map((catalogRes.data ?? []).map((a) => [a.app_name, a]));

  // Resolve user emails via admin client
  const emailMap = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users) emailMap.set(u.id, u.email ?? u.id.slice(0, 8));
  } catch { /* silent */ }

  // KPI: current period
  const totalHours = leases.reduce((s, l) => s + durationHours(l.created_at, l.expires_at, l.status), 0);
  const activeUsers = new Set(leases.filter((l) => l.initiated_by).map((l) => l.initiated_by)).size;
  const leaseCount = leases.length;

  // KPI: previous period
  const prevTotalHours = prevLeases.reduce((s, l) => s + durationHours(l.created_at, l.expires_at, l.status), 0);
  const prevActiveUsers = new Set(prevLeases.filter((l) => l.initiated_by).map((l) => l.initiated_by)).size;
  const prevLeaseCount = prevLeases.length;

  // Top app
  const appHoursMap = new Map<string, number>();
  for (const l of leases) {
    if (l.app_name) appHoursMap.set(l.app_name, (appHoursMap.get(l.app_name) ?? 0) + durationHours(l.created_at, l.expires_at, l.status));
  }
  const topEntry = [...appHoursMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topApp = topEntry ? {
    name: catalogMap.get(topEntry[0])?.display_name ?? topEntry[0],
    hours: Math.round(topEntry[1] * 10) / 10,
  } : null;

  // App ranking
  const appRankMap = new Map<string, { leaseCount: number; totalHours: number; users: Set<string> }>();
  for (const l of leases) {
    if (!l.app_name) continue;
    const e = appRankMap.get(l.app_name) ?? { leaseCount: 0, totalHours: 0, users: new Set<string>() };
    e.leaseCount++;
    e.totalHours += durationHours(l.created_at, l.expires_at, l.status);
    if (l.initiated_by) e.users.add(l.initiated_by);
    appRankMap.set(l.app_name, e);
  }
  const appRanking = [...appRankMap.entries()]
    .map(([appName, d]) => ({
      appName,
      displayName: catalogMap.get(appName)?.display_name ?? appName,
      category: catalogMap.get(appName)?.category ?? null,
      iconEmoji: catalogMap.get(appName)?.icon_emoji ?? '📦',
      leaseCount: d.leaseCount,
      totalHours: Math.round(d.totalHours * 10) / 10,
      uniqueUsers: d.users.size,
    }))
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 10);

  // User ranking
  const userRankMap = new Map<string, { leaseCount: number; totalHours: number }>();
  for (const l of leases) {
    if (!l.initiated_by) continue;
    const e = userRankMap.get(l.initiated_by) ?? { leaseCount: 0, totalHours: 0 };
    e.leaseCount++;
    e.totalHours += durationHours(l.created_at, l.expires_at, l.status);
    userRankMap.set(l.initiated_by, e);
  }
  const userRanking = [...userRankMap.entries()]
    .map(([userId, d]) => ({
      userId,
      email: emailMap.get(userId) ?? `${userId.slice(0, 8)}...`,
      leaseCount: d.leaseCount,
      totalHours: Math.round(d.totalHours * 10) / 10,
    }))
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 10);

  // Trend: group by date, fill gaps with 0
  const trendMap = new Map<string, { hours: number; leaseCount: number }>();
  for (const l of leases) {
    const date = l.created_at.slice(0, 10);
    const e = trendMap.get(date) ?? { hours: 0, leaseCount: 0 };
    e.hours += durationHours(l.created_at, l.expires_at, l.status);
    e.leaseCount++;
    trendMap.set(date, e);
  }
  const trend: { date: string; hours: number; leaseCount: number }[] = [];
  const cursor = new Date(currentStart);
  const now = new Date();
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10);
    const e = trendMap.get(key) ?? { hours: 0, leaseCount: 0 };
    trend.push({ date: key, hours: Math.round(e.hours * 10) / 10, leaseCount: e.leaseCount });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Heatmap: day[0-6 Sun-Sat] × hour[0-23]
  const heatmapCounts = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const l of leases) {
    const dt = new Date(l.created_at);
    heatmapCounts[dt.getDay()][dt.getHours()]++;
  }
  const maxCount = Math.max(1, ...heatmapCounts.flat());
  const heatmap = heatmapCounts.map((row) =>
    row.map((count) => ({ count, intensity: count / maxCount }))
  );

  return NextResponse.json({
    kpi: {
      totalHours: Math.round(totalHours * 10) / 10,
      prevTotalHours: Math.round(prevTotalHours * 10) / 10,
      activeUsers,
      prevActiveUsers,
      topApp,
      leaseCount,
      prevLeaseCount,
    },
    appRanking,
    userRanking,
    trend,
    heatmap,
  });
}
