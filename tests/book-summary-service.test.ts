import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromMock,
  maybeSingleMock,
  upsertMock,
  fetchWithRetryMock,
  loadPromptsMock,
  formatPromptMock,
  logGrokUsageMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  upsertMock: vi.fn(),
  fetchWithRetryMock: vi.fn(),
  loadPromptsMock: vi.fn(),
  formatPromptMock: vi.fn(),
  logGrokUsageMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/lib/prompts', () => ({
  loadPrompts: loadPromptsMock,
  formatPrompt: formatPromptMock,
}));

vi.mock('../app/services/api-utils', () => ({
  grokApiKey: 'x'.repeat(32),
  fetchWithRetry: fetchWithRetryMock,
  logGrokUsage: logGrokUsageMock,
}));

import { getBookSummary } from '../app/services/book-summary-service';

describe('getBookSummary parser resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleMock,
    };

    fromMock.mockReturnValue({
      select: vi.fn(() => query),
      upsert: upsertMock,
    });

    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockResolvedValue({ error: null });
    loadPromptsMock.mockResolvedValue({ book_summary: { prompt: 'prompt' } });
    formatPromptMock.mockReturnValue('formatted prompt');
  });

  it('returns cached summary without calling Grok', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { summary_data: { title: 'Cached', summary: 'Already cached' } },
      error: null,
    });

    const result = await getBookSummary('Book', 'Author');

    expect(result).toEqual({ title: 'Cached', summary: 'Already cached' });
    expect(fetchWithRetryMock).not.toHaveBeenCalled();
  });

  it('normalizes alternate LLM field names into BookSummary shape', async () => {
    fetchWithRetryMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              book_title: 'Normalized Title',
              book_author: 'Normalized Author',
              overview: 'Overview summary text',
              cards_title: 'Concepts',
              cards: [{ title: 'Idea 1', description: 'Core concept' }],
              action_items: ['Try this action'],
              glossary: [{ name: 'Term', definition: 'Definition' }],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    const result = await getBookSummary('Fallback Title', 'Fallback Author');

    expect(result).not.toBeNull();
    expect(result?.summary).toBe('Overview summary text');
    expect(result?.title).toBe('Normalized Title');
    expect(result?.author).toBe('Normalized Author');
    expect(result?.cardsTitle).toBe('Concepts');
    expect(result?.cards[0]).toMatchObject({ name: 'Idea 1', desc: 'Core concept' });
    expect(result?.tasks[0]).toMatchObject({ text: 'Try this action' });
    expect(result?.glossary[0]).toMatchObject({ term: 'Term', def: 'Definition' });
    expect(upsertMock).toHaveBeenCalled();
  });

  it('repairs trailing comma JSON and still returns a summary', async () => {
    fetchWithRetryMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"title":"T","author":"A","summary":"S",}',
          },
        },
      ],
      usage: null,
    });

    const result = await getBookSummary('Book', 'Author');

    expect(result).not.toBeNull();
    expect(result?.summary).toBe('S');
  });

  it('returns null when no summary-like field exists', async () => {
    fetchWithRetryMock.mockResolvedValue({
      choices: [{ message: { content: '{"title":"Only Title"}' } }],
      usage: null,
    });

    const result = await getBookSummary('Book', 'Author');

    expect(result).toBeNull();
  });
});
