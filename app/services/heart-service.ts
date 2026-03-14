import { supabase } from '@/lib/supabase';

// Browser-compatible djb2 hash
function hashContent(type: string, content: any): string {
  const str = JSON.stringify({ type, content });
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return 'h_' + (hash >>> 0).toString(16);
}

// Generate a content hash for any content item
export function getContentHash(type: string, identifier: string): string {
  return hashContent(type, identifier);
}

// Toggle heart on/off. Returns new hearted state.
export async function toggleHeart(userId: string, contentHash: string): Promise<boolean> {
  // Check if already hearted
  const { data: existing } = await supabase
    .from('content_hearts')
    .select('id')
    .eq('user_id', userId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (existing) {
    await supabase.from('content_hearts').delete().eq('id', existing.id);
    return false;
  } else {
    await supabase.from('content_hearts').insert({ user_id: userId, content_hash: contentHash });
    return true;
  }
}

// Batch load heart counts and user's hearted state for multiple content hashes
export async function loadHearts(
  userId: string | null,
  contentHashes: string[]
): Promise<{ counts: Map<string, number>; userHearted: Set<string> }> {
  if (contentHashes.length === 0) return { counts: new Map(), userHearted: new Set() };

  const unique = [...new Set(contentHashes)];

  // Fetch all hearts for these hashes in one query
  const { data: allHearts } = await supabase
    .from('content_hearts')
    .select('content_hash, user_id')
    .in('content_hash', unique);

  const counts = new Map<string, number>();
  const userHearted = new Set<string>();

  if (allHearts) {
    for (const h of allHearts) {
      counts.set(h.content_hash, (counts.get(h.content_hash) || 0) + 1);
      if (userId && h.user_id === userId) {
        userHearted.add(h.content_hash);
      }
    }
  }

  return { counts, userHearted };
}
