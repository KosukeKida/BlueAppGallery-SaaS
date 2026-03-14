'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { PromotionCardData } from '@/components/gallery/promotion-card';

export default function PromotionsPage() {
  const [cards, setCards] = useState<PromotionCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editCard, setEditCard] = useState<PromotionCardData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPosition, setEditPosition] = useState(0);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCards = useCallback(async () => {
    const res = await fetch('/api/promotions?active=false');
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const openNewDialog = () => {
    setIsNew(true);
    setEditCard({ id: '', title: '', description: null, image_url: null, link_url: '', position: 0, is_active: true });
    setEditTitle('');
    setEditDescription('');
    setEditLinkUrl('');
    setEditImageUrl('');
    setEditPosition(0);
    setEditActive(true);
  };

  const openEditDialog = (card: PromotionCardData) => {
    setIsNew(false);
    setEditCard(card);
    setEditTitle(card.title);
    setEditDescription(card.description || '');
    setEditLinkUrl(card.link_url);
    setEditImageUrl(card.image_url || '');
    setEditPosition(card.position);
    setEditActive(card.is_active);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/promotions/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setEditImageUrl(data.url);
        toast.success('Image uploaded');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload error');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editLinkUrl.trim()) {
      toast.error('Title and Link URL are required');
      return;
    }

    setSaving(true);

    if (isNew) {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          imageUrl: editImageUrl || null,
          linkUrl: editLinkUrl.trim(),
          position: editPosition,
        }),
      });
      if (res.ok) {
        toast.success('Promotion card created');
        setEditCard(null);
        await fetchCards();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create');
      }
    } else if (editCard) {
      const res = await fetch('/api/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editCard.id,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          imageUrl: editImageUrl || null,
          linkUrl: editLinkUrl.trim(),
          position: editPosition,
          isActive: editActive,
        }),
      });
      if (res.ok) {
        toast.success('Promotion card updated');
        setEditCard(null);
        await fetchCards();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    }

    setSaving(false);
  };

  const handleDelete = async (card: PromotionCardData) => {
    if (!confirm(`Delete "${card.title}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/promotions?id=${card.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Promotion card deleted');
      await fetchCards();
    } else {
      toast.error('Failed to delete');
    }
  };

  const handleToggleActive = async (card: PromotionCardData) => {
    const res = await fetch('/api/promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, isActive: !card.is_active }),
    });
    if (res.ok) {
      toast.success(card.is_active ? 'Card deactivated' : 'Card activated');
      await fetchCards();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Manage promotion cards displayed in the Gallery. Use these for donations, ads, or announcements.
          </p>
        </div>
        <Button onClick={openNewDialog}>Add Promotion Card</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-2">No promotion cards yet.</p>
            <p className="text-sm mb-4">
              Add a promotion card to display in the Gallery alongside app cards.
            </p>
            <Button onClick={openNewDialog}>Add Promotion Card</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-20">Position</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    {card.image_url ? (
                      <img src={card.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <span className="text-xl">📢</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{card.title}</div>
                      {card.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[240px]">
                          {card.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    <span className="font-mono break-all">{card.link_url}</span>
                  </TableCell>
                  <TableCell className="text-center">{card.position}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleActive(card)}>
                      <Badge variant={card.is_active ? 'default' : 'secondary'} className="cursor-pointer">
                        {card.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(card)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(card)}>
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

      {/* Edit / Create dialog */}
      <Dialog open={!!editCard} onOpenChange={(open) => { if (!open) setEditCard(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Promotion Card' : 'Edit Promotion Card'}</DialogTitle>
            <DialogDescription>
              Configure how this card appears in the Gallery grid. It will link to the specified URL when clicked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Image */}
            <div className="space-y-2">
              <Label>Card Image</Label>
              <div className="flex items-center gap-3">
                {editImageUrl ? (
                  <img src={editImageUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center text-xl">📢</div>
                )}
                <div className="flex-1 space-y-1">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="text-xs"
                  />
                  {editImageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditImageUrl('')}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, or GIF. Max 2MB. Used as the card icon.
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="promo-title">Title</Label>
              <Input
                id="promo-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Support this project!"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="promo-desc">Description</Label>
              <Textarea
                id="promo-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description shown on the card..."
                rows={2}
              />
            </div>

            {/* Link URL */}
            <div className="space-y-2">
              <Label htmlFor="promo-link">Link URL</Label>
              <Input
                id="promo-link"
                value={editLinkUrl}
                onChange={(e) => setEditLinkUrl(e.target.value)}
                placeholder="https://ko-fi.com/..."
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Opens in a new tab when the card is clicked.
              </p>
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="promo-position">Grid Position</Label>
              <Input
                id="promo-position"
                type="number"
                min={0}
                value={editPosition}
                onChange={(e) => setEditPosition(parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Insert before this position in the &quot;All Apps&quot; grid (0 = first).
              </p>
            </div>

            {/* Active toggle (edit mode only) */}
            {!isNew && (
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <button type="button" onClick={() => setEditActive(!editActive)}>
                  <Badge variant={editActive ? 'default' : 'secondary'} className="cursor-pointer">
                    {editActive ? 'Active' : 'Inactive'}
                  </Badge>
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCard(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
