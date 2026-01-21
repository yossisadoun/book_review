export interface PromptsConfig {
    book_suggestions: {
        prompt: string;
    };
    book_search: {
        prompt: string;
    };
    author_facts: {
        prompt: string;
    };
    book_influences: {
        prompt: string;
    };
    book_domain: {
        prompt: string;
    };
    book_context: {
        prompt: string;
    };
    podcast_episodes: {
        prompt: string;
    };
    related_books: {
        prompt: string;
    };
    book_research: {
        prompt: string;
    };
    trivia_questions: {
        prompt: string;
    };
}
export declare function loadPrompts(forceReload?: boolean): Promise<PromptsConfig>;
export declare function formatPrompt(template: string, variables: Record<string, string>): string;
