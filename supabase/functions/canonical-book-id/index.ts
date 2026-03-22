import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function primaryAuthor(author: string): string {
  // Take only the first author — split on &, "and", comma (but not commas inside initials like "J.R.R.")
  // First split on " & " or " and " (case-insensitive)
  let primary = author.split(/\s+&\s+|\s+and\s+/i)[0]
  // Then split on comma — but only if what follows looks like another name (has a space + capital letter pattern)
  // This avoids splitting "Morrison, Toni" style names
  // Simple heuristic: if there's a comma followed by content that contains a space, it might be "Author1, Author2"
  // But "Last, First" also has a comma. Use: if the part after comma starts with a capital and the part before also
  // has a space (suggesting it's already "First Last"), then it's a co-author separator.
  const commaParts = primary.split(',')
  if (commaParts.length > 1) {
    const before = commaParts[0].trim()
    // If first part has a space (e.g., "Douglas Adams"), treat comma as co-author separator
    if (before.includes(' ')) {
      primary = before
    }
    // Otherwise it's likely "Last, First" format — keep as-is
  }
  return primary.trim()
}

function generateCanonicalBookId(title: string, author: string): string {
  let normalizedTitle = stripDiacritics((title || '').toLowerCase().trim())
  normalizedTitle = normalizedTitle
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/\s*\([^)]*\)\s*/g, ' ')  // strip parentheticals: "Beloved (novel)" → "Beloved"
    .replace(/-/g, ' ')             // normalize hyphens to spaces: "Catch-22" → "Catch 22"
    .replace(/\s+/g, ' ')           // re-collapse after replacements
    .trim()

  let normalizedAuthor = stripDiacritics((author || '').toLowerCase().trim())
  normalizedAuthor = primaryAuthor(normalizedAuthor)
  normalizedAuthor = normalizedAuthor
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/\.\s+/g, '.')         // collapse initial spacing: "j. d." → "j.d."
    .replace(/-/g, ' ')             // normalize hyphens: "saint-exupery" → "saint exupery"
    .replace(/\s+/g, ' ')           // re-collapse after replacements
    .trim()

  return `${normalizedTitle}|${normalizedAuthor}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Single book: { title, author }
    // Batch: { books: [{ title, author }, ...] }
    if (body.books && Array.isArray(body.books)) {
      const results = body.books.map((b: { title?: string; author?: string }) => ({
        title: b.title || '',
        author: b.author || '',
        canonical_book_id: generateCanonicalBookId(b.title || '', b.author || ''),
      }))
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { title, author } = body
    if (typeof title !== 'string') {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const canonical_book_id = generateCanonicalBookId(title, author || '')
    return new Response(JSON.stringify({ title, author: author || '', canonical_book_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
