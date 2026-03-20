'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface Schedule {
  id: string;
  connection_id: string;
  app_name: string;
  label: string | null;
  days_of_week: number[];
  start_time: string;
  stop_time: string;
  timezone: string;
  is_enabled: boolean;
  last_triggered_at: string | null;
  last_trigger_action: string | null;
  last_trigger_status: string | null;
  last_error: string | null;
}

interface AppOption {
  app_name: string;
  display_name: string | null;
  app_type: string;
  connection_id: string;
}

// ============================================================
// Constants
// ============================================================

const DAY_LABELS = [
  { value: 1, short: 'Mo', long: 'Monday' },
  { value: 2, short: 'Tu', long: 'Tuesday' },
  { value: 3, short: 'We', long: 'Wednesday' },
  { value: 4, short: 'Th', long: 'Thursday' },
  { value: 5, short: 'Fr', long: 'Friday' },
  { value: 6, short: 'Sa', long: 'Saturday' },
  { value: 7, short: 'Su', long: 'Sunday' },
];

const TIMEZONES = [
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
];

const WEEKDAY_PRESET = [1, 2, 3, 4, 5];

// ============================================================
// Helpers
// ============================================================

function formatDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (JSON.stringify(sorted) === JSON.stringify(WEEKDAY_PRESET)) return 'Mon-Fri';
  if (JSON.stringify(sorted) === JSON.stringify([6, 7])) return 'Sat-Sun';
  return sorted.map(d => DAY_LABELS.find(l => l.value === d)?.short ?? '').join(', ');
}

function formatTime(time: string): string {
  // "HH:MM:SS" or "HH:MM" → "HH:MM"
  return time.substring(0, 5);
}

function calcDuration(startTime: string, stopTime: string): string {
  const startParts = startTime.split(':');
  const stopParts = stopTime.split(':');
  const startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  const stopMin = parseInt(stopParts[0], 10) * 60 + parseInt(stopParts[1], 10);
  const diff = stopMin - startMin;
  if (diff <= 0) return '--';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function tzShort(tz: string): string {
  const entry = TIMEZONES.find(t => t.value === tz);
  if (!entry) return tz;
  const match = entry.label.match(/\(([^)]+)\)/);
  return match ? match[1].split(',')[0].trim() : tz;
}

// ============================================================
// Page Component
// ============================================================

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editAppName, setEditAppName] = useState('');
  const [editConnectionId, setEditConnectionId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editStopTime, setEditStopTime] = useState('18:00');
  const [editTimezone, setEditTimezone] = useState('Asia/Tokyo');
  const [editEnabled, setEditEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchedules = useCallback(async () => {
    const res = await fetch('/api/schedules');
    if (res.ok) {
      const data = await res.json();
      setSchedules(data.schedules || []);
    }
    setLoading(false);
  }, []);

  const fetchApps = useCallback(async () => {
    const res = await fetch('/api/catalog');
    if (res.ok) {
      const data = await res.json();
      // Filter out streamlit_wh (always-on, no schedule needed)
      const eligible = (data.apps || []).filter(
        (a: AppOption & { app_type: string; is_visible: boolean }) =>
          a.app_type !== 'streamlit_wh' && a.is_visible !== false
      );
      setApps(eligible);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchApps();
  }, [fetchSchedules, fetchApps]);

  const openNewDialog = () => {
    setIsNew(true);
    setEditSchedule({} as Schedule);
    setEditAppName('');
    setEditConnectionId('');
    setEditLabel('');
    setEditDays(WEEKDAY_PRESET);
    setEditStartTime('09:00');
    setEditStopTime('18:00');
    setEditTimezone('Asia/Tokyo');
    setEditEnabled(true);
  };

  const openEditDialog = (s: Schedule) => {
    setIsNew(false);
    setEditSchedule(s);
    setEditAppName(s.app_name);
    setEditConnectionId(s.connection_id);
    setEditLabel(s.label || '');
    setEditDays([...s.days_of_week]);
    setEditStartTime(formatTime(s.start_time));
    setEditStopTime(formatTime(s.stop_time));
    setEditTimezone(s.timezone);
    setEditEnabled(s.is_enabled);
  };

  const toggleDay = (day: number) => {
    setEditDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAppSelect = (appName: string) => {
    setEditAppName(appName);
    const app = apps.find(a => a.app_name === appName);
    if (app) setEditConnectionId(app.connection_id);
  };

  const handleSave = async () => {
    if (!editAppName || editDays.length === 0 || !editStartTime || !editStopTime) {
      toast.error('App, days, start time, and stop time are required');
      return;
    }
    if (editStopTime <= editStartTime) {
      toast.error('Stop time must be after start time');
      return;
    }

    setSaving(true);

    if (isNew) {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: editConnectionId,
          appName: editAppName,
          label: editLabel.trim() || null,
          daysOfWeek: editDays,
          startTime: editStartTime,
          stopTime: editStopTime,
          timezone: editTimezone,
        }),
      });
      if (res.ok) {
        toast.success('Schedule created');
        setEditSchedule(null);
        await fetchSchedules();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create');
      }
    } else if (editSchedule) {
      const res = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editSchedule.id,
          label: editLabel.trim() || null,
          daysOfWeek: editDays,
          startTime: editStartTime,
          stopTime: editStopTime,
          timezone: editTimezone,
          isEnabled: editEnabled,
        }),
      });
      if (res.ok) {
        toast.success('Schedule updated');
        setEditSchedule(null);
        await fetchSchedules();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    }

    setSaving(false);
  };

  const handleDelete = async (s: Schedule) => {
    const name = s.label || s.app_name;
    if (!confirm(`Delete schedule "${name}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/schedules?id=${s.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Schedule deleted');
      await fetchSchedules();
    } else {
      toast.error('Failed to delete');
    }
  };

  const handleToggleEnabled = async (s: Schedule) => {
    const res = await fetch('/api/schedules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, isEnabled: !s.is_enabled }),
    });
    if (res.ok) {
      toast.success(s.is_enabled ? 'Schedule disabled' : 'Schedule enabled');
      await fetchSchedules();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Schedules</h2>
          <p className="text-sm text-muted-foreground">
            Set up automated start/stop times for your apps. Schedules run on the configured days and times.
          </p>
        </div>
        <Button onClick={openNewDialog}>Add Schedule</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-2">No schedules yet.</p>
            <p className="text-sm mb-4">
              Add a schedule to automatically start and stop apps at specific times.
            </p>
            <Button onClick={openNewDialog}>Add Schedule</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24">Last Run</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.app_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{s.label || '--'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDays(s.days_of_week)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-mono">
                      {formatTime(s.start_time)}-{formatTime(s.stop_time)}
                    </div>
                    <div className="text-xs text-muted-foreground">{tzShort(s.timezone)}</div>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleEnabled(s)}>
                      <Badge variant={s.is_enabled ? 'default' : 'secondary'} className="cursor-pointer">
                        {s.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    {s.last_triggered_at ? (
                      <div>
                        <Badge
                          variant={
                            s.last_trigger_status === 'OK' ? 'default' :
                            s.last_trigger_status === 'SKIPPED' ? 'secondary' :
                            'destructive'
                          }
                          className="text-xs"
                        >
                          {s.last_trigger_action} {s.last_trigger_status}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(s)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(s)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={!!editSchedule} onOpenChange={(open) => { if (!open) setEditSchedule(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Schedule' : 'Edit Schedule'}</DialogTitle>
            <DialogDescription>
              Configure automated start/stop times. The app will launch at start time and stop at stop time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* App selector (new only) */}
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="sched-app">App</Label>
                <select
                  id="sched-app"
                  value={editAppName}
                  onChange={(e) => handleAppSelect(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select an app...</option>
                  {apps.map(app => (
                    <option key={app.app_name} value={app.app_name}>
                      {app.display_name || app.app_name} ({app.app_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show app name when editing */}
            {!isNew && (
              <div className="space-y-1">
                <Label>App</Label>
                <p className="text-sm font-medium">{editAppName}</p>
              </div>
            )}

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="sched-label">Label</Label>
              <Input
                id="sched-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g. Weekday business hours"
              />
            </div>

            {/* Days of week */}
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex gap-1">
                {DAY_LABELS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-10 rounded-md text-sm font-medium border transition-colors ${
                      editDays.includes(day.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-input hover:bg-muted'
                    }`}
                    title={day.long}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditDays(WEEKDAY_PRESET)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  onClick={() => setEditDays([6, 7])}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Weekends
                </button>
                <button
                  type="button"
                  onClick={() => setEditDays([1, 2, 3, 4, 5, 6, 7])}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Every day
                </button>
              </div>
            </div>

            {/* Start / Stop time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sched-start">Start Time</Label>
                <Input
                  id="sched-start"
                  type="time"
                  step="900"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-stop">Stop Time</Label>
                <Input
                  id="sched-stop"
                  type="time"
                  step="900"
                  value={editStopTime}
                  onChange={(e) => setEditStopTime(e.target.value)}
                />
              </div>
            </div>

            {/* Duration display */}
            {editStartTime && editStopTime && editStopTime > editStartTime && (
              <p className="text-sm text-muted-foreground">
                Duration: {calcDuration(editStartTime, editStopTime)}
              </p>
            )}
            {editStartTime && editStopTime && editStopTime <= editStartTime && (
              <p className="text-sm text-destructive">
                Stop time must be after start time.
              </p>
            )}

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="sched-tz">Timezone</Label>
              <select
                id="sched-tz"
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Enable toggle (edit only) */}
            {!isNew && (
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <button type="button" onClick={() => setEditEnabled(!editEnabled)}>
                  <Badge variant={editEnabled ? 'default' : 'secondary'} className="cursor-pointer">
                    {editEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSchedule(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
