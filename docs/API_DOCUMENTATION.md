# RetailAgent API Documentation

## Table of Contents

1. [Core Libraries](#core-libraries)
2. [Platform Abstraction](#platform-abstraction)
3. [AI Integration](#ai-integration)
4. [Utilities](#utilities)
5. [Error Handling](#error-handling)
6. [State Management](#state-management)

## Core Libraries

### Logger (`src/lib/logger.js`)

Structured logging system with persistent storage.

#### Methods

##### `logger.setLevel(level)`
Set minimum log level.

**Parameters**:
- `level` (string): 'DEBUG', 'INFO', 'WARN', or 'ERROR'

**Example**:
```javascript
logger.setLevel('DEBUG');
```

##### `logger.debug(message, data)`
Log debug message.

**Parameters**:
- `message` (string): Log message
- `data` (object): Additional data

**Example**:
```javascript
logger.debug('Processing search', { query: 'samsung phone' });
```

##### `logger.info(message, data)`
Log info message.

**Parameters**:
- `message` (string): Log message
- `data` (object): Additional data

**Example**:
```javascript
logger.info('Search completed', { results: 25 });
```

##### `logger.warn(message, data)`
Log warning message.

**Parameters**:
- `message` (string): Log message
- `data` (object): Additional data

**Example**:
```javascript
logger.warn('Filter application slow', { duration: 5000 });
```

##### `logger.error(message, error, data)`
Log error message.

**Parameters**:
- `message` (string): Log message
- `error` (Error|object): Error object
- `data` (object): Additional context

**Example**:
```javascript
logger.error('Search failed', error, { query: 'samsung phone' });
```

##### `logger.getLogs()`
Get all logs.

**Returns**: `Array<LogEntry>`

**Example**:
```javascript
const logs = logger.getLogs();
```

##### `logger.getLogsByLevel(level)`
Get logs filtered by level.

**Parameters**:
- `level` (string): Log level

**Returns**: `Array<LogEntry>`

**Example**:
```javascript
const errors = logger.getLogsByLevel('ERROR');
```

##### `logger.clearLogs()`
Clear all logs.

**Returns**: `Promise<void>`

**Example**:
```javascript
await logger.clearLogs();
```

##### `logger.exportLogs()`
Export logs as text.

**Returns**: `Promise<string>`

**Example**:
```javascript
const logText = await logger.exportLogs();
```

---

### Error Handler (`src/lib/error-handler.js`)

Comprehensive error handling with recovery mechanisms.

#### Classes

##### `RetailAgentError`
Base error class.

**Properties**:
- `message` (string): Error message
- `code` (string): Error code
- `recoverable` (boolean): Whether error is recoverable
- `context` (object): Additional context
- `timestamp` (string): ISO timestamp

##### `APIError`
API-related errors.

**Properties**:
- `statusCode` (number): HTTP status code
- `response` (object): API response

**Example**:
```javascript
throw new APIError('API call failed', 500, response);
```

##### `DOMError`
DOM-related errors.

**Properties**:
- `selector` (string): Failed selector

**Example**:
```javascript
throw new DOMError('Element not found', '#search-input');
```

##### `IntentParseError`
Intent parsing errors.

**Properties**:
- `userQuery` (string): Original user query

**Example**:
```javascript
throw new IntentParseError('Could not parse intent', userQuery);
```

#### Methods

##### `ErrorHandler.handle(error, context)`
Handle error with recovery strategy.

**Parameters**:
- `error` (Error): Error object
- `context` (object): Additional context

**Returns**: `Promise<{success: boolean, message: string, recovery?: object}>`

**Example**:
```javascript
const result = await ErrorHandler.handle(error, { 
  context: 'SEARCH_OPERATION' 
});
```

##### `ErrorHandler.wrapAsync(fn, context)`
Wrap async function with error handling.

**Parameters**:
- `fn` (Function): Async function to wrap
- `context` (object): Error context

**Returns**: `Function`: Wrapped function

**Example**:
```javascript
const safeSearch = ErrorHandler.wrapAsync(search, { 
  context: 'SEARCH' 
});
```

##### `ErrorHandler.safeDOMOperation(operation, selector, options)`
Create safe DOM operation wrapper.

**Parameters**:
- `operation` (Function): DOM operation
- `selector` (string): CSS selector
- `options` (object): Options
  - `retryable` (boolean): Whether retryable
  - `alternativeSelectors` (Array<string>): Alternative selectors
  - `fallback` (Function): Fallback operation

**Returns**: `Function`: Safe operation function

**Example**:
```javascript
const safeClick = ErrorHandler.safeDOMOperation(
  (el) => el.click(),
  '#button',
  { retryable: true }
);
```

---

### Retry Logic (`src/lib/retry.js`)

Exponential backoff retry for API calls and DOM operations.

#### Classes

##### `RetryConfig`
Retry configuration.

**Properties**:
- `maxRetries` (number): Maximum retry attempts (default: 3)
- `initialDelay` (number): Initial delay in ms (default: 1000)
- `maxDelay` (number): Maximum delay in ms (default: 30000)
- `multiplier` (number): Backoff multiplier (default: 2)
- `retryableErrors` (Array<Error>): Retryable error types
- `onRetry` (Function): Retry callback

**Example**:
```javascript
const config = new RetryConfig({
  maxRetries: 5,
  initialDelay: 500,
  multiplier: 2
});
```

#### Functions

##### `retryWithBackoff(fn, config)`
Retry function with exponential backoff.

**Parameters**:
- `fn` (Function): Function to retry
- `config` (RetryConfig): Retry configuration

**Returns**: `Promise<any>`: Function result

**Example**:
```javascript
const result = await retryWithBackoff(
  () => apiCall(),
  new RetryConfig({ maxRetries: 3 })
);
```

##### `retryAPICall(apiCall, options)`
Retry API call with exponential backoff.

**Parameters**:
- `apiCall` (Function): API call function
- `options` (object): Retry options

**Returns**: `Promise<any>`: API response

**Example**:
```javascript
const response = await retryAPICall(
  () => fetch('/api/data'),
  { maxRetries: 3, initialDelay: 1000 }
);
```

##### `retryDOMOperation(selector, operation, options)`
Retry DOM operation with element waiting.

**Parameters**:
- `selector` (string): CSS selector
- `operation` (Function): DOM operation
- `options` (object): Retry options

**Returns**: `Promise<any>`: Operation result

**Example**:
```javascript
await retryDOMOperation(
  '#button',
  (el) => el.click(),
  { maxRetries: 5 }
);
```

##### `waitForCondition(condition, options)`
Wait for condition with timeout.

**Parameters**:
- `condition` (Function): Condition function
- `options` (object): Options
  - `timeout` (number): Timeout in ms (default: 10000)
  - `interval` (number): Check interval in ms (default: 500)

**Returns**: `Promise<any>`: Condition result

**Example**:
```javascript
await waitForCondition(
  () => document.querySelector('#results') !== null,
  { timeout: 5000 }
);
```

---

## Platform Abstraction

### Ecommerce Platform (`src/lib/ecommerce-platforms.js`)

Base class for e-commerce platform implementations.

#### Class: `EcommercePlatform`

Base class for all platforms.

##### Constructor

```javascript
constructor(name, config)
```

**Parameters**:
- `name` (string): Platform name
- `config` (object): Platform configuration
  - `enabled` (boolean): Whether enabled
  - `domains` (Array<string>): Supported domains
  - `selectors` (object): DOM selectors
  - `actions` (object): Custom actions

**Example**:
```javascript
class MyPlatform extends EcommercePlatform {
  constructor() {
    super('myplatform', {
      enabled: true,
      domains: ['myplatform.com'],
      selectors: { /* ... */ }
    });
  }
}
```

##### Methods

###### `matches(url)`
Check if URL matches platform.

**Parameters**:
- `url` (string): URL to check

**Returns**: `boolean`

**Example**:
```javascript
if (platform.matches('https://amazon.in/product')) {
  // Handle Amazon
}
```

###### `search(query, filters, sort)`
Perform search.

**Parameters**:
- `query` (string): Search query
- `filters` (object): Filter options
- `sort` (string): Sort option

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.search('samsung phone', { 
  price_max: 20000 
});
```

###### `getSearchResults()`
Get search results.

**Returns**: `Promise<Array<Product>>`

**Product Structure**:
```javascript
{
  title: string,
  price: string|number,
  rating: number,
  link: string,
  image: string,
  availability: string,
  // ... platform-specific fields
}
```

**Example**:
```javascript
const products = await platform.getSearchResults();
```

###### `applyFilters(filters)`
Apply filters to search results.

**Parameters**:
- `filters` (object): Filter options

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.applyFilters({
  price_min: 10000,
  price_max: 20000,
  rating: 4
});
```

###### `selectProduct(index)`
Select product from results.

**Parameters**:
- `index` (number): Product index (default: 0)

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.selectProduct(0);
```

###### `buyNow()`
Click Buy Now button.

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.buyNow();
```

###### `addToCart()`
Add product to cart.

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.addToCart();
```

###### `checkout(options)`
Handle checkout flow.

**Parameters**:
- `options` (object): Checkout options
  - `address` (object): Shipping address
  - `payment` (object): Payment method

**Returns**: `Promise<boolean>`

**Example**:
```javascript
await platform.checkout({
  address: { /* ... */ },
  payment: { /* ... */ }
});
```

#### Platform Registry

##### `platformRegistry.register(platform)`
Register a platform.

**Parameters**:
- `platform` (EcommercePlatform): Platform instance

**Example**:
```javascript
const platform = new AmazonPlatform();
platformRegistry.register(platform);
```

##### `platformRegistry.get(name)`
Get platform by name.

**Parameters**:
- `name` (string): Platform name

**Returns**: `EcommercePlatform`

**Example**:
```javascript
const amazon = platformRegistry.get('amazon');
```

##### `platformRegistry.getByUrl(url)`
Get platform by URL.

**Parameters**:
- `url` (string): URL

**Returns**: `EcommercePlatform|null`

**Example**:
```javascript
const platform = platformRegistry.getByUrl('https://amazon.in');
```

##### `platformRegistry.getAll()`
Get all registered platforms.

**Returns**: `Array<EcommercePlatform>`

**Example**:
```javascript
const platforms = platformRegistry.getAll();
```

##### `platformRegistry.getEnabled()`
Get enabled platforms.

**Returns**: `Array<EcommercePlatform>`

**Example**:
```javascript
const enabled = platformRegistry.getEnabled();
```

---

## AI Integration

### Gemini API (`src/lib/gemini.js`)

Integration with Google Gemini AI.

#### Functions

##### `generateContent(apiKey, prompt, systemInstruction, modelName)`
Generate content using Gemini AI.

**Parameters**:
- `apiKey` (string): Gemini API key
- `prompt` (string): User prompt
- `systemInstruction` (string): System instruction (default: "")
- `modelName` (string): Model name (default: null, auto-selects)

**Returns**: `Promise<object>`: Gemini API response

**Example**:
```javascript
const response = await generateContent(
  apiKey,
  'Parse this shopping query: buy samsung phone',
  'You are a shopping assistant.'
);
```

##### `getAvailableModels(apiKey)`
Get available Gemini models.

**Parameters**:
- `apiKey` (string): Gemini API key

**Returns**: `Promise<Array<string>>`: Model names

**Example**:
```javascript
const models = await getAvailableModels(apiKey);
```

##### `setLogAction(logActionFn)`
Set callback for logging AI attempts.

**Parameters**:
- `logActionFn` (Function): Logging function

**Example**:
```javascript
setLogAction((message, level) => {
  console.log(`[${level}] ${message}`);
});
```

---

### Page Analyzer (`src/lib/page-analyzer.js`)

LLM-based page analysis.

#### Constants

##### `ANALYSIS_MODES`
Analysis modes enum.

```javascript
{
  GENERAL: 'GENERAL',
  ANALYZE_SEARCH_RESULTS: 'ANALYZE_SEARCH_RESULTS',
  ANALYZE_FILTERS: 'ANALYZE_FILTERS',
  ANALYZE_PRODUCT_PAGE: 'ANALYZE_PRODUCT_PAGE',
  ANALYZE_CHECKOUT: 'ANALYZE_CHECKOUT'
}
```

#### Functions

##### `analyzePage(apiKey, pageContent, context, mode)`
Analyze page content using LLM.

**Parameters**:
- `apiKey` (string): Gemini API key
- `pageContent` (string): Simplified page content
- `context` (object): Analysis context
  - `intent` (object): User intent
  - `status` (string): Current status
  - `platform` (string): Platform name
- `mode` (string): Analysis mode (default: 'GENERAL')

**Returns**: `Promise<object>`: Analysis result

**Example**:
```javascript
const result = await analyzePage(
  apiKey,
  pageContent,
  { intent, status: 'SEARCHING', platform: 'amazon' },
  ANALYSIS_MODES.ANALYZE_SEARCH_RESULTS
);
```

##### `extractAttributesWithLLM(apiKey, productTitle, productDescription)`
Extract product attributes using LLM.

**Parameters**:
- `apiKey` (string): Gemini API key
- `productTitle` (string): Product title
- `productDescription` (string): Product description (default: "")

**Returns**: `Promise<object>`: Extracted attributes

**Example**:
```javascript
const attributes = await extractAttributesWithLLM(
  apiKey,
  'Samsung Galaxy S21 128GB',
  'Latest Samsung phone with 5G...'
);
```

---

## Utilities

### Product Matcher (`src/lib/product-matcher.js`)

Product matching and ranking.

#### Functions

##### `matchesFilters(product, filters)`
Check if product matches filters.

**Parameters**:
- `product` (object): Product object
- `filters` (object): Filter criteria

**Returns**: `boolean`

**Example**:
```javascript
const matches = matchesFilters(product, {
  price_max: 20000,
  brand: 'samsung'
});
```

##### `rankResults(products, intent)`
Rank products by relevance.

**Parameters**:
- `products` (Array<Product>): Products to rank
- `intent` (object): User intent

**Returns**: `Array<Product>`: Ranked products

**Example**:
```javascript
const ranked = rankResults(products, {
  product: 'samsung phone',
  filters: { price_max: 20000 }
});
```

##### `isUnavailable(product)`
Check if product is unavailable.

**Parameters**:
- `product` (object): Product object

**Returns**: `boolean`

**Example**:
```javascript
if (isUnavailable(product)) {
  // Skip unavailable product
}
```

---

### Product Comparator (`src/lib/product-comparator.js`)

Multi-platform product comparison.

#### Functions

##### `compareProducts(platformResults, preferences)`
Compare products across platforms.

**Parameters**:
- `platformResults` (object): Results from each platform
  ```javascript
  {
    amazon: { products: [...], tab: tabId },
    flipkart: { products: [...], tab: tabId }
  }
  ```
- `preferences` (object): Comparison preferences
  ```javascript
  {
    priceWeight: 0.4,
    ratingWeight: 0.3,
    deliveryWeight: 0.2,
    availabilityWeight: 0.1
  }
  ```

**Returns**: `object`: Comparison result

**Example**:
```javascript
const comparison = compareProducts(platformResults, {
  priceWeight: 0.5,
  ratingWeight: 0.3,
  deliveryWeight: 0.2
});
```

##### `groupSimilarProducts(products)`
Group similar products.

**Parameters**:
- `products` (Array<Product>): Products to group

**Returns**: `Array<Array<Product>>`: Grouped products

**Example**:
```javascript
const groups = groupSimilarProducts(products);
```

##### `formatComparisonResult(result)`
Format comparison result for display.

**Parameters**:
- `result` (object): Comparison result

**Returns**: `object`: Formatted result

**Example**:
```javascript
const formatted = formatComparisonResult(comparison);
```

---

### Sponsored Detector (`src/lib/sponsored-detector.js`)

Sponsored product detection.

#### Functions

##### `isSponsoredProduct(container, platform)`
Check if product container is sponsored.

**Parameters**:
- `container` (Element): Product container element
- `platform` (string): Platform name

**Returns**: `boolean`

**Example**:
```javascript
if (isSponsoredProduct(container, 'amazon')) {
  // Skip sponsored product
}
```

---

### Configuration (`src/lib/config.js`)

Configuration management.

#### Class: `ConfigManager`

##### Methods

###### `load()`
Load configuration.

**Returns**: `Promise<object>`

**Example**:
```javascript
const config = await configManager.load();
```

###### `save(config)`
Save configuration.

**Parameters**:
- `config` (object): Configuration object

**Returns**: `Promise<void>`

**Example**:
```javascript
await configManager.save({
  geminiApiKey: '...',
  comparisonPreferences: { /* ... */ }
});
```

---

## State Management

### Service Worker State (`src/background/service_worker.js`)

#### Global State: `currentState`

```javascript
{
  status: 'IDLE' | 'PARSING' | 'SEARCHING' | 'SELECTING' | 
          'COMPARING' | 'PRODUCT_PAGE' | 'CHECKOUT' | 'COMPLETED',
  data: {
    product: string,
    platform: string,
    filters: object,
    // ... parsed intent
  },
  tabId: number,
  filtersApplied: boolean,
  productPageRetries: number,
  maxProductPageRetries: number,
  compareMode: boolean,
  platformResults: object,
  comparisonResult: object
}
```

#### Functions

##### `resetState()`
Reset state to IDLE.

**Example**:
```javascript
resetState();
```

##### `handleUserQuery(text)`
Handle user query.

**Parameters**:
- `text` (string): User query text

**Returns**: `Promise<void>`

**Example**:
```javascript
await handleUserQuery('buy samsung phone under 20000');
```

##### `parseIntent(apiKey, text)`
Parse natural language intent.

**Parameters**:
- `apiKey` (string): Gemini API key
- `text` (string): User query

**Returns**: `Promise<object>`: Parsed intent

**Example**:
```javascript
const intent = await parseIntent(apiKey, 'buy samsung phone');
```

##### `startAutomation()`
Start shopping automation.

**Returns**: `Promise<void>`

**Example**:
```javascript
await startAutomation();
```

##### `executeNextStep(tabId)`
Execute next step in shopping flow.

**Parameters**:
- `tabId` (number): Tab ID

**Returns**: `Promise<void>`

**Example**:
```javascript
await executeNextStep(tabId);
```

---

## Message Passing

### Popup → Service Worker

```javascript
chrome.runtime.sendMessage({
  type: 'USER_QUERY',
  text: 'buy samsung phone under 20000'
}, (response) => {
  // Handle response
});
```

### Service Worker → Content Script

```javascript
chrome.tabs.sendMessage(tabId, {
  action: 'SEARCH',
  query: 'samsung phone',
  filters: { price_max: 20000 }
}, (response) => {
  // Handle response
});
```

### Content Script → Service Worker

```javascript
chrome.runtime.sendMessage({
  type: 'SEARCH_RESULTS',
  products: [...],
  platform: 'amazon'
});
```

---

## Type Definitions

### Product

```typescript
interface Product {
  title: string;
  price: string | number;
  rating?: number;
  link: string;
  image?: string;
  availability?: string;
  delivery?: string;
  asin?: string; // Amazon-specific
  // ... platform-specific fields
}
```

### Intent

```typescript
interface Intent {
  product: string;
  platform?: string;
  compareMode: boolean;
  filters: {
    price_min?: number;
    price_max?: number;
    brand?: string;
    rating?: number;
    ram?: string;
    battery?: number;
    // ... more filters
  };
  sortStrategy?: string;
  urgency?: string;
  quantity?: number;
}
```

### Log Entry

```typescript
interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data: object;
  context: object;
}
```

---

**Last Updated**: January 2026  
**Version**: 1.0.0

