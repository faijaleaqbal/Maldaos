import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'maroon' | 'gold' | 'outline' | 'ai' | 'success' | 'warning' | 'danger' | 'muted';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-warm-200 text-ink border-warm-300',
    maroon: 'bg-maroon-50 text-maroon-800 border-maroon-200',
    gold: 'bg-gold-50 text-gold-900 border-gold-300 font-medium',
    outline: 'bg-transparent text-ink-muted border-warm-300',
    ai: 'bg-ai-50 text-ai-700 border-ai-border font-medium',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    muted: 'bg-warm-100 text-ink-muted border-warm-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs sm:text-sm px-2.5 py-1',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 font-sans rounded-md border tracking-tight leading-none whitespace-nowrap',
          variants[variant],
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
};
