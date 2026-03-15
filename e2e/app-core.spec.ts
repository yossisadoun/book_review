import { test, expect } from '@playwright/test';

// Helper to sign in as guest and dismiss onboarding
async function signInAsGuest(page: any) {
  await page.goto('/');
  await page.waitForSelector('text=Start as guest', { timeout: 10000 });
  await page.click('text=Start as guest');
  // Wait for onboarding or main app
  await page.waitForTimeout(2000);
}

test.describe('Core app flows', () => {
  test('login screen renders with Google and guest options', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Start as guest')).toBeVisible();
  });

  test('guest login works and shows onboarding', async ({ page }) => {
    await signInAsGuest(page);
    // Should see onboarding welcome screen
    await expect(page.locator('text=WELCOME TO')).toBeVisible({ timeout: 10000 });
  });

  test('can dismiss onboarding and reach bookshelf', async ({ page }) => {
    await signInAsGuest(page);

    // Navigate to last onboarding page via dots
    const dots = page.locator('button.rounded-full.w-2\\.5');
    // Click through to last page and close
    await dots.nth(4).click();
    await page.waitForTimeout(500);

    // Look for the add book search or empty bookshelf state
    // The last page has a search input or the main app loads after onboarding
    await expect(page.locator('text=START BY ADDING')).toBeVisible({ timeout: 3000 });
  });
});
