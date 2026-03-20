'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Period = 'week' | 'month' | '3months';
type TrendMetric = 'hours' | 'leaseCount' | 'uniqueUsers' | 'avgDuration';

interface AppRankItem {
  appName: string;
  displayName: string;
  category: string | null;
  iconEmoji: string;
  leaseCount: number;
  totalHours: number;
  uniqueUsers: number;
}

interface UserRankItem {
  userId: string;
  email: string;
  leaseCount: number;
  totalHours: number;
}

interface TrendItem {
  date: string;
  hours: number;
  leaseCount: number;
  uniqueUsers: number;
  avgDuration: number;
}

interface InsightsData {
  kpi: {
    totalHours: number;
    prevTotalHours: number;
    activeUsers: number;
    prevActiveUsers: number;
    topApp: { name: string; hours: number } | null;
    leaseCount: number;
    prevLeaseCount: number;
  };
  appRanking: AppRankItem[];
  userRanking: UserRankItem[];
  trend: TrendItem[];
  heatmap: { count: number; intensity: number }[][];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const METRIC_INFO: Record<TrendMetric, { label: string; unit: string; color: string; dataKey: string }> = {
  hours:       { label: 'Usage Hours',   unit: 'h',  color: '#4f46e5', dataKey: 'hours' },
  leaseCount:  { label: 'Launches',      unit: '',   color: '#0891b2', dataKey: 'leaseCount' },
  uniqueUsers: { label: 'Unique Users',  unit: '',   color: '#059669', dataKey: 'uniqueUsers' },
  avgDuration: { label: 'Avg Duration',  unit: 'h',  color: '#d97706', dataKey: 'avgDuration' },
};

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  '3months': 'Last 3 Months',
};

function Delta({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = Math.round((current - prev) / prev * 100);
  if (pct === 0) return <span className="text-xs text-muted-foreground">— same as before</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs prev period
    </span>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('hours');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Full data fetch — called when period changes
  const fetchAll = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/insights?period=${p}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Partial fetch — updates only trend + heatmap when app filter changes
  const fetchFiltered = useCallback(async (p: Period, app: string | null) => {
    setTrendLoading(true);
    try {
      const params = new URLSearchParams({ period: p });
      if (app) params.set('app', app);
      const res = await fetch(`/api/insights?${params}`);
      if (res.ok) {
        const d = await res.json();
        setData((prev) => prev ? { ...prev, trend: d.trend, heatmap: d.heatmap } : prev);
      }
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // Period change: reset app filter and re-fetch everything
  const handlePeriodChange = (p: Period) => {
    setSelectedApp(null);
    setTrendMetric('hours');
    setPeriod(p);
  };

  useEffect(() => { fetchAll(period); }, [period, fetchAll]);

  // App filter change: partial re-fetch of trend/heatmap only
  useEffect(() => {
    if (!data) return; // wait for initial load
    fetchFiltered(period, selectedApp);
  }, [selectedApp]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (entry: any) => {
    const item = entry as AppRankItem;
    setSelectedApp((prev) => prev === item.appName ? null : item.appName);
  };

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      'Date,Hours,Launches,UniqueUsers,AvgDuration(h)',
      ...data.trend.map((t) => `${t.date},${t.hours},${t.leaseCount},${t.uniqueUsers},${t.avgDuration}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `usage-insights-${period}${selectedApp ? `-${selectedApp}` : ''}.csv`;
    a.click();
  };

  const kpi = data?.kpi;
  const metric = METRIC_INFO[trendMetric];
  const selectedAppName = selectedApp
    ? (data?.appRanking.find((a) => a.appName === selectedApp)?.displayName ?? selectedApp)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Usage Insights</h2>
          <p className="text-sm text-muted-foreground">
            App usage analytics — {PERIOD_LABELS[period]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Usage</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{kpi?.totalHours ?? 0}h</div>
                <Delta current={kpi?.totalHours ?? 0} prev={kpi?.prevTotalHours ?? 0} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Users</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{kpi?.activeUsers ?? 0}</div>
                <Delta current={kpi?.activeUsers ?? 0} prev={kpi?.prevActiveUsers ?? 0} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top App</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-lg font-bold truncate leading-tight">{kpi?.topApp?.name ?? '—'}</div>
                {kpi?.topApp && <div className="text-xs text-muted-foreground">{kpi.topApp.hours}h used</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lease Count</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{kpi?.leaseCount ?? 0}</div>
                <Delta current={kpi?.leaseCount ?? 0} prev={kpi?.prevLeaseCount ?? 0} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {!loading && (
        <>
          {/* App Ranking + User Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* App Usage Ranking */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">App Usage Ranking</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Click an app to filter Trend &amp; Heatmap
                </p>
              </CardHeader>
              <CardContent>
                {mounted && (data?.appRanking.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, data!.appRanking.length * 38)}>
                    <BarChart
                      data={data!.appRanking}
                      layout="vertical"
                      margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                      <YAxis type="category" dataKey="displayName" hide />
                      <Tooltip
                        formatter={(v) => [`${v}h`, 'Usage']}
                        labelFormatter={(l) => l}
                        cursor={false}
                      />
                      <Bar
                        dataKey="totalHours"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={handleBarClick}
                      >
                        {data!.appRanking.map((entry) => (
                          <Cell
                            key={entry.appName}
                            fill={
                              selectedApp === null || selectedApp === entry.appName
                                ? '#4f46e5'
                                : '#94a3b8'
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="displayName"
                          position="insideLeft"
                          style={{ fill: 'white', fontSize: 11, fontWeight: 500 }}
                        />
                        <LabelList
                          dataKey="totalHours"
                          position="right"
                          formatter={(v: unknown) => `${v}h`}
                          style={{ fontSize: 11 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for this period</div>
                )}
              </CardContent>
            </Card>

            {/* Top Users */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Users</CardTitle>
                <p className="text-xs text-muted-foreground">Ranked by total usage hours</p>
              </CardHeader>
              <CardContent>
                {(data?.userRanking.length ?? 0) > 0 ? (
                  <div className="space-y-3">
                    {data!.userRanking.map((u, i) => (
                      <div key={u.userId} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.leaseCount} lease{u.leaseCount !== 1 ? 's' : ''}</div>
                        </div>
                        <span className="text-sm font-semibold shrink-0 tabular-nums">{u.totalHours}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for this period</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* App filter badge */}
          {selectedAppName && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Filtered by:</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {selectedAppName}
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="hover:text-indigo-900 dark:hover:text-indigo-100 leading-none"
                  aria-label="Clear filter"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          {/* Usage Trend */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base">Usage Trend</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Daily view — select a metric below</p>
                </div>
                {/* Metric selector */}
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(METRIC_INFO) as TrendMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTrendMetric(m)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-md border transition-colors',
                        trendMetric === m
                          ? 'border-transparent text-white'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                      )}
                      style={trendMetric === m ? { backgroundColor: METRIC_INFO[m].color } : undefined}
                    >
                      {METRIC_INFO[m].label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              ) : mounted && (data?.trend.some((t) => (t[metric.dataKey as keyof TrendItem] as number) > 0) ?? false) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data!.trend} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      unit={metric.unit}
                      width={metric.unit ? 40 : 32}
                    />
                    <Tooltip
                      formatter={(v) => [`${v}${metric.unit}`, metric.label]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric.dataKey}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for this period</div>
              )}
            </CardContent>
          </Card>

          {/* Launch Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Launch Heatmap</CardTitle>
              <p className="text-xs text-muted-foreground">When leases are started — day of week × hour of day</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {trendLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded-lg" />
              ) : data?.heatmap ? (
                <div className="min-w-[560px]">
                  {/* Hour labels */}
                  <div className="flex gap-0.5 mb-1.5 ml-10">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} className="w-5 text-[9px] text-center text-muted-foreground">
                        {h % 6 === 0 ? h : ''}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {data.heatmap.map((row, day) => (
                    <div key={day} className="flex items-center gap-0.5 mb-0.5">
                      <div className="w-9 text-[10px] text-muted-foreground text-right pr-1.5 shrink-0">
                        {DAYS[day]}
                      </div>
                      {row.map((cell, hour) => (
                        <div
                          key={hour}
                          title={`${DAYS[day]} ${String(hour).padStart(2, '0')}:00 — ${cell.count} start${cell.count !== 1 ? 's' : ''}`}
                          className="w-5 h-5 rounded-sm transition-colors"
                          style={{
                            backgroundColor: cell.count === 0
                              ? 'hsl(var(--muted))'
                              : `rgba(79, 70, 229, ${0.15 + cell.intensity * 0.85})`,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center gap-2 mt-3 ml-10">
                    <span className="text-[10px] text-muted-foreground">Less</span>
                    {[0.15, 0.35, 0.55, 0.75, 1.0].map((v) => (
                      <div key={v} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(79, 70, 229, ${v})` }} />
                    ))}
                    <span className="text-[10px] text-muted-foreground">More</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No data for this period</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
