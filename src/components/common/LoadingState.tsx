import React from 'react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  fullPage?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading campus operations telemetry...',
  subtext = 'Connecting to Malda College infrastructure nodes',
  fullPage = false,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-warm-300 border-t-maroon-700 animate-spin" />
        <div className="absolute w-6 h-6 rounded-full bg-gold-400/20" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink tracking-tight">{message}</p>
        {subtext && <p className="text-xs text-ink-muted">{subtext}</p>}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center w-full">
        {content}
      </div>
    );
  }

  return content;
};
