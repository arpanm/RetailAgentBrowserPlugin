# RetailAgent Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Adding Features](#adding-features)
9. [Contributing](#contributing)

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher
- **Chrome Browser**: Version 88 or higher
- **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/RetailAgent.git
cd RetailAgent

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` directory
```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

1. Open the extension popup
2. Click the settings icon (⚙️)
3. Enter your Gemini API key
4. (Optional) Enter Google Maps API key for store locator

### 3. Development Mode

```bash
# Watch mode - rebuilds on file changes
npm run watch

# Or build manually
npm run build
```

**Note**: After building, reload the extension in `chrome://extensions/` to see changes.

### 4. Hot Reload Setup (Optional)

For faster development, use Chrome Extension Reloader or similar tools to auto-reload the extension on file changes.

## Project Structure

```
RetailAgent/
├── src/
│   ├── background/
│   │   └── service_worker.js      # Main orchestration logic
│   ├── content/
│   │   ├── amazon-loader.js        # Amazon content script loader
│   │   ├── amazon.js               # Amazon content script
│   │   ├── flipkart-loader.js      # Flipkart loader
│   │   ├── flipkart.js             # Flipkart content script
│   │   ├── platforms/              # Platform implementations
│   │   │   ├── amazon-platform.js
│   │   │   ├── flipkart-platform.js
│   │   │   └── ...
│   │   └── shared/                 # Shared utilities
│   │       ├── actions.js          # Common DOM actions
│   │       ├── selectors.js       # DOM selector utilities
│   │       └── login-handlers.js  # Login automation
│   ├── lib/                        # Core libraries
│   │   ├── gemini.js               # Gemini AI integration
│   │   ├── ecommerce-platforms.js # Platform abstraction
│   │   ├── logger.js               # Logging system
│   │   ├── error-handler.js       # Error handling
│   │   └── ...                     # Other libraries
│   └── popup/                      # Extension UI
│       ├── index.html
│       ├── popup.js
│       └── styles.css
├── tests/                          # Test files
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   └── e2e/                        # End-to-end tests
├── docs/                           # Documentation
├── icons/                          # Extension icons
├── manifest.json                   # Extension manifest
├── package.json                    # NPM configuration
├── webpack.config.js              # Build configuration
└── README.md                       # Main README
```

## Development Workflow

### 1. Making Changes

1. **Edit source files** in `src/`
2. **Build** with `npm run build` or `npm run watch`
3. **Reload extension** in `chrome://extensions/`
4. **Test** your changes
5. **Debug** using Chrome DevTools

### 2. File Organization

- **Service Worker**: `src/background/service_worker.js`
- **Content Scripts**: `src/content/*.js`
- **Platform Implementations**: `src/content/platforms/*-platform.js`
- **Libraries**: `src/lib/*.js`
- **UI**: `src/popup/*`

### 3. Adding New Files

When adding new files:

1. **Update webpack.config.js** if needed (usually not required for lib files)
2. **Update manifest.json** if adding content scripts
3. **Add imports** in files that use the new module
4. **Update documentation** if adding public APIs

### 4. Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add feature: description"

# Push and create PR
git push origin feature/your-feature-name
```

## Code Style Guidelines

### JavaScript Style

- **ES6+**: Use modern JavaScript features
- **Modules**: Use ES6 `import/export`
- **Async/Await**: Prefer over promises
- **Error Handling**: Always use try-catch
- **Comments**: JSDoc for public functions

### Naming Conventions

- **Files**: `kebab-case.js` (e.g., `amazon-platform.js`)
- **Classes**: `PascalCase` (e.g., `AmazonPlatform`)
- **Functions**: `camelCase` (e.g., `performSearch`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Variables**: `camelCase` (e.g., `searchResults`)

### Code Examples

#### Good ✅

```javascript
/**
 * Performs search on Amazon
 * @param {string} query - Search query
 * @param {object} filters - Filter options
 * @returns {Promise<boolean>} Success status
 */
async function performSearch(query, filters = {}) {
    try {
        logger.info('Performing search', { query, filters });
        // Implementation
        return true;
    } catch (error) {
        logger.error('Search failed', error);
        throw error;
    }
}
```

#### Bad ❌

```javascript
function search(q, f) {
    // No error handling
    // No logging
    // Unclear parameters
    document.querySelector('#search').value = q;
    document.querySelector('#search').click();
}
```

### Error Handling

Always handle errors gracefully:

```javascript
try {
    await riskyOperation();
} catch (error) {
    logger.error('Operation failed', error);
    await ErrorHandler.handle(error, { context: 'OPERATION_NAME' });
    // Provide fallback or user feedback
}
```

### Logging

Use structured logging:

```javascript
logger.info('Action performed', { 
    key1: value1, 
    key2: value2 
});

logger.error('Error occurred', error, { 
    context: 'CONTEXT_NAME',
    additionalData: data 
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Writing Tests

#### Unit Test Example

```javascript
import { describe, it, expect } from '@jest/globals';
import { parsePrice } from '../src/lib/text-normalizer.js';

describe('parsePrice', () => {
    it('should parse Indian rupee format', () => {
        expect(parsePrice('₹1,234.56')).toBe(1234.56);
    });
    
    it('should handle invalid input', () => {
        expect(parsePrice('invalid')).toBeNull();
    });
});
```

#### Integration Test Example

```javascript
import { describe, it, expect } from '@jest/globals';
import { handleUserQuery } from '../src/background/service_worker.js';

describe('Shopping Flow', () => {
    it('should complete full shopping flow', async () => {
        const result = await handleUserQuery('buy samsung phone under 20000');
        expect(result).toBeDefined();
        // ... more assertions
    });
});
```

### Test Structure

- **Unit Tests**: Test individual functions/modules
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user flows

## Debugging

### Chrome DevTools

#### Service Worker Debugging

1. Go to `chrome://extensions/`
2. Find RetailAgent extension
3. Click "service worker" link
4. DevTools opens for service worker
5. Set breakpoints and debug

#### Content Script Debugging

1. Open the e-commerce website (e.g., amazon.in)
2. Open DevTools (F12)
3. Go to "Sources" tab
4. Find extension files under "Content scripts"
5. Set breakpoints

#### Popup Debugging

1. Right-click extension icon
2. Select "Inspect popup"
3. DevTools opens for popup
4. Debug UI code

### Console Logging

```javascript
// Use logger instead of console.log
logger.info('Debug message', { data });
logger.error('Error', error);

// Check logs in popup settings
```

### Common Debugging Scenarios

#### Content Script Not Loading

1. Check `manifest.json` content_scripts section
2. Verify URL matches in manifest
3. Check service worker console for errors
4. Verify loader files exist

#### Service Worker Not Responding

1. Check service worker console
2. Verify service worker is running
3. Check for import errors
4. Reload extension

#### Messages Not Passing

1. Check `chrome.runtime.lastError`
2. Verify message structure matches
3. Check if content script is injected
4. Verify tab ID is correct

## Adding Features

### 1. Adding a New Platform

See [PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md) for detailed instructions.

### 2. Adding a New Library

1. Create file in `src/lib/your-library.js`
2. Export functions/classes
3. Import where needed
4. Add tests
5. Document in API_DOCUMENTATION.md

### 3. Adding UI Features

1. Update `src/popup/index.html` (structure)
2. Update `src/popup/popup.js` (logic)
3. Update `src/popup/styles.css` (styling)
4. Test in popup DevTools

### 4. Adding New Intent Filters

1. Update intent parser prompt in `service_worker.js`
2. Add filter handling in platform implementations
3. Update filter builders if needed
4. Add tests

## Contributing

### Contribution Process

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Write** tests
5. **Update** documentation
6. **Submit** a pull request

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No linter errors
- [ ] Tested manually
- [ ] Commit messages are clear

### Commit Message Format

```
type: short description

Longer description if needed

- Bullet point 1
- Bullet point 2
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

### Code Review

- Be respectful and constructive
- Focus on code, not person
- Suggest improvements
- Approve when satisfied

## Common Tasks

### Reloading Extension

```bash
# After making changes
npm run build
# Then reload in chrome://extensions/
```

### Clearing Extension Data

```javascript
// In service worker console
chrome.storage.local.clear();
```

### Testing Intent Parsing

```javascript
// In service worker console
const apiKey = 'your-api-key';
const query = 'buy samsung phone under 20000';
const intent = await parseIntent(apiKey, query);
console.log(intent);
```

### Testing Platform Search

```javascript
// In content script console (on platform page)
const platform = new AmazonPlatform();
await platform.search('samsung phone', { price_max: 20000 });
const results = await platform.getSearchResults();
console.log(results);
```

## Troubleshooting

### Build Errors

**Issue**: Webpack errors
**Solution**: Check import paths, verify all dependencies installed

**Issue**: Module not found
**Solution**: Check file paths, verify exports

### Runtime Errors

**Issue**: Service worker not loading
**Solution**: Check for syntax errors, verify imports

**Issue**: Content script not injecting
**Solution**: Check manifest.json, verify URL matches

**Issue**: API calls failing
**Solution**: Check API key, verify network, check quota

### Common Issues

1. **Extension not reloading**: Hard reload browser
2. **Old code running**: Clear browser cache
3. **Messages failing**: Check chrome.runtime.lastError
4. **Selectors not working**: Check DOM structure changed

## Resources

### Documentation
- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

### Tools
- [Chrome Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

### Community
- [Chrome Extensions Forum](https://groups.google.com/a/chromium.org/g/chromium-extensions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-chrome-extension)

---

**Last Updated**: January 2026  
**Version**: 1.0.0

