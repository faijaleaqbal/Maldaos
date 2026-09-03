export const CATEGORIES = ['INFRASTRUCTURE', 'ACADEMICS', 'HOSTEL', 'CLEANLINESS', 'SAFETY', 'OTHER'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type Status = (typeof STATUSES)[number];

/** Legal lifecycle transitions (mirrors transition_issue_status in SQL). */
export const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'], // SUPER_ADMIN only
};

export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface Validation {
  ok: boolean;
  errors: string[];
}

export function validateTitle(title: string): Validation {
  const n = (title ?? '').trim().length;
  if (n < 5 || n > 200) return { ok: false, errors: ['title must be 5-200 characters'] };
  return { ok: true, errors: [] };
}

export function validateDescription(desc: string): Validation {
  const n = (desc ?? '').trim().length;
  if (n < 10 || n > 5000) return { ok: false, errors: ['description must be 10-5000 characters'] };
  return { ok: true, errors: [] };
}

export function validateEnum<T extends string>(value: string, allowed: readonly T[]): Validation {
  if (!(allowed as readonly string[]).includes(value)) {
    return { ok: false, errors: [`must be one of: ${allowed.join(', ')}`] };
  }
  return { ok: true, errors: [] };
}

export function validateImage(ext: string, sizeBytes: number, mimeType: string): Validation {
  const errors: string[] = [];
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) errors.push(`extension must be one of: ${ALLOWED_EXTENSIONS.join(', ')}`);
  if (!Object.values(MIME_BY_EXT).includes(mimeType)) errors.push('content type must be image/jpeg, image/png or image/webp');
  if (sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) errors.push('file size must be 1 byte - 5 MB');
  return { ok: errors.length === 0, errors };
}

export function validateIssueInput(input: {
  title: string;
  description: string;
  category: string;
  priority?: string;
}): Validation {
  const errors: string[] = [];
  const t = validateTitle(input.title);
  if (!t.ok) errors.push(...t.errors);
  const d = validateDescription(input.description);
  if (!d.ok) errors.push(...d.errors);
  const c = validateEnum(input.category, CATEGORIES);
  if (!c.ok) errors.push(`category ${c.errors[0]}`);
  if (input.priority) {
    const p = validateEnum(input.priority, PRIORITIES);
    if (!p.ok) errors.push(`priority ${p.errors[0]}`);
  }
  return { ok: errors.length === 0, errors };
}
