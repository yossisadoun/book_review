/**
 * Schema-aware test for the delete-account edge function.
 *
 * Verifies that every table+column referenced in the function actually
 * exists in the migration files. Would have caught:
 * - Wrong table names (podcast_cache vs podcast_episodes_cache)
 * - Non-existent columns (user_id on shared cache tables)
 * - Missing tables (proactive_messages vs proactive_message_log)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const fnSource = readFileSync(
  join(__dirname, '../supabase/functions/delete-account/index.ts'),
  'utf-8'
);

// Read all migration SQL files into one string
const migrationsDir = join(__dirname, '../migrations');
const allMigrationsSql = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(migrationsDir, f), 'utf-8'))
  .join('\n');

// Extract { table, column } pairs from the edge function source
function extractTableColumns(source: string): Array<{ table: string; column: string }> {
  const results: Array<{ table: string; column: string }> = [];
  const regex = /\{\s*table:\s*'([^']+)',\s*column:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    results.push({ table: match[1], column: match[2] });
  }
  return results;
}

const tableColumns = extractTableColumns(fnSource);

// Tables created before migration files existed (initial Supabase setup).
// These are known-good and won't appear in /migrations/*.sql.
const preMigrationTables: Record<string, string[]> = {
  books: ['id', 'user_id', 'title', 'author'],
  follows: ['id', 'follower_id', 'following_id'],
  users: ['id', 'email', 'full_name', 'avatar_url', 'is_public'],
};

describe('delete-account edge function schema', () => {
  it('references at least one table', () => {
    expect(tableColumns.length).toBeGreaterThan(0);
  });

  // Deduplicate tables (follows appears twice with different columns)
  const uniqueTables = [...new Set(tableColumns.map(tc => tc.table))];

  for (const table of uniqueTables) {
    it(`table "${table}" exists in migrations`, () => {
      // Match CREATE TABLE or ALTER TABLE or INSERT INTO for this table name
      if (table in preMigrationTables) return; // known pre-migration table
      const tablePattern = new RegExp(
        `(create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${table}\\b)` +
        `|(alter\\s+table\\s+(public\\.)?${table}\\b)` +
        `|(insert\\s+into\\s+(public\\.)?${table}\\b)`,
        'i'
      );
      expect(
        tablePattern.test(allMigrationsSql),
        `Table "${table}" not found in any migration file`
      ).toBe(true);
    });
  }

  for (const { table, column } of tableColumns) {
    it(`column "${table}.${column}" exists in migrations`, () => {
      // Find the CREATE TABLE block for this table and check the column exists
      // Also check ALTER TABLE ... ADD COLUMN
      const columnInCreate = new RegExp(
        `create\\s+table[^;]*?${table}\\s*\\([^;]*?\\b${column}\\b[^;]*?\\)`,
        'is'
      );
      const columnInAlter = new RegExp(
        `alter\\s+table\\s+(public\\.)?${table}\\s+add\\s+(column\\s+)?${column}\\b`,
        'i'
      );
      // Check pre-migration tables
      const preMigration = preMigrationTables[table];
      if (preMigration) {
        expect(
          preMigration.includes(column),
          `Column "${column}" not in known pre-migration table "${table}" (known: ${preMigration.join(', ')})`
        ).toBe(true);
        return;
      }

      // Special case: "id" column is implicit in most tables
      const isIdColumn = column === 'id';

      expect(
        columnInCreate.test(allMigrationsSql) ||
        columnInAlter.test(allMigrationsSql) ||
        isIdColumn,
        `Column "${column}" not found in CREATE/ALTER TABLE "${table}" in migrations`
      ).toBe(true);
    });
  }
});
