# RetailAgent Features Documentation

## Overview

This document describes the key features and implementation details of RetailAgent, including fixes, optimizations, and research findings.

## Table of Contents

1. [Core Features](#core-features)
2. [Platform Support](#platform-support)
3. [Filter System](#filter-system)
4. [Product Comparison](#product-comparison)
5. [Sponsored Product Detection](#sponsored-product-detection)
6. [Error Handling & Retry Logic](#error-handling--retry-logic)
7. [Buy Now Flow](#buy-now-flow)
8. [Content Script Loading](#content-script-loading)

## Core Features

### Natural Language Processing

RetailAgent uses Google Gemini AI to understand natural language shopping intents.

**Capabilities**:
- Parses product queries from plain English
- Extracts filters (price, brand, rating, etc.)
- Detects platform preferences
- Identifies comparison requests

**Example Queries**:
- "buy samsung phone under 20000"
- "find iPhone 15 Pro Max on Flipkart"
- "compare laptops 16gb ram under 50000"
- "best price for oneplus nord"

### Multi-Platform Support

Supports multiple e-commerce platforms with unified interface:
- ✅ Amazon (India, US, UK, Germany, France)
- ✅ Flipkart
- ✅ eBay
- ✅ Walmart
- 🔄 Shopify (in progress)

## Platform Support

### Amazon

**Features**:
- URL-based filter application (most reliable)
- DOM-based filter fallback
- LLM-based filter discovery (last resort)
- Sponsored product filtering
- Multi-region support

**Filter Types**:
- Price range
- Rating (minimum stars)
- Brand
- RAM capacity
- Storage capacity
- Battery capacity
- Color
- Condition

**Implementation Details**:
- Uses Amazon's `rh` parameter for URL filters
- Filter codes mapped in `amazon-filter-codes.js`
- URL builder in `amazon-url-filter-builder.js`
- Filter verification in `filter-verifier.js`

### Flipkart

**Features**:
- AJAX-based search (no page reload)
- Dynamic filter application
- Product extraction from dynamic content

**Special Handling**:
- Requires immediate continuation after search (no PAGE_LOADED event)
- Uses fallback search path when content script timeout occurs
- Normalizes query text (removes platform references, undefined values)

### eBay

**Features**:
- Auction and Buy-It-Now support
- AJAX-based search
- Product condition filtering

### Walmart

**Features**:
- Store pickup and delivery options
- Product availability checking

## Filter System

### Three-Layer Filter Strategy

#### 1. URL-Based Filtering (Primary)

**Amazon Implementation**:
- Builds filter URL with `rh` parameter
- Most reliable method
- No DOM dependency
- Fast execution

**Example**:
```
https://www.amazon.in/s?k=samsung+phone&rh=p_123:46655,p_36:1300000-1950000
```

**Filter Codes**:
- Rating (`p_123`): 46655 = 4+ stars
- Price (`p_36`): Converted to paise (₹13,000 = 1,300,000 paise)
- Battery (`p_n_g-101015098008111`): 91805326031 = 5000mAh+
- RAM (`p_n_g-1003495121111`): 44897287031 = 6GB

#### 2. DOM-Based Filtering (Fallback)

**When Used**:
- URL method fails
- Custom/unknown filters
- Platform doesn't support URL filters

**Implementation**:
- Clicks filter elements directly
- Waits for filter application
- Verifies filters applied

#### 3. LLM-Based Filtering (Last Resort)

**When Used**:
- DOM structure changed
- Unknown filter structure
- Complex filter scenarios

**Implementation**:
- Uses `page-analyzer.js` with `ANALYZE_FILTERS` mode
- LLM discovers available filters
- Recommends filter actions

### Filter Verification

**Methods**:
1. URL parameter check
2. Product count monitoring
3. DOM indicator check

**Implementation**: `filter-verifier.js`

## Product Comparison

### Overview

Compares products across multiple platforms automatically.

### Features

- **Multi-platform search**: Opens Amazon + Flipkart simultaneously
- **Intelligent scoring**: Price, rating, delivery, availability
- **Best deal detection**: Automatically finds winner
- **Savings calculator**: Shows how much you save
- **Transparent ranking**: See all options ranked

### Comparison Algorithm

```javascript
Score = (priceScore × priceWeight) + 
        (ratingScore × ratingWeight) + 
        (deliveryScore × deliveryWeight) + 
        (availabilityScore × availabilityWeight)
```

### User Preferences

Configurable weights (default):
- Price: 40%
- Rating: 30%
- Delivery: 20%
- Availability: 10%

### Comparison Flow

1. User query includes "compare" keyword
2. Service worker sets `compareMode = true`
3. Opens multiple platform tabs
4. Parallel searches on all platforms
5. Extract products from each platform
6. Compare using scoring algorithm
7. Display comparison card
8. Auto-select best product
9. Navigate to best product page
10. Close unused tabs

### UI Display

- Gradient purple/pink header
- Green "Best Deal" section
- Medals (🥇🥈🥉) for ranked products
- Savings amount display
- Clear recommendation reason

## Sponsored Product Detection

### Detection Methods (Priority Order)

1. `data-component-type="sp-sponsored-result"` (most reliable)
2. `data-ad-details` attribute
3. `.AdHolder` class
4. `.s-sponsored-header` element
5. `.s-sponsored-info-icon` element
6. ARIA labels containing "sponsored"

### Implementation

**File**: `src/lib/sponsored-detector.js`

**Usage**:
```javascript
import { isSponsoredProduct } from '../../lib/sponsored-detector.js';

// In getSearchResults()
for (const container of containers) {
    if (isSponsoredProduct(container, 'amazon')) {
        continue; // Skip sponsored
    }
    // Extract product...
}
```

**Benefits**:
- Ensures first result is always organic
- Filters before extraction (efficient)
- Multiple detection methods (robust)

## Error Handling & Retry Logic

### Error Types

1. **APIError**: API call failures
   - Status codes: 401, 403, 429, 500+
   - Recovery: Retry with backoff

2. **DOMError**: DOM element not found
   - Recovery: Try alternative selectors, retry

3. **IntentParseError**: Intent parsing failures
   - Recovery: Fallback to simple parser

### Retry Strategy

**Exponential Backoff**:
- Initial delay: 1s
- Multiplier: 2x
- Max delay: 30s
- Max retries: 3-5

**Retryable Errors**:
- Network errors
- 5xx server errors
- 429 rate limiting
- DOM element loading delays

### Implementation

**Files**:
- `src/lib/error-handler.js` - Error handling
- `src/lib/retry.js` - Retry logic

## Buy Now Flow

### Flow Steps

1. Navigate to product page
2. Find Buy Now button
3. Click Buy Now
4. Detect navigation to checkout
5. Stop automation (user completes checkout)

### Buy Now Detection

**Multiple Selectors**:
```javascript
buyNow: [
    '#buy-now-button',
    '#sc-buy-box-ptc-button',
    '[name="submit.buy-now"]',
    '[data-action="buy-now"]',
    // ... more selectors
]
```

### Checkout Detection

**URL Patterns**:
- `/gp/buy/`
- `/cart`
- `/checkout`
- `/spc/`

### Retry Logic

**Limits**:
- Max retries: 3 per product
- Retry delay: 2-3 seconds
- After max retries: User notification

**User Messages**:
- Success: "✅ Buy Now successful! Navigated to checkout page."
- Failure: "Unable to complete purchase after 3 attempts. Please proceed manually."

### Fixes Applied

**Issue**: Infinite loop after Buy Now click
**Solution**:
- Added retry counter
- Checkout detection
- Retry limit enforcement
- Better navigation error handling

## Content Script Loading

### Problem

Content scripts use ES6 `import` statements, but Chrome Manifest V3 doesn't support ES6 modules in static content scripts.

### Solution

Created **loader wrapper scripts** that use dynamic `import()` (which IS allowed in content script context).

### Implementation

**Loader Pattern**:
```javascript
// Loader (classic script - no imports at top level)
(async () => {
    await import(chrome.runtime.getURL('src/content/amazon.js'));
})();
```

**Why This Works**:
- ✅ Loader is a classic script (can be declared in manifest)
- ✅ Dynamic `import()` IS allowed inside content scripts
- ✅ Loads the actual ES6 module with all its imports
- ✅ Executes in proper isolated world

### Files Created

1. `src/content/amazon-loader.js`
2. `src/content/flipkart-loader.js`
3. `src/content/ebay-loader.js`
4. `src/content/walmart-loader.js`

### Manifest Configuration

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.amazon.in/*"],
      "js": ["src/content/amazon-loader.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "src/content/*.js",
        "src/content/platforms/*.js",
        "src/lib/*.js"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

## Research Documentation

### Amazon Filter Research

**File**: `docs/amazon-filter-research.md`

**Findings**:
- Amazon uses `rh` parameter for filters
- Filter codes are consistent across regions
- URL-based filtering is most reliable
- Filter codes documented in `amazon-filter-codes.js`

### Amazon DOM Research

**File**: `docs/amazon-dom-research.md`

**Findings**:
- Filter sidebar structure
- Product container selectors
- Sponsored product indicators
- Dynamic content loading patterns

### Flipkart Filter Research

**File**: `docs/flipkart-filter-research.md`

**Findings**:
- AJAX-based filter application
- URL parameter structure
- Dynamic filter elements

## Performance Optimizations

### Caching

- API responses cached
- Model availability cached
- Working model cache (per day)

### Lazy Loading

- Content scripts loaded only when needed
- Platform modules loaded on demand

### Parallel Processing

- Multi-platform comparison runs in parallel
- Product extraction optimized

### Performance Targets

- Intent parsing: < 3 seconds
- Search execution: < 5 seconds
- Filter application: < 4 seconds
- Product extraction: < 2 seconds
- Total flow: < 30 seconds

## Known Limitations

1. **Brand Filter**: Brand codes are dynamic (falls back to DOM)
2. **Test Infrastructure**: Requires npm install before running tests
3. **LLM Fallback**: Not yet implemented for all scenarios
4. **Flipkart**: URL-based filtering not yet implemented

## Future Enhancements

1. Multi-product comparison
2. Price tracking and alerts
3. Wishlist management
4. Cart management
5. Cross-platform price comparison
6. Voice commands
7. AI recommendations

---

**Last Updated**: January 2026  
**Version**: 1.0.0

