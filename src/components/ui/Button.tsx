import React, { useImperativeHandle } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';
import { useSpatialTilt } from './useSpatialTilt';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  spatial?: boolean;
  depth?: 'primary' | 'secondary' | 'subtle' | 'none';
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
      spatial = true,
      depth,
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      onKeyDown,
      onKeyUp,
      ...props
    },
    forwardedRef
  ) => {
    // Spatial tilt physics hook
    const { ref: internalRef, isPressed, handlers } = useSpatialTilt<HTMLButtonElement>({
      enabled: spatial && !disabled && !isLoading,
      maxRotateX: variant === 'primary' || variant === 'gold' ? 2.5 : 1.8,
      maxRotateY: variant === 'primary' || variant === 'gold' ? 2.5 : 1.8,
      maxTranslateZ: variant === 'primary' || variant === 'gold' ? 3 : 2,
      pressTranslateY: 1.5,
      damping: 0.14,
    });

    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLButtonElement);

    const baseStyles =
      'relative isolate inline-flex items-center justify-center font-sans font-medium select-none cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none';

    const spatialStyles = spatial
      ? 'spatial-surface spatial-perspective will-change-transform transform-gpu'
      : 'transition-colors duration-150';

    // Layer 1 + 2: Tactile chassis shadows and institutional color variants
    const variants = {
      primary: clsx(
        'bg-maroon-700 text-white border border-maroon-800 hover:bg-maroon-800 active:bg-maroon-900',
        spatial && 'spatial-shadow-primary'
      ),
      secondary: clsx(
        'bg-surface text-ink border border-warm-300 hover:bg-warm-100 active:bg-warm-200 text-ink-muted hover:text-ink',
        spatial ? 'spatial-shadow-secondary' : 'shadow-subtle'
      ),
      gold: clsx(
        'bg-gold-500 text-maroon-950 font-semibold border border-gold-600 hover:bg-gold-400 active:bg-gold-600',
        spatial && 'spatial-shadow-gold'
      ),
      outline: clsx(
        'bg-transparent text-maroon-800 border border-maroon-300 hover:bg-maroon-50 active:bg-maroon-100',
        spatial && 'hover:border-maroon-600 active:border-maroon-800 shadow-xs'
      ),
      ghost:
        'bg-transparent text-ink hover:bg-warm-200 active:bg-warm-300 border border-transparent',
      danger: clsx(
        'bg-rose-700 text-white border border-rose-800 hover:bg-rose-800 active:bg-rose-900',
        spatial && 'spatial-shadow-danger'
      ),
    };

    // WCAG 2.5.5 / 2.5.8 compliant sizing & minimum touch targets
    const sizes = {
      sm: 'text-xs min-h-[44px] sm:min-h-[36px] h-auto sm:h-9 px-3 py-2 sm:py-1.5 gap-1.5 touch-manipulation',
      md: 'text-sm min-h-[44px] h-11 px-4 gap-2 touch-manipulation',
      lg: 'text-base min-h-[48px] h-12 px-6 gap-2.5 touch-manipulation',
    };

    return (
      <button
        ref={internalRef}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        data-pressed={isPressed}
        className={twMerge(clsx(baseStyles, spatialStyles, variants[variant], sizes[size], className))}
        onPointerEnter={(e) => {
          handlers.onPointerEnter(e);
          onPointerEnter?.(e);
        }}
        onPointerMove={(e) => {
          handlers.onPointerMove(e);
          onPointerMove?.(e);
        }}
        onPointerLeave={(e) => {
          handlers.onPointerLeave();
          onPointerLeave?.(e);
        }}
        onPointerDown={(e) => {
          handlers.onPointerDown();
          onPointerDown?.(e);
        }}
        onPointerUp={(e) => {
          handlers.onPointerUp();
          onPointerUp?.(e);
        }}
        onPointerCancel={(e) => {
          handlers.onPointerCancel();
        }}
        onKeyDown={(e) => {
          handlers.onKeyDown(e);
          onKeyDown?.(e);
        }}
        onKeyUp={(e) => {
          handlers.onKeyUp(e);
          onKeyUp?.(e);
        }}
        {...props}
      >
        {/* Layer 2 Specular Highlight Rim */}
        {spatial && (variant === 'primary' || variant === 'gold' || variant === 'danger') && (
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-md opacity-80"
            aria-hidden="true"
          />
        )}
        {spatial && variant === 'secondary' && (
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rounded-t-md"
            aria-hidden="true"
          />
        )}

        {/* Layer 3: Floating Content Layer */}
        <span className={clsx('spatial-content relative z-10 inline-flex items-center justify-center gap-2 w-full')}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          ) : (
            leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
          )}
          <span>{children}</span>
          {!isLoading && rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
export const SpatialButton = Button;
