/**
 * Edge Function Deploy Safety Tests
 *
 * These tests ensure edge functions are deployed correctly and that
 * common deployment mistakes (like missing --no-verify-jwt) are caught.
 * Also tests that AbortError is silenced in search components.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const deployScriptPath = join(__dirname, '../scripts/deploy-functions.sh');
const addBookSheetSource = readFileSync(join(__dirname, '../app/components/AddBookSheet.tsx'), 'utf-8');

describe('Edge function deploy safety', () => {
  it('deploy script exists', () => {
    expect(existsSync(deployScriptPath)).toBe(true);
  });

  it('deploy script always uses --no-verify-jwt', () => {
    const script = readFileSync(deployScriptPath, 'utf-8');
    // Every `supabase functions deploy` call must include --no-verify-jwt
    const deployLines = script.split('\n').filter(line =>
      line.includes('functions deploy') && !line.startsWith('#')
    );
    expect(deployLines.length).toBeGreaterThan(0);
    for (const line of deployLines) {
      expect(line).toContain('--no-verify-jwt');
    }
  });

  it('deploy script is executable', () => {
    const { statSync } = require('fs');
    const stats = statSync(deployScriptPath);
    // Check owner execute bit
    expect(stats.mode & 0o100).toBeTruthy();
  });
});

describe('AddBookSheet AbortError handling', () => {
  it('searchUsers silences AbortError before console.error', () => {
    // The AbortError check must come BEFORE the console.error call
    const searchUsersMatch = addBookSheetSource.match(
      /async function searchUsers[\s\S]*?^  \}/m
    );
    expect(searchUsersMatch).toBeTruthy();
    const fn = searchUsersMatch![0];

    // Should check for AbortError in both the Supabase error handler and the catch block
    expect(fn).toMatch(/AbortError|aborted/);

    // The abort check should appear before console.error in the error block
    const errorBlock = fn.match(/if \(error\) \{[\s\S]*?\}/);
    expect(errorBlock).toBeTruthy();
    const abortIdx = errorBlock![0].indexOf('AbortError');
    const consoleIdx = errorBlock![0].indexOf('console.error');
    expect(abortIdx).toBeLessThan(consoleIdx);
  });

  it('searchBooksFromDB silences AbortError before console.error', () => {
    const searchBooksMatch = addBookSheetSource.match(
      /async function searchBooksFromDB[\s\S]*?^  \}/m
    );
    expect(searchBooksMatch).toBeTruthy();
    const fn = searchBooksMatch![0];

    expect(fn).toMatch(/AbortError|aborted/);

    const errorBlock = fn.match(/if \(error\) \{[\s\S]*?\}/);
    expect(errorBlock).toBeTruthy();
    const abortIdx = errorBlock![0].indexOf('AbortError');
    const consoleIdx = errorBlock![0].indexOf('console.error');
    expect(abortIdx).toBeLessThan(consoleIdx);
  });

  it('outer catch blocks also handle AbortError', () => {
    // Both functions should have catch blocks that check for AbortError
    const catchBlocks = addBookSheetSource.match(/catch \(err.*?\) \{[\s\S]*?console\.error\('Error searching/g);
    expect(catchBlocks).toBeTruthy();
    expect(catchBlocks!.length).toBeGreaterThanOrEqual(2);
    for (const block of catchBlocks!) {
      expect(block).toMatch(/AbortError|aborted/);
    }
  });
});
