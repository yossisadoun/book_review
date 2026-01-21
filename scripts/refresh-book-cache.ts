/**
 * Script to refresh cached data for books in Supabase
 * 
 * Usage:
 *   npx tsx scripts/refresh-book-cache.ts "Book Title" "Author Name"
 *   npx tsx scripts/refresh-book-cache.ts --all
 *   npx tsx scripts/refresh-book-cache.ts --all --limit 10
 * 
 * This script refreshes the following cache tables:
 * - author_facts_cache
 * - trivia_questions_cache (generated from author facts)
 * - book_domain_cache
 * - book_influences_cache
 * - book_context_cache
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GROK_API_KEY = process.env.NEXT_PUBLIC_GROK_API_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('   The service role key is required to bypass RLS for bulk operations.');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

if (!GROK_API_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_GROK_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Load prompts
function loadPrompts() {
  try {
    const promptsPath = join(process.cwd(), 'prompts.yaml');
    const yamlText = readFileSync(promptsPath, 'utf-8');
    return yaml.load(yamlText) as any;
  } catch (error) {
    console.error('❌ Error loading prompts.yaml:', error);
    process.exit(1);
  }
}

function formatPrompt(template: string, variables: Record<string, string>): string {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return formatted;
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      
      if (res.status === 429 && i < retries - 1) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * Math.pow(2, i);
        console.log(`   ⏳ Rate limited. Waiting ${waitTime}ms before retry...`);
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

// Generate author facts
async function generateAuthorFacts(bookTitle: string, author: string, prompts: any): Promise<string[]> {
  console.log(`   📝 Generating author facts...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const prompt = formatPrompt(prompts.author_facts.prompt, { author, bookTitle });
  
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };
  
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    return result.facts || [];
  } catch (err: any) {
    console.error(`   ❌ Error generating author facts:`, err.message);
    return [];
  }
}

// Generate trivia questions from author facts
async function generateTriviaQuestions(bookTitle: string, author: string, facts: string[], prompts: any): Promise<any[]> {
  if (facts.length === 0) {
    console.log(`   ⏭️  Skipping trivia questions (no author facts)`);
    return [];
  }
  
  console.log(`   🎯 Generating trivia questions...`);
  
  const factsJson = facts.map(fact => ({ author_facts: [fact] }));
  const prompt = formatPrompt(prompts.trivia_questions.prompt, { 
    book_title: bookTitle,
    author_name: author,
    FACTS_JSON: JSON.stringify(factsJson, null, 2) 
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.8
  };
  
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    const content = data.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    return parsed.questions || [];
  } catch (err: any) {
    console.error(`   ❌ Error generating trivia questions:`, err.message);
    return [];
  }
}

// Generate domain insights
async function generateDomainInsights(bookTitle: string, author: string, prompts: any): Promise<{ label: string; facts: string[] } | null> {
  console.log(`   🔍 Generating domain insights...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const prompt = formatPrompt(prompts.book_domain.prompt, { bookTitle, author });
  
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };
  
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    const content = data.choices?.[0]?.message?.content || '{"label":"Domain","facts":[]}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    return {
      label: result.label || 'Domain',
      facts: result.facts || []
    };
  } catch (err: any) {
    console.error(`   ❌ Error generating domain insights:`, err.message);
    return null;
  }
}

// Generate influences
async function generateInfluences(bookTitle: string, author: string, prompts: any): Promise<string[]> {
  console.log(`   📚 Generating influences...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const prompt = formatPrompt(prompts.book_influences.prompt, { bookTitle, author });
  
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };
  
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    return result.facts || [];
  } catch (err: any) {
    console.error(`   ❌ Error generating influences:`, err.message);
    return [];
  }
}

// Generate context insights
async function generateContextInsights(bookTitle: string, author: string, prompts: any): Promise<string[]> {
  console.log(`   🌍 Generating context insights...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const prompt = formatPrompt(prompts.book_context.prompt, { bookTitle, author });
  
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };
  
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    return result.facts || [];
  } catch (err: any) {
    console.error(`   ❌ Error generating context insights:`, err.message);
    return [];
  }
}

// Save to cache tables
async function saveToCache(
  bookTitle: string,
  author: string,
  authorFacts: string[],
  triviaQuestions: any[],
  domainInsights: { label: string; facts: string[] } | null,
  influences: string[],
  contextInsights: string[]
): Promise<void> {
  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();
  const now = new Date().toISOString();
  
  // Save author facts
  if (authorFacts.length > 0) {
    const { error } = await supabase
      .from('author_facts_cache')
      .upsert({
        book_title: normalizedTitle,
        book_author: normalizedAuthor,
        author_facts: authorFacts,
        updated_at: now
      }, {
        onConflict: 'book_title,book_author'
      });
    if (error) {
      console.error(`   ❌ Error saving author facts:`, error.message);
    } else {
      console.log(`   ✅ Saved ${authorFacts.length} author facts`);
    }
  }
  
  // Save trivia questions (no unique constraint, so check first)
  if (triviaQuestions.length > 0) {
    const { data: existing } = await supabase
      .from('trivia_questions_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase
        .from('trivia_questions_cache')
        .update({
          questions: triviaQuestions,
          updated_at: now
        })
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
      if (error) {
        console.error(`   ❌ Error updating trivia questions:`, error.message);
      } else {
        console.log(`   ✅ Updated ${triviaQuestions.length} trivia questions`);
      }
    } else {
      const { error } = await supabase
        .from('trivia_questions_cache')
        .insert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          questions: triviaQuestions,
          updated_at: now
        });
      if (error) {
        console.error(`   ❌ Error inserting trivia questions:`, error.message);
      } else {
        console.log(`   ✅ Inserted ${triviaQuestions.length} trivia questions`);
      }
    }
  }
  
  // Save domain insights
  if (domainInsights && domainInsights.facts.length > 0) {
    const { error } = await supabase
      .from('book_domain_cache')
      .upsert({
        book_title: normalizedTitle,
        book_author: normalizedAuthor,
        domain_label: domainInsights.label,
        domain_insights: domainInsights.facts,
        updated_at: now
      }, {
        onConflict: 'book_title,book_author'
      });
    if (error) {
      console.error(`   ❌ Error saving domain insights:`, error.message);
    } else {
      console.log(`   ✅ Saved ${domainInsights.facts.length} domain insights (${domainInsights.label})`);
    }
  }
  
  // Save influences
  if (influences.length > 0) {
    const { error } = await supabase
      .from('book_influences_cache')
      .upsert({
        book_title: normalizedTitle,
        book_author: normalizedAuthor,
        influences: influences,
        updated_at: now
      }, {
        onConflict: 'book_title,book_author'
      });
    if (error) {
      console.error(`   ❌ Error saving influences:`, error.message);
    } else {
      console.log(`   ✅ Saved ${influences.length} influences`);
    }
  }
  
  // Save context insights
  if (contextInsights.length > 0) {
    const { error } = await supabase
      .from('book_context_cache')
      .upsert({
        book_title: normalizedTitle,
        book_author: normalizedAuthor,
        context_insights: contextInsights,
        updated_at: now
      }, {
        onConflict: 'book_title,book_author'
      });
    if (error) {
      console.error(`   ❌ Error saving context insights:`, error.message);
    } else {
      console.log(`   ✅ Saved ${contextInsights.length} context insights`);
    }
  }
}

// Refresh cache for a single book
async function refreshBookCache(bookTitle: string, author: string): Promise<void> {
  console.log(`\n📖 Refreshing cache for: "${bookTitle}" by ${author}`);
  console.log('─'.repeat(60));
  
  const prompts = loadPrompts();
  
  try {
    // Generate all cached data
    const [authorFacts, domainInsights, influences, contextInsights] = await Promise.all([
      generateAuthorFacts(bookTitle, author, prompts),
      generateDomainInsights(bookTitle, author, prompts),
      generateInfluences(bookTitle, author, prompts),
      generateContextInsights(bookTitle, author, prompts)
    ]);
    
    // Generate trivia questions from author facts
    const triviaQuestions = await generateTriviaQuestions(bookTitle, author, authorFacts, prompts);
    
    // Save everything to cache
    await saveToCache(bookTitle, author, authorFacts, triviaQuestions, domainInsights, influences, contextInsights);
    
    console.log(`✅ Successfully refreshed cache for "${bookTitle}"`);
  } catch (err: any) {
    console.error(`❌ Error refreshing cache for "${bookTitle}":`, err.message);
    throw err;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || (args[0] === '--help' || args[0] === '-h')) {
    console.log(`
Usage:
  npx tsx scripts/refresh-book-cache.ts "Book Title" "Author Name"
  npx tsx scripts/refresh-book-cache.ts --all
  npx tsx scripts/refresh-book-cache.ts --all --limit 10

Options:
  --all          Refresh all books from the database
  --limit N      Limit to N books when using --all (default: no limit)
  --help, -h     Show this help message

Examples:
  npx tsx scripts/refresh-book-cache.ts "The Catcher in the Rye" "J.D. Salinger"
  npx tsx scripts/refresh-book-cache.ts --all --limit 5
`);
    process.exit(0);
  }
  
  if (args[0] === '--all') {
    // Refresh all books
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
    
    console.log('🚀 Refreshing cache for all books...');
    if (limit) {
      console.log(`   (Limited to ${limit} books)`);
    }
    
    // Fetch distinct books from database
    let query = supabase
      .from('books')
      .select('title, author')
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: books, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching books:', error.message);
      process.exit(1);
    }
    
    if (!books || books.length === 0) {
      console.log('⚠️  No books found in database');
      process.exit(0);
    }
    
    // Get unique books (by title + author)
    const uniqueBooks = new Map<string, { title: string; author: string }>();
    for (const book of books) {
      if (book.title && book.author) {
        const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
        if (!uniqueBooks.has(key)) {
          uniqueBooks.set(key, { title: book.title, author: book.author });
        }
      }
    }
    
    const bookList = Array.from(uniqueBooks.values());
    console.log(`\n📚 Found ${bookList.length} unique books to refresh\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < bookList.length; i++) {
      const book = bookList[i];
      console.log(`[${i + 1}/${bookList.length}]`);
      try {
        await refreshBookCache(book.title, book.author);
        successCount++;
        
        // Add delay between books to avoid rate limiting
        if (i < bookList.length - 1) {
          console.log('   ⏳ Waiting 3 seconds before next book...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        errorCount++;
        console.error(`   ❌ Failed to refresh:`, err);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${bookList.length}`);
    console.log('='.repeat(60));
  } else {
    // Refresh single book
    if (args.length < 2) {
      console.error('❌ Please provide both book title and author');
      console.error('   Usage: npx tsx scripts/refresh-book-cache.ts "Book Title" "Author Name"');
      process.exit(1);
    }
    
    const bookTitle = args[0];
    const author = args[1];
    
    await refreshBookCache(bookTitle, author);
    console.log('\n✨ Done!');
  }
}

main().catch(console.error);
