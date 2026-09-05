'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, X, ChevronDown } from 'lucide-react';
import { useSpatialTilt } from './useSpatialTilt';
export { Button, SpatialButton } from './Button';

/* ==========================================================================
   1. SPATIAL TABS (Sliding Layered Indicator, No Excessive Spring)
   ========================================================================== */

export interface SpatialTabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
}

export interface SpatialTabsProps<T extends string = string> {
  tabs: SpatialTabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  layoutId?: string;
}

export function SpatialTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  ariaLabel = 'Tab navigation',
  layoutId = 'spatial-tabs-indicator',
}: SpatialTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={twMerge(
        'relative inline-flex items-center rounded-md border border-warm-300 bg-warm-200/80 p-0.5 text-xs font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              'relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation min-h-[36px] sm:min-h-[32px]',
              isActive ? 'text-maroon-900 font-semibold' : 'text-ink-muted hover:text-ink'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={{
                  duration: 0.24,
                  ease: [0.25, 1, 0.5, 1], // Exact 240ms dampened ease (220-300ms spec, zero overshoot)
                }}
                className="absolute inset-0 z-[-1] rounded bg-white border border-warm-300/80 shadow-[0_1.5px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]"
              />
            )}
            {tab.icon && <span className="shrink-0" aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'ml-1 font-mono text-[10px] px-1.5 py-0.2 rounded-full border transition-colors',
                  isActive
                    ? 'bg-maroon-50 text-maroon-800 border-maroon-200'
                    : 'bg-warm-100 text-ink-muted border-warm-300'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   2. SPATIAL FILTER PILL (Tactile Paper Chassis, Edge Accent on Select)
   ========================================================================== */

export interface SpatialFilterProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number | string;
  variant?: 'category' | 'status';
  className?: string;
  ariaLabel?: string;
}

export const SpatialFilter: React.FC<SpatialFilterProps> = ({
  active,
  onClick,
  label,
  count,
  variant = 'category',
  className,
  ariaLabel,
}) => {
  const { ref, isPressed, handlers } = useSpatialTilt<HTMLButtonElement>({
    enabled: true,
    maxRotateX: 1.5,
    maxRotateY: 1.5,
    maxTranslateZ: 1.5,
    pressTranslateY: 1,
    damping: 0.16,
  });

  const activeStyles =
    variant === 'category'
      ? 'bg-maroon-700 text-white font-semibold border-maroon-800 spatial-shadow-primary'
      : 'bg-warm-400 text-maroon-950 font-semibold border-warm-500 shadow-sm';

  const unactiveStyles =
    'bg-warm-100 hover:bg-white text-ink-muted hover:text-ink border-warm-300/80 hover:border-warm-400 shadow-xs';

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel || label}
      data-pressed={isPressed}
      onClick={onClick}
      className={twMerge(
        'relative isolate inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all duration-150 cursor-pointer select-none touch-manipulation border min-h-[32px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700',
        active ? activeStyles : unactiveStyles,
        isPressed ? 'translate-y-[1px]' : active ? '-translate-y-[0.5px]' : '',
        className
      )}
      onPointerEnter={handlers.onPointerEnter}
      onPointerMove={handlers.onPointerMove}
      onPointerLeave={handlers.onPointerLeave}
      onPointerDown={handlers.onPointerDown}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onKeyDown={handlers.onKeyDown}
      onKeyUp={handlers.onKeyUp}
    >
      {/* Subtle top edge highlight */}
      {active && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span
          className={clsx(
            'font-mono text-[10px] px-1.5 py-0.2 rounded-full border',
            active
              ? 'bg-white/20 text-white border-white/30'
              : 'bg-warm-200/80 text-ink-muted border-warm-300'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/* ==========================================================================
   3. SPATIAL SEARCH (Recessed Paper Well with Focus Elevation)
   ========================================================================== */

export interface SpatialSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export const SpatialSearch: React.FC<SpatialSearchProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className,
  ...props
}) => {
  return (
    <div className={twMerge('relative flex-1 group', className)}>
      <Search className="w-4 h-4 text-ink-muted group-focus-within:text-maroon-700 absolute left-3 top-2.5 transition-colors pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-md border border-warm-300 bg-warm-50/50 hover:bg-white text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 focus:shadow-subtle transition-all duration-150"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search input"
          className="absolute right-2.5 top-2.5 p-0.5 rounded text-ink-muted hover:text-ink hover:bg-warm-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/* ==========================================================================
   4. SPATIAL SELECT (Tactile Dropdown Chassis)
   ========================================================================== */

export interface SpatialSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  wrapperClassName?: string;
}

export const SpatialSelect: React.FC<SpatialSelectProps> = ({
  className,
  wrapperClassName,
  children,
  ...props
}) => {
  return (
    <div className={twMerge('relative inline-flex items-center shrink-0', wrapperClassName)}>
      <select
        className={twMerge(
          'appearance-none pl-3 pr-8 py-2 rounded-md border border-warm-300 text-xs sm:text-sm text-ink bg-white hover:bg-warm-50 shadow-[0_1.5px_0_#D6CBB9,0_2px_4px_-1px_rgba(0,0,0,0.05),inset_0_1px_0_#ffffff] hover:border-warm-400 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 cursor-pointer transition-all duration-150 min-h-[38px]',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-ink-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
};
