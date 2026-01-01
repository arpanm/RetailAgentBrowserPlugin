# Amazon Filter Sidebar DOM Structure Research

## Overview
Amazon's filter sidebar uses a complex DOM structure with unique IDs and classes for each filter category.

## Filter Sidebar Container

### Main Container
```html
<div id="s-refinements" class="s-refinements">
  <!-- All filters contained here -->
</div>
```

**Selector**: `#s-refinements` or `.s-refinements`

## Filter Group Structure

### Individual Filter Group
```html
<div id="p_n_g-1003495121111" class="a-section">
  <span id="p_n_g-1003495121111-title" class="a-size-base a-color-base">
    <span class="a-text-bold">RAM</span>
  </span>
  <ul class="a-unordered-list">
    <li><a href="...">
      <span class="a-list-item">
        <div class="a-checkbox">
          <input type="checkbox" ...>
        </div>
        <span class="a-size-base">6 GB</span>
        <span class="a-size-base">(15)</span>
      </span>
    </a></li>
  </ul>
</div>
```

## Filter Category IDs

### Common Filter IDs

| Filter Category | DOM ID | Description |
|----------------|---------|-------------|
| Price | `p_36` or `#priceRefinements` | Price range slider/checkboxes |
| Brand | `p_89` or `#brandsRefinements` | Brand checkboxes |
| Customer Reviews | `p_72` or `#reviewsRefinements` | Star rating filters |
| RAM | `p_n_g-1003495121111` | RAM capacity options |
| Battery | `p_n_g-101015098008111` | Battery capacity (mAh) |
| Storage | `p_n_g-1003492455111` | Storage capacity options |
| Display Size | `p_n_g-1003469290111` | Screen size ranges |
| Operating System | `p_n_g-1002989427111` | OS options (Android/iOS) |
| SIM Type | `p_n_g-1004151207091` | Dual SIM / Single SIM |
| Condition | `p_n_condition-type` | New / Renewed / Used |

## Filter Elements Structure

### Checkbox Filter
```html
<div id="p_n_g-1003495121111" class="a-section">
  <!-- Title -->
  <span id="p_n_g-1003495121111-title" class="a-size-base">
    <span class="a-text-bold">RAM</span>
  </span>
  
  <!-- Filter options list -->
  <ul class="a-unordered-list a-nostyle a-vertical">
    <li>
      <a class="a-link-normal" href="/s?rh=...">
        <span class="a-list-item">
          <!-- Checkbox (visual only, not functional) -->
          <div class="a-checkbox a-checkbox-fancy">
            <input type="checkbox" name="p_n_g-1003495121111" value="44897287031">
            <i class="a-icon a-icon-checkbox"></i>
          </div>
          <!-- Label -->
          <span class="a-size-base a-color-base">6 GB</span>
          <!-- Count -->
          <span class="a-size-base a-color-base">(15)</span>
        </span>
      </a>
    </li>
  </ul>
</div>
```

**Key Selectors**:
- Container: `div[id="p_n_g-1003495121111"]`
- Title: `#p_n_g-1003495121111-title`
- Options: `#p_n_g-1003495121111 ul li a`
- Checkbox: `input[name="p_n_g-1003495121111"]`
- Label: `#p_n_g-1003495121111 .a-list-item span.a-size-base`

### Price Range Slider
```html
<div id="p_36" class="a-section">
  <span class="a-text-bold">Price</span>
  
  <!-- Price input fields -->
  <form class="a-spacing-none">
    <span class="a-declarative">
      <span class="a-dropdown-container">
        <select name="low-price" id="low-price">
          <option value="">Min</option>
          <option value="10000">₹10,000</option>
          <option value="15000">₹15,000</option>
        </select>
      </span>
      <span class="a-dropdown-container">
        <select name="high-price" id="high-price">
          <option value="">Max</option>
          <option value="20000">₹20,000</option>
          <option value="25000">₹25,000</option>
        </select>
      </span>
    </span>
    <span class="a-button">
      <input type="submit" value="Go" class="a-button-input">
    </span>
  </form>
  
  <!-- Or predefined price ranges -->
  <ul class="a-unordered-list">
    <li><a href="...">Under ₹10,000</a></li>
    <li><a href="...">₹10,000 - ₹20,000</a></li>
    <li><a href="...">₹20,000 - ₹30,000</a></li>
    <li><a href="...">Over ₹30,000</a></li>
  </ul>
</div>
```

**Key Selectors**:
- Container: `#p_36` or `#priceRefinements`
- Min price input: `#low-price` or `input[name="low-price"]`
- Max price input: `#high-price` or `input[name="high-price"]`
- Submit button: `#p_36 .a-button-input`
- Range links: `#p_36 ul li a`

### Brand Filter
```html
<div id="p_89" class="a-section">
  <span class="a-text-bold">Brand</span>
  
  <!-- Search box for brands -->
  <div class="s-brand-search">
    <input type="text" id="s-ref-checkbox-Brand" placeholder="Search brands">
  </div>
  
  <!-- Brand list -->
  <ul id="p_89/Samsung" class="a-unordered-list">
    <li><a href="...">
      <div class="a-checkbox">
        <input type="checkbox" name="s-ref-checkbox-Samsung" value="Samsung">
      </div>
      <span>Samsung</span>
      <span>(234)</span>
    </a></li>
  </ul>
  
  <!-- See more link -->
  <span class="a-expander-prompt">
    <a href="javascript:void(0)" data-action="s-ref-checkbox-brands-more">
      See more
    </a>
  </span>
</div>
```

**Key Selectors**:
- Container: `#p_89` or `#brandsRefinements`
- Search input: `#s-ref-checkbox-Brand`
- Brand checkboxes: `#p_89 input[type="checkbox"]`
- Brand links: `#p_89 ul li a`
- See more: `#p_89 .a-expander-prompt a`

### Customer Reviews Filter
```html
<div id="p_72" class="a-section">
  <span class="a-text-bold">Customer Reviews</span>
  
  <ul class="a-unordered-list">
    <li><a href="..." aria-label="4 Stars & Up">
      <i class="a-icon a-icon-star-medium a-star-medium-4"></i>
      <span class="a-letter-space"></span>
      <span aria-label="4 Stars & Up">& Up</span>
      <span>(150)</span>
    </a></li>
    <li><a href="..." aria-label="3 Stars & Up">
      <i class="a-icon a-icon-star-medium a-star-medium-3"></i>
      <span aria-label="3 Stars & Up">& Up</span>
      <span>(280)</span>
    </a></li>
  </ul>
</div>
```

**Key Selectors**:
- Container: `#p_72` or `#reviewsRefinements`
- 4+ stars: `#p_72 a[aria-label*="4 Stars"]` or link with `.a-star-medium-4`
- 3+ stars: `#p_72 a[aria-label*="3 Stars"]` or link with `.a-star-medium-3`

## Filter Application Methods

### Method 1: Click Link (Preferred)
```javascript
// Most filters are links that navigate to filtered URL
const filterLink = document.querySelector('#p_n_g-1003495121111 ul li a');
filterLink.click();
```

### Method 2: Check Checkbox + Submit
```javascript
// Some filters require checkbox + form submission
const checkbox = document.querySelector('input[name="p_n_g-1003495121111"][value="44897287031"]');
checkbox.checked = true;
checkbox.dispatchEvent(new Event('change', { bubbles: true }));
```

### Method 3: URL Manipulation (Most Reliable)
```javascript
// Directly navigate to URL with filter parameters
const currentUrl = new URL(window.location.href);
currentUrl.searchParams.set('rh', 'p_n_g-1003495121111:44897287031');
window.location.href = currentUrl.toString();
```

## DOM vs URL Mapping

### Filter in DOM
```html
<li><a href="/s?k=samsung&rh=p_n_g-1003495121111:44897287031">
  6 GB (15)
</a></li>
```

### Corresponding URL After Click
```
https://www.amazon.in/s?k=samsung&rh=p_n_g-1003495121111:44897287031
```

### Active Filter Indicator
```html
<!-- After filter applied, appears at top of page -->
<div id="applied-filters">
  <span class="a-size-base a-color-base">
    <span class="a-text-bold">RAM:</span> 6 GB
    <a href="/s?k=samsung" class="a-link-normal">
      <i class="a-icon a-icon-close"></i>
    </a>
  </span>
</div>
```

**Selector for active filters**: `.a-color-base.a-text-bold` or `#applied-filters span`

## Filter Expansion (See More)

### Collapsed Filter Section
```html
<div id="p_89" class="a-section">
  <!-- Visible brands (default 10) -->
  <ul>...</ul>
  
  <!-- Expander -->
  <div class="a-expander-container">
    <a class="a-expander-header" data-action="a-expander-toggle">
      <i class="a-icon a-icon-expand"></i>
      <span class="a-expander-prompt">See more</span>
    </a>
    
    <!-- Hidden content -->
    <div class="a-expander-content a-expander-partial-collapse-content" style="display:none;">
      <ul>
        <!-- Additional brands -->
      </ul>
    </div>
  </div>
</div>
```

**Expansion Selectors**:
- See more button: `.a-expander-header`, `[data-action="a-expander-toggle"]`
- Hidden content: `.a-expander-content`
- After expansion: `.a-expander-content[style*="display: block"]`

## Filter Discovery Algorithm

```javascript
function discoverFilters() {
  const filters = {};
  
  // Find all filter groups
  const filterGroups = document.querySelectorAll('#s-refinements > div[id^="p_"]');
  
  filterGroups.forEach(group => {
    const filterId = group.id;
    const titleEl = group.querySelector(`#${filterId}-title, .a-text-bold`);
    const title = titleEl?.textContent.trim();
    
    // Get all options
    const options = [];
    group.querySelectorAll('ul li a').forEach(link => {
      const label = link.querySelector('.a-size-base')?.textContent.trim();
      const href = link.getAttribute('href');
      const count = link.querySelector('.a-size-base:last-child')?.textContent.trim();
      
      options.push({ label, href, count });
    });
    
    filters[filterId] = { title, options };
  });
  
  return filters;
}
```

## Best Practices

### 1. Wait for Elements
```javascript
await waitForElement('#s-refinements', { timeout: 5000 });
```

### 2. Handle Dynamic Loading
```javascript
// Filters may load after initial page render
const observer = new MutationObserver(() => {
  if (document.querySelector('#s-refinements')) {
    observer.disconnect();
    // Process filters
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

### 3. Verify Filter Applied
```javascript
function verifyFilterApplied(filterId, value) {
  const url = new URL(window.location.href);
  const rh = url.searchParams.get('rh') || '';
  return rh.includes(`${filterId}:${value}`);
}
```

### 4. Handle Multiple Values
```javascript
// For filters that support multiple selections
const selectedValues = Array.from(
  document.querySelectorAll(`input[name="${filterId}"]:checked`)
).map(input => input.value);
```

## Common Issues & Solutions

### Issue 1: Filter Not Clickable
**Solution**: Check if parent `<a>` tag is the clickable element, not checkbox

### Issue 2: Filter Doesn't Apply
**Solution**: Use URL navigation instead of DOM clicking

### Issue 3: See More Not Expanding
**Solution**: Trigger click on expander header, wait for animation

### Issue 4: Active Filters Not Detected
**Solution**: Check both URL parameters and DOM indicators

## Mobile vs Desktop Differences

### Desktop
- Sidebar on left
- All filters visible
- Hover effects available

### Mobile
- Filters in modal dialog
- Accessed via "Filters" button
- Different DOM structure
- Container: `.s-filter-panel-modal`

## Resources
- Chrome DevTools Elements panel for DOM inspection
- Amazon's a-expander JavaScript component
- Filter interaction logging for debugging
