'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface PromotionCardData {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string;
  position: number;
  is_active: boolean;
}

interface PromotionCardProps {
  card: PromotionCardData;
}

export function PromotionCard({ card }: PromotionCardProps) {
  return (
    <button
      type="button"
      onClick={() => window.open(card.link_url, '_blank', 'noopener')}
      className={cn(
        'group relative flex flex-col text-left rounded-xl border bg-card p-4 min-h-[140px]',
        'hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer',
        'border-dashed border-amber-400/60 hover:border-amber-500/80'
      )}
    >
      {/* Sponsored badge */}
      <Badge
        variant="secondary"
        className="absolute top-2 right-2 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      >
        Sponsored
      </Badge>

      {/* Header: Image/Icon + Title */}
      <div className="flex items-start gap-3 mb-2">
        {card.image_url ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
            <img
              src={card.image_url}
              alt={card.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 bg-amber-500/15">
            📢
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate pr-16">{card.title}</div>
        </div>
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {card.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-end">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
          Learn More ↗
        </span>
      </div>
    </button>
  );
}
