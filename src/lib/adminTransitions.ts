import type { IssueStatus, UserRole } from '@/types';

/**
 * Returns whether a role may initiate an assignment. Department membership of
 * a department admin is checked by `getAvailableTransitions`, where the issue
 * and target-department context is available.
 */
export function canUserAssign(userRole: UserRole): boolean {
  return userRole === 'DEPARTMENT_ADMIN' || userRole === 'SUPER_ADMIN';
}

/**
 * Staff and department admins may resolve only issues in their assigned
 * department. Super admins may resolve any issue.
 */
export function canUserResolve(
  userRole: UserRole,
  isDeptStaffOrAdmin: boolean
): boolean {
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  return (
    isDeptStaffOrAdmin &&
    (userRole === 'STAFF' || userRole === 'DEPARTMENT_ADMIN')
  );
}

/** Only super admins may close a resolved issue. */
export function canUserClose(userRole: UserRole): boolean {
  return userRole === 'SUPER_ADMIN';
}

/**
 * Determines whether a user may reopen a resolved issue. Student reporters
 * may do so only during the seven-day resolution window; assigned-department
 * staff/admins and super admins are not subject to that window.
 *
 * `getAvailableTransitions` applies the extra CLOSED -> OPEN restriction,
 * which permits only super admins.
 */
export function canUserReopen(
  userRole: UserRole,
  isReporter: boolean,
  isResolvedRecently: boolean,
  isDeptStaffOrAdmin: boolean
): boolean {
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  if (
    isDeptStaffOrAdmin &&
    (userRole === 'STAFF' || userRole === 'DEPARTMENT_ADMIN')
  ) {
    return true;
  }

  return userRole === 'STUDENT' && isReporter && isResolvedRecently;
}

/** A resolution reason is required only when resolving an in-progress issue. */
export function isResolutionReasonRequired(
  fromStatus: IssueStatus,
  toStatus: IssueStatus
): boolean {
  return fromStatus === 'IN_PROGRESS' && toStatus === 'RESOLVED';
}

/**
 * Computes the legal next statuses that the current user may perform.
 *
 * This is a UI helper only. `assign_issue` and `transition_issue_status`
 * enforce the same policy server-side and remain the source of truth.
 */
export function getAvailableTransitions(
  currentStatus: IssueStatus,
  userRole: UserRole,
  isDeptStaffOrAdmin: boolean,
  isReporter: boolean,
  isResolvedRecently: boolean
): IssueStatus[] {
  switch (currentStatus) {
    case 'OPEN':
      // A department admin must belong to the selected target department.
      return canUserAssign(userRole) &&
        (userRole === 'SUPER_ADMIN' || isDeptStaffOrAdmin)
        ? ['ASSIGNED']
        : [];

    case 'ASSIGNED':
      return canUserResolve(userRole, isDeptStaffOrAdmin)
        ? ['IN_PROGRESS']
        : [];

    case 'IN_PROGRESS':
      return canUserResolve(userRole, isDeptStaffOrAdmin) ? ['RESOLVED'] : [];

    case 'RESOLVED': {
      const transitions: IssueStatus[] = [];

      if (canUserClose(userRole)) {
        transitions.push('CLOSED');
      }
      if (
        canUserReopen(
          userRole,
          isReporter,
          isResolvedRecently,
          isDeptStaffOrAdmin
        )
      ) {
        transitions.push('OPEN');
      }

      return transitions;
    }

    case 'CLOSED':
      return canUserClose(userRole) ? ['OPEN'] : [];
  }
}
