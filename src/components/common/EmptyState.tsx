import React from 'react';
import { Button } from '@/components/ui/Button';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-5 sm:p-10 text-center rounded-lg border border-dashed border-warm-300 bg-white/60">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-warm-200/80 flex items-center justify-center text-maroon-800 mb-2.5 sm:mb-3.5">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.5]" />
      </div>
      <h3 className="font-serif font-semibold text-base sm:text-lg text-ink mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-ink-muted max-w-sm mb-3.5 sm:mb-5 leading-relaxed">{description}</p>
      {actionLabel && (
        <>
          {actionHref ? (
            <a href={actionHref}>
              <Button size="sm" variant="primary">
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button size="sm" variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
