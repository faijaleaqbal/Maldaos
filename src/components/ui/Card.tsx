import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'warm' | 'subtle' | 'ai' | 'outlined';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', className, ...props }, ref) => {
    const variants = {
      default: 'bg-surface border-warm-300 text-ink shadow-card',
      warm: 'bg-warm-100 border-warm-300 text-ink',
      subtle: 'bg-warm-50 border-warm-200 text-ink',
      ai: 'bg-ai-surface border-ai-border text-ink shadow-subtle',
      outlined: 'bg-transparent border-warm-300 text-ink',
    };

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx('rounded-lg border p-4 sm:p-5 transition-all', variants[variant], className)
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge(clsx('flex flex-col space-y-1.5 pb-3 border-b border-warm-200 mb-3', className))} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3 className={twMerge(clsx('font-serif font-semibold text-lg text-ink tracking-tight', className))} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className,
  ...props
}) => (
  <p className={twMerge(clsx('text-xs sm:text-sm text-ink-muted', className))} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge(clsx('pt-1', className))} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge(clsx('flex items-center pt-3 mt-3 border-t border-warm-200', className))} {...props}>
    {children}
  </div>
);
