# Amazon Filter URL Parameter Structure Research

## Overview
Amazon.in uses URL-based filtering with parameters encoded in the `rh` (refinement) parameter. This document provides comprehensive mapping of all filter types, their IDs, value codes, and URL encoding rules.

## Filter URL Structure

### Base Format
```
https://www.amazon.in/s?k={search_query}&rh={filter_parameters}
```

### Example URL (From Test Case)
**Before filters:**
```
https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&ref=nb_sb_noss
```
- Product count: 25 results

**After filters:**
```
https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&rh=p_123%3A46655%2Cp_36%3A1300000-1950000%2Cp_n_g-101015098008111%3A91805326031%257C92071917031%2Cp_n_g-1003495121111%3A44897287031%257C44897288031
```
- Product count: 12 results

### URL Decoding
The `rh` parameter decoded:
```
rh=p_123:46655,p_36:1300000-1950000,p_n_g-101015098008111:91805326031|92071917031,p_n_g-1003495121111:44897287031|44897288031
```

## Filter Parameter Mapping

### 1. Customer Reviews (`p_123`)
**Filter ID:** `p_123`

**Value Codes:**
- `46655` = 4 Stars & Up
- `46654` = 3 Stars & Up
- `46653` = 2 Stars & Up
- `46652` = 1 Star & Up

**Example:**
```
p_123:46655  // 4+ stars only
```

### 2. Price Range (`p_36`)
**Filter ID:** `p_36`

**Format:** `p_36:{minPaise}-{maxPaise}`

**Important:** Prices are in paise (1 Rupee = 100 paise)

**Conversion:**
- ₹13,000 = 1,300,000 paise
- ₹19,500 = 1,950,000 paise
- ₹20,000 = 2,000,000 paise

**Example:**
```
p_36:1300000-1950000  // ₹13,000 to ₹19,500
p_36:500000-1000000   // ₹5,000 to ₹10,000
p_36:-2000000         // Under ₹20,000 (no min)
p_36:1500000-         // Above ₹15,000 (no max)
```

### 3. Battery Capacity (`p_n_g-101015098008111`)
**Filter ID:** `p_n_g-101015098008111`

**Value Codes:**
- `91805326031` = 5000 mAh & Above
- `92071917031` = 6000 mAh & Above
- Other codes for specific mAh ranges

**Example:**
```
p_n_g-101015098008111:91805326031           // 5000mAh+
p_n_g-101015098008111:91805326031|92071917031  // 5000mAh+ OR 6000mAh+
```

### 4. RAM Size (`p_n_g-1003495121111`)
**Filter ID:** `p_n_g-1003495121111`

**Value Codes:**
- `44897277031` = 2 GB
- `44897278031` = 3 GB
- `44897279031` = 4 GB
- `44897287031` = 6 GB
- `44897288031` = 8 GB
- `44897289031` = 12 GB
- `44897290031` = 16 GB

**Example:**
```
p_n_g-1003495121111:44897287031             // 6GB only
p_n_g-1003495121111:44897287031|44897288031 // 6GB OR 8GB
```

### 5. Internal Storage (`p_n_g-1003492455111`)
**Filter ID:** `p_n_g-1003492455111`

**Value Codes:**
- `44349045031` = 32 GB
- `44349046031` = 64 GB
- `44349047031` = 128 GB
- `44349048031` = 256 GB
- `44349049031` = 512 GB
- `44349050031` = 1 TB

**Example:**
```
p_n_g-1003492455111:44349047031             // 128GB
p_n_g-1003492455111:44349047031|44349048031 // 128GB OR 256GB
```

### 6. Brand (`p_89` or `brandsRefinements`)
**Filter ID:** `p_89`

**Value Codes:** Brand-specific codes (dynamic based on category)

**Common Brand Codes:**
- Samsung: (varies by category)
- Apple: (varies by category)
- OnePlus: (varies by category)
- Xiaomi: (varies by category)

**Example:**
```
p_89:12345678  // Specific brand code
```

### 7. Other Common Filters

#### Operating System (`p_n_g-1003469290111`)
**Filter ID:** `p_n_g-1003469290111`
- Android, iOS, etc.

#### Screen Size (`p_n_feature_nineteen_browse-bin`)
**Filter ID:** `p_n_feature_nineteen_browse-bin`
- Various screen size ranges

#### Connectivity (`p_n_feature_browse-bin`)
**Filter ID:** `p_n_feature_browse-bin`
- 4G, 5G, etc.

## URL Encoding Rules

### 1. Basic Encoding
- `:` (colon) → `%3A`
- `,` (comma) → `%2C`
- `|` (pipe) → `%7C` or `%257C` (double-encoded)
- Space → `+` or `%20`
- `-` (dash) → `-` (not encoded in filter values)

### 2. Multiple Values
Use pipe `|` separator (URL-encoded as `%7C` or `%257C`):
```
p_n_g-1003495121111:44897287031|44897288031  // 6GB OR 8GB
```

### 3. Multiple Filters
Use comma `,` separator (URL-encoded as `%2C`):
```
p_123:46655,p_36:1300000-1950000,p_n_g-101015098008111:91805326031
```

### 4. Complete Example
Raw:
```
rh=p_123:46655,p_36:1300000-1950000,p_n_g-101015098008111:91805326031|92071917031
```

URL-encoded:
```
rh=p_123%3A46655%2Cp_36%3A1300000-1950000%2Cp_n_g-101015098008111%3A91805326031%257C92071917031
```

## Filter Application Priority

Based on URL structure and testing, recommended priority:

1. **Price Range** (`p_36`) - Reduces result set most effectively
2. **Brand** (`p_89`) - Further narrows results
3. **RAM** (`p_n_g-1003495121111`) - Spec-based filtering
4. **Battery** (`p_n_g-101015098008111`) - Spec-based filtering
5. **Storage** (`p_n_g-1003492455111`) - Spec-based filtering
6. **Customer Reviews** (`p_123`) - Quality filtering

## URL Construction Algorithm

```javascript
function buildAmazonFilterURL(baseURL, filters) {
    const refinements = [];
    
    // 1. Price filter
    if (filters.price_min || filters.price_max) {
        const minPaise = filters.price_min ? filters.price_min * 100 : '';
        const maxPaise = filters.price_max ? filters.price_max * 100 : '';
        refinements.push(`p_36:${minPaise}-${maxPaise}`);
    }
    
    // 2. Rating filter
    if (filters.rating >= 4) {
        refinements.push('p_123:46655'); // 4+ stars
    } else if (filters.rating >= 3) {
        refinements.push('p_123:46654'); // 3+ stars
    }
    
    // 3. Battery filter
    if (filters.battery >= 6000) {
        refinements.push('p_n_g-101015098008111:92071917031');
    } else if (filters.battery >= 5000) {
        refinements.push('p_n_g-101015098008111:91805326031|92071917031');
    }
    
    // 4. RAM filter
    const ramCodes = {
        2: '44897277031',
        3: '44897278031',
        4: '44897279031',
        6: '44897287031',
        8: '44897288031',
        12: '44897289031',
        16: '44897290031'
    };
    if (filters.ram) {
        const ramGB = parseInt(filters.ram);
        const codes = Object.entries(ramCodes)
            .filter(([gb]) => parseInt(gb) >= ramGB)
            .map(([_, code]) => code);
        if (codes.length > 0) {
            refinements.push(`p_n_g-1003495121111:${codes.join('|')}`);
        }
    }
    
    // Join all refinements
    const rhParam = refinements.join(',');
    
    // Add to URL
    const url = new URL(baseURL);
    url.searchParams.set('rh', rhParam);
    
    return url.toString();
}
```

## Verification Methods

### 1. URL Verification
Check that URL contains expected `rh` parameter with correct filter codes.

### 2. Product Count Verification
Compare product count before and after filter application. Should decrease.

### 3. DOM Verification
Check for active filter indicators:
- `.a-badge-label` - Filter chips
- `[aria-label*="Clear filters"]` - Clear filter button
- `.s-navigation-clear-link` - Clear link in sidebar

### 4. Visual Verification
Filter sidebar should show checked/selected filters with visual indicators.

## Edge Cases

### 1. No Results
Some filter combinations may result in 0 products. Handle gracefully.

### 2. Invalid Filter Codes
Using incorrect filter codes will be ignored by Amazon (no error).

### 3. Conflicting Filters
Some filters may conflict (e.g., brand + incompatible specs).

### 4. Category-Specific Filters
Filter IDs and codes can vary by product category. Above codes are for Electronics > Mobile Phones.

## Testing URLs

Test with these specific URLs:

**Test 1: Price only (Under ₹20,000)**
```
https://www.amazon.in/s?k=samsung+phone&rh=p_36:-2000000
```

**Test 2: Price + Rating**
```
https://www.amazon.in/s?k=samsung+phone&rh=p_36:-2000000,p_123:46655
```

**Test 3: Complete filter set (from test case)**
```
https://www.amazon.in/s?k=samsung+phone&rh=p_123:46655,p_36:1300000-1950000,p_n_g-101015098008111:91805326031|92071917031,p_n_g-1003495121111:44897287031|44897288031
```

## References

- Amazon URL structure analysis from test case
- Real-world filter application testing
- Amazon search results page inspection
- Filter ID extraction from DOM elements

