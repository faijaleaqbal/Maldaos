import { AIAnalysis, Issue, IssueCategory, IssuePriority } from '@/types';

export const AIService = {
  /**
   * Analyze an issue description and images to suggest category, priority, and check duplicates.
   * Never throws uncaught errors; always returns fallback if AI gateway is unreachable or disabled.
   */
  async analyzeIssue(
    title: string,
    description: string,
    building: string,
    existingIssues: Issue[] = []
  ): Promise<AIAnalysis> {
    try {
      // If client environment allows calling server API route:
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, building }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        return data as AIAnalysis;
      }
    } catch (e) {
      // continue to local intelligent triage engine
    }

    // Local deterministic contextual triage (guarantees 100% offline & demo reliability)
    return this.generateDeterministicTriage(title, description, building, existingIssues);
  },

  generateDeterministicTriage(
    title: string,
    description: string,
    building: string,
    existingIssues: Issue[] = []
  ): AIAnalysis {
    const text = `${title} ${description} ${building}`.toLowerCase();

    let detectedCategory: IssueCategory = 'OTHER';
    let suggestedPriority: IssuePriority = 'MEDIUM';
    let suggestedDepartment = 'Campus Infrastructure Helpdesk';
    const urgencyFactors: string[] = [];

    // Keyword intelligence
    if (text.includes('spark') || text.includes('fire') || text.includes('arcing') || text.includes('shock') || text.includes('short circuit') || text.includes('gas') || text.includes('danger')) {
      detectedCategory = 'SAFETY';
      suggestedPriority = 'URGENT';
      suggestedDepartment = 'Campus Security & Electrical Maintenance';
      urgencyFactors.push('Immediate life safety or electrical fire risk detected');
      urgencyFactors.push('Urgent physical isolation recommended');
    } else if (text.includes('wire') || text.includes('switch') || text.includes('light') || text.includes('bulb') || text.includes('power') || text.includes('breaker') || text.includes('fan') || text.includes('leak') || text.includes('water') || text.includes('pipe') || text.includes('wall') || text.includes('roof')) {
      detectedCategory = 'INFRASTRUCTURE';
      suggestedPriority = text.includes('blackout') || text.includes('hall') || text.includes('flood') ? 'HIGH' : 'MEDIUM';
      suggestedDepartment = 'Campus Infrastructure Maintenance';
      urgencyFactors.push('Physical facility or electrical fixture degradation reported');
    } else if (text.includes('wifi') || text.includes('wi-fi') || text.includes('network') || text.includes('projector') || text.includes('bench') || text.includes('blackboard') || text.includes('desk') || text.includes('classroom') || text.includes('lecture') || text.includes('lab') || text.includes('computer')) {
      detectedCategory = 'ACADEMICS';
      suggestedPriority = text.includes('exam') || text.includes('lecture') ? 'HIGH' : 'MEDIUM';
      suggestedDepartment = 'Academic Infrastructure & IT Cell';
      urgencyFactors.push('Impacts ongoing classroom instruction or lab sessions');
    } else if (text.includes('garbage') || text.includes('waste') || text.includes('trash') || text.includes('smell') || text.includes('stink') || text.includes('clean') || text.includes('dirt') || text.includes('toilet') || text.includes('washroom') || text.includes('canteen')) {
      detectedCategory = 'CLEANLINESS';
      suggestedPriority = text.includes('canteen') ? 'HIGH' : 'MEDIUM';
      suggestedDepartment = 'Sanitation & Housekeeping';
      urgencyFactors.push('Hygiene standards in shared student facilities or dining areas');
    } else if (text.includes('stair') || text.includes('lock') || text.includes('guard') || text.includes('gate') || text.includes('theft') || text.includes('rail') || text.includes('harassment') || text.includes('threat')) {
      detectedCategory = 'SAFETY';
      suggestedPriority = 'HIGH';
      suggestedDepartment = 'Campus Security & Estate Office';
      urgencyFactors.push('Physical safety or perimeter security concern');
    } else if (text.includes('hostel') || text.includes('mess') || text.includes('room') || text.includes('bed') || text.includes('warden')) {
      detectedCategory = 'HOSTEL';
      suggestedPriority = 'MEDIUM';
      suggestedDepartment = 'Hostel Superintendent Office';
      urgencyFactors.push('Residential student accommodation welfare');
    }

    // Check for possible duplicates among existing issues
    const words = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const possibleDuplicates = existingIssues
      .filter((iss) => iss.status !== 'RESOLVED' && iss.status !== 'CLOSED')
      .map((iss) => {
        const issWords = `${iss.title} ${iss.location.building}`.toLowerCase();
        let matchCount = 0;
        words.forEach((w) => {
          if (issWords.includes(w)) matchCount++;
        });
        const score = words.length > 0 ? matchCount / words.length : 0;
        return {
          id: iss.id,
          ticketNumber: iss.ticketNumber,
          title: iss.title,
          similarityScore: Math.min(0.95, Number((score * 0.8 + (iss.location.building === building ? 0.2 : 0)).toFixed(2))),
          status: iss.status,
        };
      })
      .filter((d) => d.similarityScore >= 0.4)
      .slice(0, 3);

    const summary = `${detectedCategory.replace('_', ' ')} concern reported at ${building}. ${
      urgencyFactors[0] || 'Standard maintenance resolution pathway recommended.'
    }`;

    return {
      detectedCategory,
      suggestedSeverity: suggestedPriority,
      suggestedPriority,
      // Heuristic output carries NO confidence claim — only real provider
      // responses may report confidence. This is always a labelled fallback.
      confidence: 0,
      summary,
      suggestedDepartment,
      possibleDuplicates,
      urgencyFactors,
      gatewayProvider: 'deterministic-heuristic (rule-based, not AI)',
      analyzedAt: new Date().toISOString(),
      isFallback: true,
    };
  },

  getFallbackAnalysis(reason = 'AI analysis temporarily unavailable. You can continue processing this report manually.'): AIAnalysis {
    return {
      detectedCategory: 'OTHER',
      suggestedSeverity: 'MEDIUM',
      suggestedPriority: 'MEDIUM',
      confidence: 0,
      summary: reason,
      suggestedDepartment: 'Campus Infrastructure Helpdesk',
      possibleDuplicates: [],
      urgencyFactors: ['Manual admin review required'],
      isFallback: true,
      analyzedAt: new Date().toISOString(),
    };
  },
};
