# Platform Development Guide

## Overview

This guide explains how to add support for new e-commerce platforms to RetailAgent. The platform abstraction layer makes it straightforward to integrate new shopping sites.

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [Creating a New Platform](#creating-a-new-platform)
3. [Platform Implementation](#platform-implementation)
4. [Testing Your Platform](#testing-your-platform)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

## Platform Architecture

### How Platforms Work

```
┌─────────────────────────────────────────┐
│         Service Worker                  │
│  (Orchestrates shopping flow)          │
└──────────────┬──────────────────────────┘
               │
               │ Messages
               ▼
┌─────────────────────────────────────────┐
│      Content Script                      │
│  (Injected into platform website)      │
└──────────────┬──────────────────────────┘
               │
               │ Uses
               ▼
┌─────────────────────────────────────────┐
│    Platform Class                        │
│  (Implements EcommercePlatform)         │
└─────────────────────────────────────────┘
```

### Key Components

1. **Content Script**: Injected into platform website, handles DOM interaction
2. **Platform Class**: Extends `EcommercePlatform`, implements platform-specific logic
3. **Loader Script**: Dynamically imports platform module (required for ES6 modules)
4. **Shared Utilities**: Common DOM operations (`actions.js`, `selectors.js`)

## Creating a New Platform

### Step 1: Create Platform Class

Create `src/content/platforms/yourplatform-platform.js`:

```javascript
import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, clickBuyNow } from '../shared/actions.js';
import { logger } from '../../lib/logger.js';

export class YourPlatformPlatform extends EcommercePlatform {
    constructor() {
        super('yourplatform', {
            enabled: true,
            domains: ['yourplatform.com', 'www.yourplatform.com'],
            selectors: {
                search: {
                    input: '#search-input',
                    button: '#search-button',
                    form: 'form.search-form'
                },
                results: {
                    container: '.product-item',
                    title: '.product-title',
                    link: '.product-link',
                    price: '.product-price',
                    rating: '.product-rating',
                    image: '.product-image'
                },
                product: {
                    buyNow: '#buy-now-button',
                    addToCart: '#add-to-cart-button',
                    title: '#product-title',
                    price: '#product-price'
                },
                checkout: {
                    address: '#shipping-address',
                    continue: '#continue-button',
                    payment: '#payment-method',
                    placeOrder: '#place-order-button'
                }
            }
        });
    }

    // Implement required methods...
}
```

### Step 2: Create Content Script

Create `src/content/yourplatform.js`:

```javascript
import { YourPlatformPlatform } from './platforms/yourplatform-platform.js';
import { platformRegistry } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';

// Register platform
const platform = new YourPlatformPlatform();
platformRegistry.register(platform);

logger.info('YourPlatform platform loaded');

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case 'SEARCH':
                    await platform.search(message.query, message.filters);
                    sendResponse({ success: true });
                    break;
                
                case 'GET_RESULTS':
                    const products = await platform.getSearchResults();
                    sendResponse({ success: true, products });
                    break;
                
                case 'SELECT_PRODUCT':
                    await platform.selectProduct(message.index);
                    sendResponse({ success: true });
                    break;
                
                case 'BUY_NOW':
                    await platform.buyNow();
                    sendResponse({ success: true });
                    break;
                
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            logger.error('Message handler error', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    
    return true; // Keep message channel open for async response
});
```

### Step 3: Create Loader Script

Create `src/content/yourplatform-loader.js`:

```javascript
// Loader script for YourPlatform
// Uses dynamic import() to load ES6 module
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/yourplatform.js'));
    } catch (error) {
        console.error('Failed to load YourPlatform content script:', error);
    }
})();
```

### Step 4: Update Manifest

Add to `manifest.json`:

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.yourplatform.com/*"],
      "js": ["src/content/yourplatform-loader.js"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "https://www.yourplatform.com/*"
  ]
}
```

### Step 5: Register in Service Worker

Add platform registration in `src/background/service_worker.js`:

```javascript
class SWYourPlatformPlatform extends EcommercePlatform {
    constructor() {
        super('yourplatform', {
            enabled: true,
            domains: ['yourplatform.com']
        });
    }
}

// Register in service worker
platformRegistry.register(new SWYourPlatformPlatform());
```

## Platform Implementation

### Required Methods

Your platform class must implement these methods:

#### 1. `search(query, filters, sort)`

Perform search on the platform.

**Parameters**:
- `query` (string): Search query
- `filters` (object): Filter options
- `sort` (string): Sort option

**Returns**: `Promise<boolean>`

**Example**:
```javascript
async search(query, filters = {}, sort = null) {
    try {
        logger.info('YourPlatform: Performing search', { query, filters });
        
        // Fill search input
        const input = document.querySelector(this.selectors.search.input);
        if (!input) throw new Error('Search input not found');
        
        input.value = query;
        
        // Submit search
        const button = document.querySelector(this.selectors.search.button);
        if (button) {
            button.click();
        } else {
            input.form?.submit();
        }
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Apply filters if provided
        if (Object.keys(filters).length > 0) {
            await this.applyFilters(filters);
        }
        
        return true;
    } catch (error) {
        logger.error('YourPlatform: Search failed', error);
        throw error;
    }
}
```

#### 2. `getSearchResults()`

Extract products from search results page.

**Returns**: `Promise<Array<Product>>`

**Product Structure**:
```javascript
{
  title: string,
  price: string|number,
  rating?: number,
  link: string,
  image?: string,
  availability?: string,
  // ... platform-specific fields
}
```

**Example**:
```javascript
async getSearchResults() {
    try {
        logger.info('YourPlatform: Extracting products');
        
        const containers = document.querySelectorAll(
            this.selectors.results.container
        );
        
        const products = [];
        
        for (const container of containers) {
            try {
                const titleEl = container.querySelector(
                    this.selectors.results.title
                );
                const priceEl = container.querySelector(
                    this.selectors.results.price
                );
                const linkEl = container.querySelector(
                    this.selectors.results.link
                );
                
                if (!titleEl || !linkEl) continue;
                
                const product = {
                    title: titleEl.textContent.trim(),
                    price: this.parsePrice(priceEl?.textContent),
                    link: linkEl.href,
                    rating: this.parseRating(container),
                    image: container.querySelector(
                        this.selectors.results.image
                    )?.src
                };
                
                products.push(product);
            } catch (error) {
                logger.debug('Failed to extract product', error);
            }
        }
        
        logger.info(`YourPlatform: Found ${products.length} products`);
        return products;
    } catch (error) {
        logger.error('YourPlatform: Failed to extract products', error);
        throw error;
    }
}
```

#### 3. `applyFilters(filters)`

Apply filters to search results.

**Parameters**:
- `filters` (object): Filter options

**Returns**: `Promise<boolean>`

**Example**:
```javascript
async applyFilters(filters) {
    try {
        logger.info('YourPlatform: Applying filters', filters);
        
        // Price filter
        if (filters.price_max) {
            const priceFilter = document.querySelector(
                `[data-filter="price-max"][data-value="${filters.price_max}"]`
            );
            if (priceFilter) {
                priceFilter.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Brand filter
        if (filters.brand) {
            const brandFilter = document.querySelector(
                `[data-filter="brand"][data-value="${filters.brand}"]`
            );
            if (brandFilter) {
                brandFilter.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Wait for filters to apply
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return true;
    } catch (error) {
        logger.error('YourPlatform: Filter application failed', error);
        throw error;
    }
}
```

#### 4. `selectProduct(index)`

Navigate to product page.

**Parameters**:
- `index` (number): Product index (default: 0)

**Returns**: `Promise<boolean>`

**Example**:
```javascript
async selectProduct(index = 0) {
    try {
        const products = await this.getSearchResults();
        if (index >= products.length) {
            throw new Error(`Product index ${index} out of range`);
        }
        
        const product = products[index];
        window.location.href = product.link;
        
        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return true;
    } catch (error) {
        logger.error('YourPlatform: Product selection failed', error);
        throw error;
    }
}
```

#### 5. `buyNow()`

Click Buy Now button.

**Returns**: `Promise<boolean>`

**Example**:
```javascript
async buyNow() {
    try {
        const buyNowButton = document.querySelector(
            this.selectors.product.buyNow
        );
        
        if (!buyNowButton) {
            throw new Error('Buy Now button not found');
        }
        
        buyNowButton.click();
        
        // Wait for navigation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return true;
    } catch (error) {
        logger.error('YourPlatform: Buy Now failed', error);
        throw error;
    }
}
```

### Optional Methods

These methods are optional but recommended:

- `addToCart()` - Add product to cart
- `checkout(options)` - Handle checkout flow
- `sortResults(sortOption)` - Sort search results
- `getProductDetails()` - Get product details from product page
- `trackOrder(orderId)` - Track order status
- `initiateReturn(orderId, reason)` - Initiate return

### Helper Methods

Add platform-specific helper methods:

```javascript
parsePrice(priceText) {
    // Extract numeric price from text
    const match = priceText?.match(/[\d,]+\.?\d*/);
    if (!match) return null;
    return parseFloat(match[0].replace(/,/g, ''));
}

parseRating(container) {
    // Extract rating from container
    const ratingEl = container.querySelector('.rating');
    if (!ratingEl) return null;
    const match = ratingEl.textContent.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
}
```

## Testing Your Platform

### Manual Testing

1. **Load Extension**: Build and load extension in Chrome
2. **Navigate to Platform**: Go to your platform website
3. **Test Search**: Try searching for a product
4. **Test Filters**: Apply filters and verify they work
5. **Test Product Selection**: Select a product and verify navigation
6. **Test Buy Now**: Click Buy Now and verify checkout

### Automated Testing

Create test file `tests/integration/yourplatform.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { YourPlatformPlatform } from '../../src/content/platforms/yourplatform-platform.js';

describe('YourPlatform', () => {
    it('should match platform URLs', () => {
        const platform = new YourPlatformPlatform();
        expect(platform.matches('https://www.yourplatform.com/product')).toBe(true);
        expect(platform.matches('https://amazon.com')).toBe(false);
    });
    
    // Add more tests...
});
```

### Debugging

1. **Check Console**: Open DevTools on platform website
2. **Check Logs**: Use `logger` to log operations
3. **Verify Selectors**: Test selectors in console
4. **Check Messages**: Verify message passing works

## Best Practices

### 1. Selector Strategy

- **Use Multiple Selectors**: Provide fallback selectors
- **Data Attributes**: Prefer `data-*` attributes over classes
- **Wait for Elements**: Use `waitForCondition` before interacting

```javascript
selectors: {
    search: {
        input: [
            '#search-input',
            '[data-testid="search-input"]',
            'input[name="search"]'
        ]
    }
}
```

### 2. Error Handling

Always handle errors gracefully:

```javascript
try {
    await this.search(query);
} catch (error) {
    logger.error('Search failed', error);
    throw error; // Re-throw for service worker to handle
}
```

### 3. Waiting for Page Loads

Wait for elements before interacting:

```javascript
await waitForCondition(
    () => document.querySelector(this.selectors.results.container) !== null,
    { timeout: 10000 }
);
```

### 4. Filter Application

- **URL-based**: If platform supports URL filters, use them (most reliable)
- **DOM-based**: Click filter elements as fallback
- **LLM-based**: Use page analyzer for complex cases

### 5. Sponsored Products

Filter out sponsored products:

```javascript
import { isSponsoredProduct } from '../../lib/sponsored-detector.js';

// In getSearchResults()
for (const container of containers) {
    if (isSponsoredProduct(container, 'yourplatform')) {
        continue; // Skip sponsored
    }
    // Extract product...
}
```

### 6. Product Extraction

- **Extract All Fields**: Get title, price, rating, link, image
- **Handle Missing Data**: Use optional chaining (`?.`)
- **Normalize Data**: Convert prices to numbers, ratings to 0-5 scale

### 7. Performance

- **Lazy Loading**: Only load platform when needed
- **Caching**: Cache selectors and results when possible
- **Debouncing**: Debounce rapid filter changes

## Examples

### Complete Platform Example

See existing platforms for reference:
- `src/content/platforms/amazon-platform.js` - Complex platform with URL filters
- `src/content/platforms/flipkart-platform.js` - AJAX-based platform
- `src/content/platforms/ebay-platform.js` - Auction platform

### Simple Platform Template

```javascript
import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';

export class SimplePlatformPlatform extends EcommercePlatform {
    constructor() {
        super('simpleplatform', {
            enabled: true,
            domains: ['simpleplatform.com'],
            selectors: {
                search: {
                    input: '#search',
                    button: '#search-btn'
                },
                results: {
                    container: '.product',
                    title: '.title',
                    price: '.price',
                    link: 'a'
                },
                product: {
                    buyNow: '#buy-now'
                }
            }
        });
    }

    async search(query, filters = {}) {
        const input = document.querySelector(this.selectors.search.input);
        input.value = query;
        document.querySelector(this.selectors.search.button).click();
        await new Promise(r => setTimeout(r, 2000));
        return true;
    }

    async getSearchResults() {
        const containers = document.querySelectorAll(
            this.selectors.results.container
        );
        return Array.from(containers).map(container => ({
            title: container.querySelector(this.selectors.results.title)?.textContent,
            price: container.querySelector(this.selectors.results.price)?.textContent,
            link: container.querySelector(this.selectors.results.link)?.href
        }));
    }

    async selectProduct(index = 0) {
        const products = await this.getSearchResults();
        window.location.href = products[index].link;
        await new Promise(r => setTimeout(r, 3000));
        return true;
    }

    async buyNow() {
        document.querySelector(this.selectors.product.buyNow)?.click();
        await new Promise(r => setTimeout(r, 2000));
        return true;
    }
}
```

## Common Issues

### Issue: Content Script Not Loading

**Solution**: Check manifest.json matches array, verify loader script exists

### Issue: Selectors Not Working

**Solution**: Use multiple selectors, check DOM structure, wait for elements

### Issue: Filters Not Applying

**Solution**: Check if platform uses URL filters or DOM clicks, verify filter selectors

### Issue: Products Not Extracting

**Solution**: Verify container selector, check for dynamic loading, wait for page load

## Next Steps

1. **Implement Platform**: Follow steps above
2. **Test Thoroughly**: Test all methods
3. **Add Tests**: Write unit and integration tests
4. **Document**: Add platform-specific documentation
5. **Submit PR**: Create pull request with your platform

## Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)

---

**Last Updated**: January 2026  
**Version**: 1.0.0


