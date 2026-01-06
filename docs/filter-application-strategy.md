# Filter Application Strategy

## Strategy Overview

### Priority: URL Manipulation > DOM Clicking > LLM Fallback

1. **URL Manipulation** - Most reliable, fastest
2. **DOM Clicking** - Fallback when URL fails
3. **LLM Analysis** - Last resort for complex/unknown filters

## Filter Application Priority Order

### 1. Price Filters (Priority 1 - Highest)
**Why First**: Drastically reduces result set

**Application Method**:
- Amazon: URL with `p_36:min_paise-max_paise`
- Flipkart: URL with `facets.price_range.from` and `facets.price_range.to`

**Example**:
```javascript
// Amazon: ₹13,000-₹19,500
const priceParam = 'p_36:1300000-1950000';

// Flipkart
const priceFrom = 'facets.price_range.from=13000';
const priceTo = 'facets.price_range.to=19500';
```

### 2. Brand Filters (Priority 2)
**Why Second**: Further narrows results to specific manufacturers

**Application Method**:
- Amazon: URL with `p_89:BrandName` or checkbox click
- Flipkart: URL with `facets.brand[]=BrandName`

**Example**:
```javascript
// Amazon
const brandParam = 'p_89:Samsung';

// Flipkart
const brandParam = 'facets.brand[]=Samsung';
```

### 3. Specification Filters (Priority 3)
**Why Third**: Technical requirements (RAM, Battery, Storage)

**Application Order**:
1. RAM
2. Battery
3. Storage
4. Display Size

**Application Method**:
- Amazon: URL with specific filter IDs and value codes
- Flipkart: URL with facet parameters

**Example**:
```javascript
// Amazon RAM: 6GB
const ramParam = 'p_n_g-1003495121111:44897287031';

// Amazon Battery: 5000mAh+
const batteryParam = 'p_n_g-101015098008111:91805326031';

// Flipkart RAM
const ramParam = 'facets.ram[]=6 GB and Above';
```

### 4. Rating Filters (Priority 4 - Lowest)
**Why Last**: Already narrowed by specs, rating is final refinement

**Application Method**:
- Amazon: URL with `p_123:46655` (4+ stars)
- Flipkart: URL with `facets.rating[]=4★ and above`

## URL-Based Application (Primary Method)

### When to Use
- **Always try first**
- Most reliable method
- Fastest execution
- No DOM dependency

### Implementation

#### Amazon URL Building
```javascript
function buildAmazonFilterURL(baseURL, filters) {
  const url = new URL(baseURL);
  const rhParams = [];
  
  // Price (Priority 1)
  if (filters.price_min || filters.price_max) {
    const min = (filters.price_min || 0) * 100;
    const max = (filters.price_max || '') ? filters.price_max * 100 : '';
    rhParams.push(`p_36:${min}-${max}`);
  }
  
  // Brand (Priority 2)
  if (filters.brand) {
    rhParams.push(`p_89:${filters.brand}`);
  }
  
  // RAM (Priority 3a)
  if (filters.ram) {
    const ramCode = RAM_FILTER_CODES[filters.ram];
    if (ramCode) {
      rhParams.push(`p_n_g-1003495121111:${ramCode}`);
    }
  }
  
  // Battery (Priority 3b)
  if (filters.battery) {
    const batteryCode = BATTERY_FILTER_CODES[filters.battery];
    if (batteryCode) {
      rhParams.push(`p_n_g-101015098008111:${batteryCode}`);
    }
  }
  
  // Storage (Priority 3c)
  if (filters.storage) {
    const storageCode = STORAGE_FILTER_CODES[filters.storage];
    if (storageCode) {
      rhParams.push(`p_n_g-1003492455111:${storageCode}`);
    }
  }
  
  // Rating (Priority 4)
  if (filters.rating) {
    const ratingCode = RATING_FILTER_CODES[filters.rating];
    if (ratingCode) {
      rhParams.push(`p_123:${ratingCode}`);
    }
  }
  
  if (rhParams.length > 0) {
    url.searchParams.set('rh', rhParams.join(','));
  }
  
  return url.toString();
}
```

#### Flipkart URL Building
```javascript
function buildFlipkartFilterURL(baseURL, filters) {
  const url = new URL(baseURL);
  
  // Price (Priority 1)
  if (filters.price_min) {
    url.searchParams.append('p[]', `facets.price_range.from=${filters.price_min}`);
  }
  if (filters.price_max) {
    url.searchParams.append('p[]', `facets.price_range.to=${filters.price_max}`);
  }
  
  // Brand (Priority 2)
  if (filters.brand) {
    url.searchParams.append('p[]', `facets.brand[]=${filters.brand}`);
  }
  
  // RAM (Priority 3a)
  if (filters.ram) {
    url.searchParams.append('p[]', `facets.ram[]=${filters.ram} GB and Above`);
  }
  
  // Battery (Priority 3b)
  if (filters.battery) {
    url.searchParams.append('p[]', `facets.battery_capacity[]=${filters.battery} mAh and Above`);
  }
  
  // Storage (Priority 3c)
  if (filters.storage) {
    url.searchParams.append('p[]', `facets.internal_storage[]=${filters.storage} GB and Above`);
  }
  
  // Rating (Priority 4)
  if (filters.rating) {
    url.searchParams.append('p[]', `facets.rating[]=${filters.rating}★ and above`);
  }
  
  return url.toString();
}
```

### Verification After URL Navigation
```javascript
async function verifyFiltersApplied(expectedFilters) {
  // Wait for page load
  await waitForCondition(() => 
    document.querySelector('[data-asin]') || document.querySelector('[data-id]'),
    { timeout: 5000 }
  );
  
  const url = new URL(window.location.href);
  
  // Check URL contains expected parameters
  const rh = url.searchParams.get('rh');
  if (!rh && Object.keys(expectedFilters).length > 0) {
    return { success: false, reason: 'No filters in URL' };
  }
  
  // Verify each filter
  for (const [key, value] of Object.entries(expectedFilters)) {
    const filterParam = getExpectedFilterParam(key, value);
    if (!rh.includes(filterParam)) {
      return { success: false, reason: `Missing filter: ${key}=${value}` };
    }
  }
  
  // Check product count changed
  const productCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
  if (productCount === 0) {
    return { success: false, reason: 'No products found after filtering' };
  }
  
  return { success: true, productCount };
}
```

## DOM-Based Application (Fallback Method)

### When to Use
- URL method failed
- Unknown filter codes
- Dynamic/custom filters
- Platform doesn't support URL filters

### Implementation

#### Filter Discovery
```javascript
async function discoverDOMFilters() {
  const filterSidebar = document.querySelector('#s-refinements') || 
                       document.querySelector('[class*="filter"]');
  
  if (!filterSidebar) {
    return null;
  }
  
  const filters = {};
  const filterGroups = filterSidebar.querySelectorAll('div[id^="p_"]');
  
  filterGroups.forEach(group => {
    const filterId = group.id;
    const title = group.querySelector(`#${filterId}-title`)?.textContent.trim();
    const options = Array.from(group.querySelectorAll('ul li a')).map(link => ({
      label: link.textContent.trim(),
      href: link.href,
      element: link
    }));
    
    filters[filterId] = { title, options };
  });
  
  return filters;
}
```

#### Filter Click Strategy
```javascript
async function clickDOMFilter(filterLabel, filterValue) {
  // Find filter by label
  const filterLinks = Array.from(document.querySelectorAll('#s-refinements a'));
  const matchingLink = filterLinks.find(link => 
    link.textContent.toLowerCase().includes(filterValue.toLowerCase())
  );
  
  if (!matchingLink) {
    return { success: false, reason: 'Filter option not found' };
  }
  
  // Scroll into view
  matchingLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try multiple click strategies
  const clickStrategies = [
    () => matchingLink.click(),
    () => matchingLink.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    () => {
      matchingLink.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      matchingLink.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      matchingLink.click();
    }
  ];
  
  for (const strategy of clickStrategies) {
    try {
      strategy();
      
      // Wait for navigation or page update
      await waitForCondition(() => 
        window.location.href !== matchingLink.href || 
        document.querySelector('.a-spinner') === null,
        { timeout: 3000 }
      );
      
      return { success: true };
    } catch (error) {
      continue; // Try next strategy
    }
  }
  
  return { success: false, reason: 'All click strategies failed' };
}
```

## LLM-Based Application (Last Resort)

### When to Use
- Both URL and DOM methods failed
- Unknown platform or structure
- Complex custom filters
- Need intelligent selector discovery

### Implementation
```javascript
async function applyFiltersWithLLM(filters) {
  // Get simplified page content
  const pageContent = getSimplifiedPageContent();
  
  // Send to LLM
  const llmResponse = await analyzePage(pageContent, 'ANALYZE_FILTERS', {
    requestedFilters: filters,
    platform: 'amazon'
  });
  
  if (!llmResponse.success) {
    return { success: false, reason: 'LLM analysis failed' };
  }
  
  // Execute LLM recommendations
  for (const action of llmResponse.actions) {
    if (action.type === 'click') {
      const element = document.querySelector(action.selector);
      if (element) {
        element.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else if (action.type === 'navigate') {
      window.location.href = action.url;
      return { success: true, method: 'LLM-navigate' };
    }
  }
  
  return { success: true, method: 'LLM-click' };
}
```

## Retry Logic

### Retry Strategy
```javascript
async function applyFiltersWithRetry(filters, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try URL method first
      const urlResult = await applyFiltersViaURL(filters);
      if (urlResult.success) {
        return { success: true, method: 'URL', attempt };
      }
      
      // If URL failed, try DOM
      if (attempt < maxAttempts) {
        const domResult = await applyFiltersViaDOM(filters);
        if (domResult.success) {
          return { success: true, method: 'DOM', attempt };
        }
      }
      
      // Last attempt: try LLM
      if (attempt === maxAttempts) {
        const llmResult = await applyFiltersWithLLM(filters);
        if (llmResult.success) {
          return { success: true, method: 'LLM', attempt };
        }
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxAttempts) {
        return { success: false, error: error.message, attempts: maxAttempts };
      }
    }
  }
  
  return { success: false, reason: 'Max attempts reached' };
}
```

## Verification Methods

### Method 1: URL Parameter Check
```javascript
function verifyURLParameters(filters) {
  const url = new URL(window.location.href);
  const rh = url.searchParams.get('rh') || '';
  
  return Object.entries(filters).every(([key, value]) => {
    const expectedParam = getFilterParamForKey(key, value);
    return rh.includes(expectedParam);
  });
}
```

### Method 2: Product Count Check
```javascript
async function verifyProductCountChanged(beforeCount) {
  await waitForCondition(() => {
    const currentCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
    return currentCount !== beforeCount && currentCount > 0;
  }, { timeout: 5000 });
  
  const afterCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
  return afterCount !== beforeCount;
}
```

### Method 3: DOM Indicator Check
```javascript
function verifyActiveFilterIndicators(filters) {
  const activeFilters = document.querySelectorAll('#applied-filters span, .a-color-state');
  const activeFilterTexts = Array.from(activeFilters).map(el => el.textContent.toLowerCase());
  
  return Object.values(filters).some(value => 
    activeFilterTexts.some(text => text.includes(value.toString().toLowerCase()))
  );
}
```

## Error Handling

### Common Errors and Solutions

#### Error: No Filter Codes Found
```javascript
if (!filterCode) {
  // Fallback to DOM clicking
  return applyFiltersViaDOM(filters);
}
```

#### Error: URL Too Long
```javascript
if (filterURL.length > 2048) {
  // Apply only essential filters (price, brand)
  const essentialFilters = {
    price_min: filters.price_min,
    price_max: filters.price_max,
    brand: filters.brand
  };
  return applyFiltersViaURL(essentialFilters);
}
```

#### Error: Page Not Updating
```javascript
if (!pageUpdated) {
  // Force page reload with filters
  window.location.href = filterURL;
}
```

## Best Practices

1. **Always Prioritize Price**: Reduces result set fastest
2. **Verify After Each Filter**: Don't apply all at once without verification
3. **Use URL Method First**: Most reliable across platforms
4. **Log All Attempts**: For debugging and analytics
5. **Handle Platform Differences**: Amazon vs Flipkart have different structures
6. **Timeout Appropriately**: Don't wait forever for verification
7. **Provide User Feedback**: Let user know what's happening

## Testing Strategy

```javascript
async function testFilterApplication(filters) {
  const results = {
    url_method: null,
    dom_method: null,
    llm_method: null
  };
  
  // Test URL method
  try {
    results.url_method = await applyFiltersViaURL(filters);
  } catch (error) {
    results.url_method = { success: false, error: error.message };
  }
  
  // Test DOM method
  try {
    results.dom_method = await applyFiltersViaDOM(filters);
  } catch (error) {
    results.dom_method = { success: false, error: error.message };
  }
  
  // Test LLM method
  try {
    results.llm_method = await applyFiltersWithLLM(filters);
  } catch (error) {
    results.llm_method = { success: false, error: error.message };
  }
  
  return results;
}
```

## Platform-Specific Notes

### Amazon
- URL method is highly reliable
- Filter codes are stable
- Price must be in paise
- Multiple values use pipe `|`

### Flipkart
- URL method works but parameters are verbose
- Class names change frequently
- Text-based selection more reliable for DOM
- Each filter value is separate `p[]` parameter

## Resources
- Amazon filter code documentation
- Flipkart facet documentation
- LLM prompts for filter analysis
- Test cases for each platform



