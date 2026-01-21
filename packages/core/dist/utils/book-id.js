"use strict";
// Canonical book ID generation for deduplication
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCanonicalBookId = generateCanonicalBookId;
function generateCanonicalBookId(bookTitle, bookAuthor) {
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
