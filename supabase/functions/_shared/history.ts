import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const HISTORY_IMAGE_BUCKET = 'history-images';
const STORAGE_REF_PREFIX = `storage://${HISTORY_IMAGE_BUCKET}/`;

function guessFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase();
  if (fromName) return fromName;

  switch (file.type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

export function isHistoryStorageRef(value: string) {
  return value.startsWith(STORAGE_REF_PREFIX);
}

function parseHistoryStorageRef(value: string) {
  if (!isHistoryStorageRef(value)) return null;
  return {
    bucket: HISTORY_IMAGE_BUCKET,
    path: value.slice(STORAGE_REF_PREFIX.length),
  };
}

export async function persistHistoryImageFiles(
  supabase: SupabaseClient,
  authUserId: string,
  files: File[],
) {
  const refs: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const extension = guessFileExtension(file);
    const path = `${authUserId}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from(HISTORY_IMAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '31536000',
    });

    if (error) {
      console.warn(`[history] Failed to upload image "${file.name}": ${error.message}`);
      continue;
    }

    refs.push(`${STORAGE_REF_PREFIX}${path}`);
  }

  return refs;
}

export async function resolveHistoryImageUrls(
  supabase: SupabaseClient,
  imageUrls: string[] | null | undefined,
) {
  const urls = imageUrls ?? [];
  const resolved = await Promise.all(
    urls.map(async (value) => {
      const storageRef = parseHistoryStorageRef(value);
      if (!storageRef) return value;

      const { data, error } = await supabase.storage
        .from(storageRef.bucket)
        .createSignedUrl(storageRef.path, 60 * 60 * 24 * 30);

      if (error || !data?.signedUrl) {
        console.warn(`[history] Failed to sign image URL "${storageRef.path}": ${error?.message ?? 'unknown error'}`);
        return null;
      }

      return data.signedUrl;
    }),
  );

  return resolved.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export async function saveHistoryEntry(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    question: string;
    answer: string;
    explanation?: string;
    source?: string;
    conversationId?: string;
    styleMode?: string;
    image_urls?: string[];
    is_bulk?: boolean;
    steps?: string[];
  },
): Promise<{ saved: boolean; id: string | null }> {
  const { authUserId, question, answer, source = 'extension' } = params;

  const { data, error } = await supabase
    .from('history_entries')
    .insert({
      user_id: authUserId,
      question,
      answer,
      explanation: params.explanation,
      source,
      conversation_id: params.conversationId,
      style_mode: params.styleMode,
      image_urls: params.image_urls || [],
      is_bulk: params.is_bulk || false,
      steps: params.steps ?? [],
      created_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    return { saved: false, id: null };
  }

  return { saved: true, id: data?.id ?? null };
}
