# Flipkart Filter Structure Research

## Overview
Flipkart uses a different filter structure compared to Amazon, with URL parameters and a distinct DOM hierarchy.

## URL Structure

### Base URL Format
```
https://www.flipkart.com/search?q={search_query}&{filter_params}
```

### Filter Parameters
Unlike Amazon's `rh` parameter, Flipkart uses individual query parameters:

```
https://www.flipkart.com/search?q=samsung+phone&p[]=facets.brand%255B%255D%3DSamsung&p[]=facets.price_range.from%3D10000&p[]=facets.price_range.to%3D20000
```

## Common Filter Parameters

### 1. Brand Filter
```
p[]=facets.brand%255B%255D%3DSamsung
p[]=facets.brand%255B%255D%3DApple

Decoded: p[]=facets.brand[]=Samsung
```

### 2. Price Range
```
p[]=facets.price_range.from%3D10000
p[]=facets.price_range.to%3D20000

Decoded:
- facets.price_range.from=10000
- facets.price_range.to=20000
```

### 3. RAM
```
p[]=facets.ram%255B%255D%3D6%2BGB
p[]=facets.ram%255B%255D%3D8%2BGB

Decoded: facets.ram[]=6 GB
```

### 4. Storage (Internal Memory)
```
p[]=facets.internal_storage%255B%255D%3D128%2BGB
p[]=facets.internal_storage%255B%255D%3D256%2BGB

Decoded: facets.internal_storage[]=128 GB
```

### 5. Battery Capacity
```
p[]=facets.battery_capacity%255B%255D%3D5000%2BmAh%2Band%2BAbove

Decoded: facets.battery_capacity[]=5000 mAh and Above
```

### 6. Customer Ratings
```
p[]=facets.rating%255B%255D%3D4%25E2%2598%2585%2B%2Band%2Babove

Decoded: facets.rating[]=4★ and above
```

### 7. Operating System
```
p[]=facets.operating_system%255B%255D%3DAndroid

Decoded: facets.operating_system[]=Android
```

## DOM Structure

### Filter Sidebar Container
```html
<div class="_2gmrv0">
  <!-- All filters contained here -->
</div>
```

**Note**: Flipkart uses obfuscated class names that change frequently.

### Individual Filter Section
```html
<div class="_2gmrv0">
  <!-- Filter title -->
  <div class="_2gmrv0">
    <span class="_2gmrv0">Brand</span>
  </div>
  
  <!-- Filter options -->
  <div class="_2gmrv0">
    <div class="_2gmrv0">
      <label class="_2gmrv0">
        <input type="checkbox" class="_2gmrv0">
        <div class="_2gmrv0">Samsung</div>
      </label>
    </div>
  </div>
</div>
```

### Better Selectors (Text-Based)
Due to obfuscated classes, use text-based selection:

```javascript
// Find filter by title
const brandFilter = Array.from(document.querySelectorAll('div')).find(
  div => div.textContent.trim() === 'Brand'
)?.closest('section, div[class*="filter"]');

// Find checkbox by label
const samsungCheckbox = Array.from(document.querySelectorAll('label')).find(
  label => label.textContent.includes('Samsung')
)?.querySelector('input[type="checkbox"]');
```

## Stable Selectors (When Available)

### Search Input
```
input[name="q"]
input[placeholder*="Search"]
```

### Filter Checkboxes
```
input[type="checkbox"][class*="filter"]
label:has(input[type="checkbox"])
```

### Clear All Filters
```
a[href*="?q="]:not([href*="p[]="])
// Or text-based:
Array.from(document.querySelectorAll('a')).find(a => a.textContent === 'Clear all')
```

### Applied Filters
```
div[class*="applied-filter"]
div:has(> span:contains("✕"))
```

## Filter Application Methods

### Method 1: Checkbox Click
```javascript
const checkbox = document.querySelector('input[type="checkbox"]');
checkbox.click();
// Wait for page reload or AJAX update
```

### Method 2: URL Navigation (More Reliable)
```javascript
const currentUrl = new URL(window.location.href);
currentUrl.searchParams.append('p[]', 'facets.brand[]=Samsung');
window.location.href = currentUrl.toString();
```

## Key Differences from Amazon

| Feature | Amazon | Flipkart |
|---------|--------|----------|
| Filter URL | Single `rh` parameter | Multiple `p[]` parameters |
| Class Names | Stable (`a-checkbox`) | Obfuscated, change frequently |
| Filter IDs | Stable (`p_36`, `p_89`) | Based on facet names |
| Price Format | Paise (₹1 = 100) | Rupees directly |
| Multi-Select | Pipe separator `\|` | Multiple `p[]` parameters |
| Filter Discovery | By ID | By text content |

## Filter Discovery Strategy

### 1. Text-Based Discovery
```javascript
function discoverFlipkartFilters() {
  const filters = {};
  
  // Common filter titles
  const filterTitles = ['Brand', 'Price', 'RAM', 'Internal Storage', 'Battery Capacity', 'Customer Ratings'];
  
  filterTitles.forEach(title => {
    const filterSection = Array.from(document.querySelectorAll('div')).find(
      div => div.textContent.trim() === title
    );
    
    if (filterSection) {
      const parent = filterSection.closest('section, div[class*="container"]');
      const options = Array.from(parent.querySelectorAll('label')).map(label => ({
        text: label.textContent.trim(),
        checkbox: label.querySelector('input[type="checkbox"]')
      }));
      
      filters[title] = options;
    }
  });
  
  return filters;
}
```

### 2. Link-Based Discovery
```javascript
function discoverFilterLinks() {
  const links = document.querySelectorAll('a[href*="facets"]');
  return Array.from(links).map(link => ({
    text: link.textContent.trim(),
    href: link.href,
    filterParam: new URL(link.href).searchParams.get('p[]')
  }));
}
```

## Filter Verification

### Check URL
```javascript
function verifyFlipkartFilter(facetName, value) {
  const params = new URLSearchParams(window.location.search);
  const pParams = params.getAll('p[]');
  
  const encodedFilter = `facets.${facetName}[]=${value}`;
  return pParams.some(p => decodeURIComponent(p).includes(encodedFilter));
}
```

### Check Active Filter Badges
```javascript
function getActiveFilters() {
  // Look for clear/remove filter buttons
  const clearButtons = document.querySelectorAll('[class*="clear"], [class*="remove"]');
  return Array.from(clearButtons).map(btn => btn.textContent.trim());
}
```

## Brand Name Mapping

### Consistent Names
```
Samsung → Samsung
Apple → Apple
Xiaomi → XIAOMI (sometimes uppercase)
OnePlus → OnePlus
Realme → realme (lowercase)
```

## RAM Values

```
2 GB
3 GB
4 GB
6 GB and Above
8 GB and Above
12 GB and Above
```

## Storage Values

```
32 GB and Below
64 GB - 127 GB
128 GB - 255 GB
256 GB and Above
```

## Battery Values

```
3000 mAh and Above
4000 mAh and Above
5000 mAh and Above
6000 mAh and Above
```

## Price Filter

### Price Range Selector
```html
<div class="_2gmrv0">
  <select>
    <option value="">Min</option>
    <option value="10000">₹10,000</option>
    <option value="15000">₹15,000</option>
  </select>
  <select>
    <option value="">Max</option>
    <option value="20000">₹20,000</option>
    <option value="25000">₹25,000</option>
  </select>
</div>
```

Or direct URL:
```
?p[]=facets.price_range.from=10000&p[]=facets.price_range.to=20000
```

## Mobile App vs Web Differences

### Web (Desktop/Mobile Browser)
- Standard DOM structure
- Filters in sidebar or modal
- URL-based navigation

### Mobile App
- Native controls
- Different API endpoints
- Not accessible to extension

## Best Practices

### 1. Use URL Navigation
Flipkart's DOM changes frequently, URL manipulation is more reliable.

### 2. Wait for Page Load
```javascript
await waitForCondition(() => {
  return document.querySelector('div[data-id]')?.children.length > 0;
}, { timeout: 5000 });
```

### 3. Handle AJAX Updates
```javascript
const observer = new MutationObserver(() => {
  // Check if products updated
  const products = document.querySelectorAll('[data-id]');
  if (products.length > 0) {
    observer.disconnect();
    // Process products
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

### 4. Normalize Filter Values
```javascript
function normalizeFilterValue(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '+')
    .replace('gb', 'GB')
    .replace('mah', 'mAh');
}
```

## Common Issues

### Issue 1: Class Names Changed
**Solution**: Use text-based selection or data attributes

### Issue 2: Filter Not Applied
**Solution**: Use URL navigation instead of clicking

### Issue 3: Product Count Not Updated
**Solution**: Wait for DOM mutation or URL change

### Issue 4: Price Range Not Working
**Solution**: Use URL parameters directly:
```
?p[]=facets.price_range.from=X&p[]=facets.price_range.to=Y
```

## Implementation Priority

1. **Price Range** - Use URL parameters
2. **Brand** - Text-based checkbox selection or URL
3. **RAM** - URL parameter with normalized values
4. **Storage** - URL parameter with normalized values
5. **Battery** - URL parameter with normalized values
6. **Rating** - URL parameter

## Testing URLs

### Example: Samsung Phones with Filters
```
https://www.flipkart.com/search?q=samsung+phone&p[]=facets.brand%255B%255D%3DSamsung&p[]=facets.ram%255B%255D%3D6%2BGB%2Band%2BAbove&p[]=facets.battery_capacity%255B%255D%3D5000%2BmAh%2Band%2BAbove&p[]=facets.price_range.from%3D10000&p[]=facets.price_range.to%3D20000
```

## Resources
- Flipkart's facet-based filtering system
- Browser DevTools for DOM inspection
- Network tab for AJAX monitoring
- URL parameter encoding/decoding tools
