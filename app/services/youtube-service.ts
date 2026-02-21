import { supabase } from '@/lib/supabase';
import type { YouTubeVideo } from '../types';
import { youtubeApiKey } from './api-utils';
import { decodeHtmlEntities } from '../components/utils';

// --- YouTube Data API ---
export async function getYouTubeVideos(bookTitle: string, author: string): Promise<YouTubeVideo[]> {
  console.log(`[getYouTubeVideos] 🔄 Searching YouTube for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('youtube_videos')
      .select('videos')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.videos && Array.isArray(cachedData.videos)) {
      if (cachedData.videos.length > 0) {
        console.log(`[getYouTubeVideos] ✅ Found ${cachedData.videos.length} cached videos in database`);
        return (cachedData.videos as YouTubeVideo[]).map(v => ({
          ...v,
          title: decodeHtmlEntities(v.title),
          description: decodeHtmlEntities(v.description || ''),
          channelTitle: decodeHtmlEntities(v.channelTitle),
        }));
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getYouTubeVideos] ✅ Found cached "no results" - skipping YouTube API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getYouTubeVideos] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getYouTubeVideos] ⚠️ Error checking cache:', err);
    // Continue to fetch
  }

  if (!youtubeApiKey || youtubeApiKey.trim() === '') {
    console.warn('[getYouTubeVideos] ⚠️ YouTube API key not found or empty');
    console.warn('[getYouTubeVideos] Key length:', youtubeApiKey?.length || 0);
    console.warn('[getYouTubeVideos] ⚠️ Please check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets');
    return [];
  }

  // Validate API key format (YouTube API keys typically start with specific patterns)
  if (youtubeApiKey.length < 20) {
    console.warn('[getYouTubeVideos] ⚠️ YouTube API key appears to be invalid (too short)');
    console.warn('[getYouTubeVideos] ⚠️ Please verify NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets is correct');
    return [];
  }

  try {
    const videos: YouTubeVideo[] = [];

    // Query 1: Book title + author
    const query1 = `${bookTitle} ${author}`;
    const url1 = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query1)}&type=video&maxResults=5&key=${youtubeApiKey}`;

    console.log(`[getYouTubeVideos] 🔍 Query 1: "${query1}"`);
    const response1 = await fetch(url1);
    if (response1.ok) {
      const data1 = await response1.json();
      if (data1.items) {
        data1.items.forEach((item: any) => {
          videos.push({
            id: item.id.videoId,
            videoId: item.id.videoId,
            title: decodeHtmlEntities(item.snippet.title),
            description: decodeHtmlEntities(item.snippet.description || ''),
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
            channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
            publishedAt: item.snippet.publishedAt,
          });
        });
      }
    } else {
      let errorData: any = {};
      try {
        const text = await response1.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // If JSON parsing fails, log the raw text
        console.error('[getYouTubeVideos] ❌ Query 1 error response (raw):', await response1.text().catch(() => 'Could not read response'));
      }

      console.error(`[getYouTubeVideos] ❌ Query 1 failed: ${response1.status} ${response1.statusText}`);
      console.error('[getYouTubeVideos] Error details:', {
        status: response1.status,
        statusText: response1.statusText,
        error: errorData.error || errorData,
        message: errorData.error?.message || errorData.message || 'No error message',
        reason: errorData.error?.errors?.[0]?.reason || errorData.reason || 'Unknown reason',
        domain: errorData.error?.errors?.[0]?.domain || errorData.domain,
        fullError: errorData
      });

      // Provide helpful guidance based on error
      if (response1.status === 403) {
        const reason = errorData.error?.errors?.[0]?.reason || errorData.reason || '';
        if (reason === 'quotaExceeded') {
          console.error('[getYouTubeVideos] ⚠️ YouTube API quota exceeded. Please check your quota in Google Cloud Console.');
        } else if (reason === 'accessNotConfigured') {
          console.error('[getYouTubeVideos] ⚠️ YouTube Data API v3 is not enabled. Enable it in Google Cloud Console.');
        } else if (reason === 'ipRefererBlocked') {
          console.error('[getYouTubeVideos] ⚠️ API key restrictions are blocking this request. Check IP/referrer restrictions in Google Cloud Console.');
        } else {
          console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 Forbidden. Possible causes:');
          console.error('[getYouTubeVideos]   1. Invalid API key');
          console.error('[getYouTubeVideos]   2. API key restrictions (IP/referrer)');
          console.error('[getYouTubeVideos]   3. YouTube Data API v3 not enabled');
          console.error('[getYouTubeVideos]   4. Quota exceeded');
          console.error('[getYouTubeVideos]   Check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets and Google Cloud Console settings.');
        }
      }
    }

    // Query 2: Author + "interview"
    const query2 = `${author} interview`;
    const url2 = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query2)}&type=video&maxResults=5&key=${youtubeApiKey}`;

    console.log(`[getYouTubeVideos] 🔍 Query 2: "${query2}"`);
    const response2 = await fetch(url2);
    if (response2.ok) {
      const data2 = await response2.json();
      if (data2.items) {
        data2.items.forEach((item: any) => {
          // Avoid duplicates
          if (!videos.find(v => v.videoId === item.id.videoId)) {
            videos.push({
              id: item.id.videoId,
              videoId: item.id.videoId,
              title: decodeHtmlEntities(item.snippet.title),
              description: decodeHtmlEntities(item.snippet.description || ''),
              thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
              channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
              publishedAt: item.snippet.publishedAt,
            });
          }
        });
      }
    } else {
      let errorData: any = {};
      try {
        const text = await response2.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // If JSON parsing fails, log the raw text
        console.error('[getYouTubeVideos] ❌ Query 2 error response (raw):', await response2.text().catch(() => 'Could not read response'));
      }

      console.error(`[getYouTubeVideos] ❌ Query 2 failed: ${response2.status} ${response2.statusText}`);
      console.error('[getYouTubeVideos] Error details:', {
        status: response2.status,
        statusText: response2.statusText,
        error: errorData.error || errorData,
        message: errorData.error?.message || errorData.message || 'No error message',
        reason: errorData.error?.errors?.[0]?.reason || errorData.reason || 'Unknown reason',
        domain: errorData.error?.errors?.[0]?.domain || errorData.domain,
        fullError: errorData
      });

      // Provide helpful guidance based on error
      if (response2.status === 403) {
        const reason = errorData.error?.errors?.[0]?.reason || errorData.reason || '';
        if (reason === 'quotaExceeded') {
          console.error('[getYouTubeVideos] ⚠️ YouTube API quota exceeded. Please check your quota in Google Cloud Console.');
        } else if (reason === 'accessNotConfigured') {
          console.error('[getYouTubeVideos] ⚠️ YouTube Data API v3 is not enabled. Enable it in Google Cloud Console.');
        } else if (reason === 'ipRefererBlocked') {
          console.error('[getYouTubeVideos] ⚠️ API key restrictions are blocking this request. Check IP/referrer restrictions in Google Cloud Console.');
        } else {
          console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 Forbidden. Possible causes:');
          console.error('[getYouTubeVideos]   1. Invalid API key');
          console.error('[getYouTubeVideos]   2. API key restrictions (IP/referrer)');
          console.error('[getYouTubeVideos]   3. YouTube Data API v3 not enabled');
          console.error('[getYouTubeVideos]   4. Quota exceeded');
          console.error('[getYouTubeVideos]   Check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets and Google Cloud Console settings.');
        }
      }
    }

    // Limit to top 10 videos
    const limitedVideos = videos.slice(0, 10);
    console.log(`[getYouTubeVideos] ✅ Found ${limitedVideos.length} videos`);

    // Save to database
    if (limitedVideos.length > 0) {
      await saveYouTubeVideosToDatabase(bookTitle, author, limitedVideos);
    }

    return limitedVideos;
  } catch (err: any) {
    console.error('[getYouTubeVideos] ❌ Error:', err);
    console.error('[getYouTubeVideos] Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack
    });

    // Check for specific API errors
    if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
      console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 - check API key permissions and quota');
    } else if (err.message?.includes('400') || err.message?.includes('Bad Request')) {
      console.error('[getYouTubeVideos] ⚠️ YouTube API returned 400 - check API key validity');
    }

    return [];
  }
}

// --- Save YouTube Videos to Database ---
async function saveYouTubeVideosToDatabase(bookTitle: string, bookAuthor: string, videos: YouTubeVideo[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveYouTubeVideosToDatabase] ❌ Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      videos: videos,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('youtube_videos')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('youtube_videos')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveYouTubeVideosToDatabase] ❌ Error saving videos:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        fullError: result.error
      });

      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveYouTubeVideosToDatabase] ⚠️ Table "youtube_videos" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveYouTubeVideosToDatabase] ✅ Saved ${videos.length} videos to database`);
    }
  } catch (err: any) {
    console.error('[saveYouTubeVideosToDatabase] ❌ Unexpected error:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
  }
}
