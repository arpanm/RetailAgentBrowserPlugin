# LLM DOM Analysis Best Practices

## Overview
Using LLMs to analyze DOM structure enables adaptive, intelligent interaction with dynamic websites where traditional selectors fail.

## When to Use LLM DOM Analysis

### Use Cases
1. **Unknown/Changing Selectors** - Platform changes frequently
2. **Complex Filter Structures** - Non-standard or custom filters
3. **Fallback Strategy** - When rule-based methods fail
4. **New Platforms** - No pre-defined selectors available
5. **A/B Testing Variants** - Different users see different DOM structures

### When NOT to Use
1. **Stable Selectors Available** - Rule-based is faster/cheaper
2. **Simple Operations** - Standard clicking/navigation
3. **High-Frequency Actions** - Cost/latency prohibitive
4. **Offline Requirements** - LLM requires network

## DOM Simplification

### Why Simplify
- LLMs have token limits
- Reduce noise and irrelevant elements
- Focus on actionable content
- Faster processing

### Simplification Strategy

#### 1. Remove Unnecessary Elements
```javascript
function simplifyDOM(rootElement) {
  const clone = rootElement.cloneNode(true);
  
  // Remove scripts, styles, SVGs
  const removeSelectors = ['script', 'style', 'svg', 'noscript', 'iframe'];
  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Remove hidden elements
  clone.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
  clone.querySelectorAll('[hidden], .hidden').forEach(el => el.remove());
  
  // Remove ads and tracking
  clone.querySelectorAll('[class*="ad-"], [id*="ad-"], [class*="tracking"]').forEach(el => el.remove());
  
  return clone;
}
```

#### 2. Extract Key Attributes
```javascript
function extractKeyAttributes(element) {
  const attributes = {};
  
  // Only keep relevant attributes
  const relevantAttrs = ['id', 'class', 'name', 'type', 'href', 'data-asin', 'data-id', 'aria-label'];
  
  relevantAttrs.forEach(attr => {
    if (element.hasAttribute(attr)) {
      attributes[attr] = element.getAttribute(attr);
    }
  });
  
  return attributes;
}
```

#### 3. Create Hierarchical Structure
```javascript
function createDOMHierarchy(element, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return null;
  
  const node = {
    tag: element.tagName.toLowerCase(),
    attributes: extractKeyAttributes(element),
    text: element.textContent?.trim().substring(0, 100), // Limit text length
    children: []
  };
  
  // Only process relevant children
  Array.from(element.children).forEach(child => {
    if (isRelevantElement(child)) {
      const childNode = createDOMHierarchy(child, maxDepth, currentDepth + 1);
      if (childNode) {
        node.children.push(childNode);
      }
    }
  });
  
  return node;
}

function isRelevantElement(element) {
  const relevantTags = ['div', 'span', 'a', 'button', 'input', 'select', 'ul', 'li', 'form'];
  return relevantTags.includes(element.tagName.toLowerCase()) &&
         element.textContent?.trim().length > 0;
}
```

## LLM Prompt Engineering

### Prompt Structure

#### 1. System Instruction
```javascript
const systemInstruction = `
You are an expert web automation assistant specializing in e-commerce platforms.
Your task is to analyze HTML/DOM structure and provide actionable recommendations.

Your responses must be:
1. **Structured JSON** - Always return valid JSON
2. **Specific** - Provide exact CSS selectors
3. **Testable** - Selectors must work in querySelector()
4. **Prioritized** - Order recommendations by reliability

Response Format:
{
  "analysis": "Brief description of findings",
  "selectors": [
    {
      "purpose": "what this selector does",
      "selector": "CSS selector string",
      "priority": 1-5 (1=highest),
      "method": "click|input|navigate"
    }
  ],
  "fallback": "alternative approach if selectors fail"
}
`;
```

#### 2. Context-Specific Instructions

**For Filter Discovery**:
```javascript
const filterDiscoveryPrompt = `
Analyze this HTML to identify filter controls (checkboxes, dropdowns, links).
Focus on:
- Price range selectors
- Brand filters
- Specification filters (RAM, Storage, Battery)
- Rating filters

For each filter found, provide:
- Filter category/type
- CSS selector to find it
- How to interact with it (click, input, select)
- Current state (selected/unselected)
`;
```

**For Product Extraction**:
```javascript
const productExtractionPrompt = `
Analyze this HTML to identify product listings.
For each product, extract:
- Product title
- Price
- Link/URL
- ASIN/Product ID
- Rating
- Availability status

Provide CSS selectors for:
- Product container
- Title element
- Price element
- Link element
- Any unique identifiers

Identify and mark sponsored products.
`;
```

**For Buy Now Button**:
```javascript
const buyNowPrompt = `
Analyze this product page HTML to locate the "Buy Now" button.
Look for:
- Button or input elements
- Text containing "Buy Now", "Buy", "Purchase"
- Form submission elements
- Alternative CTAs if Buy Now not available

Provide selector, interaction method, and any prerequisites (e.g., variant selection).
`;
```

### Few-Shot Examples

Include examples in prompts to guide LLM:

```javascript
const fewShotExamples = `
Example 1:
HTML: <input id="buy-now-button" type="submit" value="Buy Now">
Response: {
  "selector": "#buy-now-button",
  "method": "click",
  "priority": 1
}

Example 2:
HTML: <div class="filter-option"><a href="/s?rh=p_36:10000-20000">₹10,000 - ₹20,000</a></div>
Response: {
  "selector": ".filter-option a[href*='p_36']",
  "method": "click",
  "priority": 1,
  "filterType": "price"
}
`;
```

## Response Validation

### Validate LLM Output
```javascript
function validateLLMResponse(response) {
  const errors = [];
  
  // Check JSON structure
  if (!response.selectors || !Array.isArray(response.selectors)) {
    errors.push('Missing or invalid selectors array');
  }
  
  // Validate each selector
  response.selectors?.forEach((sel, index) => {
    if (!sel.selector) {
      errors.push(`Selector ${index}: missing selector string`);
    }
    
    if (!sel.method) {
      errors.push(`Selector ${index}: missing interaction method`);
    }
    
    // Test selector validity
    try {
      document.querySelector(sel.selector);
    } catch (e) {
      errors.push(`Selector ${index}: invalid CSS selector "${sel.selector}"`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Test Selectors
```javascript
async function testLLMSelectors(selectors) {
  const results = [];
  
  for (const sel of selectors) {
    try {
      const element = document.querySelector(sel.selector);
      
      results.push({
        selector: sel.selector,
        found: element !== null,
        visible: element?.offsetParent !== null,
        clickable: element && !element.disabled,
        text: element?.textContent?.trim().substring(0, 50)
      });
    } catch (error) {
      results.push({
        selector: sel.selector,
        error: error.message
      });
    }
  }
  
  return results;
}
```

## Iterative Refinement

### Strategy: Learn from Failures
```javascript
async function llmWithFeedback(domContent, task, maxAttempts = 3) {
  let feedback = '';
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = `
      ${task}
      
      ${feedback ? `Previous attempt failed: ${feedback}. Try a different approach.` : ''}
      
      DOM Content:
      ${domContent}
    `;
    
    const response = await callLLM(prompt);
    const validation = validateLLMResponse(response);
    
    if (!validation.valid) {
      feedback = `Invalid response: ${validation.errors.join(', ')}`;
      continue;
    }
    
    // Test selectors
    const testResults = await testLLMSelectors(response.selectors);
    const workingSelectors = testResults.filter(r => r.found && r.visible);
    
    if (workingSelectors.length > 0) {
      return {
        success: true,
        selectors: workingSelectors,
        attempt
      };
    }
    
    feedback = `Selectors not found or not visible: ${testResults.map(r => r.selector).join(', ')}`;
  }
  
  return {
    success: false,
    reason: 'Max attempts reached'
  };
}
```

## Cost & Performance Optimization

### 1. Caching
```javascript
const llmCache = new Map();

async function cachedLLMAnalysis(domHash, task) {
  const cacheKey = `${domHash}-${task}`;
  
  if (llmCache.has(cacheKey)) {
    return llmCache.get(cacheKey);
  }
  
  const result = await llmAnalysis(domHash, task);
  llmCache.set(cacheKey, result);
  
  // Expire after 1 hour
  setTimeout(() => llmCache.delete(cacheKey), 60 * 60 * 1000);
  
  return result;
}
```

### 2. Selective Analysis
```javascript
function shouldUseLLM(context) {
  // Use rule-based if available
  if (context.hasStableSelectors) {
    return false;
  }
  
  // Use LLM for unknown platforms
  if (!context.knownPlatform) {
    return true;
  }
  
  // Use LLM if previous attempts failed
  if (context.previousAttempts > 2) {
    return true;
  }
  
  return false;
}
```

### 3. Token Management
```javascript
function optimizeDOMForLLM(dom, maxTokens = 4000) {
  let simplified = simplifyDOM(dom);
  let content = simplified.innerHTML;
  
  // Estimate tokens (rough: 1 token ≈ 4 characters)
  const estimatedTokens = content.length / 4;
  
  if (estimatedTokens > maxTokens) {
    // Aggressive truncation
    content = content.substring(0, maxTokens * 4);
    content += '\n... (truncated)';
  }
  
  return content;
}
```

## Platform-Specific Patterns

### Amazon Pattern Recognition
```javascript
const amazonPatterns = {
  productContainer: [
    '[data-asin]:not([data-asin=""])',
    '[data-component-type="s-search-result"]'
  ],
  buyNowButton: [
    '#buy-now-button',
    'input[name="submit.buy-now"]'
  ],
  filters: [
    '#s-refinements div[id^="p_"]'
  ]
};

function enhancePromptWithPatterns(prompt, platform) {
  const patterns = platformPatterns[platform];
  if (patterns) {
    prompt += `\n\nKnown ${platform} patterns:\n${JSON.stringify(patterns, null, 2)}`;
  }
  return prompt;
}
```

## Error Handling

### Graceful Degradation
```javascript
async function analyzeWithFallback(dom, task) {
  try {
    // Try LLM analysis
    const llmResult = await llmAnalysis(dom, task);
    if (llmResult.success) {
      return llmResult;
    }
  } catch (error) {
    console.error('LLM analysis failed:', error);
  }
  
  // Fallback to basic heuristics
  return basicHeuristicAnalysis(dom, task);
}

function basicHeuristicAnalysis(dom, task) {
  // Simple text-based matching as last resort
  if (task.includes('buy now')) {
    const buttons = Array.from(dom.querySelectorAll('button, input[type="submit"]'));
    const buyButton = buttons.find(btn => 
      /buy\s*now/i.test(btn.textContent || btn.value)
    );
    
    if (buyButton) {
      return {
        success: true,
        selectors: [{
          selector: `button:contains("${buyButton.textContent}")`,
          method: 'click'
        }]
      };
    }
  }
  
  return { success: false };
}
```

## Best Practices Summary

1. **Always Simplify DOM** - Remove noise before sending to LLM
2. **Provide Clear Instructions** - Specific, actionable prompts
3. **Include Examples** - Few-shot learning improves accuracy
4. **Validate Responses** - Test selectors before using
5. **Iterate with Feedback** - Learn from failures
6. **Cache Results** - Avoid redundant LLM calls
7. **Use as Fallback** - Not primary method
8. **Monitor Costs** - Track API usage
9. **Handle Errors Gracefully** - Always have a fallback
10. **Platform-Specific Context** - Include known patterns

## Evaluation Metrics

```javascript
const llmAnalyticsTracker = {
  totalCalls: 0,
  successfulCalls: 0,
  averageTokensUsed: 0,
  averageResponseTime: 0,
  
  track(call) {
    this.totalCalls++;
    if (call.success) this.successfulCalls++;
    this.averageTokensUsed = 
      (this.averageTokensUsed * (this.totalCalls - 1) + call.tokensUsed) / this.totalCalls;
    this.averageResponseTime = 
      (this.averageResponseTime * (this.totalCalls - 1) + call.responseTime) / this.totalCalls;
  },
  
  getStats() {
    return {
      total: this.totalCalls,
      successful: this.successfulCalls,
      successRate: (this.successfulCalls / this.totalCalls * 100).toFixed(2) + '%',
      avgTokens: Math.round(this.averageTokensUsed),
      avgResponseTime: Math.round(this.averageResponseTime) + 'ms'
    };
  }
};
```

## Resources
- LLM API documentation (Gemini, GPT-4, etc.)
- CSS selector specification
- Web automation best practices
- DOM manipulation guides

