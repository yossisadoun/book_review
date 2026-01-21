// Grok API usage logging utility

export interface GrokUsageLog {
  timestamp: string;
  function: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Grok pricing (per million tokens)
const GROK_INPUT_PRICE_PER_M = 0.2; // $0.20 per million input tokens
const GROK_OUTPUT_PRICE_PER_M = 0.5; // $0.50 per million output tokens

export function logGrokUsage(
  functionName: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  }
): void {
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    return;
  }

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || promptTokens + completionTokens;

  // Calculate cost
  const inputCost = (promptTokens / 1_000_000) * GROK_INPUT_PRICE_PER_M;
  const outputCost = (completionTokens / 1_000_000) * GROK_OUTPUT_PRICE_PER_M;
  const estimatedCost = inputCost + outputCost;

  const logEntry: GrokUsageLog = {
    timestamp: new Date().toISOString(),
    function: functionName,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost,
  };

  // Store in provided storage (or skip if not available)
  if (storage) {
    storage.getItem('grokUsageLogs').then((existingLogsStr) => {
      const existingLogs: GrokUsageLog[] = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      existingLogs.push(logEntry);
      // Keep only last 100 entries
      const recentLogs = existingLogs.slice(-100);
      storage.setItem('grokUsageLogs', JSON.stringify(recentLogs));
    }).catch((err) => {
      console.error('[logGrokUsage] Error saving to storage:', err);
    });
  }
}

export function getGrokUsageLogs(storage?: {
  getItem: (key: string) => Promise<string | null>;
}): Promise<GrokUsageLog[]> {
  if (!storage) {
    return Promise.resolve([]);
  }

  return storage.getItem('grokUsageLogs')
    .then((logs) => {
      return logs ? JSON.parse(logs) : [];
    })
    .catch((err) => {
      console.error('[getGrokUsageLogs] Error reading from storage:', err);
      return [];
    });
}
