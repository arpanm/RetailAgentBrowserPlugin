# Flipkart Filter Structure Research

## Overview
Flipkart.com uses a different filter structure compared to Amazon, with simpler URL parameters and different DOM selectors. This document provides comprehensive analysis.

## URL Structure

### Base Format
```
https://www.flipkart.com/search?q={search_query}&param1=value1&param2=value2
```

### Example URLs

**Before filters:**
```
https://www.flipkart.com/search?q=samsung+phone+6gb+ram+5000mah+battery+under+20000
```

**After filters:**
```
https://www.flipkart.com/search?q=samsung+phone&p%5B%5D=facets.ram%255B%255D%3D6%2BGB&p%5B%5D=facets.battery_capacity%255B%255D%3D5000%2BmAh%2Band%2BAbove&p%5B%5D=facets.price_range.from%3D13000&p%5B%5D=facets.price_range.to%3D20000
```

## Filter Parameter Format

### Price Range
**Parameter:** `p[]=facets.price_range.from={min}&p[]=facets.price_range.to={max}`

**Example:**
```
p[]=facets.price_range.from=5000
p[]=facets.price_range.to=20000
```

### RAM
**Parameter:** `p[]=facets.ram[]={value}+GB`

**Examples:**
```
p[]=facets.ram[]=6+GB
p[]=facets.ram[]=8+GB
```

### Battery Capacity
**Parameter:** `p[]=facets.battery_capacity[]={value}+mAh+and+Above`

**Examples:**
```
p[]=facets.battery_capacity[]=5000+mAh+and+Above
p[]=facets.battery_capacity[]=6000+mAh+and+Above
```

### Brand
**Parameter:** `p[]=facets.brand[]={brand_name}`

**Example:**
```
p[]=facets.brand[]=Samsung
p[]=facets.brand[]=OnePlus
```

### Rating
**Parameter:** `p[]=facets.rating[]={rating}+★+%26+above`

**Examples:**
```
p[]=facets.rating[]=4★+%26+above
p[]=facets.rating[]=3★+%26+above
```

## DOM Structure

### Product Container
```html
<div class="_1AtVbE col-12-12" data-id="MOBXXXXXXXX">
    <a class="_1fQZEK" href="/product-name/p/itm123456789">
        <div class="_312yB9 _1KuRV5">
            <img class="_396cs4 _2amPTt _3qGmMb" src="..." alt="Samsung Galaxy...">
        </div>
    </a>
    
    <div class="_2kHMtA">
        <a class="IRpwTa" href="/product-name/p/itm123456789">
            <div class="_4rR01T">Samsung Galaxy M14 5G</div>
        </a>
        
        <div class="_30jeq3 _1_WHN1">
            ₹13,990
        </div>
        
        <div class="_3LWZlK">
            4.2
            <img src="..." class="_1_R_DZ">
        </div>
    </div>
</div>
```

**Key Selectors:**
- Container: `div[data-id]`, `._1AtVbE`
- Link: `a.IRpwTa`, `a._1fQZEK`, `a[href*="/p/"]`
- Title: `._4rR01T`, `.ygS67m`
- Price: `._30jeq3`, `._1_WHN1`
- Rating: `._3LWZlK`
- Image: `._396cs4`, `img[src*="flipkart"]`

### Filter Sidebar
```html
<div class="_1k1QCg">
    <div class="_2gmUFU _3V8rao">
        <div class="_3uDYxP">Price</div>
        <div>
            <select class="_1iFkle">
                <option value="">Min</option>
                <option value="5000">5000</option>
            </select>
            <div class="_1NVz6p">to</div>
            <select class="_1iFkle">
                <option value="">Max</option>
                <option value="20000">20000</option>
            </select>
        </div>
    </div>
    
    <div class="_2gmUFU _3V8rao">
        <div class="_3uDYxP">Brand</div>
        <div class="_24_Dny">
            <label class="_2uN8Y2">
                <input type="checkbox" class="_2GsDuj">
                <div class="_3hloQ8">Samsung</div>
            </label>
        </div>
    </div>
    
    <div class="_2gmUFU _3V8rao">
        <div class="_3uDYxP">RAM</div>
        <div class="_24_Dny">
            <label class="_2uN8Y2">
                <input type="checkbox" class="_2GsDuj">
                <div class="_3hloQ8">6 GB</div>
            </label>
            <label class="_2uN8Y2">
                <input type="checkbox" class="_2GsDuj">
                <div class="_3hloQ8">8 GB</div>
            </label>
        </div>
    </div>
</div>
```

**Key Selectors:**
- Filter sidebar: `._1k1QCg`, `.c-p9N_E`
- Filter group: `._2gmUFU`, `._3V8rao`
- Filter title: `._3uDYxP`
- Checkbox: `._2GsDuj`, `input[type="checkbox"]`
- Checkbox label: `._3hloQ8`
- Price dropdown: `._1iFkle`, `select`

### Sponsored Products
```html
<div class="_1AtVbE" data-id="MOBXXXXXXXX">
    <div class="_2aJJNI">Ad</div>
    <!-- Rest of product structure -->
</div>
```

**Sponsored Detection:**
- Ad label: `._2aJJNI` with text "Ad"
- Sometimes: `.adPlaceholder` class
- Less reliable than Amazon's detection

## Key Differences from Amazon

### 1. URL Parameters
- **Amazon:** Uses `rh` parameter with numeric filter IDs
- **Flipkart:** Uses `p[]` array parameters with descriptive names

### 2. Filter Application
- **Amazon:** Can navigate directly to filtered URL
- **Flipkart:** Often requires checkbox interaction, URL sync happens after

### 3. Sponsored Detection
- **Amazon:** Multiple reliable attributes (`data-component-type`, etc.)
- **Flipkart:** Mainly visual "Ad" label, less reliable

### 4. DOM Stability
- **Amazon:** Relatively stable selectors
- **Flipkart:** Frequent class name changes (obfuscated classes)

### 5. Filter Complexity
- **Amazon:** More filter options, hierarchical structure
- **Flipkart:** Simpler filter UI, flatter structure

## Flipkart Filter Application Strategy

### Recommended Approach: Hybrid
1. Try DOM clicking first (more reliable for Flipkart)
2. Wait for URL to update
3. Verify filters in URL
4. If DOM fails, try direct URL manipulation as fallback

### DOM Clicking Method
```javascript
async function applyFlipkartFilter(filterType, value) {
    // Find filter section
    const filterTitle = Array.from(document.querySelectorAll('._3uDYxP'))
        .find(el => el.textContent.trim().toLowerCase() === filterType.toLowerCase());
    
    if (!filterTitle) return false;
    
    const filterSection = filterTitle.closest('._2gmUFU');
    
    // Find and click checkbox with matching label
    const labels = filterSection.querySelectorAll('._3hloQ8');
    const targetLabel = Array.from(labels)
        .find(el => el.textContent.trim().includes(value));
    
    if (targetLabel) {
        const checkbox = targetLabel.parentElement.querySelector('._2GsDuj');
        checkbox.click();
        return true;
    }
    
    return false;
}
```

### URL Building Method (Less Reliable)
```javascript
function buildFlipkartFilterURL(baseURL, filters) {
    const url = new URL(baseURL);
    
    if (filters.price_min) {
        url.searchParams.append('p[]', `facets.price_range.from=${filters.price_min}`);
    }
    
    if (filters.price_max) {
        url.searchParams.append('p[]', `facets.price_range.to=${filters.price_max}`);
    }
    
    if (filters.ram) {
        url.searchParams.append('p[]', `facets.ram[]=${filters.ram}+GB`);
    }
    
    if (filters.battery) {
        url.searchParams.append('p[]', `facets.battery_capacity[]=${filters.battery}+mAh+and+Above`);
    }
    
    if (filters.brand) {
        url.searchParams.append('p[]', `facets.brand[]=${filters.brand}`);
    }
    
    return url.toString();
}
```

## Filter Priority for Flipkart

1. **Brand** - Reduces results significantly
2. **Price Range** - Further narrows results
3. **RAM** - Spec filtering
4. **Battery** - Spec filtering
5. **Rating** - Quality filtering

## Wait Conditions

After filter application, wait for:
1. URL parameter changes
2. Product grid refresh
3. Loading spinner disappears: `._26WgTJ`, `.loading`
4. Product count updates

## Testing Selectors

```javascript
// Count products
console.log('Products:', document.querySelectorAll('div[data-id]').length);

// Count sponsored
console.log('Sponsored:', document.querySelectorAll('._2aJJNI').length);

// Check active filters
console.log('Active filters:', new URLSearchParams(window.location.search).getAll('p[]'));

// Find filter sections
console.log('Filter sections:', document.querySelectorAll('._2gmUFU').length);
```

## Common Issues

### 1. Dynamic Class Names
Flipkart uses obfuscated class names that change frequently. Need fallback selectors.

### 2. AJAX Loading
Filter application triggers AJAX, not full page reload. Must wait for AJAX completion.

### 3. Filter Unavailability
Some filters may not be available for all product searches. Check existence first.

### 4. Mobile vs Desktop
Significantly different layouts. Filters in drawer on mobile.

## Recommendations

1. **Primary Method:** DOM clicking with checkbox interaction
2. **Verification:** Check URL parameters after clicking
3. **Fallback:** Use text-based filter discovery
4. **Testing:** Test extensively as selectors change frequently

