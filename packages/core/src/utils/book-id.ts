// Canonical book ID generation for deduplication

export function generateCanonicalBookId(bookTitle: string, bookAuthor: string): string {
  // Normalize: lowercase, trim, remove extra spaces
  const normalizedTitle = bookTitle
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  const normalizedAuthor = bookAuthor
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  
  return `${normalizedTitle}|${normalizedAuthor}`;
}
