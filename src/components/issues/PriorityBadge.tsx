import React from 'react';
import { IssuePriority } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, AlertOctagon, Flame, ShieldAlert } from 'lucide-react';

interface PriorityBadgeProps {
  priority: IssuePriority;
  size?: 'sm' | 'md';
  prefix?: string; // e.g. "AI Suggested: "
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm', prefix = '' }) => {
  switch (priority) {
    case 'CRITICAL':
      return (
        <Badge variant="danger" size={size} className="bg-rose-100 text-rose-900 border-rose-300 font-semibold">
          <Flame className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{prefix}Critical</span>
        </Badge>
      );
    case 'HIGH':
      return (
        <Badge variant="warning" size={size} className="bg-amber-100 text-amber-900 border-amber-300 font-medium">
          <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
          <span>{prefix}High</span>
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge variant="gold" size={size} className="bg-warm-200 text-ink border-warm-300">
          <AlertCircle className="w-3 h-3 text-gold-700 shrink-0" />
          <span>{prefix}Medium</span>
        </Badge>
      );
    case 'LOW':
      return (
        <Badge variant="muted" size={size} className="bg-warm-100 text-ink-muted border-warm-200">
          <span>{prefix}Low</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size={size}>
          <span>{prefix}{priority}</span>
        </Badge>
      );
  }
};
