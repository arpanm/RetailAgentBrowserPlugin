# RetailAgent Architecture Documentation

## Overview

RetailAgent is a Chrome extension that uses AI to automate shopping across multiple e-commerce platforms. It understands natural language shopping intents and automates the entire shopping flow from search to checkout.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │   Popup UI   │◄─────►│ Service      │◄─────►│ Content  │  │
│  │  (Side Panel)│      │ Worker       │      │ Scripts  │  │
│  └──────────────┘      └──────────────┘      └──────────┘  │
│         │                    │                    │          │
│         │                    │                    │          │
│         └────────────────────┴────────────────────┘          │
│                            │                                 │
│                            ▼                                 │
│                  ┌──────────────────┐                        │
│                  │  Core Libraries  │                        │
│                  │  - Gemini API     │                        │
│                  │  - Platform      │                        │
│                  │    Abstraction   │                        │
│                  │  - State Mgmt    │                        │
│                  └──────────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  E-commerce      │
                  │  Platforms       │
                  │  (Amazon, etc.)  │
                  └──────────────────┘
```

## Component Architecture

### 1. Service Worker (`src/background/service_worker.js`)

**Purpose**: Central orchestration layer that manages the shopping flow.

**Responsibilities**:
- Intent parsing using Gemini AI
- State management (IDLE, PARSING, SEARCHING, SELECTING, CHECKOUT, etc.)
- Tab management and navigation
- Message passing between popup and content scripts
- Platform routing and comparison logic
- Error handling and retry logic

**Key Functions**:
- `handleUserQuery(text)` - Entry point for user queries
- `parseIntent(apiKey, text)` - Parses natural language to structured intent
- `startAutomation()` - Initiates shopping automation
- `executeNextStep(tabId)` - Executes next step in shopping flow
- `handleComparisonPageLoad()` - Handles multi-platform comparison

**State Machine**:
```
IDLE → PARSING → SEARCHING → SELECTING → PRODUCT_PAGE → CHECKOUT → COMPLETED
                ↓
            COMPARING (parallel platform searches)
```

### 2. Content Scripts (`src/content/`)

**Purpose**: Platform-specific implementations that interact with e-commerce websites.

**Structure**:
- **Loaders**: `*-loader.js` files that dynamically import platform modules
- **Platform Scripts**: `amazon.js`, `flipkart.js`, `ebay.js`, `walmart.js`
- **Platform Classes**: `platforms/*-platform.js` - Platform-specific implementations
- **Shared Utilities**: `shared/actions.js`, `shared/selectors.js`, `shared/login-handlers.js`

**Key Responsibilities**:
- DOM interaction (search, filter, product selection)
- Product extraction from search results
- Filter application (URL-based and DOM-based)
- Sponsored product detection and filtering
- Buy Now / Add to Cart actions
- Checkout flow automation

**Communication**:
- Receives messages from service worker via `chrome.runtime.onMessage`
- Sends results back via `chrome.runtime.sendMessage`
- Uses `chrome.runtime.sendMessage` for cross-tab communication

### 3. Popup UI (`src/popup/`)

**Purpose**: User interface for interacting with the extension.

**Components**:
- `index.html` - UI structure
- `popup.js` - UI logic and event handlers
- `styles.css` - Styling

**Features**:
- Natural language input
- Real-time status updates
- Collapsible message groups
- Settings management (API keys, preferences)
- Comparison results display
- Order history and tracking

**Communication**:
- Sends queries to service worker via `chrome.runtime.sendMessage`
- Receives updates via `chrome.runtime.onMessage`
- Stores settings in `chrome.storage.local`

### 4. Core Libraries (`src/lib/`)

#### 4.1 Platform Abstraction (`ecommerce-platforms.js`)

**Purpose**: Unified interface for different e-commerce platforms.

**Key Classes**:
- `EcommercePlatform` - Base class for all platforms
- `PlatformRegistry` - Singleton registry for platform management

**Platform Interface**:
```javascript
class EcommercePlatform {
  async search(query, filters, sort)
  async getSearchResults()
  async applyFilters(filters)
  async selectProduct(index)
  async buyNow()
  async checkout(options)
  // ... more methods
}
```

**Registered Platforms**:
- Amazon (India, US, UK, Germany, France)
- Flipkart
- eBay
- Walmart
- Shopify (in progress)

#### 4.2 Intent Parsing (`gemini.js`)

**Purpose**: Integration with Google Gemini AI for natural language understanding.

**Key Functions**:
- `generateContent(apiKey, prompt, systemInstruction, modelName)` - Main AI call
- `getAvailableModels(apiKey)` - Fetches available Gemini models
- `setLogAction(fn)` - Sets callback for logging AI attempts

**Model Fallback Strategy**:
1. Try cached working model (if available)
2. Try models in priority order:
   - `gemini-2.0-flash-exp`
   - `gemini-1.5-pro`
   - `gemini-1.5-flash`
   - `gemini-pro`
   - Fallback models

**Caching**:
- Response caching for identical prompts
- Model availability caching per API key
- Working model cache (per day)

#### 4.3 Intent Parser (`service_worker.js`)

**Purpose**: Converts natural language to structured shopping intent.

**Intent Structure**:
```javascript
{
  product: "samsung phone",
  platform: "amazon" | "flipkart" | null,
  compareMode: boolean,
  filters: {
    price_min: number,
    price_max: number,
    brand: string,
    rating: number,
    ram: string,
    battery: number,
    // ... more filters
  },
  sortStrategy: "cheapest" | "best_rated" | "relevant",
  urgency: "delivered_today" | "within_week" | "none",
  quantity: number
}
```

**Fallback Strategy**:
1. Try LLM parsing (Gemini AI)
2. Fallback to simple regex-based parser if LLM fails

#### 4.4 Filter System

**Amazon Filter Implementation**:
- `amazon-filter-codes.js` - Filter code mappings
- `amazon-url-filter-builder.js` - URL-based filter construction
- `amazon-url-parser.js` - URL parsing and filter extraction
- `filter-verifier.js` - Filter application verification

**Filter Application Strategy** (Priority Order):
1. **URL-based** (Primary) - Builds Amazon filter URL with `rh` parameter
2. **DOM-based** (Fallback) - Clicks filter elements directly
3. **LLM-based** (Last Resort) - Uses AI to discover and apply filters

**Filter Types Supported**:
- Price range (min/max)
- Rating (minimum stars)
- Brand
- RAM capacity
- Storage capacity
- Battery capacity
- Color
- Condition (new/used/refurbished)

#### 4.5 Product Matching (`product-matcher.js`)

**Purpose**: Matches products against user intent and ranks them.

**Key Functions**:
- `rankResults(products, intent)` - Ranks products by relevance
- `matchesFilters(product, filters)` - Checks if product matches filters
- `isUnavailable(product)` - Detects unavailable products

**Ranking Factors**:
- Price match
- Rating match
- Brand match
- Feature match (RAM, storage, battery, etc.)
- Availability status

#### 4.6 Product Comparison (`product-comparator.js`)

**Purpose**: Compares products across multiple platforms.

**Key Functions**:
- `compareProducts(platformResults, preferences)` - Main comparison function
- `groupSimilarProducts(products)` - Groups similar products
- `formatComparisonResult(result)` - Formats result for display

**Comparison Algorithm**:
```javascript
Score = (priceScore × priceWeight) + 
        (ratingScore × ratingWeight) + 
        (deliveryScore × deliveryWeight) + 
        (availabilityScore × availabilityWeight)
```

**User Preferences** (Configurable):
- Price importance (0-100%)
- Rating importance (0-100%)
- Delivery speed (0-100%)
- Availability (0-100%)

#### 4.7 Page Analysis (`page-analyzer.js`)

**Purpose**: Uses LLM to analyze page content when DOM selectors fail.

**Analysis Modes**:
- `GENERAL` - General page analysis
- `ANALYZE_SEARCH_RESULTS` - Extract products from search results
- `ANALYZE_FILTERS` - Discover available filters
- `ANALYZE_PRODUCT_PAGE` - Analyze product details page
- `ANALYZE_CHECKOUT` - Analyze checkout page

**Key Functions**:
- `analyzePage(apiKey, pageContent, context, mode)` - Main analysis function
- `extractAttributesWithLLM(apiKey, title, description)` - Extract product attributes

#### 4.8 Sponsored Product Detection (`sponsored-detector.js`)

**Purpose**: Identifies and filters out sponsored/advertisement products.

**Detection Methods** (Priority Order):
1. `data-component-type="sp-sponsored-result"`
2. `data-ad-details` attribute
3. `.AdHolder` class
4. `.s-sponsored-header` element
5. `.s-sponsored-info-icon` element
6. ARIA labels containing "sponsored"

**Usage**:
```javascript
if (isSponsoredProduct(container, 'amazon')) {
  // Skip this product
}
```

#### 4.9 Error Handling (`error-handler.js`)

**Purpose**: Centralized error handling and user-friendly error messages.

**Error Types**:
- `IntentParseError` - Intent parsing failures
- `APIError` - API call failures
- `PlatformError` - Platform-specific errors

**Features**:
- Automatic error recovery
- User-friendly error messages
- Error logging
- Retry suggestions

#### 4.10 Retry Logic (`retry.js`)

**Purpose**: Exponential backoff retry for API calls and DOM operations.

**Key Functions**:
- `retryAPICall(fn, maxRetries, delay)` - Retry API calls
- `retryDOMOperation(fn, maxRetries, delay)` - Retry DOM operations

**Retry Strategy**:
- Exponential backoff: 1s, 2s, 4s, 8s
- Maximum 3-5 retries
- Configurable delays

#### 4.11 Logging (`logger.js`)

**Purpose**: Structured logging system.

**Log Levels**:
- `info` - Informational messages
- `warn` - Warnings
- `error` - Errors
- `debug` - Debug information

**Features**:
- Persistent log storage
- Log filtering
- Export logs
- Clear logs

#### 4.12 Configuration (`config.js`)

**Purpose**: Configuration management.

**Stored Settings**:
- Gemini API key
- Google Maps API key (optional)
- Platform preferences
- Comparison preferences
- User preferences

**Storage**: `chrome.storage.local`

#### 4.13 Other Libraries

- `address-manager.js` - Address management
- `payment-manager.js` - Payment method management
- `order-tracker.js` - Order tracking
- `store-locator.js` - Offline store locator
- `coupon-manager.js` - Coupon/promo code management
- `login-manager.js` - Platform login automation
- `cache.js` - Response caching
- `analytics.js` - Usage analytics
- `i18n.js` - Internationalization
- `json-parser.js` - LLM JSON response parsing
- `text-normalizer.js` - Text normalization utilities

## Data Flow

### Shopping Flow

```
1. User enters query in popup
   ↓
2. Popup sends message to service worker
   ↓
3. Service worker parses intent (Gemini AI)
   ↓
4. Service worker determines platform(s)
   ↓
5. Service worker creates tab(s) for platform(s)
   ↓
6. Content script injected into tab
   ↓
7. Content script registers platform
   ↓
8. Service worker sends search command
   ↓
9. Content script performs search
   ↓
10. Content script applies filters (if any)
    ↓
11. Content script extracts products
    ↓
12. Content script filters sponsored products
    ↓
13. Content script sends results to service worker
    ↓
14. Service worker ranks/compares products
    ↓
15. Service worker selects best product
    ↓
16. Service worker navigates to product page
    ↓
17. Content script clicks Buy Now
    ↓
18. Service worker detects checkout page
    ↓
19. Flow completes, user completes checkout manually
```

### Comparison Flow

```
1. User query includes "compare" keyword
   ↓
2. Service worker sets compareMode = true
   ↓
3. Service worker opens multiple platform tabs
   ↓
4. Parallel searches on all platforms
   ↓
5. Extract products from each platform
   ↓
6. Compare products using scoring algorithm
   ↓
7. Display comparison card in popup
   ↓
8. Auto-select best product
   ↓
9. Navigate to best product page
   ↓
10. Close unused platform tabs
    ↓
11. Continue with Buy Now flow
```

## Message Passing

### Popup → Service Worker

```javascript
chrome.runtime.sendMessage({
  type: 'USER_QUERY',
  text: 'buy samsung phone under 20000'
}, callback);
```

### Service Worker → Content Script

```javascript
chrome.tabs.sendMessage(tabId, {
  action: 'SEARCH',
  query: 'samsung phone',
  filters: { price_max: 20000 }
}, callback);
```

### Content Script → Service Worker

```javascript
chrome.runtime.sendMessage({
  type: 'SEARCH_RESULTS',
  products: [...],
  platform: 'amazon'
});
```

## State Management

### Global State (`currentState`)

```javascript
{
  status: 'IDLE' | 'PARSING' | 'SEARCHING' | 'SELECTING' | 
          'COMPARING' | 'PRODUCT_PAGE' | 'CHECKOUT' | 'COMPLETED',
  data: {
    product: string,
    platform: string,
    filters: object,
    // ... parsed intent data
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

## Security & Privacy

### Data Storage
- All data stored locally in `chrome.storage.local`
- API keys stored securely (never transmitted to third parties)
- No external servers (except Gemini API and Google Maps API)

### Permissions
- `activeTab` - Access current tab
- `scripting` - Inject content scripts
- `storage` - Store settings and data
- `tabs` - Create and manage tabs
- `geolocation` - Store locator feature
- `sidePanel` - Side panel UI

### Content Security Policy
- Extension pages: `script-src 'self'; object-src 'self'`
- No inline scripts
- All scripts loaded from extension files

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Content scripts loaded only when needed
2. **Caching**: API responses cached to reduce calls
3. **Parallel Processing**: Multi-platform comparison runs in parallel
4. **Debouncing**: Search input debounced
5. **Retry Limits**: Prevents infinite loops

### Performance Targets
- Intent parsing: < 3 seconds
- Search execution: < 5 seconds
- Filter application: < 4 seconds
- Product extraction: < 2 seconds
- Total flow: < 30 seconds

## Extension Lifecycle

### Installation
1. Extension installed
2. Service worker initialized
3. Platforms registered
4. Default settings loaded

### Runtime
1. Service worker stays active
2. Content scripts injected on page load
3. Popup opens on icon click
4. Messages passed between components

### Update
1. New version installed
2. Service worker reloaded
3. Content scripts re-injected
4. Settings preserved

## Testing Strategy

### Unit Tests (`tests/unit/`)
- Library functions
- Utility functions
- Parsing logic

### Integration Tests (`tests/integration/`)
- Service worker flow
- Content script flow
- Message passing

### E2E Tests (`tests/e2e/`)
- Complete shopping flows
- Platform-specific flows
- Error scenarios

## Build System

### Webpack Configuration
- Entry points: service worker, popup, content scripts
- Output: `dist/` directory
- Copy plugin: Copies static files
- Babel: ES6+ transpilation

### Build Process
```bash
npm run build  # Production build
npm run watch  # Development watch mode
```

## Deployment

### Chrome Web Store
1. Build extension (`npm run build`)
2. Zip `dist/` directory
3. Upload to Chrome Web Store Developer Dashboard
4. Fill store listing
5. Submit for review

### Development
1. Load unpacked extension from `dist/`
2. Enable developer mode
3. Reload on changes

## Future Enhancements

### Planned Features
- Voice commands
- Mobile app companion
- Firefox extension
- Advanced analytics dashboard
- Price tracking and alerts
- Social sharing
- Plugin system for custom platforms

### Architecture Improvements
- Service worker persistence improvements
- Better error recovery
- Enhanced caching strategies
- Performance monitoring
- A/B testing framework

---

**Last Updated**: January 2026  
**Version**: 1.0.0

