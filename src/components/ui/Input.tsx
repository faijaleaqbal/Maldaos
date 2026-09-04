import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && inputId ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-ink uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={errorId || helperId || undefined}
            className={twMerge(
              clsx(
                'w-full min-h-[42px] rounded-md border bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-700/20 disabled:bg-warm-100 disabled:opacity-75',
                leftIcon ? 'pl-9' : '',
                error ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : 'border-warm-300',
                className
              )
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs text-rose-600 font-medium" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-ink-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = error && textareaId ? `${textareaId}-error` : undefined;
    const helperId = helperText && textareaId ? `${textareaId}-helper` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-ink uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={errorId || helperId || undefined}
          className={twMerge(
            clsx(
              'w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-700/20 disabled:bg-warm-100 disabled:opacity-75',
              error ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : 'border-warm-300',
              className
            )
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-rose-600 font-medium" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-ink-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
