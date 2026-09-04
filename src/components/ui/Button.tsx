import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-sans font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 rounded-md cursor-pointer select-none';

    const variants = {
      primary:
        'bg-maroon-700 text-white hover:bg-maroon-800 active:bg-maroon-900 border border-maroon-800 shadow-sm',
      secondary:
        'bg-surface text-ink hover:bg-warm-100 active:bg-warm-200 border border-warm-300 text-ink-muted hover:text-ink shadow-subtle',
      gold:
        'bg-gold-500 text-maroon-950 font-semibold hover:bg-gold-400 active:bg-gold-600 border border-gold-600 shadow-sm',
      outline:
        'bg-transparent text-maroon-800 hover:bg-maroon-50 active:bg-maroon-100 border border-maroon-300',
      ghost:
        'bg-transparent text-ink hover:bg-warm-200 active:bg-warm-300',
      danger:
        'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 border border-rose-800 shadow-sm',
    };

    const sizes = {
      sm: 'text-xs h-9 px-3 gap-1.5 min-h-[38px] sm:min-h-[36px]',
      md: 'text-sm h-11 px-4 gap-2 min-h-[44px]',
      lg: 'text-base h-12 px-6 gap-2.5 min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
