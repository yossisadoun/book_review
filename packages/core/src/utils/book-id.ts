// Canonical book ID generation for deduplication

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function primaryAuthor(author: string): string {
  // Take only the first/primary author — split on & or "and"
  let primary = author.split(/\s+&\s+|\s+and\s+/i)[0];
  // Handle comma-separated co-authors: "Douglas Adams, Eoin Colfer"
  // But preserve "Last, First" format
  const commaParts = primary.split(',');
  if (commaParts.length > 1 && commaParts[0].trim().includes(' ')) {
    primary = commaParts[0];
  }
  return primary.trim();
}

export function generateCanonicalBookId(bookTitle: string, bookAuthor: string): string {
  let normalizedTitle = stripDiacritics((bookTitle || '').toLowerCase().trim())
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')  // strip parentheticals
    .replace(/-/g, ' ')                 // hyphens → spaces
    .replace(/\s+/g, ' ')
    .trim();

  let normalizedAuthor = stripDiacritics((bookAuthor || '').toLowerCase().trim());
  normalizedAuthor = primaryAuthor(normalizedAuthor)
    .replace(/\s+/g, ' ')
    .replace(/\.\s+/g, '.')             // collapse initial spacing
    .replace(/-/g, ' ')                 // hyphens → spaces
    .replace(/\s+/g, ' ')
    .trim();

  return `${normalizedTitle}|${normalizedAuthor}`;
}
