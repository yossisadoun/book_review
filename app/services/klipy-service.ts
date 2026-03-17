const API_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY || '';
const BASE_URL = `https://api.klipy.com/api/v1/${API_KEY}`;

export interface KlipyGif {
  slug: string;
  title: string;
  type: 'gif' | 'ad';
  preview_url: string;  // small thumbnail for grid
  full_url: string;     // full-size for sending
  width: number;
  height: number;
}

function parseGifItem(item: any): KlipyGif | null {
  if (item.type === 'ad') return null;

  const file = item.file || {};
  // Klipy uses: file.xs, file.sm, file.md, file.hd — each with gif/webp/mp4 sub-objects
  const preview = file.sm?.gif?.url || file.xs?.gif?.url || file.md?.gif?.url || '';
  const full = file.md?.gif?.url || file.hd?.gif?.url || file.sm?.gif?.url || '';
  const width = file.md?.gif?.width || file.sm?.gif?.width || 200;
  const height = file.md?.gif?.height || file.sm?.gif?.height || 200;

  if (!preview && !full) return null;

  return {
    slug: item.slug || String(item.id) || '',
    title: item.title || '',
    type: 'gif',
    preview_url: preview,
    full_url: full,
    width: Number(width),
    height: Number(height),
  };
}

export async function searchGifs(query: string, page = 1): Promise<KlipyGif[]> {
  if (!API_KEY) {
    console.warn('[klipy] No API key configured');
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/gifs/search?q=${encodeURIComponent(query)}&per_page=24&page=${page}&rating=pg-13`
    );
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.data?.data || json?.data || [];
    return items.map(parseGifItem).filter(Boolean) as KlipyGif[];
  } catch (err) {
    console.error('[klipy] Search error:', err);
    return [];
  }
}

export async function getTrendingGifs(page = 1): Promise<KlipyGif[]> {
  if (!API_KEY) {
    console.warn('[klipy] No API key configured');
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/gifs/trending?per_page=24&page=${page}&rating=pg-13`
    );
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.data?.data || json?.data || [];
    return items.map(parseGifItem).filter(Boolean) as KlipyGif[];
  } catch (err) {
    console.error('[klipy] Trending error:', err);
    return [];
  }
}
