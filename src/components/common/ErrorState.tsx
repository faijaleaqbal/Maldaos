import React from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  actionLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Operational Data Unreachable',
  message = 'Something went wrong while loading this data from the campus telemetry layer. You can retry or continue manually.',
  onRetry,
  actionLabel = 'Retry Request',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-rose-200 bg-rose-50/50 my-4">
      <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 mb-3">
        <AlertTriangle className="w-5 h-5 stroke-[2]" />
      </div>
      <h3 className="font-serif font-semibold text-base text-ink mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-ink-muted max-w-md mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
