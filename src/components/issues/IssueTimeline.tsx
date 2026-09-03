'use client';

import React from 'react';
import { IssueStatus, TimelineEvent } from '@/types';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, Cpu, UserCheck, Wrench, Check } from 'lucide-react';

interface IssueTimelineProps {
  events: TimelineEvent[];
  currentStatus: IssueStatus;
}

const STAGES: { status: IssueStatus; label: string; icon: any }[] = [
  { status: 'OPEN', label: 'Logged', icon: Clock },
  { status: 'ASSIGNED', label: 'Dispatched', icon: UserCheck },
  { status: 'IN_PROGRESS', label: 'In Progress', icon: Wrench },
  { status: 'RESOLVED', label: 'Resolved', icon: CheckCircle2 },
  { status: 'CLOSED', label: 'Closed', icon: Check },
];

const getStatusRank = (s: IssueStatus): number => {
  switch (s as string) {
    case 'OPEN':
    case 'REPORTED':
      return 1;
    case 'ASSIGNED':
      return 2;
    case 'IN_PROGRESS':
      return 3;
    case 'RESOLVED':
      return 4;
    case 'CLOSED':
      return 5;
    default:
      return 1;
  }
};

export const IssueTimeline: React.FC<IssueTimelineProps> = ({ events, currentStatus }) => {
  const currentRank = getStatusRank(currentStatus);

  return (
    <div className="space-y-6">
      {/* Horizontal Progress Bar for Large Screens */}
      <div className="hidden md:block pb-4">
        <div className="flex items-center justify-between relative">
          {/* Connecting Track Line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-warm-200 -z-0" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-maroon-700 -z-0 transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, ((currentRank - 1) / (STAGES.length - 1)) * 100))}%`,
            }}
          />

          {STAGES.map((stage, idx) => {
            const stageRank = idx + 1;
            const isCompleted = currentRank > stageRank;
            const isCurrent = currentRank === stageRank;
            const isPending = currentRank < stageRank;
            const Icon = stage.icon;

            return (
              <div key={stage.status} className="flex flex-col items-center relative z-10">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.15 : 1,
                    backgroundColor: isCompleted
                      ? '#7A1F2B'
                      : isCurrent
                      ? '#FFFFFF'
                      : '#F8F6F1',
                    borderColor: isCompleted
                      ? '#7A1F2B'
                      : isCurrent
                      ? '#7A1F2B'
                      : '#E5DFD5',
                  }}
                  transition={{ duration: 0.3 }}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    isCompleted
                      ? 'text-white'
                      : isCurrent
                      ? 'text-maroon-700 shadow-sm ring-4 ring-maroon-100'
                      : 'text-ink-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </motion.div>
                <span
                  className={`text-[11px] font-medium mt-2 max-w-[80px] text-center leading-tight ${
                    isCurrent ? 'text-maroon-800 font-semibold' : isCompleted ? 'text-ink' : 'text-ink-muted'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Chronological Event Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-warm-300">
        {events && events.length > 0 ? (
          events.map((event, idx) => {
            const isLatest = idx === events.length - 1;
            return (
              <motion.div
                key={event.id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                className="relative"
              >
                {/* Node Bullet */}
                <div
                  className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                    isLatest
                      ? 'border-maroon-700 ring-4 ring-maroon-100'
                      : 'border-warm-400 bg-warm-200'
                  }`}
                />

                <div className="bg-white rounded-lg border border-warm-200 p-3.5 shadow-subtle">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                    <h5 className="text-xs sm:text-sm font-semibold text-ink font-sans flex items-center gap-1.5">
                      {event.label}
                      {isLatest && (
                        <span className="text-[10px] bg-maroon-50 text-maroon-800 font-medium px-1.5 py-0.5 rounded border border-maroon-200">
                          Current Stage
                        </span>
                      )}
                    </h5>
                    <time className="text-[11px] text-ink-muted font-mono">
                      {new Date(event.timestamp).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>

                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed mb-2">
                    {event.description}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-ink-muted pt-1.5 border-t border-warm-100">
                    <span className="font-medium text-ink">{event.actor.name}</span>
                    <span>•</span>
                    <span>{event.actor.role}</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-xs text-ink-muted py-2">No event records logged yet.</div>
        )}
      </div>
    </div>
  );
};
