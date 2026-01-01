# Amazon Filter URL Parameter Structure Research

## Overview
Amazon uses URL-based filtering with the `rh` (refinement history) parameter to encode filter selections.

## Filter Parameter Structure

### Base URL Format
```
https://www.amazon.in/s?k={search_query}&rh={filter_params}&ref=nb_sb_noss
```

### RH Parameter Format
The `rh` parameter contains comma-separated filter specifications:
```
rh=filter_id:value1|value2,filter_id2:range_start-range_end
```

## Known Filter IDs and Value Codes

### 1. Customer Reviews (`p_123`)
```
p_123:46655  = 4 stars & up
p_123:46654  = 3 stars & up
p_123:46653  = 2 stars & up
p_123:46652  = 1 star & up
```

### 2. Price Range (`p_36`)
Format: `p_36:min_paise-max_paise`
- Price must be in **paise** (1 rupee = 100 paise)
- Example: ₹13,000 to ₹19,500 = `p_36:1300000-1950000`

```
Examples:
- Under ₹10,000: p_36:0-1000000
- ₹10,000-₹20,000: p_36:1000000-2000000
- Over ₹50,000: p_36:5000000-
```

### 3. Battery Capacity (`p_n_g-101015098008111`)
```
p_n_g-101015098008111:91805324031  = 3000-3999 mAh
p_n_g-101015098008111:91805325031  = 4000-4999 mAh
p_n_g-101015098008111:91805326031  = 5000-5999 mAh
p_n_g-101015098008111:92071917031  = 6000+ mAh
```

### 4. RAM (`p_n_g-1003495121111`)
```
p_n_g-1003495121111:44897277031  = 2 GB
p_n_g-1003495121111:44897278031  = 3 GB
p_n_g-1003495121111:44897279031  = 4 GB
p_n_g-1003495121111:44897287031  = 6 GB
p_n_g-1003495121111:44897288031  = 8 GB
p_n_g-1003495121111:44897289031  = 12 GB
p_n_g-1003495121111:44897290031  = 16 GB
```

### 5. Storage Capacity (`p_n_g-1003492455111`)
```
p_n_g-1003492455111:44349045031  = 32 GB
p_n_g-1003492455111:44349046031  = 64 GB
p_n_g-1003492455111:44349047031  = 128 GB
p_n_g-1003492455111:44349048031  = 256 GB
p_n_g-1003492455111:44349049031  = 512 GB
p_n_g-1003492455111:44349050031  = 1 TB
```

### 6. Brand (`p_89`)
Brand names are typically text-based or have numeric codes:
```
p_89:Samsung
p_89:Apple
p_89:Xiaomi
p_89:OnePlus
```

### 7. Display Size (`p_n_g-1003469290111`)
```
p_n_g-1003469290111:33962286031  = Under 5 inches
p_n_g-1003469290111:33962287031  = 5-5.5 inches
p_n_g-1003469290111:33962288031  = 5.5-6 inches
p_n_g-1003469290111:33962289031  = 6-6.5 inches
p_n_g-1003469290111:33962290031  = 6.5+ inches
```

### 8. Condition (`p_n_condition-type`)
```
p_n_condition-type:8609959031  = New
p_n_condition-type:8609960031  = Renewed
p_n_condition-type:8609961031  = Used
```

### 9. Operating System (`p_n_g-1002989427111`)
```
p_n_g-1002989427111:27179438031  = Android
p_n_g-1002989427111:27179439031  = iOS
```

### 10. SIM Type (`p_n_g-1004151207091`)
```
p_n_g-1004151207091:1898694031  = Dual SIM
p_n_g-1004151207091:1898695031  = Single SIM
```

## URL Encoding Rules

### 1. Comma Separator
Multiple filters separated by comma:
```
rh=p_123:46655,p_36:1300000-1950000
```

### 2. Pipe Separator for Multiple Values
Multiple values for same filter use pipe `|`:
```
p_n_g-1003495121111:44897287031|44897288031  (6GB or 8GB)
```

### 3. URL Encoding
- Pipe `|` encoded as `%7C` or `%257C` (double encoding)
- Comma `,` can stay as comma
- Colon `:` can stay as colon
- Space encoded as `+` or `%20`

Example encoded:
```
rh=p_36:1300000-1950000,p_n_g-101015098008111:91805326031%257C92071917031
```

## Real-World Example

### Test Case Analysis

**Before Filters:**
```
URL: https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&ref=nb_sb_noss
Results: 25 products
```

**After Filters:**
```
URL: https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&rh=p_123%3A46655%2Cp_36%3A1300000-1950000%2Cp_n_g-101015098008111%3A91805326031%257C92071917031%2Cp_n_g-1003495121111%3A44897287031%257C44897288031&dc&qid=1767022371&rnid=44897277031&ref=sr_nr_p_n_g-1003495121111_3&ds=v1%3AZQV89QESc5y%2FWzhdeMSjFcoLykx4MoVjzydVHcxmf%2B0
Results: 12 products
```

**Decoded `rh` Parameter:**
```
p_123:46655  (4+ stars)
p_36:1300000-1950000  (₹13,000-₹19,500)
p_n_g-101015098008111:91805326031|92071917031  (5000-5999mAh or 6000+mAh)
p_n_g-1003495121111:44897287031|44897288031  (6GB or 8GB RAM)
```

## Additional Parameters

### Sort Parameter (`s`)
```
s=relevancerank  = Best Match (default)
s=price-asc-rank  = Price: Low to High
s=price-desc-rank  = Price: High to Low
s=review-rank  = Avg. Customer Review
s=date-desc-rank  = Newest Arrivals
```

### Pagination (`page`)
```
page=1, page=2, etc.
```

### Department Category (`i`)
```
i=electronics
i=computers
i=mobile-phones
```

## Filter Discovery Strategy

### Method 1: URL Analysis
1. Perform manual filter on Amazon
2. Copy resulting URL
3. Extract `rh` parameter
4. Decode and analyze filter codes

### Method 2: DOM Inspection
1. Inspect filter sidebar elements
2. Look for `data-value` attributes
3. Map visible labels to filter codes

### Method 3: Network Monitoring
1. Open DevTools Network tab
2. Apply filter on Amazon
3. Inspect XHR/Fetch requests
4. Extract filter parameters from request

## Implementation Notes

### Priority Order
1. **Price filters** - Drastically reduce result set
2. **Brand filters** - Further narrow results
3. **Specification filters** (RAM, battery, storage)
4. **Rating filters** - Final refinement

### Validation
- Always verify URL encoding is correct
- Check product count changed after filter application
- Validate filter parameters appear in URL
- Test with multiple value combinations

### Error Handling
- Invalid filter codes → Skip that filter
- No results after filtering → Relax filters
- URL too long → Prioritize essential filters

## Resources
- Amazon's internal filter documentation (if available)
- Browser DevTools Network tab for real-time analysis
- Community reverse-engineering efforts
