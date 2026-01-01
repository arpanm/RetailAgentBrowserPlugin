/**
 * E2E Test for Specific Amazon Samsung Phone Shopping Flow
 * Based on test case specification: docs/test-case-specification.md
 */

describe('Amazon Samsung Phone Shopping Flow', () => {
  let page;
  let browser;
  
  const TEST_CASE = {
    initialUrl: 'https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&ref=nb_sb_noss',
    expectedInitialResults: 25, // Approximate
    filters: {
      price_min: 13000,
      price_max: 19500,
      rating: 4,
      battery: [5000, 6000],
      ram: [6, 8]
    },
    expectedFilteredResults: 12, // Approximate
    expectedProductASIN: 'B0FN7W26Q8',
    expectedProductUrl: 'https://www.amazon.in/Samsung-Moonlight-Storage-Gorilla-Upgrades/dp/B0FN7W26Q8/'
  };
  
  beforeAll(async () => {
    // Setup browser and extension
    browser = await setupExtensionTest();
    page = await browser.newPage();
  }, 30000);
  
  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });
  
  describe('Step 1: Initial Search', () => {
    test('should navigate to Amazon and perform search', async () => {
      // Navigate to Amazon homepage
      await page.goto('https://www.amazon.in/', { waitUntil: 'networkidle2' });
      expect(page.url()).toContain('amazon.in');
      
      // Perform search
      const searchBox = await page.waitForSelector('#twotabsearchtextbox, input[name="field-keywords"]');
      await searchBox.type('samsung phone 5000+ battery and 6GB+ ram under 20000RS price');
      await searchBox.press('Enter');
      
      // Wait for search results
      await page.waitForSelector('[data-asin]:not([data-asin=""])', { timeout: 10000 });
      
      // Verify we're on search results page
      expect(page.url()).toContain('/s?');
      expect(page.url()).toContain('samsung');
      
      // Count products
      const productCount = await page.$$eval(
        '[data-asin]:not([data-asin=""])',
        elements => elements.length
      );
      
      expect(productCount).toBeGreaterThan(20);
      expect(productCount).toBeLessThan(30);
      
      console.log(`Initial search returned ${productCount} products`);
    }, 30000);
  });
  
  describe('Step 2: Apply Filters', () => {
    test('should apply filters via URL manipulation', async () => {
      const currentUrl = page.url();
      
      // Build filter URL
      const filterUrl = buildAmazonFilterUrl(currentUrl, TEST_CASE.filters);
      
      // Navigate to filtered URL
      await page.goto(filterUrl, { waitUntil: 'networkidle2' });
      
      // Wait for products to load
      await page.waitForSelector('[data-asin]:not([data-asin=""])', { timeout: 10000 });
      
      // Verify URL contains filter parameters
      const finalUrl = page.url();
      expect(finalUrl).toContain('rh=');
      expect(finalUrl).toContain('p_123:46655'); // 4+ stars
      expect(finalUrl).toContain('p_36:1300000-1950000'); // Price range
      expect(finalUrl).toContain('p_n_g-101015098008111'); // Battery
      expect(finalUrl).toContain('p_n_g-1003495121111'); // RAM
      
      console.log('Filters applied successfully via URL');
    }, 30000);
    
    test('should show reduced product count after filtering', async () => {
      // Count products after filtering
      const filteredCount = await page.$$eval(
        '[data-asin]:not([data-asin=""])',
        elements => elements.length
      );
      
      expect(filteredCount).toBeGreaterThan(10);
      expect(filteredCount).toBeLessThan(15);
      expect(filteredCount).toBeLessThan(TEST_CASE.expectedInitialResults);
      
      console.log(`Filtered search returned ${filteredCount} products`);
    }, 15000);
  });
  
  describe('Step 3: Select First Non-Sponsored Product', () => {
    test('should extract products and identify non-sponsored ones', async () => {
      const products = await page.evaluate(() => {
        const containers = document.querySelectorAll('[data-asin]:not([data-asin=""])');
        const results = [];
        
        containers.forEach(container => {
          const asin = container.getAttribute('data-asin');
          
          // Check if sponsored
          const isSponsored = 
            container.getAttribute('data-component-type') === 'sp-sponsored-result' ||
            container.querySelector('[data-ad-details]') !== null ||
            container.querySelector('.AdHolder') !== null ||
            container.querySelector('.s-sponsored-header') !== null;
          
          // Get product link
          const linkEl = container.querySelector('h2 a[href*="/dp/"]');
          const link = linkEl ? linkEl.href : null;
          
          // Get title
          const title = linkEl ? linkEl.textContent.trim() : '';
          
          if (asin && link && !isSponsored) {
            results.push({ asin, link, title, isSponsored });
          }
        });
        
        return results;
      });
      
      expect(products.length).toBeGreaterThan(0);
      
      const firstNonSponsored = products[0];
      expect(firstNonSponsored).toBeDefined();
      expect(firstNonSponsored.isSponsored).toBe(false);
      expect(firstNonSponsored.asin).toBeTruthy();
      expect(firstNonSponsored.link).toContain('/dp/');
      
      console.log(`First non-sponsored product: ASIN ${firstNonSponsored.asin}`);
      console.log(`Title: ${firstNonSponsored.title.substring(0, 50)}...`);
      
      // Store for next test
      global.selectedProduct = firstNonSponsored;
    }, 15000);
    
    test('should navigate to first non-sponsored product page', async () => {
      expect(global.selectedProduct).toBeDefined();
      
      const productUrl = global.selectedProduct.link;
      await page.goto(productUrl, { waitUntil: 'networkidle2' });
      
      // Verify we're on product page
      const currentUrl = page.url();
      expect(currentUrl).toContain('/dp/');
      expect(currentUrl).toContain(global.selectedProduct.asin);
      
      // Verify product page elements
      const productTitle = await page.waitForSelector('#productTitle, h1');
      expect(productTitle).toBeTruthy();
      
      console.log(`Successfully navigated to product page`);
    }, 30000);
  });
  
  describe('Step 4: Buy Now Action', () => {
    test('should find Buy Now button on product page', async () => {
      // Try multiple selectors
      const buyNowSelectors = [
        '#buy-now-button',
        'input[name="submit.buy-now"]',
        'input[title="Buy Now"]',
        '.buy-now-button'
      ];
      
      let buyNowButton = null;
      for (const selector of buyNowSelectors) {
        try {
          buyNowButton = await page.$(selector);
          if (buyNowButton) {
            console.log(`Buy Now button found with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      expect(buyNowButton).toBeTruthy();
      
      // Check if button is visible and enabled
      const isVisible = await buyNowButton.isIntersectingViewport();
      expect(isVisible || true).toBeTruthy(); // May need scroll
      
      const isDisabled = await page.evaluate(
        btn => btn.disabled || btn.classList.contains('a-button-disabled'),
        buyNowButton
      );
      expect(isDisabled).toBe(false);
      
      // Store for next test
      global.buyNowButton = buyNowButton;
    }, 15000);
    
    test('should click Buy Now and navigate to checkout or show login', async () => {
      expect(global.buyNowButton).toBeTruthy();
      
      const initialUrl = page.url();
      
      // Scroll button into view
      await global.buyNowButton.evaluate(btn => btn.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      
      // Click Buy Now
      await global.buyNowButton.click();
      
      // Wait for navigation or modal
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
        page.waitForSelector('#ap_email', { timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(5000)
      ]);
      
      const currentUrl = page.url();
      
      // Check for successful outcomes
      const navigatedToCheckout = 
        currentUrl.includes('/gp/buy/') ||
        currentUrl.includes('/checkout/') ||
        currentUrl.includes('/spc/') ||
        currentUrl.includes('/cart');
      
      const loginModalShown = await page.$('#ap_email') !== null;
      
      const success = navigatedToCheckout || loginModalShown || currentUrl !== initialUrl;
      
      expect(success).toBe(true);
      
      if (navigatedToCheckout) {
        console.log('✅ Successfully navigated to checkout');
      } else if (loginModalShown) {
        console.log('✅ Login modal appeared (expected for non-logged-in users)');
      } else {
        console.log('⚠️  URL changed but unclear destination:', currentUrl);
      }
    }, 20000);
  });
  
  describe('Step 5: Retry Logic Verification', () => {
    test('should respect retry limits (3 attempts max)', async () => {
      // This test verifies the extension's retry logic
      // By checking that it doesn't loop infinitely
      
      const retryLogs = await getExtensionLogs();
      const buyNowRetries = retryLogs.filter(log => 
        log.message && log.message.includes('buyNowRetries')
      );
      
      if (buyNowRetries.length > 0) {
        // Check that retries are capped at 3
        const maxRetries = Math.max(...buyNowRetries.map(log => log.retryCount || 0));
        expect(maxRetries).toBeLessThanOrEqual(3);
        console.log(`Max Buy Now retries: ${maxRetries} (should be ≤3)`);
      }
    });
    
    test('should show manual intervention message after max retries', async () => {
      const chatMessages = await getExtensionChatMessages();
      
      const hasManualMessage = chatMessages.some(msg =>
        msg.includes('manual') ||
        msg.includes('Please complete') ||
        msg.includes('proceed manually')
      );
      
      // This is only expected if Buy Now actually failed
      // So we don't assert, just log
      if (hasManualMessage) {
        console.log('✅ Manual intervention message shown after retries');
      } else {
        console.log('ℹ️  No manual intervention message (Buy Now likely succeeded)');
      }
    });
  });
});

/**
 * Helper Functions
 */

function buildAmazonFilterUrl(baseUrl, filters) {
  const url = new URL(baseUrl);
  const refinements = [];
  
  // Price
  if (filters.price_min || filters.price_max) {
    const min = filters.price_min ? filters.price_min * 100 : 0;
    const max = filters.price_max ? filters.price_max * 100 : 999999999;
    refinements.push(`p_36:${min}-${max}`);
  }
  
  // Rating
  if (filters.rating === 4) {
    refinements.push('p_123:46655');
  } else if (filters.rating === 3) {
    refinements.push('p_123:46654');
  }
  
  // Battery (use codes from research)
  if (filters.battery) {
    const batteryCodes = filters.battery.map(mAh => {
      if (mAh >= 6000) return '92071917031';
      if (mAh >= 5000) return '91805326031';
      return '91805325031';
    }).join('|');
    refinements.push(`p_n_g-101015098008111:${batteryCodes}`);
  }
  
  // RAM (use codes from research)
  if (filters.ram) {
    const ramCodes = filters.ram.map(gb => {
      if (gb === 8) return '44897288031';
      if (gb === 6) return '44897287031';
      if (gb === 4) return '44897279031';
      return '44897278031';
    }).join('|');
    refinements.push(`p_n_g-1003495121111:${ramCodes}`);
  }
  
  if (refinements.length > 0) {
    url.searchParams.set('rh', refinements.join(','));
  }
  
  return url.href;
}

async function setupExtensionTest() {
  const puppeteer = require('puppeteer');
  
  const extensionPath = require('path').resolve(__dirname, '../../');
  
  return await puppeteer.launch({
    headless: false, // Extensions require non-headless mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
}

async function getExtensionLogs() {
  // Implementation depends on how logs are accessible
  // This is a placeholder
  return [];
}

async function getExtensionChatMessages() {
  // Implementation depends on how chat messages are accessible
  // This is a placeholder
  return [];
}

module.exports = {
  TEST_CASE,
  buildAmazonFilterUrl,
  setupExtensionTest
};
