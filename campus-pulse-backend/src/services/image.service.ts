import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';
import { validateImage, MIME_BY_EXT } from '../lib/validation.js';

export interface ImageMetadata {
  id: string;
  issue_id: string;
  uploaded_by: string;
  kind: 'EVIDENCE' | 'RESOLUTION_PROOF';
  storage_path: string;
  file_size_bytes: number;
  content_type: string;
  created_at: string;
}

/**
 * Build the canonical storage path for an upload.
 * Convention: {issue_id}/{uploader_id}/{name}.{ext}
 */
export function buildPath(issueId: string, uploaderId: string, fileName: string): string {
  return `${issueId}/${uploaderId}/${fileName}`;
}

/** Upload bytes to a private bucket, then register validated metadata. */
export async function uploadIssueImage(
  client: SupabaseClient,
  bucket: 'issue-photos' | 'resolution-proofs',
  issueId: string,
  uploaderId: string,
  fileName: string,
  fileBody: ArrayBuffer | Blob | Uint8Array,
  sizeBytes: number
) {
  const ext = fileName.split('.').pop()!.toLowerCase();
  const mime = MIME_BY_EXT[ext];
  const v = validateImage(ext, sizeBytes, mime);
  if (!v.ok) throw { error: { code: 'INVALID_FILE', message: v.errors.join('; ') } };

  const path = buildPath(issueId, uploaderId, fileName);
  const { error: upErr } = await client.storage.from(bucket).upload(path, fileBody, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) throw mapDbError(upErr);

  const kind = bucket === 'resolution-proofs' ? 'RESOLUTION_PROOF' : 'EVIDENCE';
  return registerImageMetadata(client, issueId, kind, path, sizeBytes, mime);
}

/** Register image metadata via guarded RPC (validates ext/mime/size/path ownership). */
export async function registerImageMetadata(
  client: SupabaseClient,
  issueId: string,
  kind: 'EVIDENCE' | 'RESOLUTION_PROOF',
  storagePath: string,
  sizeBytes: number,
  contentType: string
) {
  const { data, error } = await client.rpc('register_issue_image', {
    p_issue_id: issueId,
    p_kind: kind,
    p_storage_path: storagePath,
    p_file_size_bytes: sizeBytes,
    p_content_type: contentType,
  });
  if (error) throw mapDbError(error);
  return data as ImageMetadata;
}

/** Create a signed URL for a private object (RLS still gates metadata). */
export async function createSignedUrl(
  client: SupabaseClient,
  bucket: 'issue-photos' | 'resolution-proofs',
  storagePath: string,
  expiresIn = 300
) {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
  if (error) throw mapDbError(error);
  return data!.signedUrl;
}

/** List image metadata for an issue (RLS gates rows; proof rows need staff+). */
export async function listIssueImages(client: SupabaseClient, issueId: string) {
  const { data, error } = await client
    .from('issue_images')
    .select('id, issue_id, uploaded_by, kind, storage_path, file_size_bytes, content_type, created_at')
    .eq('issue_id', issueId);
  if (error) throw mapDbError(error);
  return data as ImageMetadata[];
}
