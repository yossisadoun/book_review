/**
 * Script to populate the curated_podcast_episodes table
 * Run with: npx tsx scripts/populate-curated-episodes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('   The service role key is required to bypass RLS for bulk inserts.');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Prioritized book podcast shows (collectionId)
const PRIORITIZED_SHOWS = [
  { name: "The Book Club Review", collectionId: 1215730246 },
  { name: "The Book Review (by The New York Times)", collectionId: 120315179 },
  { name: "Book Riot – The Podcast (All the Books!)", collectionId: 993284374 },
  { name: "Overdue", collectionId: 602003021 },
  { name: "Backlisted", collectionId: 892817183 },
  { name: "If Books Could Kill", collectionId: 1660908304 },
  { name: "World Book Club", collectionId: 309595551 },
  { name: "Book Club with Michael Smerconish", collectionId: 1522088009 },
  { name: "New Books Network", collectionId: 150548015 },
  { name: "Reading Glasses", collectionId: 1393888875 },
];

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429 && i < retries - 1) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * Math.pow(2, i);
        console.log(`⏳ Rate limited. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

function extractBookInfo(title: string, description: string): { bookTitle: string | null; bookAuthor: string | null } {
  // Simple extraction patterns - you might want to enhance this
  const text = `${title} ${description}`.toLowerCase();
  
  // Look for patterns like "Book Title by Author" or quotes around book titles
  const byPattern = /"([^"]+)"\s+by\s+([^,\.]+)/i;
  const match = text.match(byPattern);
  
  if (match) {
    return {
      bookTitle: match[1].trim(),
      bookAuthor: match[2].trim(),
    };
  }
  
  // Look for "Book Title" with author mentioned nearby
  const quotePattern = /"([^"]+)"/;
  const quoteMatch = text.match(quotePattern);
  
  if (quoteMatch) {
    // Try to find author after the quote
    const afterQuote = text.substring(text.indexOf(quoteMatch[0]) + quoteMatch[0].length);
    const authorMatch = afterQuote.match(/(?:by|with|featuring)\s+([^,\.]+)/i);
    
    if (authorMatch) {
      return {
        bookTitle: quoteMatch[1].trim(),
        bookAuthor: authorMatch[1].trim(),
      };
    }
  }
  
  return { bookTitle: null, bookAuthor: null };
}

async function populateEpisodesForShow(show: { name: string; collectionId: number }) {
  console.log(`\n📻 Processing: ${show.name} (ID: ${show.collectionId})`);
  
  try {
    // Fetch episodes from Apple Podcasts
    const lookupUrl = `https://itunes.apple.com/lookup?id=${show.collectionId}&media=podcast&entity=podcastEpisode&limit=200`;
    const data = await fetchWithRetry(lookupUrl);
    const episodes = data.results?.slice(1) || []; // Skip first (it's the show itself)
    
    console.log(`   Found ${episodes.length} episodes`);
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const ep of episodes) {
      try {
        // Extract book info
        const { bookTitle, bookAuthor } = extractBookInfo(
          ep.trackName || '',
          ep.description || ''
        );
        
        // Convert duration
        const durationMs = ep.trackTimeMillis || 0;
        const lengthMinutes = durationMs > 0 ? Math.round(durationMs / 60000) : null;
        
        // Format release date
        let airDate: string | null = null;
        if (ep.releaseDate) {
          try {
            airDate = new Date(ep.releaseDate).toISOString().split('T')[0];
          } catch (e) {
            // Invalid date, skip
          }
        }
        
        const episodeData = {
          collection_id: show.collectionId,
          podcast_name: show.name,
          episode_title: ep.trackName || 'Untitled Episode',
          episode_url: ep.trackViewUrl || ep.episodeUrl || '',
          audio_url: ep.episodeUrl || null,
          episode_summary: ep.description || '',
          podcast_summary: show.name,
          length_minutes: lengthMinutes,
          air_date: airDate,
          book_title: bookTitle,
          book_author: bookAuthor,
          updated_at: new Date().toISOString(),
        };
        
        // Upsert (insert or update if exists)
        const { error } = await supabase
          .from('curated_podcast_episodes')
          .upsert(episodeData, { 
            onConflict: 'collection_id,episode_url',
            ignoreDuplicates: false 
          });
        
        if (error) {
          if (error.code === '23505') { // Unique violation (shouldn't happen with upsert, but just in case)
            skipped++;
          } else {
            console.error(`   ❌ Error inserting episode "${ep.trackName}":`, error.message);
            skipped++;
          }
        } else {
          // Check if it was an insert or update by querying first
          const { data: existing } = await supabase
            .from('curated_podcast_episodes')
            .select('id')
            .eq('collection_id', show.collectionId)
            .eq('episode_url', episodeData.episode_url)
            .single();
          
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        }
      } catch (err: any) {
        console.error(`   ⚠️ Error processing episode:`, err.message);
        skipped++;
      }
    }
    
    console.log(`   ✅ ${show.name}: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
    return { inserted, updated, skipped };
  } catch (err: any) {
    console.error(`   ❌ Error fetching episodes for ${show.name}:`, err.message);
    return { inserted: 0, updated: 0, skipped: 0 };
  }
}

async function main() {
  console.log('🚀 Starting to populate curated_podcast_episodes table...\n');
  console.log(`📊 Processing ${PRIORITIZED_SHOWS.length} shows\n`);
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const show of PRIORITIZED_SHOWS) {
    const result = await populateEpisodesForShow(show);
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    
    // Add a small delay between shows to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Inserted: ${totalInserted}`);
  console.log(`   🔄 Updated: ${totalUpdated}`);
  console.log(`   ⏭️  Skipped: ${totalSkipped}`);
  console.log(`   📦 Total: ${totalInserted + totalUpdated + totalSkipped}`);
  console.log('='.repeat(50));
  console.log('\n✨ Done!');
}

main().catch(console.error);
