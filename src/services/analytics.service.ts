import { AnalyticsSummary, CampusHealthScore, Issue } from '@/types';
import { getSupabaseClient, isMockModeEnabled, toBackendError } from '@/lib/supabase';

export const AnalyticsService = {
  /**
   * Server-side admin stats (auth-scoped via admin_stats RPC):
   * DEPARTMENT_ADMIN -> own department, SUPER_ADMIN -> whole college.
   * Returns null for students/staff (FORBIDDEN by the RPC) — callers treat it
   * as "no server stats available", the client summary stays authoritative.
   */
  async getAdminStats(): Promise<{
    scope: 'COLLEGE' | 'DEPARTMENT';
    by_status: Record<string, number>;
    by_category: Record<string, number>;
    avg_resolution_minutes: number | null;
  } | null> {
    if (isMockModeEnabled()) return null;
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) {
        // Students/staff get FORBIDDEN — expected, not an error state.
        const be = toBackendError(error);
        if (be.code === 'FORBIDDEN') return null;
        throw be;
      }
      return (data as any) ?? null;
    } catch (err) {
      console.warn('admin_stats unavailable:', err);
      return null;
    }
  },

  calculateSummary(issues: Issue[]): AnalyticsSummary {
    const totalIssues = issues.length;
    const openIssues = issues.filter(
      (i) => i.status === 'OPEN' || i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS'
    ).length;
    const criticalIssues = issues.filter(
      (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
    ).length;
    const inProgressIssues = issues.filter(
      (i) => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED'
    ).length;
    const resolvedIssues = issues.filter(
      (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
    ).length;

    const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;

    // Real average resolution time in hours computed strictly from database timestamps
    const resolvedWithDates = issues.filter((i) => i.resolvedAt && i.createdAt);
    let avgHours = 0;
    if (resolvedWithDates.length > 0) {
      const totalDurations = resolvedWithDates.reduce((acc, curr) => {
        const diffMs = new Date(curr.resolvedAt!).getTime() - new Date(curr.createdAt).getTime();
        return acc + Math.max(0, diffMs / (1000 * 3600));
      }, 0);
      avgHours = Number((totalDurations / resolvedWithDates.length).toFixed(1));
    }

    // Dynamic Campus Health calculation based strictly on real counts
    const campusHealth = this.calculateHealthScore(totalIssues, openIssues, criticalIssues, resolutionRate);

    // Issues by category (grounded in real records)
    const categoryCounts: Record<string, number> = {};
    const categoryColors: Record<string, string> = {
      INFRASTRUCTURE: '#7A1F2B',
      ACADEMICS: '#D4A72C',
      HOSTEL: '#C05621',
      CLEANLINESS: '#15803D',
      SAFETY: '#B91C1C',
      OTHER: '#6B6870',
    };

    issues.forEach((iss) => {
      const cat = iss.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const issuesByCategory = Object.entries(categoryCounts).map(([cat, count]) => ({
      category: cat.replace('_', ' '),
      count,
      color: categoryColors[cat] || '#7A1F2B',
    }));

    // Issues by department (grounded in real records)
    const deptMap: Record<string, { open: number; resolved: number; totalHours: number; resolvedCount: number }> = {};
    issues.forEach((iss) => {
      const d = iss.department || 'Unassigned';
      if (!deptMap[d]) deptMap[d] = { open: 0, resolved: 0, totalHours: 0, resolvedCount: 0 };
      if (iss.status === 'RESOLVED' || iss.status === 'CLOSED') {
        deptMap[d].resolved++;
        if (iss.resolvedAt && iss.createdAt) {
          const diffHours = Math.max(0, (new Date(iss.resolvedAt).getTime() - new Date(iss.createdAt).getTime()) / (1000 * 3600));
          deptMap[d].totalHours += diffHours;
          deptMap[d].resolvedCount++;
        }
      } else {
        deptMap[d].open++;
      }
    });

    const issuesByDepartment = Object.entries(deptMap).map(([department, data]) => ({
      department: department.length > 22 ? department.slice(0, 20) + '…' : department,
      open: data.open,
      resolved: data.resolved,
      avgHours: data.resolvedCount > 0 ? Number((data.totalHours / data.resolvedCount).toFixed(1)) : 0,
    }));

    // Issues by building (grounded in real records)
    const buildingMap: Record<string, { count: number; critical: number }> = {};
    issues.forEach((iss) => {
      const b = (iss.location?.building || 'Main Campus').split('(')[0].trim();
      if (!buildingMap[b]) buildingMap[b] = { count: 0, critical: 0 };
      buildingMap[b].count++;
      if (iss.priority === 'URGENT' && iss.status !== 'RESOLVED' && iss.status !== 'CLOSED') {
        buildingMap[b].critical++;
      }
    });

    const issuesByBuilding = Object.entries(buildingMap).map(([building, data]) => ({
      building: building.length > 18 ? building.slice(0, 16) + '…' : building,
      count: data.count,
      critical: data.critical,
    }));

    // Real daily distribution (past 7 days) computed from actual creation and resolution dates
    const days: { date: string; reported: number; resolved: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - i);
      const targetDateStr = targetDate.toISOString().slice(0, 10);
      const displayStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const reportedOnDay = issues.filter((iss) => iss.createdAt && iss.createdAt.startsWith(targetDateStr)).length;
      const resolvedOnDay = issues.filter((iss) => iss.resolvedAt && iss.resolvedAt.startsWith(targetDateStr)).length;

      days.push({
        date: displayStr,
        reported: reportedOnDay,
        resolved: resolvedOnDay,
      });
    }

    // Real resolution time distribution brackets
    let under2 = 0;
    let twoToSix = 0;
    let sixToTwentyFour = 0;
    let oneToThreeDays = 0;
    let overThreeDays = 0;

    resolvedWithDates.forEach((iss) => {
      const diffHours = (new Date(iss.resolvedAt!).getTime() - new Date(iss.createdAt).getTime()) / (1000 * 3600);
      if (diffHours < 2) under2++;
      else if (diffHours < 6) twoToSix++;
      else if (diffHours < 24) sixToTwentyFour++;
      else if (diffHours < 72) oneToThreeDays++;
      else overThreeDays++;
    });

    const resolutionTimeDistribution = [
      { bracket: '< 2 hrs', count: under2 },
      { bracket: '2 - 6 hrs', count: twoToSix },
      { bracket: '6 - 24 hrs', count: sixToTwentyFour },
      { bracket: '1 - 3 days', count: oneToThreeDays },
      { bracket: '> 3 days', count: overThreeDays },
    ];

    return {
      totalIssues,
      openIssues,
      criticalIssues,
      inProgressIssues,
      resolvedIssues,
      resolutionRate,
      averageResolutionHours: avgHours,
      campusHealth,
      issuesByDay: days,
      issuesByCategory,
      issuesByDepartment,
      issuesByBuilding,
      resolutionTimeDistribution,
    };
  },

  calculateHealthScore(
    totalCount: number,
    openCount: number,
    criticalCount: number,
    resolutionRate: number
  ): CampusHealthScore {
    if (totalCount === 0) {
      return {
        overall: 100,
        resolutionPerformance: 100,
        openIssueLoad: 100,
        criticalSeverityIndex: 100,
        recurringFaultIndex: 100,
        statusLabel: 'OPTIMAL',
        trailingDays: 14,
        disclaimer: 'No incidents currently recorded on campus.',
      };
    }

    // Component 1: Resolution Velocity (0-100)
    const resolutionPerformance = resolutionRate;

    // Component 2: Open Issue Load (penalized by open issues)
    const openIssueLoad = Math.max(0, Math.round(100 - openCount * 5));

    // Component 3: Critical Issue Index (penalized heavily by critical faults)
    const criticalSeverityIndex = Math.max(0, Math.round(100 - criticalCount * 25));

    // Component 4: Recurring Fault Index based on load
    const recurringFaultIndex = Math.max(20, Math.round(100 - openCount * 3));

    const overall = Math.round(
      resolutionPerformance * 0.4 +
      openIssueLoad * 0.25 +
      criticalSeverityIndex * 0.25 +
      recurringFaultIndex * 0.1
    );

    let statusLabel: 'OPTIMAL' | 'STABLE' | 'ATTENTION_NEEDED' | 'CRITICAL' = 'STABLE';
    if (overall >= 85) statusLabel = 'OPTIMAL';
    else if (overall >= 70) statusLabel = 'STABLE';
    else if (overall >= 50) statusLabel = 'ATTENTION_NEEDED';
    else statusLabel = 'CRITICAL';

    return {
      overall,
      resolutionPerformance,
      openIssueLoad,
      criticalSeverityIndex,
      recurringFaultIndex,
      statusLabel,
      trailingDays: 14,
      disclaimer: 'Computed strictly from live database incident records and resolution velocity.',
    };
  },
};

