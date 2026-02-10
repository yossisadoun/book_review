// Feature flags configuration
// Toggle features on/off for A/B testing or gradual rollouts

export const featureFlags = {
  // When true, use hand-drawn SVG icons. When false, use Lucide icons.
  hand_drawn_icons: false,
  // Info page variant: 'a' = animated icons, 'b' = rotating tooltips, 'c' = 3-page stepper
  info_page_variant: 'c' as 'a' | 'b' | 'c',

  // Insights feature flags - control which insight types are fetched/displayed
  // When false: not fetched, not shown in book page, not added to feed
  insights: {
    author_facts: false,      // Trivia facts about author
    book_influences: false,   // Literary influences
    book_domain: false,       // Domain/subject matter insights
    book_context: false,      // Historical/cultural context
    did_you_know: true,       // "Did you know?" insights (NEW - enabled by default)
  },

  // Book page section headers - when true, hide the header/menu for that section
  bookPageSectionHeaders: {
    insights: true,           // Hide insights header menu (INSIGHTS: / category dropdown)
    podcasts: true,           // Hide podcasts header
    youtube: true,            // Hide YouTube videos header
    articles: true,           // Hide articles header
    relatedBooks: true,       // Hide related books header
  },
} as const;

export type FeatureFlags = typeof featureFlags;
