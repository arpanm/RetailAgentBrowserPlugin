# Test Case Specification

## Primary Test Case: Amazon Samsung Phone Shopping

### Test Scenario
Search for Samsung phones with specific filters, select first non-sponsored product, and initiate "Buy Now" action.

### Initial State

#### Starting URL
```
https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&ref=nb_sb_noss
```

#### Expected Results
- **Product Count**: 25 products
- **Page State**: Search results page
- **Filters Applied**: None (initial search)

### Filter Requirements

#### Filters to Apply
1. **Price Range**: ₹13,000 - ₹19,500
2. **Customer Reviews**: 4 stars and above
3. **Battery Capacity**: 5000-5999mAh OR 6000+mAh
4. **RAM**: 6GB OR 8GB

### Expected State After Filters

#### Filtered URL
```
https://www.amazon.in/s?k=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&rh=p_123%3A46655%2Cp_36%3A1300000-1950000%2Cp_n_g-101015098008111%3A91805326031%257C92071917031%2Cp_n_g-1003495121111%3A44897287031%257C44897288031&dc&qid=1767022371&rnid=44897277031&ref=sr_nr_p_n_g-1003495121111_3
```

#### URL Parameters Breakdown
- **Search Query** (`k`): `samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price`
- **Refinements** (`rh`): 
  - `p_123:46655` - 4+ stars rating
  - `p_36:1300000-1950000` - Price range (₹13,000-₹19,500 in paise)
  - `p_n_g-101015098008111:91805326031|92071917031` - Battery (5000-5999mAh | 6000+mAh)
  - `p_n_g-1003495121111:44897287031|44897288031` - RAM (6GB | 8GB)

#### Expected Results
- **Product Count**: 12 products
- **Page State**: Filtered search results
- **Verification**: URL contains all filter parameters

### Product Selection

#### Selection Criteria
1. **First non-sponsored product**
2. **Must meet filter criteria**
3. **Must have valid product page link**

#### Expected Selected Product
**URL**:
```
https://www.amazon.in/Samsung-Moonlight-Storage-Gorilla-Upgrades/dp/B0FN7W26Q8/ref=sr_1_3?dib=eyJ2IjoiMSJ9.m3K6MyBXTxbjT_A7DDKJxRnEZHPAdGQFLAuFdMlMvEdVE7IfO4OuI7QNVL2tbK5XLJ9ZHzxiK0c6LiOWWqqoPEdOXYoxA7cPapremj74A1p4vwtUb8cJ9aMxBxItb6FfhvqLoFlYj86fe6LA-hpVReLAppfBd7WEPkUu_ugiV16yILYDpUEYNpO3.6VNWLVmqMXC2HpDqw9eYBML9USrzEl9PGidIu-6XE9Q&dib_tag=se&keywords=samsung+phone+5000%2B+battery+and+6GB%2B+ram+under+20000RS+price&nsdOptOutParam=true&qid=1767022373&refinements=p_123%3A46655%2Cp_36%3A1300000-1950000%2Cp_n_g-101015098008111%3A91805326031%7C92071917031%2Cp_n_g-1003495121111%3A44897287031%7C44897288031&rnid=44897277031&sr=8-3
```

**ASIN**: `B0FN7W26Q8`

**Product**: Samsung Galaxy (Moonlight Blue, with appropriate specs)

#### Verification
- Product page URL contains `/dp/B0FN7W26Q8/`
- Page loads successfully
- Product details visible
- Buy Now button present

### Buy Now Action

#### Expected Button
- **Selector**: `#buy-now-button`
- **Alternative**: `input[name="submit.buy-now"]`
- **State**: Enabled, visible, clickable

#### Expected Outcome After Click
1. **Navigation to checkout** OR
2. **Login modal appears** OR
3. **Address selection page**

#### Verification Criteria
- URL changes to contain `/gp/buy/` OR `/checkout/` OR `/spc/`
- OR login modal visible with selectors: `#ap_email`, `#ap_password`
- Extension stops after retry limit (3 attempts) if Buy Now fails

## Step-by-Step Test Flow

### Step 1: Navigate to Amazon
```javascript
const startURL = 'https://www.amazon.in/';
// Expected: Amazon homepage loads
```

### Step 2: Perform Search
```javascript
const searchQuery = 'samsung phone 5000+ battery and 6GB+ ram under 20000RS price';
// Expected: Search results page with 25 products
```

### Step 3: Apply Filters
```javascript
const filters = {
  price_min: 13000,
  price_max: 19500,
  rating: 4,
  battery: [5000, 6000],
  ram: [6, 8]
};
// Expected: URL contains filter parameters, 12 products shown
```

### Step 4: Verify Filters Applied
```javascript
// Check URL
assert(window.location.href.includes('p_36:1300000-1950000'));
assert(window.location.href.includes('p_123:46655'));
assert(window.location.href.includes('p_n_g-101015098008111'));
assert(window.location.href.includes('p_n_g-1003495121111'));

// Check product count
const productCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
assert(productCount === 12);
```

### Step 5: Extract Products
```javascript
const products = extractProducts();
// Expected: Array of 12 products, all non-sponsored
```

### Step 6: Select First Non-Sponsored Product
```javascript
const firstProduct = products.find(p => !p.isSponsored);
// Expected: firstProduct.asin === 'B0FN7W26Q8'
```

### Step 7: Navigate to Product Page
```javascript
window.location.href = firstProduct.link;
// Expected: Product page loads with ASIN B0FN7W26Q8
```

### Step 8: Find Buy Now Button
```javascript
const buyNowButton = document.querySelector('#buy-now-button');
// Expected: Button exists and is clickable
```

### Step 9: Click Buy Now
```javascript
buyNowButton.click();
// Expected: Navigation to checkout or login modal
```

### Step 10: Verify Checkout/Login
```javascript
// Check URL for checkout
if (window.location.href.includes('/gp/buy/') || 
    window.location.href.includes('/checkout/')) {
  // Success: Navigated to checkout
} else if (document.querySelector('#ap_email')) {
  // Success: Login modal appeared
} else {
  // Retry or fail
}
```

## Success Criteria

### ✅ Test Passes If:
1. Initial search returns ~25 products
2. Filters applied successfully (URL contains all parameters)
3. Product count reduces to ~12 after filtering
4. First non-sponsored product is selected
5. Product page loads (ASIN B0FN7W26Q8)
6. Buy Now button found and clicked
7. Either:
   - Checkout page loads, OR
   - Login modal appears, OR
   - After 3 retries, user is informed to proceed manually

### ❌ Test Fails If:
1. Initial search returns 0 products or errors
2. Filters not applied (URL unchanged)
3. Product count doesn't change after filtering
4. Only sponsored products returned
5. Product page navigation fails
6. Buy Now button not found
7. Infinite loop on Buy Now failure

## Edge Cases to Test

### Edge Case 1: All Products Sponsored
**Scenario**: Filter results contain only sponsored products
**Expected**: Skip sponsored products, select first organic result

### Edge Case 2: No Products After Filtering
**Scenario**: Filters too restrictive, 0 results
**Expected**: Relax filters and retry, or inform user

### Edge Case 3: Buy Now Button Disabled
**Scenario**: Product out of stock
**Expected**: Try "Add to Cart" or select next product

### Edge Case 4: Login Required
**Scenario**: User not logged in
**Expected**: Inform user to login manually

### Edge Case 5: Price Changed
**Scenario**: Product price no longer within range
**Expected**: Continue (price might have dropped), or skip if increased

## Performance Benchmarks

| Step | Max Time | Target Time |
|------|----------|-------------|
| Navigate to Amazon | 5s | 2s |
| Perform Search | 5s | 3s |
| Apply Filters | 8s | 4s |
| Extract Products | 3s | 1s |
| Navigate to Product | 5s | 2s |
| Find Buy Now | 3s | 1s |
| Click Buy Now | 5s | 2s |
| **Total** | **34s** | **15s** |

## Test Data

### Valid Test Inputs
```javascript
const validInputs = [
  {
    query: 'samsung phone 5000+ battery and 6GB+ ram under 20000RS price',
    filters: {
      price_max: 20000,
      battery: 5000,
      ram: '6gb',
      brand: 'samsung'
    },
    expectedProducts: '10-15'
  }
];
```

### Invalid Test Inputs
```javascript
const invalidInputs = [
  {
    query: '',
    expectedError: 'Empty search query'
  },
  {
    query: 'xyz123impossible',
    expectedError: 'No products found'
  }
];
```

## Assertions

### URL Assertions
```javascript
// After filter application
expect(window.location.href).toContain('rh=');
expect(window.location.href).toContain('p_36:1300000-1950000');
expect(window.location.href).toContain('p_123:46655');
```

### Product Count Assertions
```javascript
// Before filters
expect(initialProductCount).toBeGreaterThan(20);
expect(initialProductCount).toBeLessThan(30);

// After filters
expect(filteredProductCount).toBeGreaterThan(10);
expect(filteredProductCount).toBeLessThan(15);
```

### Product Data Assertions
```javascript
// First product
expect(firstProduct.asin).toBe('B0FN7W26Q8');
expect(firstProduct.isSponsored).toBe(false);
expect(firstProduct.link).toContain('/dp/B0FN7W26Q8/');
```

### Buy Now Assertions
```javascript
// After click
expect(
  window.location.href.includes('/gp/buy/') ||
  window.location.href.includes('/checkout/') ||
  document.querySelector('#ap_email') !== null
).toBe(true);
```

## Error Messages

### Expected Error Scenarios
1. **"No products found"** - 0 search results
2. **"Unable to apply filters"** - Filter application failed
3. **"All products are sponsored"** - No organic results
4. **"Product navigation failed"** - Can't open product page
5. **"Buy Now button not found"** - Missing on product page
6. **"Maximum retry attempts reached"** - Buy Now failed 3 times
7. **"Please proceed manually"** - User intervention needed

## Cleanup
- Clear cookies/cache between test runs
- Reset extension state
- Close extra tabs
- Verify no background processes running

## Reporting
- Log each step with timestamp
- Capture screenshots at key points
- Record network requests
- Export logs for analysis
- Generate pass/fail summary



