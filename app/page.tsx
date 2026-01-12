'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Loader2,
  Trash2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Library,
  Info,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Constants ---
const STORAGE_KEY = 'quick_book_ratings_v1';
const RATING_DIMENSIONS = ['writing', 'insight', 'flow'] as const;
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; // Provided by environment

const GRADIENTS = [
  'from-rose-500 to-pink-600',
  'from-indigo-600 to-blue-700',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-600 to-fuchsia-600',
  'from-cyan-500 to-blue-500',
] as const;

interface Book {
  id: string;
  title: string;
  author: string;
  publishYear?: number;
  coverUrl?: string | null;
  wikipediaUrl?: string;
  pageTitle?: string;
  createdAt: number;
  ratings: {
    writing: number | null;
    insight: number | null;
    flow: number | null;
  };
}

// --- API Helpers ---

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 5, delay = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
        if (i === retries - 1) throw new Error(`HTTP ${res.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
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

function first4DigitYear(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

// --- Gemini Suggestions Pipeline ---

async function getGeminiSuggestions(query: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const systemPrompt = `You are a book title expert. The user is searching for a book with a potentially misspelled or partial title.
  Analyze the query: "${query}"
  Return a JSON array of the top 3 most likely real book titles. 
  Keep the titles exact so they work well in a Wikipedia search.
  If the input is Hebrew, suggest Hebrew titles.
  Format: { "suggestions": ["Title 1", "Title 2", "Title 3"] }`;

  const payload = {
    contents: [{ parts: [{ text: `Search query: ${query}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          suggestions: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["suggestions"]
      }
    }
  };

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{"suggestions":[]}').suggestions;
  } catch (err) {
    return [];
  }
}

// --- Wikipedia/Wikidata Pipeline ---

async function getWikidataItemForTitle(pageTitle: string, lang = 'en'): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(pageTitle)}&prop=pageprops&ppprop=wikibase_item`;
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0] as any;
  return page?.pageprops?.wikibase_item ?? null;
}

async function getAuthorAndYearFromWikidata(qid: string, lang = 'en'): Promise<{ author: string; publishYear?: number }> {
  const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(qid)}&props=claims`;
  const entityData = await fetchWithRetry(entityUrl);
  const ent = entityData?.entities?.[qid];
  const claims = ent?.claims ?? {};

  const authorClaims = claims?.P50 ?? [];
  const authorIds = authorClaims.map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);

  const dateClaim = (claims?.P577?.[0] ?? claims?.P571?.[0]);
  const timeStr = dateClaim?.mainsnak?.datavalue?.value?.time; 
  const publishYear = first4DigitYear(timeStr);

  let author = lang === 'he' ? "מחבר לא ידוע" : "Unknown Author";

  if (authorIds.length > 0) {
    const authorsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(authorIds.join("|"))}&props=labels&languages=${lang}|en`;
    const authorsData = await fetchWithRetry(authorsUrl);
    const labels = authorIds.map((id: string) => {
        const entity = authorsData?.entities?.[id];
        return entity?.labels?.[lang]?.value || entity?.labels?.en?.value;
    }).filter(Boolean);
    if (labels.length > 0) author = labels.join(", ");
  }
  return { author, publishYear };
}

async function lookupBookOnWikipedia(query: string): Promise<Book | null> {
  const lang = isHebrew(query) ? 'he' : 'en';
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const searchData = await fetchWithRetry(searchUrl);
  const results = searchData.query?.search || [];
  if (results.length === 0) return null;

  const keywords = lang === 'he' 
    ? ["ספר", "רומן", "נובלה", "ביוגרפיה", "סיפור"] 
    : ["novel", "memoir", "non-fiction", "book", "biography", "fiction"];

  let bestCandidate = results.find((r: any) => 
    r.title.toLowerCase().includes(lang === 'he' ? "(ספר)" : "(book)") || 
    r.title.toLowerCase().includes(lang === 'he' ? "(רומן)" : "(novel)")
  );

  if (!bestCandidate) {
    bestCandidate = results.find((r: any) => keywords.some(kw => r.snippet.toLowerCase().includes(kw)));
  }
  if (!bestCandidate) bestCandidate = results[0];
  
  const pageTitle = bestCandidate.title;
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
  const summaryData = await fetchWithRetry(summaryUrl);

  const qid = await getWikidataItemForTitle(pageTitle, lang);
  let author = lang === 'he' ? "מחבר לא ידוע" : "Unknown Author";
  let publishYear: number | undefined = undefined;
  
  if (qid) {
    const wdData = await getAuthorAndYearFromWikidata(qid, lang);
    author = wdData.author || author;
    publishYear = wdData.publishYear;
  }

  return {
    id: '',
    title: summaryData.title || pageTitle,
    author: author,
    publishYear: publishYear,
    coverUrl: summaryData.thumbnail?.source || summaryData.originalimage?.source || null,
    wikipediaUrl: summaryData.content_urls?.desktop?.page,
    pageTitle: pageTitle,
    createdAt: Date.now(),
    ratings: { writing: null, insight: null, flow: null }
  };
}

// --- Utilities ---

function calculateAvg(ratings: Book['ratings']): string | null {
  const values = Object.values(ratings).filter(v => v != null) as number[];
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

// --- UI Components ---

interface RatingStarsProps {
  value: number | null;
  onRate: (dimension: string, value: number) => void;
  dimension: string;
}

function RatingStars({ value, onRate, dimension }: RatingStarsProps) {
  const [localValue, setLocalValue] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    setLocalValue(value || 0);
    setIsLocked(false);
  }, [dimension, value]);

  function handleTap(star: number) {
    if (isLocked) return;
    setIsLocked(true);
    setLocalValue(star);
    setTimeout(() => onRate(dimension, star), 450);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900/60 mb-1">{dimension}</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} onClick={() => handleTap(star)} className="p-1 focus:outline-none" whileTap={{ scale: 0.7 }}>
            <Star 
              size={32} 
              className={`transition-all duration-300 ease-out ${star <= localValue ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300 fill-transparent scale-100'}`}
              style={{ transitionDelay: star <= localValue ? `${star * 50}ms` : '0ms' }}
            />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface AddBookSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Book) => void;
}

function AddBookSheet({ isOpen, onClose, onAdd }: AddBookSheetProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) return;
    setLoading(true);
    setError('');
    
    // Run both in parallel
    const wikiPromise = lookupBookOnWikipedia(titleToSearch);
    const geminiPromise = getGeminiSuggestions(titleToSearch);

    try {
      const [meta, gems] = await Promise.all([wikiPromise, geminiPromise]);
      
      setSuggestions(gems);

      if (meta) {
        const newBook: Book = {
          ...meta,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ratings: { writing: null, insight: null, flow: null }
        };
        onAdd(newBook);
        setQuery('');
        setSuggestions([]);
        onClose();
      } else {
        setError(`Couldn't find an exact match on Wikipedia.`);
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestionClick(s: string) {
    setQuery(s);
    handleSearch(s);
  }

  if (!isOpen) return null;

  const isQueryHebrew = isHebrew(query);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-t-3xl p-3 shadow-2xl pb-5"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
          <div className="relative">
            <input 
              autoFocus 
              type="text" 
              placeholder={isQueryHebrew ? "חפש ספר..." : "Search for a book..."}
              value={query} 
              onChange={e => setQuery(e.target.value)}
              className={`w-full py-4 bg-slate-100 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-lg outline-none ${isQueryHebrew ? 'text-right pr-4 pl-12' : 'pl-4 pr-12'}`}
              dir={isQueryHebrew ? "rtl" : "ltr"}
            />
            <button 
              type="submit" 
              disabled={loading} 
              className={`absolute top-2 bottom-2 aspect-square bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 ${isQueryHebrew ? 'left-2' : 'right-2'}`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>
          
          {/* Gemini "Did you mean?" Suggestions */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                <div className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" /> Did you mean?
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-red-500 text-sm px-2 font-medium">{error}</p>}
        </form>
        <p className="mt-4 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5 uppercase tracking-wider">
          <Library size={12} /> Powered by Wikipedia & AI
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setBooks(JSON.parse(saved)); } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }, [books, isLoaded]);

  useEffect(() => {
    setIsEditing(false);
    setIsConfirmingDelete(false);
    
    setIsMetaExpanded(true);
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  function handleAddBook(meta: Book) {
    const newBook: Book = { ...meta, id: crypto.randomUUID(), createdAt: Date.now(), ratings: { writing: null, insight: null, flow: null } };
    const newBooks = [...books, newBook];
    setBooks(newBooks);
    setSelectedIndex(newBooks.length - 1);
  }

  function handleRate(id: string, dimension: string, value: number | null) {
    setBooks(prev => prev.map(book => book.id === id ? { ...book, ratings: { ...book.ratings, [dimension]: value } } : book));
  }

  function handleDelete() {
    const newBooks = books.filter(b => b.id !== activeBook.id);
    const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
    setIsConfirmingDelete(false);
    setSelectedIndex(newBooks.length > 0 ? nextIndex : 0);
    setBooks(newBooks);
  }

  const activeBook = books[selectedIndex];
  const nextDimension = useMemo(() => activeBook ? RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) : null, [activeBook]);
  const showRatingOverlay = activeBook && (!!nextDimension || isEditing);

  if (!isLoaded) return null;

  return (
    <div className="fixed inset-0 bg-slate-50 text-slate-900 font-sans select-none overflow-hidden flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-start p-4 relative pt-4">
        {books.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><BookOpen size={40} className="text-white opacity-90" /></div>
          </div>
        ) : (
          <div className="w-full max-w-[340px] flex flex-col items-center">
            <div className="relative w-full aspect-[2/3] rounded-3xl shadow-2xl border border-white/50 overflow-hidden group">
              {/* Cover View */}
              <AnimatePresence mode='wait'>
                <motion.div key={activeBook.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full h-full">
                  {activeBook.coverUrl ? (
                    <img src={activeBook.coverUrl} alt={activeBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${getGradient(activeBook.id)} text-white`}>
                      <BookOpen size={48} className="mb-4 opacity-30" />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Collapsible Metadata (Top Left) */}
              <div className="absolute top-4 left-4 z-30 max-w-[80%]">
                <motion.div 
                  initial={false}
                  animate={{ 
                    width: isMetaExpanded ? 'auto' : '44px',
                    height: isMetaExpanded ? 'auto' : '44px',
                    padding: isMetaExpanded ? '12px' : '0px',
                    borderRadius: '22px'
                  }}
                  onClick={() => setIsMetaExpanded(!isMetaExpanded)}
                  className="bg-white/90 backdrop-blur-md shadow-xl border border-white/20 cursor-pointer flex items-center justify-center overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    {isMetaExpanded ? (
                      <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                        <h2 className="text-sm font-black text-slate-900 leading-tight line-clamp-2 mb-1">{activeBook.title}</h2>
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-bold text-slate-600 truncate">{activeBook.author}</p>
                          <div className="flex items-center gap-2">
                            {activeBook.publishYear && (
                              <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider text-slate-700">
                                {activeBook.publishYear}
                              </span>
                            )}
                            {activeBook.wikipediaUrl && (
                              <a href={activeBook.wikipediaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[8px] text-blue-600 flex items-center gap-0.5 uppercase font-bold tracking-widest hover:underline">
                                Source <ExternalLink size={8} />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="minimized" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Info size={20} className="text-slate-800" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Actions & Navigation */}
              <AnimatePresence>
                {isConfirmingDelete && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
                    <AlertCircle size={48} className="mb-4" /><h3 className="text-xl font-bold mb-2">Delete this book?</h3>
                    <div className="flex flex-col w-full gap-2">
                      <button onClick={handleDelete} className="w-full py-3 bg-white text-red-600 rounded-xl font-black active:scale-95 transition-transform">Yes, Remove</button>
                      <button onClick={() => setIsConfirmingDelete(false)} className="w-full py-3 bg-red-700 text-white rounded-xl font-bold active:scale-95 transition-transform">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showRatingOverlay && !isConfirmingDelete && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-16 left-4 right-4 z-40 bg-white/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
                    {nextDimension ? (
                      <motion.div key={nextDimension} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full">
                        <RatingStars dimension={nextDimension} value={activeBook.ratings[nextDimension]} onRate={(dim, val) => handleRate(activeBook.id, dim, val)} />
                      </motion.div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-2 text-center">
                        <div className="p-2 bg-green-100 text-green-600 rounded-full"><CheckCircle2 size={24} /></div>
                        <p className="font-bold text-slate-900 text-sm">Rating Saved</p>
                        <div className="flex gap-2">
                          <button onClick={() => setIsEditing(false)} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform">Close</button>
                          <button onClick={() => {
                            handleRate(activeBook.id, 'writing', null);
                            handleRate(activeBook.id, 'insight', null);
                            handleRate(activeBook.id, 'flow', null);
                          }} className="px-5 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold active:scale-95 transition-transform">Reset</button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => setIsConfirmingDelete(true)} className="absolute top-4 right-4 z-30 bg-white/95 backdrop-blur p-2.5 rounded-full shadow-lg text-slate-400 hover:text-red-500 active:scale-90 transition-all border border-white/20">
                <Trash2 size={20} />
              </button>

              {calculateAvg(activeBook.ratings) && (
                <button onClick={() => setIsEditing(true)} className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 active:scale-90 transition-transform border border-white/20">
                  <Star size={14} className="fill-amber-400 text-amber-400" /><span className="font-black text-sm text-slate-800">{calculateAvg(activeBook.ratings)}</span>
                </button>
              )}

              {books.length > 1 && (
                <>
                  <button onClick={() => setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1))} className="absolute left-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={36} /></button>
                  <button onClick={() => setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0))} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={36} /></button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Peaking Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[50] flex justify-center px-4 pb-0 pointer-events-none">
        <motion.div 
          initial={{ y: 45 }}
          animate={{ y: 40 }}
          whileHover={{ y: 35 }}
          className="w-full max-w-[380px] bg-white border border-slate-200 border-b-0 rounded-t-[32px] shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.2)] p-5 flex flex-col items-center gap-2 cursor-pointer pointer-events-auto transition-all hover:bg-slate-50"
          onClick={() => setIsAdding(true)}
        >
          <div className="w-14 h-1.5 bg-slate-200 rounded-full mb-1" />
          <div className="flex items-center gap-3 text-slate-300 font-extrabold uppercase tracking-[0.2em] text-[10px] pb-4">
            <Search size={16} className="text-blue-500 opacity-50" />
            Add Book
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <AddBookSheet 
            isOpen={isAdding} 
            onClose={() => setIsAdding(false)} 
            onAdd={handleAddBook} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
