import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for login screen to load
    await page.waitForSelector('text=Start as guest', { timeout: 10000 });
    // Sign in as guest
    await page.click('text=Start as guest');
    // Wait for the about/onboarding screen to appear
    await page.waitForSelector('text=WELCOME TO', { timeout: 10000 });
  });

  test('can swipe through all onboarding pages', async ({ page }) => {
    // Page 0: Welcome
    await expect(page.locator('text=WELCOME TO')).toBeVisible();

    // Swipe to page 1: Build Your Library
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.move(100, 400, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('text=BUILD YOUR')).toBeVisible({ timeout: 3000 });

    // Swipe to page 2: Get More From Reading
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.move(100, 400, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('text=GET MORE FROM READING')).toBeVisible({ timeout: 3000 });

    // Swipe to page 3: Choose What To See
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.move(100, 400, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('text=CHOOSE WHAT')).toBeVisible({ timeout: 3000 });

    // Swipe to page 4: Start By Adding Your Book
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.move(100, 400, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('text=START BY ADDING')).toBeVisible({ timeout: 3000 });
  });

  test('can toggle content preferences and proceed', async ({ page }) => {
    // Navigate to Choose What To See (page 3) via pagination dots
    const dots = page.locator('button.rounded-full.w-2\\.5');
    await dots.nth(3).click();
    await expect(page.locator('text=CHOOSE WHAT')).toBeVisible({ timeout: 3000 });

    // Verify toggle labels are visible
    await expect(page.locator('text=Book Facts')).toBeVisible();
    await expect(page.locator('text=Podcast Episodes')).toBeVisible();

    // Click Next to proceed
    await page.click('text=Next');
    await expect(page.locator('text=START BY ADDING')).toBeVisible({ timeout: 3000 });
  });
});
