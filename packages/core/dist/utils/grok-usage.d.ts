export interface GrokUsageLog {
    timestamp: string;
    function: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
}
export declare function logGrokUsage(functionName: string, usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
} | undefined, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): void;
export declare function getGrokUsageLogs(storage?: {
    getItem: (key: string) => Promise<string | null>;
}): Promise<GrokUsageLog[]>;
