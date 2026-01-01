# Improved Collapsible Messages - Claude/ChatGPT Style

## Problem Fixed
Previously, only the first 4 messages were being collapsed. All subsequent messages appeared normally because the pattern matching was too restrictive.

## Solution
Changed from **whitelist approach** (specific patterns) to **blacklist approach** (everything except final messages).

### Before (Restrictive Patterns):
```javascript
// Only these specific patterns were collapsed:
- "Trying model X/Y:"
- "Model X failed"
- "Model X succeeded"
- "Analyzing your request"
- Limited to ~8 patterns
```

**Result:** Most messages (like "Platform registered", "Performing search", "Applying filters") were NOT matched, so they appeared as regular messages.

### After (Inclusive Approach):
```javascript
// Everything is intermediate EXCEPT final messages:
const isFinalMessage = (text) => {
  const finalPatterns = [
    /^Searching for/,
    /^Opening .* in a new tab/,
    /^Found .* items/,
    /^✅/,
    /^Unable to complete/,
    /^Please proceed manually/,
    /^Maximum retry attempts reached/,
    // ... only truly important messages
  ];
  return finalPatterns.some(pattern => pattern.test(text));
};

// All system messages that are NOT final = intermediate
const isIntermediateMessage = (text, sender) => {
  if (sender !== 'system') return false;
  if (isFinalMessage(text)) return false;
  return true; // Everything else is collapsed
};
```

**Result:** ALL progress/debug/intermediate messages are now collapsed. Only final, actionable messages are visible.

## New Behavior

### Multiple Collapsible Sections
Like Claude/ChatGPT thinking sections, you can now have multiple collapsed groups in one conversation:

```
User: buy samsung phone...
▶ 🔄 11 steps (click to expand)
Searching for "phone" with filters...
Opening amazon in a new tab...
▶ 🔄 8 steps (click to expand)
Found 16 items on page.
▶ 🔄 5 steps (click to expand)
✅ Successfully navigated to checkout page!
Please complete the checkout manually on the website.
```

Each collapsed section groups its own intermediate messages. When a final message appears, the current group closes, and a new group starts for the next batch of intermediate messages.

## Visual Improvements

### Better Styling (Claude/ChatGPT-like)
```css
/* Cleaner, more modern look */
.collapsible-group {
  background: #f7f7f8;
  border: 1px solid #e3e4e8;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* Gradient header */
.collapsible-header {
  background: linear-gradient(to bottom, #fafafa, #f5f5f5);
  padding: 12px 14px;
}

/* Icon for context */
.collapsible-icon {
  content: '🔄';
  opacity: 0.7;
}
```

### Smart Summary Text
```javascript
if (collapsibleMessageCount === 1) {
  summary = 'Processing...';
} else {
  summary = `${collapsibleMessageCount} steps (click to expand)`;
}
```

## Example Flow

### User Query:
```
"buy samsung phone greater than 5000 battery and greater than 6gb ram less than 20000 rs price"
```

### Chat Display:
```
User: buy samsung phone greater than...

▶ 🔄 Processing...
  [Collapsed: 11 intermediate messages including:]
  - Analyzing your request...
  - Trying model 1/34: gemini-2.0-flash-lite-preview
  - Model failed (429)...
  - ... (8 more model attempts)
  - Model gemini-robotics-er-1.5-preview succeeded

Searching for "phone" with filters: {...}
Opening amazon in a new tab...

▶ 🔄 8 steps (click to expand)
  [Collapsed: 8 intermediate messages including:]
  - Platform registered: amazon
  - Performing search
  - Search submitted
  - Executing fallback search
  - Amazon: Applying filters
  - Filters applied, waiting for results
  - Requesting search results
  - Amazon: Extracting products

Found 16 items on page.

▶ 🔄 5 steps (click to expand)
  [Collapsed: 5 intermediate messages including:]
  - Products ranked
  - Navigation attempt via tabs.update
  - Opening product page...
  - Product page navigation verified
  - On Product Page. Finding "Buy Now" button...

✅ Successfully navigated to checkout page!
Please complete the checkout manually on the website.
```

## Benefits

1. **Clean UI**: Only 3-4 visible messages instead of 30+
2. **Multiple Sections**: Each phase of work gets its own collapsible group
3. **Always Available**: Click to expand any section to see details
4. **Smart Grouping**: Automatically groups related intermediate messages
5. **Professional**: Looks like Claude/ChatGPT thinking sections

## What Gets Collapsed vs Visible

### Collapsed (Intermediate):
- Platform registered
- Performing search
- Search submitted
- Applying filters
- Filters applied
- Navigation attempts
- Product extraction
- Clicking buttons
- Model attempts/failures
- API calls
- DOM operations
- State changes
- Debug info

### Visible (Final):
- ✅ Success messages
- Searching for "X"...
- Opening X in a new tab
- Found X items
- Unable to complete...
- Please proceed manually
- Maximum retry attempts
- Error messages requiring user action
- Settings saved
- Chat cleared

## Files Modified
1. `src/popup/popup.js` - Changed to blacklist approach + visual improvements
2. `src/popup/styles.css` - Claude/ChatGPT-style appearance

## Test It
1. **Reload extension**
2. **Send query**: "buy samsung phone..."
3. **Observe**: Multiple collapsible sections throughout the conversation
4. **Click any section** to expand/collapse
5. **See**: Clean, professional chat UI with details on demand

