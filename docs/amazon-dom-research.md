# Amazon DOM Structure Research

## Overview
This document provides detailed analysis of Amazon.in's DOM structure for search results pages, filter sidebar, product containers, and interactive elements.

## Search Results Page Structure

### Main Container
```html
<div id="s-results-list-atf" class="s-main-slot s-result-list">
    <!-- Product containers here -->
</div>
```

**Selectors:**
- `#s-results-list-atf`
- `[data-component-type="s-search-results"]`
- `.s-main-slot.s-result-list`

### Result Info Bar
```html
<div class="sg-col-inner">
    <span class="s-desktop-toolbar">
        <span>1-16 of over 5,000 results for</span>
        <span class="s-result-count">samsung phone</span>
    </span>
</div>
```

**Selectors for product count:**
- `.s-result-count`
- `[data-component-type="s-result-info-bar"] span`

## Product Container Structure

### Organic Product Container
```html
<div data-asin="B0FN7W26Q8"
     data-index="2" 
     data-component-type="s-search-result"
     class="s-result-item s-asin">
    
    <!-- Image section -->
    <div class="s-product-image-container">
        <img class="s-image" 
             src="..." 
             alt="Samsung Galaxy..."
             data-image-latency="s-product-image">
    </div>
    
    <!-- Title section -->
    <h2 class="s-line-clamp-2">
        <a class="a-link-normal s-underline-text" 
           href="/Samsung-Moonlight-Storage-Gorilla-Upgrades/dp/B0FN7W26Q8/...">
            <span class="a-size-medium a-color-base a-text-normal">
                Samsung Galaxy M14 5G (Sapphire Blue, 6GB, 128GB Storage)
            </span>
        </a>
    </h2>
    
    <!-- Price section -->
    <div class="a-row a-size-base">
        <span class="a-price" data-a-color="price">
            <span class="a-offscreen">₹13,990</span>
            <span class="a-price-whole">13,990</span>
            <span class="a-price-symbol">₹</span>
        </span>
    </div>
    
    <!-- Rating section -->
    <div class="a-row a-size-small">
        <span class="a-icon-alt">4.2 out of 5 stars</span>
        <span class="a-size-base s-underline-text">25,498</span>
    </div>
</div>
```

**Key Selectors:**
- Container: `[data-asin]:not([data-asin=""])`
- ASIN attribute: `data-asin`
- Title: `h2 a span.a-text-normal`, `h2 a.s-underline-text`
- Link: `h2 a[href*="/dp/"]`
- Price (screen reader): `.a-price .a-offscreen`
- Price (visible): `.a-price-whole`
- Image: `.s-image`, `img[data-image-latency]`
- Rating: `.a-icon-alt`, `[aria-label*="out of 5 stars"]`
- Reviews count: `.s-underline-text` (adjacent to rating)

### Sponsored Product Container
```html
<div data-asin="B0ABCD1234"
     data-index="0"
     data-component-type="sp-sponsored-result"
     data-ad-details="{...}"
     class="s-result-item AdHolder s-asin">
    
    <!-- Sponsored label -->
    <div class="s-sponsored-header">
        <span class="s-sponsored-label">Sponsored</span>
        <span class="s-sponsored-info-icon"></span>
    </div>
    
    <!-- Rest same as organic product -->
</div>
```

**Sponsored Detection Attributes:**
- `data-component-type="sp-sponsored-result"`
- `data-ad-details` attribute present
- `.AdHolder` class
- `.s-sponsored-header` element
- `.s-sponsored-label` text "Sponsored"
- `.s-sponsored-info-icon` element

## Filter Sidebar Structure

### Main Sidebar Container
```html
<div id="s-refinements" class="sg-col-4-of-12">
    <div id="filters">
        <!-- Filter groups here -->
    </div>
</div>
```

**Selectors:**
- `#s-refinements` - Main sidebar
- `#filters` - Filter container
- `.a-section.a-spacing-none` - Individual filter groups

### Filter Group Structure

#### 1. Customer Reviews Filter (`p_123`)
```html
<div id="p_123" class="a-section a-spacing-small">
    <span id="p_123-title" class="a-size-base a-color-base">
        <h4>Avg. Customer Review</h4>
    </span>
    
    <ul class="a-unordered-list a-nostyle a-vertical">
        <li id="p_123/46655">
            <span class="a-list-item">
                <a class="a-link-normal" 
                   href="/s?...&rh=...p_123:46655...">
                    <i class="a-icon a-icon-star-small a-star-small-4"></i>
                    <span class="a-size-small a-color-base">4 Stars & Up</span>
                </a>
            </span>
        </li>
        <li id="p_123/46654">
            <span class="a-list-item">
                <a href="/s?...&rh=...p_123:46654...">
                    <i class="a-icon a-icon-star-small a-star-small-3"></i>
                    <span>3 Stars & Up</span>
                </a>
            </span>
        </li>
    </ul>
</div>
```

**Selectors:**
- Container: `#p_123`, `div[id="p_123"]`
- Title: `#p_123-title`
- Options: `#p_123 a.a-link-normal`
- Specific option: `#p_123\\/46655`, `a[href*="p_123:46655"]`

#### 2. Price Range Filter (`p_36`)
```html
<div id="p_36" class="a-section a-spacing-small">
    <span id="p_36-title" class="a-size-base a-color-base">
        <h4>Price</h4>
    </span>
    
    <form class="s-range-input" action="/s">
        <div class="a-row a-spacing-small">
            <input type="number" 
                   name="low-price" 
                   id="low-price"
                   placeholder="Min"
                   class="a-input-text a-spacing-top-mini">
            <span class="a-letter-space"></span>
            <input type="number"
                   name="high-price"
                   id="high-price"
                   placeholder="Max"
                   class="a-input-text a-spacing-top-mini">
        </div>
        
        <input type="submit"
               aria-labelledby="p_36-title"
               value="Go"
               class="a-button-input">
    </form>
    
    <!-- Price ranges as links (alternative to inputs) -->
    <ul class="a-unordered-list a-nostyle a-vertical">
        <li><a href="/s?...&rh=...p_36:500000-1000000...">₹5,000 - ₹10,000</a></li>
        <li><a href="/s?...&rh=...p_36:1000000-1500000...">₹10,000 - ₹15,000</a></li>
    </ul>
</div>
```

**Selectors:**
- Container: `#p_36`
- Min input: `input[name="low-price"]`, `#low-price`
- Max input: `input[name="high-price"]`, `#high-price`
- Submit button: `input[type="submit"][aria-labelledby="p_36-title"]`
- Price range links: `#p_36 a[href*="p_36:"]`

#### 3. Battery Capacity Filter (`p_n_g-101015098008111`)
```html
<div id="p_n_g-101015098008111" class="a-section a-spacing-small">
    <span id="p_n_g-101015098008111-title" class="a-size-base a-color-base">
        <h4>Battery Capacity</h4>
    </span>
    
    <ul class="a-unordered-list a-nostyle a-vertical">
        <li>
            <span class="a-list-item">
                <a class="a-link-normal" 
                   href="/s?...&rh=...p_n_g-101015098008111:91805326031...">
                    <span class="a-size-base a-color-base">5000 mAh & Above</span>
                </a>
            </span>
        </li>
        <li>
            <span class="a-list-item">
                <a href="/s?...&rh=...p_n_g-101015098008111:92071917031...">
                    <span>6000 mAh & Above</span>
                </a>
            </span>
        </li>
    </ul>
</div>
```

**Selectors:**
- Container: `div[id="p_n_g-101015098008111"]`
- Options: `#p_n_g-101015098008111 a[href*="101015098008111"]`
- Specific value: `a[href*="101015098008111:91805326031"]`

#### 4. RAM Filter (`p_n_g-1003495121111`)
```html
<div id="p_n_g-1003495121111" class="a-section a-spacing-small">
    <span id="p_n_g-1003495121111-title" class="a-size-base a-color-base">
        <h4>Computer Memory Size</h4>
    </span>
    
    <ul class="a-unordered-list a-nostyle a-vertical">
        <li>
            <a href="/s?...&rh=...p_n_g-1003495121111:44897287031...">
                <span>6 GB</span>
            </a>
        </li>
        <li>
            <a href="/s?...&rh=...p_n_g-1003495121111:44897288031...">
                <span>8 GB</span>
            </a>
        </li>
    </ul>
</div>
```

**Selectors:**
- Container: `div[id="p_n_g-1003495121111"]`
- Options: `#p_n_g-1003495121111 a[href*="1003495121111"]`
- Specific value: `a[href*="1003495121111:44897287031"]`

### Filter Expansion ("See More")
```html
<span class="a-expander-prompt">
    <a href="javascript:void(0)" 
       class="a-link-expander" 
       aria-expanded="false"
       data-action="s-expander-toggle">
        See more
    </a>
</span>
```

**Selectors:**
- See More button: `.a-link-expander`, `a[data-action="s-expander-toggle"]`
- Expansion check: `a[aria-expanded="true"]`

### Active Filter Indicators
```html
<div class="s-navigation-item s-navigation-item-active">
    <a href="/s?...">
        <span class="a-badge-label">6 GB</span>
        <i class="a-icon a-icon-close"></i>
    </a>
</div>
```

**Selectors:**
- Active filters: `.s-navigation-item-active`
- Filter badges: `.a-badge-label`
- Clear filter: `.a-icon-close`
- Clear all: `[aria-label*="Clear filters"]`, `.s-navigation-clear-link`

## DOM to URL Mapping

### How Filters Appear in Both

**Example: 6GB RAM filter**

**DOM:**
```html
<a href="/s?k=samsung+phone&rh=...p_n_g-1003495121111:44897287031...">
    <span>6 GB</span>
</a>
```

**URL after click:**
```
https://www.amazon.in/s?k=samsung+phone&rh=p_n_g-1003495121111:44897287031
```

**Key Insight:** Filter links already contain the correct URL with `rh` parameter. Can either:
1. Click the link element (DOM method)
2. Navigate to the href URL directly (URL method)
3. Construct URL with filter codes (URL building method)

## Interaction Methods

### Method 1: Click Filter Element (DOM)
```javascript
const filterLink = document.querySelector('a[href*="p_123:46655"]');
filterLink.click();
```

**Pros:** Uses Amazon's exact URLs
**Cons:** Requires finding element, slower

### Method 2: Navigate to Filter URL (Hybrid)
```javascript
const filterLink = document.querySelector('a[href*="p_123:46655"]');
const url = filterLink.href;
window.location.href = url;
```

**Pros:** Faster than clicking
**Cons:** Still requires finding element

### Method 3: Build Filter URL (Pure URL)
```javascript
const url = new URL(window.location.href);
url.searchParams.set('rh', 'p_123:46655,p_36:1300000-1950000');
window.location.href = url.toString();
```

**Pros:** Fastest, no DOM dependency
**Cons:** Must know filter codes

## Loading Indicators

### Spinner
```html
<div class="s-loading">
    <div class="a-spinner"></div>
</div>
```

**Selectors:**
- `.s-loading`
- `.a-spinner`
- `[class*="loading"]`
- `[aria-busy="true"]`

### Overlay
```html
<div class="s-overlay" style="display: block;"></div>
```

**Selector:** `.s-overlay[style*="display: block"]`

## Page State Detection

### Search Results Page
**URL Pattern:** `/s?k=...`
**DOM Indicators:**
- `#s-results-list-atf` exists
- `[data-component-type="s-search-results"]` exists
- Product containers with `data-asin` present

### Product Page
**URL Pattern:** `/dp/{ASIN}` or `/gp/product/{ASIN}`
**DOM Indicators:**
- `#productTitle` exists
- `#buy-now-button` or similar exists
- `data-asin` on main product container

### No Results Page
**DOM Indicators:**
- `.s-no-results` exists
- Text contains "No results for"

## Dynamic Updates

### Filter Application
When filter is applied:
1. URL changes (adds/modifies `rh` parameter)
2. Product containers refresh
3. Product count updates
4. Active filter badges appear
5. Loading indicators show briefly

**Wait Strategy:**
1. Check URL changed
2. Wait for loading indicators to disappear
3. Check product count changed
4. Check active filter badges present

### Pagination
```html
<span class="s-pagination-strip">
    <a class="s-pagination-item s-pagination-next" href="/s?...&page=2">Next</a>
</span>
```

**Selector:** `.s-pagination-next`, `.s-pagination-item`

## Mobile vs Desktop Differences

### Mobile Specific
- Filters in slide-out panel
- Different filter toggle button
- Condensed product layout
- Different selectors for some elements

### Desktop Specific
- Filters in left sidebar (always visible)
- More detailed product information
- Hover effects on products

## Best Practices

### 1. Always Check for Multiple Selectors
Products may use different container classes, try multiple:
```javascript
const selectors = [
    '[data-asin]:not([data-asin=""])',
    '[data-component-type="s-search-result"]',
    '.s-result-item[data-asin]'
];
```

### 2. Extract href from Links
Product links may be relative or absolute:
```javascript
const href = link.getAttribute('href');
const fullUrl = href.startsWith('http') ? href : `https://www.amazon.in${href}`;
```

### 3. Check Sponsored Status First
Before processing product, check if sponsored:
```javascript
const isSponsored = container.getAttribute('data-component-type') === 'sp-sponsored-result';
```

### 4. Wait for Stable State
After filter application, wait for:
- URL to stabilize (no more changes)
- Loading indicators to disappear
- Product containers to render
- Product count to update

## Testing Selectors

### Quick Console Test
```javascript
// Count organic products
console.log('Organic:', document.querySelectorAll('[data-asin]:not([data-component-type="sp-sponsored-result"])').length);

// Count sponsored products
console.log('Sponsored:', document.querySelectorAll('[data-component-type="sp-sponsored-result"]').length);

// Check active filters
console.log('Active filters:', document.querySelectorAll('.a-badge-label').length);

// Check current URL filters
console.log('URL rh:', new URLSearchParams(window.location.search).get('rh'));
```

