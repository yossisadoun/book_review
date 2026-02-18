'use client';

import React from 'react';
import InsightsCards, { InsightItem } from './InsightsCards';

// Keep AuthorFactsTooltips for backward compatibility (deprecated - use InsightsCards)
interface AuthorFactsTooltipsProps {
  facts: string[];
  bookId: string;
  isLoading?: boolean;
}

function AuthorFactsTooltips({ facts, bookId, isLoading = false }: AuthorFactsTooltipsProps) {
  const insights: InsightItem[] = facts.map(fact => ({ text: fact, label: 'Trivia' }));
  return <InsightsCards insights={insights} bookId={bookId} isLoading={isLoading} />;
}

export default AuthorFactsTooltips;
