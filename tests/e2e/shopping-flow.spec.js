/**
 * E2E tests for Shopping Flow using Playwright
 * 
 * Note: These tests require headful mode and the built extension in the dist/ directory.
 * Run with: npx playwright test
 */

import { test as base, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension testing setup
const pathToExtension = path.resolve(__dirname, '../../dist');

export const test = base.extend({
  context: async ({ }, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extension testing requires headful mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent('serviceworker');

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

test.describe('Shopping Flow', () => {
    test('should open side panel and process query', async ({ page, extensionId }) => {
        // 1. Navigate to a test page
        await page.goto('https://www.google.com');

        // 2. Open extension side panel (if possible via URL)
        // Usually: chrome-extension://<id>/src/popup/index.html
        const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
        await page.goto(popupUrl);

        // 3. Enter shopping query
        const promptInput = page.locator('#prompt-input');
        await expect(promptInput).toBeVisible();
        await promptInput.fill('buy samsung phone under 20000');
        
        const sendButton = page.locator('#send-button');
        await sendButton.click();

        // 4. Verify status updates
        const statusMessages = page.locator('.message.bot');
        await expect(statusMessages.first()).toContainText('Analyzing');

        // 5. Verify a new tab is created for Amazon/Flipkart
        // In Playwright, we can wait for a new page
        // const newPagePromise = page.context().waitForEvent('page');
        // const newPage = await newPagePromise;
        // await expect(newPage).toHaveURL(/amazon\.in|flipkart\.com/);
    });

    test('should show error when API key is missing', async ({ page, extensionId }) => {
        const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
        await page.goto(popupUrl);

        const promptInput = page.locator('#prompt-input');
        await promptInput.fill('buy iphone');
        await page.locator('#send-button').click();

        // Should see error if key not set
        const errorMsg = page.locator('.message.error, .message.bot:has-text("error")');
        // This depends on the actual UI implementation
        await expect(page.locator('body')).toContainText(/API key|configure/i);
    });
});
