'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isImageIcon, getImageIconSrc } from '@/lib/icon-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface CatalogApp {
  id: string;
  app_name: string;
  display_name: string | null;
  icon_emoji: string | null;
  app_status: string | null;
  app_comment: string | null;
  category: string | null;
  compute_pool: string | null;
  service_name: string | null;
  postgres_instance: string | null;
  endpoint_url: string | null;
  is_visible: boolean;
  sort_order: number;
  last_synced_at: string | null;
}

// Special image-based icons (stored as "img:<name>" in icon_emoji)
const IMAGE_ICONS: { key: string; src: string; label: string }[] = [
  { key: 'img:streamlit', src: '/icons/streamlit.png', label: 'Streamlit' },
  { key: 'img:postgres', src: '/icons/postgres.png', label: 'PostgreSQL' },
  { key: 'img:blueappworks', src: '/icon.svg', label: 'Blue App Works' },
];

const EMOJI_OPTIONS = [
  // Business / Analytics
  '📊', '📈', '📉', '💰', '💳', '🏦', '🧾',
  // AI / ML
  '🤖', '🧠', '✨', '🔮',
  // Data / Storage
  '📦', '🗂', '🗄', '💾', '📁',
  // Operations / Tools
  '🛠', '⚙', '🔧', '🔩', '🧰',
  // Communication
  '💬', '📧', '📣', '🔔',
  // Search / Quality
  '🔍', '🔎', '✅', '🛡',
  // Science / Code
  '🧪', '🧮', '⚡', '💡',
  // People / Org
  '👥', '👤', '🏢', '🎯',
  // Misc
  '📝', '📋', '🌐', '🖥', '🔄', '📅', '🚀', '🎨',
];

const DEFAULT_CATEGORY_OPTIONS = [
  'Analytics',
  'AI/ML',
  'Operations',
  'Governance',
  'Tools',
  'Communication',
  'Data',
  'Security',
];

export default function CatalogSettingsPage() {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Edit dialog state
  const [editApp, setEditApp] = useState<CatalogApp | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmoji, setEditEmoji] = useState('📦');
  const [editEndpointUrl, setEditEndpointUrl] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Merge default categories with those already used by apps
  const allCategories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORY_OPTIONS);
    for (const app of apps) {
      if (app.category) cats.add(app.category);
    }
    return [...cats].sort();
  }, [apps]);

  const fetchApps = useCallback(async () => {
    const res = await fetch('/api/catalog');
    if (res.ok) {
      const data = await res.json();
      setApps(data.catalog || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/catalog/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const msg = data.synced > 0
          ? `Synced ${data.synced} of ${data.total} app(s) from Snowflake`
          : data.message || 'No apps to sync';
        setSyncMessage(msg);
        await fetchApps();
      } else {
        setSyncMessage(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage(`Sync error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSyncing(false);
  };

  const startEdit = (app: CatalogApp) => {
    setEditApp(app);
    setEditDisplayName(app.display_name || app.app_name);
    setEditEmoji(app.icon_emoji || '📦');
    setEditEndpointUrl(app.endpoint_url || '');
    setEditComment(app.app_comment || '');
    const cat = app.category || '';
    setEditCategory(cat);
    setCustomCategory('');
    setShowCustomCategory(false);
  };

  const handleCategorySelect = (cat: string) => {
    if (cat === '_custom') {
      setShowCustomCategory(true);
      setEditCategory('');
    } else {
      setShowCustomCategory(false);
      setCustomCategory('');
      setEditCategory(cat === '_none' ? '' : cat);
    }
  };

  const effectiveCategory = showCustomCategory ? customCategory.trim() : editCategory;

  const handleSave = async () => {
    if (!editApp) return;
    setSaving(true);

    const res = await fetch('/api/catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editApp.id,
        displayName: editDisplayName.trim(),
        iconEmoji: editEmoji,
        endpointUrl: editEndpointUrl.trim() || null,
        appComment: editComment.trim() || null,
        appCategory: effectiveCategory || null,
      }),
    });

    if (res.ok) {
      toast.success('App updated');
      setEditApp(null);
      await fetchApps();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to save');
    }
    setSaving(false);
  };

  const handleHide = async (app: CatalogApp) => {
    if (!confirm(`Hide "${app.display_name || app.app_name}" from the Gallery?`)) return;
    const res = await fetch(`/api/catalog?id=${app.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('App hidden from gallery');
      await fetchApps();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">App Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Apps are registered in Snowflake Streamlit. Sync to update, or customize display here.
          </p>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync from Snowflake'}
        </Button>
      </div>

      {syncMessage && (
        <div className={`mb-4 text-sm px-3 py-2 rounded-md ${
          syncMessage.includes('failed') || syncMessage.includes('error')
            ? 'bg-destructive/10 text-destructive'
            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        }`}>
          {syncMessage}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-2">No apps synced yet.</p>
            <p className="text-sm mb-4">
              Register apps in the Snowflake Streamlit dashboard, then sync here.
            </p>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync from Snowflake'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead></TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Compute Pool</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Postgres</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sticky right-0 bg-card z-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="text-xl">
                    {isImageIcon(app.icon_emoji || '') ? (
                      <img src={getImageIconSrc(app.icon_emoji!)!} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      app.icon_emoji || '📦'
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{app.display_name || app.app_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{app.app_name}</div>
                      {app.app_comment && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[240px]">
                          {app.app_comment}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(app)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell>
                    {app.category ? (
                      <Badge variant="outline">{app.category}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[160px]">
                    {app.compute_pool ? (
                      <span className="font-mono break-all">{app.compute_pool}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    {app.service_name ? (
                      <span className="font-mono break-all">{app.service_name}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[160px]">
                    {app.postgres_instance ? (
                      <span className="font-mono break-all">{app.postgres_instance}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={app.app_status === 'READY' ? 'default' : 'secondary'}>
                      {app.app_status || 'UNKNOWN'}
                    </Badge>
                  </TableCell>
                  <TableCell className="sticky right-0 bg-card z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleHide(app)}
                    >
                      Hide
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editApp} onOpenChange={(open) => { if (!open) setEditApp(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit App — {editApp?.display_name || editApp?.app_name}
            </DialogTitle>
            <DialogDescription>
              Customize how this app appears in the Gallery. Resource fields (Compute Pool, Service) are managed via Snowflake sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex gap-1 flex-wrap max-h-[120px] overflow-y-auto">
                {IMAGE_ICONS.map((img) => (
                  <button
                    key={img.key}
                    type="button"
                    onClick={() => setEditEmoji(img.key)}
                    title={img.label}
                    className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
                      editEmoji === img.key
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    <img src={img.src} alt={img.label} className="w-5 h-5 object-contain" />
                  </button>
                ))}
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setEditEmoji(emoji)}
                    className={`w-8 h-8 text-base rounded-md border flex items-center justify-center transition-colors ${
                      editEmoji === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input
                id="edit-name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="App display name"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCategorySelect('_none')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    !effectiveCategory && !showCustomCategory
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:bg-muted text-muted-foreground'
                  }`}
                >
                  None
                </button>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      editCategory === cat && !showCustomCategory
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCategorySelect('_custom')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    showCustomCategory
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-dashed border-muted hover:bg-muted text-muted-foreground'
                  }`}
                >
                  + Custom
                </button>
              </div>
              {showCustomCategory && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category name..."
                  className="mt-1.5"
                  autoFocus
                />
              )}
              <p className="text-xs text-muted-foreground">
                Categories are used as filter chips in the Gallery.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-comment">Description</Label>
              <Textarea
                id="edit-comment"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                placeholder="Brief description of the app..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Shown on the Gallery card and in the App Detail dialog.
              </p>
            </div>

            {/* Endpoint URL */}
            <div className="space-y-2">
              <Label htmlFor="edit-endpoint">Endpoint URL</Label>
              <Input
                id="edit-endpoint"
                value={editEndpointUrl}
                onChange={(e) => setEditEndpointUrl(e.target.value)}
                placeholder="https://...snowflakecomputing.app"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Override the auto-discovered endpoint. Leave empty for automatic detection.
              </p>
            </div>

            {/* Read-only resource info */}
            {editApp && (editApp.compute_pool || editApp.service_name || editApp.postgres_instance) && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Resources (from Snowflake)</Label>
                <div className="rounded-md border p-3 space-y-1 text-xs text-muted-foreground break-all">
                  {editApp.compute_pool && (
                    <div>Compute Pool: <span className="font-mono">{editApp.compute_pool}</span></div>
                  )}
                  {editApp.service_name && (
                    <div>Service: <span className="font-mono">{editApp.service_name}</span></div>
                  )}
                  {editApp.postgres_instance && (
                    <div>Postgres: <span className="font-mono">{editApp.postgres_instance}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditApp(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
