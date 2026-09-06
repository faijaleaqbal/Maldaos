'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Smartphone, ArrowLeft, ExternalLink } from 'lucide-react';
import {
  parseInboundAppParams,
  type InboundAppParams,
} from '@/lib/college-app-integration';

export interface CollegeAppBannerProps {
  /** Pre-parsed inbound params. When omitted, the banner reads the current URL. */
  params?: InboundAppParams;
  className?: string;
}

const BannerView: React.FC<{ params: InboundAppParams; className?: string }> = ({
  params,
  className,
}) => {
  if (!params.isFromCollegeApp) return null;

  const returnLabel = params.returnLabel || 'Return to College App';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="college-app-banner"
      className={`rounded-lg border border-maroon-200 bg-maroon-50 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shadow-subtle ${className ?? ''}`}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded bg-maroon-700 text-gold-300 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-maroon-950 leading-tight">
            Connected from Malda College Student App
          </p>
          <p className="text-xs text-maroon-900/80 mt-0.5">
            {params.studentId ? (
              <>
                Signed in as <span className="font-mono font-semibold">{params.studentId}</span>.{' '}
              </>
            ) : null}
            Campus issues you lodge here are handled by MaldaOS; your academic records stay on the college ERP.
          </p>
        </div>
      </div>

      {params.returnUrl && (
        <a
          href={params.returnUrl}
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 shrink-0 text-xs font-semibold text-white bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 border border-maroon-800 rounded-md px-3 py-2 min-h-[44px] sm:min-h-[36px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:ring-offset-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{returnLabel}</span>
          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

const BannerFromUrl: React.FC<{ className?: string }> = ({ className }) => {
  const searchParams = useSearchParams();
  const params = React.useMemo(
    () => parseInboundAppParams(searchParams ?? new URLSearchParams()),
    [searchParams]
  );
  return <BannerView params={params} className={className} />;
};

/**
 * Shown only when the visitor arrived from the Malda College Student App
 * (`?source=college_app`). Offers a safe, sanitized return link when the app
 * supplied a `return_url`.
 *
 * `useSearchParams` is wrapped in Suspense so this component is safe to render
 * inside statically-rendered client pages.
 */
export const CollegeAppBanner: React.FC<CollegeAppBannerProps> = ({ params, className }) => {
  if (params) return <BannerView params={params} className={className} />;
  return (
    <Suspense fallback={null}>
      <BannerFromUrl className={className} />
    </Suspense>
  );
};
