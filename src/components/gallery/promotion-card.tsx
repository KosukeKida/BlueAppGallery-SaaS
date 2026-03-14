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
        'group relative flex flex-col text-left rounded-xl bg-card min-h-[140px] overflow-hidden',
        'hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer',
        'ring-2 ring-amber-400/60 hover:ring-amber-500/80'
      )}
    >
      {/* Full-bleed background image */}
      {card.image_url && (
        <div className="absolute inset-0">
          <img
            src={card.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </div>
      )}

      {/* Sponsored badge */}
      <Badge
        variant="secondary"
        className="absolute top-2 right-2 text-[10px] px-1.5 py-0 bg-amber-400/90 text-amber-900 dark:bg-amber-500/80 dark:text-amber-950 z-10"
      >
        Sponsored
      </Badge>

      {/* Content overlay */}
      <div className={cn(
        'relative z-10 flex flex-col flex-1 p-4',
        card.image_url ? 'text-white' : ''
      )}>
        {/* No image fallback: icon + title */}
        {!card.image_url && (
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 bg-amber-500/15">
              📢
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate pr-16">{card.title}</div>
            </div>
          </div>
        )}

        {/* Spacer to push content to bottom when image is present */}
        {card.image_url && <div className="flex-1" />}

        {/* Title (on image) */}
        {card.image_url && (
          <div className="text-base font-bold leading-tight mb-1 drop-shadow-md">
            {card.title}
          </div>
        )}

        {/* Description */}
        {card.description && (
          <p className={cn(
            'text-xs leading-relaxed line-clamp-2 mb-2',
            card.image_url ? 'text-white/80' : 'text-muted-foreground'
          )}>
            {card.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end mt-auto">
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-md',
            card.image_url
              ? 'bg-white/20 text-white backdrop-blur-sm'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          )}>
            Learn More ↗
          </span>
        </div>
      </div>
    </button>
  );
}
