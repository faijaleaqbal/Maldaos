import React from 'react';
import { IssueStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Clock, Cpu, UserCheck, Wrench, CheckCircle2, Archive, Check } from 'lucide-react';

interface IssueStatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md';
}

export const IssueStatusBadge: React.FC<IssueStatusBadgeProps> = ({ status, size = 'sm' }) => {
  switch (status as string) {
    case 'OPEN':
    case 'REPORTED':
      return (
        <Badge variant="warning" size={size}>
          <Clock className="w-3 h-3" />
          <span>Open</span>
        </Badge>
      );
    case 'AI_ANALYZED':
      return (
        <Badge variant="ai" size={size}>
          <Cpu className="w-3 h-3 text-ai-600" />
          <span>AI Analyzed</span>
        </Badge>
      );
    case 'ASSIGNED':
      return (
        <Badge variant="default" size={size} className="bg-sky-50 text-sky-800 border-sky-200">
          <UserCheck className="w-3 h-3 text-sky-600" />
          <span>Assigned</span>
        </Badge>
      );
    case 'IN_PROGRESS':
      return (
        <Badge variant="maroon" size={size}>
          <Wrench className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
          <span>In Progress</span>
        </Badge>
      );
    case 'RESOLUTION_SUBMITTED':
      return (
        <Badge variant="gold" size={size}>
          <Check className="w-3 h-3 text-gold-800" />
          <span>Resolution Submitted</span>
        </Badge>
      );
    case 'RESOLVED':
      return (
        <Badge variant="success" size={size}>
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Resolved</span>
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge variant="muted" size={size}>
          <Archive className="w-3 h-3" />
          <span>Closed</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size={size}>
          <span>{status}</span>
        </Badge>
      );
  }
};
