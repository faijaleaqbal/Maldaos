'use client';

import React, { useEffect, useState } from 'react';
import { AnalyticsSummary } from '@/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface AnalyticsChartsProps {
  summary: AnalyticsSummary;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ summary }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-ink-muted">
        Initializing institutional charting engines...
      </div>
    );
  }

  const customTooltipStyle = {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5DFD5',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(84, 19, 29, 0.08)',
    fontSize: '12px',
    color: '#171717',
    fontFamily: 'inherit',
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Issues Over Time & Open vs Resolved */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Daily Velocity Trend */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Issues Velocity (Trailing 7 Days)</CardTitle>
                <CardDescription>Daily intake vs resolved closure trend across Malda College campus</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-maroon-700" />
                  <span className="text-ink-muted">Reported</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span className="text-ink-muted">Resolved</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.issuesByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
                  <XAxis dataKey="date" stroke="#6B6870" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B6870" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="reported"
                    name="Reported"
                    stroke="#7A1F2B"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#7A1F2B' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#15803D"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#15803D' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Category Distribution */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>Volume segmented by functional equipment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.issuesByCategory}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {summary.issuesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    iconSize={8}
                    formatter={(val) => <span className="text-[11px] text-ink">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Department Workload & Location Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 3: Department Workload & Backlog */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Department Load & Resolution</CardTitle>
            <CardDescription>Open backlog vs closed work orders per facility department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.issuesByDepartment} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
                  <XAxis dataKey="department" stroke="#6B6870" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#6B6870" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="open" name="Active Open" fill="#D4A72C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#7A1F2B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 4: Location Concentration / Building Load */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Building Issue Concentration</CardTitle>
            <CardDescription>Density of incident reports by Malda College facility block</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={summary.issuesByBuilding}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" horizontal={false} />
                  <XAxis type="number" stroke="#6B6870" fontSize={11} />
                  <YAxis type="category" dataKey="building" stroke="#6B6870" fontSize={10} tickLine={false} width={85} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="count" name="Total Tickets" fill="#54131D" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Resolution Time Distribution (MTTR) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Mean Time to Resolution (MTTR) Distribution</CardTitle>
              <CardDescription>Operational turnaround breakdown for resolved college maintenance requests</CardDescription>
            </div>
            <div className="font-mono text-xs bg-warm-100 px-3 py-1 rounded border border-warm-200">
              Average MTTR: <strong className="text-maroon-900">{summary.averageResolutionHours} Hours</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.resolutionTimeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
                <XAxis dataKey="bracket" stroke="#6B6870" fontSize={11} />
                <YAxis stroke="#6B6870" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="count" name="Tickets Completed" fill="#8C253B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
