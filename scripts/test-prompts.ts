/**
 * Prompt testing harness — run prompt versions against fixed conversations.
 *
 * Usage:
 *   npx tsx scripts/test-prompts.ts --active
 *   npx tsx scripts/test-prompts.ts --version v2-concise
 *   npx tsx scripts/test-prompts.ts --compare v1-baseline,v2-concise
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

dotenv.config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GROK_API_KEY = process.env.NEXT_PUBLIC_GROK_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}
if (!GROK_API_KEY) {
  console.error('Missing NEXT_PUBLIC_GROK_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Character {
  name: string;
  bookTitle: string;
  bookAuthor: string;
  context: Record<string, string>;
}

interface Scenario {
  name: string;
  mode?: string;
  messages: { role: string; content: string }[];
}

interface Fixtures {
  characters: Character[];
  scenarios: Scenario[];
}

interface PromptVersion {
  id: string;
  name: string;
  system_prompt_template: string;
  greeting_user_message_template?: string;
  model?: string;
  temperature?: number;
  is_active: boolean;
}

interface TestResult {
  character: string;
  scenario: string;
  version: string;
  response: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { mode: 'active' | 'version' | 'compare'; versions: string[] } {
  const args = process.argv.slice(2);

  if (args.includes('--active')) {
    return { mode: 'active', versions: [] };
  }

  const vIdx = args.indexOf('--version');
  if (vIdx !== -1 && args[vIdx + 1]) {
    return { mode: 'version', versions: [args[vIdx + 1]] };
  }

  const cIdx = args.indexOf('--compare');
  if (cIdx !== -1 && args[cIdx + 1]) {
    return { mode: 'compare', versions: args[cIdx + 1].split(',') };
  }

  console.error(
    'Usage:\n' +
      '  npx tsx scripts/test-prompts.ts --active\n' +
      '  npx tsx scripts/test-prompts.ts --version <name>\n' +
      '  npx tsx scripts/test-prompts.ts --compare <v1>,<v2>'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch prompt versions from Supabase
// ---------------------------------------------------------------------------

async function fetchVersion(name: string): Promise<PromptVersion> {
  const { data, error } = await supabase
    .from('chat_prompt_versions')
    .select('*')
    .eq('name', name)
    .single();

  if (error || !data) {
    console.error(`Could not fetch prompt version "${name}":`, error?.message);
    process.exit(1);
  }
  return data as PromptVersion;
}

async function fetchActiveVersion(): Promise<PromptVersion> {
  const { data, error } = await supabase
    .from('chat_prompt_versions')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('Could not fetch active prompt version:', error?.message);
    process.exit(1);
  }
  return data as PromptVersion;
}

// ---------------------------------------------------------------------------
// Placeholder substitution (mirrors edge-function logic)
// ---------------------------------------------------------------------------

function buildBulletList(ctx: Record<string, string>, ...prefixes: string[]): string {
  const items: string[] = [];
  for (const prefix of prefixes) {
    for (let i = 1; i <= 10; i++) {
      const val = ctx[`${prefix}_${i}`] || ctx[`${prefix}${i}`];
      if (val) items.push(`- ${val}`);
    }
    // Also check the un-numbered key itself
    if (ctx[prefix]) items.push(`- ${ctx[prefix]}`);
  }
  return items.join('\n');
}

function buildQuotedList(ctx: Record<string, string>, prefix: string, max: number): string {
  const items: string[] = [];
  for (let i = 1; i <= max; i++) {
    const val = ctx[`${prefix}_${i}`];
    if (val) items.push(`"${val}"`);
  }
  return items.join('\n');
}

function substituteTemplate(
  template: string,
  char: Character
): string {
  const ctx = char.context;

  const verifiedEvents = buildBulletList(ctx, 'VERIFIED_EVENT', 'KEY_EVENT');

  const knowledgeAreas = [
    ctx.WORLD_KNOWLEDGE,
    ctx.CULTURAL_KNOWLEDGE,
    ctx.SKILLS_AND_ABILITIES,
    ctx.SPECIAL_KNOWLEDGE,
    ...[1, 2, 3, 4].map((i) => ctx[`WORLD_ELEMENT_${i}`]).filter(Boolean),
  ]
    .filter(Boolean)
    .map((k) => `- ${k}`)
    .join('\n');

  const traits = buildBulletList(ctx, 'PERSONALITY_TRAIT');

  const recurringThemes = [1, 2, 3]
    .map((i) => ctx[`RECURRING_THEME_${i}`])
    .filter(Boolean);
  const recurringThemesStr =
    recurringThemes.length > 0
      ? `Themes ${char.name} often thinks about:\n` +
        recurringThemes.map((t) => `- ${t}`).join('\n')
      : '';

  const commonRefs = buildBulletList(ctx, 'COMMON_REFERENCE');

  const relationships = [
    ...buildBulletList(ctx, 'RELATIONSHIP').split('\n'),
    ...buildBulletList(ctx, 'CHARACTER_REFERENCE').split('\n'),
  ]
    .filter((l) => l.trim())
    .join('\n');

  const sourceQuotes = buildQuotedList(ctx, 'SOURCE_QUOTE', 3);
  const sourceQuotesStr = sourceQuotes
    ? `Authentic voice samples:\n${sourceQuotes}`
    : '';

  const dialogueAnchors = buildQuotedList(ctx, 'DIALOGUE_ANCHOR', 5);

  const knowledgeBoundaries = ctx.KNOWLEDGE_BOUNDARIES
    ? `What you know: ${ctx.KNOWLEDGE_BOUNDARIES}`
    : '';

  const doesNotKnow = ctx.DOES_NOT_KNOW
    ? `What you do NOT know: ${ctx.DOES_NOT_KNOW}`
    : 'What you do NOT know: Events beyond your point in the story.';

  const uncertainties = ctx.UNCERTAINTIES
    ? `Ambiguities: ${ctx.UNCERTAINTIES}`
    : '';

  const voiceDescription = ctx.VOICE_DESCRIPTION
    ? `Voice: ${ctx.VOICE_DESCRIPTION}`
    : '';

  const replacements: Record<string, string> = {
    '{charName}': char.name,
    '{bookTitle}': char.bookTitle,
    '{bookAuthor}': char.bookAuthor,
    '{timelinePosition}': ctx.TIMELINE_POSITION || ctx.POINT_IN_STORY_TIMELINE || '',
    '{bookSummary}': ctx.BOOK_SUMMARY || '',
    '{bookSetting}': ctx.BOOK_SETTING || '',
    '{characterRole}': ctx.CHARACTER_ROLE || '',
    '{characterBackground}': ctx.CHARACTER_BACKGROUND || '',
    '{verifiedEvents}': verifiedEvents,
    '{knowledgeAreas}': knowledgeAreas,
    '{knowledgeBoundaries}': knowledgeBoundaries,
    '{doesNotKnow}': doesNotKnow,
    '{uncertainties}': uncertainties,
    '{traits}': traits,
    '{emotionalTendencies}': ctx.EMOTIONAL_TENDENCIES || '',
    '{recurringThemes}': recurringThemesStr,
    '{commonRefs}': commonRefs,
    '{relationships}': relationships,
    '{voiceDescription}': voiceDescription,
    '{sourceQuotes}': sourceQuotesStr,
    '{dialogueAnchors}': dialogueAnchors,
    '{maxWords}': ctx.MAX_WORDS_PER_MESSAGE || '90',
    '{roleplayConstraints}':
      ctx.ROLEPLAY_CONSTRAINTS ||
      'Stay in character at all times. Do not reference events outside your knowledge.',
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Grok API call
// ---------------------------------------------------------------------------

async function callGrok(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model: string,
  temperature: number
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: apiMessages,
      temperature: temperature ?? 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return {
    content: json.choices?.[0]?.message?.content || '',
    usage: json.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ---------------------------------------------------------------------------
// Run tests for one version
// ---------------------------------------------------------------------------

async function runVersion(
  version: PromptVersion,
  fixtures: Fixtures
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const char of fixtures.characters) {
    const systemPrompt = substituteTemplate(version.system_prompt_template, char);

    for (const scenario of fixtures.scenarios) {
      const label = `[${version.name}] ${char.name} / ${scenario.name}`;
      process.stdout.write(`  Running ${label}...`);

      let messages: { role: string; content: string }[];

      if (scenario.mode === 'greeting') {
        // Build greeting user message
        const greetingTemplate =
          version.greeting_user_message_template ||
          `Generate a short, in-character greeting from ${char.name}. Keep it under {maxWords} words.`;
        const greetingMsg = substituteTemplate(greetingTemplate, char);
        messages = [{ role: 'user', content: greetingMsg }];
      } else {
        messages = scenario.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }

      try {
        const { content, usage } = await callGrok(
          systemPrompt,
          messages,
          version.model || 'grok-3-mini',
          version.temperature ?? 0.8
        );

        results.push({
          character: char.name,
          scenario: scenario.name,
          version: version.name,
          response: content,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        });

        console.log(` done (${usage.total_tokens} tokens)`);
      } catch (err: any) {
        console.log(` ERROR: ${err.message}`);
        results.push({
          character: char.name,
          scenario: scenario.name,
          version: version.name,
          response: `ERROR: ${err.message}`,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResults(results: TestResult[]) {
  const separator = '─'.repeat(70);

  for (const r of results) {
    console.log(separator);
    console.log(`Character: ${r.character}`);
    console.log(`Scenario:  ${r.scenario}`);
    console.log(`Version:   ${r.version}`);
    console.log(`Tokens:    ${r.promptTokens} prompt / ${r.completionTokens} completion / ${r.totalTokens} total`);
    console.log();
    console.log(r.response);
    console.log();
  }
}

function printComparison(resultsA: TestResult[], resultsB: TestResult[]) {
  const separator = '─'.repeat(70);
  const doubleSep = '═'.repeat(70);

  for (let i = 0; i < resultsA.length; i++) {
    const a = resultsA[i];
    const b = resultsB[i];

    console.log(doubleSep);
    console.log(`Character: ${a.character}  |  Scenario: ${a.scenario}`);
    console.log(doubleSep);

    console.log(`\n>>> ${a.version} (${a.totalTokens} tokens):`);
    console.log(a.response);

    console.log(`\n>>> ${b.version} (${b.totalTokens} tokens):`);
    console.log(b.response);

    console.log();
  }
}

function saveResults(results: TestResult[], versionName: string) {
  const dir = join(process.cwd(), 'scripts', 'prompt-test-results');
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}-${versionName}.json`;
  const filepath = join(dir, filename);

  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${filepath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { mode, versions: versionNames } = parseArgs();

  // Load fixtures
  const fixturesPath = join(process.cwd(), 'scripts', 'prompt-test-fixtures.json');
  const fixtures: Fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

  console.log(
    `Loaded ${fixtures.characters.length} character(s) and ${fixtures.scenarios.length} scenario(s)\n`
  );

  if (mode === 'active') {
    const version = await fetchActiveVersion();
    console.log(`Testing active version: "${version.name}"\n`);

    const results = await runVersion(version, fixtures);
    console.log();
    printResults(results);
    saveResults(results, version.name);
  } else if (mode === 'version') {
    const version = await fetchVersion(versionNames[0]);
    console.log(`Testing version: "${version.name}"\n`);

    const results = await runVersion(version, fixtures);
    console.log();
    printResults(results);
    saveResults(results, version.name);
  } else if (mode === 'compare') {
    if (versionNames.length !== 2) {
      console.error('--compare requires exactly two version names separated by comma');
      process.exit(1);
    }

    const [v1, v2] = await Promise.all([
      fetchVersion(versionNames[0]),
      fetchVersion(versionNames[1]),
    ]);

    console.log(`Comparing "${v1.name}" vs "${v2.name}"\n`);

    const resultsA = await runVersion(v1, fixtures);
    const resultsB = await runVersion(v2, fixtures);

    console.log();
    printComparison(resultsA, resultsB);

    // Save both
    const combined = [...resultsA, ...resultsB];
    saveResults(combined, `compare-${v1.name}-vs-${v2.name}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
