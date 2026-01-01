# Buy Now Button Research

## Amazon Buy Now Button

### Product Page Selectors

#### Primary Buy Now Button
```html
<input id="buy-now-button" name="submit.buy-now" title="Buy Now" 
       class="a-button-input" type="submit" value="Buy Now">
```

**Selectors**:
- `#buy-now-button`
- `input[name="submit.buy-now"]`
- `input[title="Buy Now"]`
- `.a-button-input[value="Buy Now"]`

#### Alternative Buy Now Forms
```javascript
const buyNowSelectors = [
  '#buy-now-button',
  'input[name="submit.buy-now"]',
  'input[id*="buy-now"]',
  'input[title*="Buy Now"]',
  'button:contains("Buy Now")',
  'span:contains("Buy Now"):has(input)',
  '#buybox input[name^="submit"]',
  '.buy-now-button'
];
```

### Add to Cart Button (Alternative)
```html
<input id="add-to-cart-button" name="submit.add-to-cart" 
       title="Add to Cart" class="a-button-input" type="submit">
```

**Selectors**:
- `#add-to-cart-button`
- `input[name="submit.add-to-cart"]`
- `input[title="Add to Cart"]`

### Buy Box Container
```html
<div id="buybox" class="a-section">
  <div id="desktop_qualifiedBuyBox">
    <!-- Buy Now and Add to Cart buttons here -->
  </div>
</div>
```

### Mobile vs Desktop

#### Desktop
```
#buy-now-button (primary)
Located in: #buybox or #desktop_qualifiedBuyBox
```

#### Mobile
```
#buy-now-button-mobile
#mobile-buy-box
Input or Button element with similar attributes
```

## After Buy Now Click

### Expected Behaviors

#### Scenario 1: Direct to Checkout (Logged In)
```
Current URL: /dp/ASIN
After Click: /gp/buy/spc/handlers/static-submit-decoupled.html
             OR /gp/buy/spc/handlers/display.html
             OR /checkout/spc/
```

#### Scenario 2: Login Modal (Not Logged In)
```html
<div class="a-popover-wrapper">
  <div class="a-popover-inner">
    <h4>Sign in to buy</h4>
    <form name="signIn" method="post" action="/ap/signin">
      <input type="email" name="email" id="ap_email">
      <input type="password" name="password" id="ap_password">
      <input type="submit" id="signInSubmit" value="Sign in">
    </form>
  </div>
</div>
```

**Detection**:
- Check for `#ap_email` or `#ap_password`
- Check URL contains `/ap/signin`

#### Scenario 3: Address Selection
```
URL: /gp/buy/addressselect/handlers/display.html
Contains address selection form
```

#### Scenario 4: Payment Method Selection
```
URL: /gp/buy/spc/handlers/display.html
Contains payment method selection
```

### Modal Dialog Detection
```javascript
function detectModalAfterBuyNow() {
  // Wait for modal to appear
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check for various modal types
  const modals = [
    document.querySelector('.a-popover-wrapper'),
    document.querySelector('[role="dialog"]'),
    document.querySelector('#a-popover-content')
  ];
  
  return modals.some(m => m !== null);
}
```

## Flipkart Buy Now Button

### Product Page Selectors

#### Primary Buy Now Button
```html
<button class="_2KpZ6l _2U9uOA _3v1-ww">Buy Now</button>
```

**Note**: Flipkart uses obfuscated class names. Use text-based selection:

```javascript
const buyNowButton = Array.from(document.querySelectorAll('button')).find(
  btn => btn.textContent.trim() === 'Buy Now'
);
```

### Alternative Selectors
```javascript
const flipkartBuyNowSelectors = [
  'button:contains("Buy Now")',
  'button[class*="buy"]',
  'a[href*="/checkout"]',
  'button[class*="_2KpZ"]' // May change
];
```

### Add to Cart (Flipkart)
```javascript
const addToCartButton = Array.from(document.querySelectorAll('button')).find(
  btn => btn.textContent.trim() === 'ADD TO CART'
);
```

## Button State Detection

### Button Available
```javascript
function isBuyNowAvailable() {
  const button = document.querySelector('#buy-now-button');
  return button && 
         !button.disabled && 
         button.offsetParent !== null && // visible
         !button.classList.contains('a-button-disabled');
}
```

### Out of Stock
```html
<span id="availability" class="a-size-medium a-color-price">
  Currently unavailable.
</span>
```

**Detection**:
```javascript
const availability = document.querySelector('#availability');
const isOutOfStock = availability && 
  (availability.textContent.includes('unavailable') ||
   availability.textContent.includes('out of stock'));
```

### Requires Selection (Size, Color, etc.)
```html
<div id="variation_color_name" class="a-section">
  <span class="selection">Select a color</span>
</div>
```

## Click Strategies

### Strategy 1: Direct Click
```javascript
const button = document.querySelector('#buy-now-button');
button.click();
```

### Strategy 2: Form Submission
```javascript
const form = document.querySelector('form[action*="add-to-cart"]');
const buyNowInput = form.querySelector('input[name="submit.buy-now"]');
buyNowInput.click();
// Or
form.submit();
```

### Strategy 3: Event Dispatch
```javascript
const button = document.querySelector('#buy-now-button');
button.dispatchEvent(new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  view: window
}));
```

### Strategy 4: Full Mouse Simulation
```javascript
async function simulateFullClick(element) {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}
```

## Verification

### Verify Buy Now Succeeded
```javascript
async function verifyBuyNowSuccess() {
  // Wait for navigation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const currentUrl = window.location.href;
  
  // Check if navigated to checkout
  const checkoutIndicators = [
    '/gp/buy/',
    '/checkout/',
    '/spc/',
    'addressselect',
    'payment'
  ];
  
  return checkoutIndicators.some(indicator => currentUrl.includes(indicator));
}
```

### Detect Navigation Failure
```javascript
function detectBuyNowFailure() {
  const url = window.location.href;
  
  // Still on product page after clicking
  if (url.includes('/dp/') || url.includes('/p/')) {
    // Check for error messages
    const errorMessages = [
      document.querySelector('.a-alert-error'),
      document.querySelector('[data-error]'),
      Array.from(document.querySelectorAll('.a-alert-inline-error'))
    ];
    
    return errorMessages.some(el => el !== null);
  }
  
  return false;
}
```

## Wait Conditions

### Wait for Button to be Clickable
```javascript
async function waitForBuyNowReady(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const button = document.querySelector('#buy-now-button');
    
    if (button && 
        !button.disabled && 
        button.offsetParent !== null &&
        button.getBoundingClientRect().height > 0) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return false;
}
```

### Wait for Page Transition
```javascript
async function waitForCheckoutNavigation(timeout = 5000) {
  const startTime = Date.now();
  const originalUrl = window.location.href;
  
  while (Date.now() - startTime < timeout) {
    if (window.location.href !== originalUrl) {
      // URL changed, wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return false;
}
```

## Error Scenarios

### Error 1: Button Not Found
**Possible Causes**:
- Product out of stock
- Requires variant selection
- Page not fully loaded

**Solution**:
- Check availability status
- Check for variant selectors
- Wait longer for page load

### Error 2: Click Doesn't Navigate
**Possible Causes**:
- JavaScript not executed
- Login required
- Network issue

**Solution**:
- Try different click strategies
- Check for login modal
- Verify network connectivity

### Error 3: Stuck on Product Page
**Possible Causes**:
- Click intercepted by other element
- Button is fake/decorative
- A/B test variation

**Solution**:
- Try Add to Cart instead
- Use form submission method
- Navigate directly to checkout URL if ASIN known

## Best Practices

### 1. Multiple Selector Attempts
```javascript
async function findBuyNowButton() {
  const selectors = [
    '#buy-now-button',
    'input[name="submit.buy-now"]',
    'input[title*="Buy Now"]',
    '#buybox input[type="submit"]'
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      return button;
    }
  }
  
  return null;
}
```

### 2. Scroll Into View Before Click
```javascript
async function clickBuyNow() {
  const button = await findBuyNowButton();
  if (button) {
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    button.click();
  }
}
```

### 3. Retry Logic
```javascript
async function clickBuyNowWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const button = await findBuyNowButton();
      if (!button) {
        throw new Error('Buy Now button not found');
      }
      
      button.click();
      
      // Verify success
      const success = await verifyBuyNowSuccess();
      if (success) {
        return true;
      }
      
      // If not successful, try next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
  
  return false;
}
```

## Platform Differences

| Feature | Amazon | Flipkart |
|---------|--------|----------|
| Button ID | Stable (`#buy-now-button`) | Obfuscated classes |
| After Click | Checkout or login modal | Checkout or login page |
| Verification | Check URL for `/gp/buy/` | Check URL for `/checkout` |
| Fallback | Add to Cart button | Add to Cart button |

## Resources
- Amazon's buybox JavaScript
- Flipkart's checkout flow
- Browser DevTools Network tab for navigation tracking

