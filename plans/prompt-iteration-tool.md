# Prompt Iteration Tool — Plan

## Context

Character chat prompts are currently hardcoded in the edge function (`supabase/functions/quick-processor/index.ts`, lines 266-404). Every change requires editing the edge function and redeploying. There's no way to compare prompt versions side-by-side or test regressions before going live.

**Goal:** A Supabase-backed prompt versioning system + a local test harness script that runs fixed conversations against any prompt version and prints results for comparison.

---

## Part 1: Supabase `chat_prompt_versions` Table

**Migration:** `migrations/add_chat_prompt_versions.sql`

```
chat_prompt_versions
├── id              uuid (PK, default gen_random_uuid())
├── name            text NOT NULL        -- e.g. "v3-shorter-replies", "v4-more-pushback"
├── prompt_type     text NOT NULL        -- 'character_chat' | 'book_chat' (extensible later)
├── template        text NOT NULL        -- the full system prompt template with {placeholders}
├── model           text DEFAULT 'grok-3-fast'  -- which model to use
├── temperature     float DEFAULT 0.8
├── notes           text                 -- free-form notes on what changed
├── is_active       boolean DEFAULT false -- only one active per prompt_type
├── created_at      timestamptz DEFAULT now()
```

- RLS: read access for authenticated users, write for service role only (or admin)
- Unique partial index: `WHERE is_active = true` per `prompt_type` (ensures only one active)
- Seed it with the current hardcoded prompt as `v1-baseline`

## Part 2: Edge Function Changes

**File:** `supabase/functions/quick-processor/index.ts`

- On character chat request, fetch the active prompt version from `chat_prompt_versions` where `is_active = true AND prompt_type = 'character_chat'`
- Cache in-memory per invocation (edge functions are short-lived, no stale cache risk)
- Use the template's `{placeholders}` and substitute with character context (same as current logic, just from DB instead of hardcode)
- Use the version's `model` and `temperature` fields
- Fallback: if no active version found, use the current hardcoded prompt (safety net)
- Add `prompt_version_id` to the response so the test harness can log which version produced what

## Part 3: Test Harness Script

**File:** `scripts/test-prompts.ts` (run with `npx tsx scripts/test-prompts.ts`)

**Test fixtures file:** `scripts/prompt-test-fixtures.json`

```json
{
  "characters": [
    {
      "name": "Jay Gatsby",
      "bookTitle": "The Great Gatsby",
      "bookAuthor": "F. Scott Fitzgerald",
      "context": {}
    }
  ],
  "scenarios": [
    {
      "name": "greeting",
      "mode": "greeting",
      "messages": []
    },
    {
      "name": "casual-question",
      "messages": [
        { "role": "user", "content": "What do you think about tonight's party?" }
      ]
    },
    {
      "name": "emotional-topic",
      "messages": [
        { "role": "user", "content": "Do you ever feel lonely?" }
      ]
    },
    {
      "name": "pushback",
      "messages": [
        { "role": "user", "content": "I think you're fooling yourself about Daisy." }
      ]
    },
    {
      "name": "off-topic",
      "messages": [
        { "role": "user", "content": "What's your opinion on social media?" }
      ]
    }
  ]
}
```

**Script behavior:**
1. Accept args: `--version <name>` (or `--active` for current active, or `--compare v1,v2` for side-by-side)
2. Fetch the prompt version(s) from Supabase
3. For each character x scenario combination:
   - Build the system prompt from template + character context
   - Call Grok API directly (same endpoint as edge function)
   - Collect response + token usage
4. Output modes:
   - **Single version:** Print each scenario response in a readable format
   - **Compare mode:** Print two versions side-by-side for each scenario
5. Save results to `scripts/prompt-test-results/` with timestamp + version name

**Dependencies:** `@supabase/supabase-js` (already installed), `tsx` for running TS scripts

---

## Workflow for Iterating on a Prompt

1. In Supabase dashboard (or via script), duplicate the active version with a new name
2. Edit the template in the new row
3. Run `npx tsx scripts/test-prompts.ts --compare v1-baseline,v2-shorter`
4. Review side-by-side output
5. When happy, set `is_active = true` on the new version (automatically deactivates old via trigger or script)
6. No edge function redeployment needed

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `migrations/add_chat_prompt_versions.sql` | Create — table + RLS + seed |
| `supabase/functions/quick-processor/index.ts` | Modify — fetch active prompt from DB |
| `scripts/test-prompts.ts` | Create — test harness |
| `scripts/prompt-test-fixtures.json` | Create — test scenarios |
| `scripts/prompt-test-results/` | Created by script at runtime |

## Verification

1. Run migration in Supabase SQL editor
2. Verify baseline prompt is seeded and marked active
3. Run `npx tsx scripts/test-prompts.ts --active` — should produce readable output for all scenarios
4. Create a v2 with a small tweak, run `--compare v1-baseline,v2-tweak`
5. Test live in the app — character chat should use the active DB prompt instead of hardcoded
