'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, MapPin, Phone, Mail, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-warm-200 border-t border-warm-300 text-ink-muted text-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Malda College Provenance */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-maroon-800 text-gold-400 font-serif font-bold text-sm flex items-center justify-center shrink-0">
                MC
              </div>
              <div>
                <span className="font-serif font-bold text-sm text-ink block leading-tight">
                  Malda College
                </span>
                <span className="text-[11px] text-ink-muted">
                  Estd. 1944 • Affiliated to University of Gour Banga
                </span>
              </div>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed max-w-sm">
              MaldaOS is the official institutional facility incident management and campus operations platform, overseen by the Internal Quality Assurance Cell (IQAC) to ensure swift resolution of campus infrastructure requisitions.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-maroon-800 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-maroon-700" />
              <span>NAAC Accredited Grade &lsquo;A&rsquo; Institution</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              Operations & Portals
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/issues" className="hover:text-maroon-800 transition-colors">
                  Campus Work Order Ledger
                </Link>
              </li>
              <li>
                <Link href="/report" className="hover:text-maroon-800 transition-colors">
                  Lodge Incident Requisition
                </Link>
              </li>
              <li>
                <Link href="/map" className="hover:text-maroon-800 transition-colors">
                  Campus Infrastructure Map
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-maroon-800 transition-colors">
                  Student & Faculty Desk
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-maroon-800 transition-colors">
                  Duty Officer Command Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Campus Coordinates & Contacts */}
          <div className="md:col-span-4 space-y-2.5">
            <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              Campus Administration
            </h4>
            <div className="space-y-1.5 text-xs text-ink-muted">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-maroon-700 shrink-0 mt-0.5" />
                <span>Rabindra Avenue, Malda, West Bengal — 732101, India</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
                <span>EPABX: (03512) 220807 • Maintenance Desk Ext. 104</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
                <span>facilities@maldacollege.ac.in</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal / Institutional Bar */}
        <div className="mt-8 pt-4 border-t border-warm-300/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-muted">
          <div>
            &copy; {new Date().getFullYear()} Malda College. All rights reserved. Campus Infrastructure & Facilities Division.
          </div>
          <div className="flex items-center gap-3">
            <span>MaldaOS v2.4 (Enterprise Collegiate Build)</span>
            <span>•</span>
            <Link href="https://maldacollege.ac.in" target="_blank" rel="noopener noreferrer" className="hover:text-maroon-800 inline-flex items-center gap-1">
              <span>College Portal</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
