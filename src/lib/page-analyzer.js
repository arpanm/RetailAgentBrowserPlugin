/**
 * Page Analyzer using Gemini LLM
 * Analyzes simplified DOM content to decide the next automation step
 * Supports multiple analysis modes for different use cases
 */

import { generateContent } from './gemini.js';
import { logger } from './logger.js';
import { parseJSONFromLLMResponse } from './json-parser.js';

// Analysis modes
export const ANALYSIS_MODES = {
    ANALYZE_SEARCH_RESULTS: 'ANALYZE_SEARCH_RESULTS',
    ANALYZE_FILTERS: 'ANALYZE_FILTERS',
    MATCH_PRODUCTS: 'MATCH_PRODUCTS',
    DETECT_LOGIN: 'DETECT_LOGIN',
    EXTRACT_ATTRIBUTES: 'EXTRACT_ATTRIBUTES',
    GENERAL: 'GENERAL' // Default mode
};

function getSystemInstruction(intent, status, platform, mode = ANALYSIS_MODES.GENERAL) {
    const baseInstruction = `
You are an expert ecommerce automation agent. Your task is to analyze the provided simplified page content and decide the next best action to fulfill the user's intent.

User Intent: ${intent}
Current Status: ${status}
Platform: ${platform}
Analysis Mode: ${mode}

The page content is a simplified representation of the current browser tab.
`;

    switch (mode) {
        case ANALYSIS_MODES.ANALYZE_SEARCH_RESULTS:
            // Platform-specific product patterns
            const productPatterns = {
                amazon: {
                    productContainer: '[data-asin]:not([data-asin=""])',
                    titleSelector: 'h2 a span, h2 a',
                    priceSelector: '.a-price .a-offscreen, .a-price-whole',
                    linkSelector: 'h2 a[href]',
                    imageSelector: 'img.s-image',
                    ratingSelector: '.a-icon-star-small .a-icon-alt',
                    linkPattern: '/dp/', 
                    origin: 'https://www.amazon.in'
                },
                flipkart: {
                    productContainer: 'div[data-id], ._1AtVbE',
                    titleSelector: '._4rR01T, a.IRpwTa',
                    priceSelector: '._30jeq3',
                    linkSelector: 'a[href*="/p/"]',
                    imageSelector: 'img[loading="eager"]',
                    ratingSelector: '.gUuXy-',
                    linkPattern: '/p/',
                    origin: 'https://www.flipkart.com'
                }
            };
            
            const platformInfo = productPatterns[platform?.toLowerCase()] || productPatterns.amazon;
            
            return baseInstruction + `
Your task is to extract product information from search results when rule-based extraction failed.

Platform: ${platform || 'unknown'}
Platform-specific information:
- Product container: ${platformInfo.productContainer}
- Title location: ${platformInfo.titleSelector}
- Price location: ${platformInfo.priceSelector}
- Link pattern: ${platformInfo.linkPattern}
- Base URL: ${platformInfo.origin}

Extract ALL products from the page content. For each product, identify:
1. **Title** - Full product name/description
2. **Price** - Both string and numeric value
3. **Link/URL** - Product detail page URL (must be absolute)
4. **Attributes from title/description**:
   - Battery capacity (mAh) - look for patterns like "5000mAh", "5000 mAh battery"
   - RAM (GB) - look for patterns like "6GB RAM", "6 GB", "8GB"
   - Storage (GB/TB) - look for patterns like "128GB", "256 GB storage", "1TB"
   - Brand - Samsung, Apple, Xiaomi, OnePlus, etc.
5. **Rating** - Star rating if available (0-5 scale)
6. **Reviews** - Number of reviews/ratings if available
7. **Image URL** - Product image if available
8. **Confidence score** - How confident you are about this product (0-1)

Return a JSON object with this structure:
{
  "action": "extract_products",
  "products": [
    {
      "title": "Samsung Galaxy M32 (Light Blue, 6GB RAM, 128GB Storage) | 6000mAh Battery",
      "price": "₹14,999",
      "priceNumeric": 14999,
      "link": "${platformInfo.origin}/dp/B09P8ZXYN5",
      "battery": 6000,
      "ram": 6,
      "storage": 128,
      "brand": "samsung",
      "rating": 4.2,
      "reviews": "1,234",
      "image": "https://...",
      "confidence": 0.95
    }
  ],
  "totalFound": 20,
  "reason": "Extracted products from search results using semantic analysis"
}

Critical Rules for ${platform || 'Amazon'}:
1. **Link Normalization**:
   - For Amazon: Links must be absolute and contain "/dp/" (e.g., https://www.amazon.in/dp/ASINCODE)
   - For Flipkart: Links must contain "/p/" (e.g., https://www.flipkart.com/product-name/p/itm1234)
   - Convert relative URLs to absolute using base URL: ${platformInfo.origin}
   - Remove tracking parameters and redirects
   
2. **Attribute Extraction**:
   - Extract battery in mAh (numeric only): 5000, 6000, etc.
   - Extract RAM in GB (numeric only): 4, 6, 8, 12, etc.
   - Extract storage in GB (numeric only): 64, 128, 256, 512, etc. (convert TB to GB if needed)
   - Brand should be lowercase: samsung, apple, xiaomi, oneplus, etc.
   
3. **Price Processing**:
   - Extract numeric value by removing currency symbols (₹, $, etc.)
   - Remove commas and spaces
   - Handle "From ₹X" by extracting X
   - If price range, use the lower value
   
4. **Product Validation**:
   - Only extract if you see clear product title and link
   - Skip sponsored ads, banners, or non-product content
   - Skip "Visit the help section" or similar navigation items
   - Confidence score should reflect certainty (0.9+ for clear products)
   
5. **Ranking**:
   - Return products in order of relevance to user's query
   - Prioritize products with more complete information
   - Consider price, ratings, and attribute matches

Example for common patterns:
- "Samsung Galaxy M32 (6GB, 128GB) 5000mAh" → battery: 5000, ram: 6, storage: 128
- "iPhone 14 Pro 256GB" → brand: "apple", storage: 256, ram: null
- "Redmi Note 12 Pro 8GB+256GB 5000mAh" → brand: "xiaomi", ram: 8, storage: 256, battery: 5000
`;

        case ANALYSIS_MODES.ANALYZE_FILTERS:
            // Platform-specific filter patterns
            const platformPatterns = {
                amazon: {
                    filterContainer: '#s-refinements, #leftNav, #filters-left-nav',
                    filterGroup: 'div[id^="p_"], div.a-section.a-spacing-none',
                    clickable: 'a.s-navigation-item, input[type="checkbox"], span.a-list-item',
                    priceInputs: 'input#low-price, input#high-price',
                    expandButtons: 'a[aria-expanded="false"], .s-expander-button'
                },
                flipkart: {
                    filterContainer: '._36fx1h, ._1AtVbE, ._1KO7_1',
                    filterGroup: '._3V_o9G, ._213e_G, section',
                    clickable: 'div[class*="_3879" i], label, a[href*="q="]',
                    priceInputs: 'input[type="text"][placeholder*="Min"], input[type="text"][placeholder*="Max"]',
                    expandButtons: '._2Go1ky, [class*="see-more"]'
                }
            };
            
            const filterPlatformInfo = platformPatterns[platform?.toLowerCase()] || platformPatterns.amazon;

            return baseInstruction + `
Your task is to understand available filters on the page and recommend which filters to apply.

Platform: ${platform || 'unknown'}
Platform-specific information:
- Filter container selectors: ${filterPlatformInfo.filterContainer}
- Filter group selectors: ${filterPlatformInfo.filterGroup}
- Clickable filter selectors: ${filterPlatformInfo.clickable}
- Price input selectors: ${filterPlatformInfo.priceInputs}

Analyze the filters section carefully and identify:
1. **Available filter categories** (Brand, RAM, Battery, Storage, Price Range, Rating, etc.)
2. **Filter options within each category** with their exact text labels
3. **Which filters match the user's requirements**
4. **The interaction method** for each filter (click checkbox, click link, fill input, etc.)
5. **The application sequence** if multiple filters need to be applied in order

Return a JSON object with this structure:
{
  "action": "apply_filters",
  "filters": [
    {
      "category": "Brand",
      "option": "Samsung",
      "selector": "css_selector_or_text_to_match",
      "interactionMethod": "click|input|select",
      "value": "value_if_input_type",
      "reason": "why this filter matches user requirements",
      "priority": 1
    }
  ],
  "sequence": ["filter1", "filter2"],
  "verificationMethod": "how to verify filter was applied (URL parameter, UI state, etc.)",
  "reason": "overall strategy for applying these filters"
}

Important Rules:
- Provide PRECISE CSS selectors when possible (IDs, classes, attributes)
- For text matching, provide the EXACT text as it appears on the page
- Specify the interaction method clearly (click, type, select dropdown)
- Handle price range filters specially - identify min/max inputs separately
- For checkboxes, provide the label text or input selector
- For expandable sections ("See More"), indicate if expansion is needed first
- Prioritize filters: 1 (must apply), 2 (should apply), 3 (optional)
- Consider filter dependencies (e.g., Category before Brand)
- If exact match not found, suggest the closest available alternatives
- Include verification strategy to confirm filter application succeeded

Example for ${platform || 'Amazon'}:
{
  "action": "apply_filters",
  "filters": [
    {
      "category": "Price",
      "option": "Under 20000",
      "selector": "#low-price",
      "interactionMethod": "input",
      "value": "20000",
      "reason": "User specified max price 20000",
      "priority": 1
    },
    {
      "category": "Brand",
      "option": "Samsung",
      "selector": "a:contains('Samsung')",
      "interactionMethod": "click",
      "reason": "User requested Samsung brand",
      "priority": 1
    },
    {
      "category": "RAM",
      "option": "6GB and above",
      "selector": "label:contains('6 GB')",
      "interactionMethod": "click",
      "reason": "User needs >= 6GB RAM",
      "priority": 2
    }
  ],
  "sequence": ["Price", "Brand", "RAM"],
  "verificationMethod": "Check URL contains filter parameters, verify active filter chips visible",
  "reason": "Apply price filter first to reduce results, then brand and specs"
}
`;

        case ANALYSIS_MODES.MATCH_PRODUCTS:
            return baseInstruction + `
Your task is to match products against user requirements using semantic understanding.

User Requirements:
${intent.includes('battery') ? '- Battery: ' + intent.match(/battery[^\d]*(\d+)/i)?.[1] + ' mAh' : ''}
${intent.includes('ram') ? '- RAM: ' + intent.match(/ram[^\d]*(\d+)/i)?.[1] + ' GB' : ''}
${intent.includes('price') ? '- Price: ' + intent.match(/price[^\d]*(\d+)/i)?.[1] : ''}

Analyze products and select the best match based on requirements.

Return a JSON object with this structure:
{
  "action": "select_product",
  "url": "product_url",
  "title": "product_title",
  "reason": "why this product matches requirements",
  "matchedAttributes": {
    "battery": true,
    "ram": true,
    "price": true
  }
}

Rules:
- Match products semantically (e.g., "6GB RAM" matches "6 GB RAM")
- Extract attributes from titles/descriptions if not explicitly stated
- Prefer products that match all requirements
- If no perfect match, select closest match and explain why
`;

        case ANALYSIS_MODES.DETECT_LOGIN:
            return baseInstruction + `
Your task is to detect if login is required and identify login elements.

Analyze the page to determine:
- Is a login screen present?
- What login elements are visible (email/phone input, password input, login button)?
- What actions are needed to proceed?

Return a JSON object with this structure:
{
  "action": "login_required" | "no_login_needed" | "click_login_button",
  "loginDetected": true/false,
  "elements": {
    "emailInput": "css_selector",
    "passwordInput": "css_selector",
    "loginButton": "css_selector"
  },
  "reason": "explanation"
}

Rules:
- Look for password inputs, login forms, sign-in buttons
- Provide precise selectors for login elements
- If login not needed, return "no_login_needed"
`;

        case ANALYSIS_MODES.EXTRACT_ATTRIBUTES:
            return baseInstruction + `
Your task is to extract product attributes (battery, RAM, storage) from product titles and descriptions.

For each product, extract:
- Battery capacity in mAh
- RAM in GB
- Storage in GB
- Brand name

Return a JSON object with this structure:
{
  "action": "extract_attributes",
  "products": [
    {
      "title": "product title",
      "battery": 5000,
      "ram": 6,
      "storage": 128,
      "brand": "samsung"
    }
  ]
}

Rules:
- Extract numeric values only
- If attribute not found, set to null
- Handle variations (e.g., "6GB RAM", "6 GB RAM", "6GB Memory")
`;

        default: // GENERAL mode
            return baseInstruction + `
Identify the most relevant elements (products, filters, login buttons, search boxes) and choose ONE action from the following:

1. CLICK: { "action": "click", "selector": "css_selector", "reason": "why" }
2. SELECT_PRODUCT: { "action": "select_product", "url": "product_url", "title": "product_title", "reason": "why this matches" }
3. INPUT: { "action": "input", "selector": "css_selector", "value": "text_to_enter", "reason": "why" }
4. FINISHED: { "action": "completed", "message": "done" }
5. FAILED: { "action": "error", "message": "explanation" }

Rules:
- Be precise with selectors.
- For SELECT_PRODUCT, pick the absolute best match based on user filters.
- If a login is clearly required to proceed, choose the login button.
- If filters need to be applied to narrow results, click them one by one.
- Return ONLY a valid JSON object.
`;
    }
}

export async function analyzePage(apiKey, pageContent, context, mode = ANALYSIS_MODES.GENERAL) {
    const { intent, status, platform } = context;
    
    const prompt = `
Simplified Page Content:
${pageContent}

Based on the above content and the user's intent "${intent}", what is the next step?
`;

    const finalSystemInstruction = getSystemInstruction(intent, status, platform, mode);

    try {
        logger.info('Sending page content to LLM for analysis', { 
            contentLength: pageContent.length,
            status,
            mode
        });
        
        const response = await generateContent(apiKey, prompt, finalSystemInstruction);
        
        if (!response || !response.candidates || !response.candidates[0]) {
            throw new Error('Invalid LLM response');
        }

        let text = response.candidates[0].content.parts[0].text;
        
        // Try multiple JSON extraction and parsing strategies
        const result = parseJSONFromLLMResponse(text, mode);
        
        if (!result) {
            throw new Error('Failed to extract valid JSON from LLM response');
        }
        
        logger.info('LLM Page Analysis Result', { mode, action: result.action, hasProducts: !!result.products });
        
        return result;
    } catch (error) {
        logger.error('Page analysis failed', { error: error.message, mode });
        throw error;
    }
}

/**
 * Extract product attributes using LLM
 */
export async function extractAttributesWithLLM(apiKey, productTitle, productDescription = '') {
    try {
        const prompt = `
Product Title: ${productTitle}
Product Description: ${productDescription || 'Not available'}

Extract the following attributes from the product information:
- Battery capacity in mAh (look for numbers followed by mAh/mAH)
- RAM in GB (look for numbers followed by GB and RAM/Memory)
- Storage in GB (look for numbers followed by GB and Storage/SSD)
- Brand name

Return JSON:
{
  "battery": 5000 or null,
  "ram": 6 or null,
  "storage": 128 or null,
  "brand": "samsung" or null
}
`;

        const response = await generateContent(apiKey, prompt, 'You are a product attribute extractor. Extract numeric values for battery, RAM, storage, and brand name from product information.');
        
        if (!response || !response.candidates || !response.candidates[0]) {
            throw new Error('Invalid LLM response');
        }

        let text = response.candidates[0].content.parts[0].text;
        
        // Try multiple JSON extraction and parsing strategies
        const result = parseJSONFromLLMResponse(text, 'attribute_extraction');
        
        if (!result) {
            logger.warn('Failed to parse LLM attribute extraction, returning nulls');
            return { battery: null, ram: null, storage: null, brand: null };
        }
        
        logger.info('LLM Attribute Extraction Result', { 
            title: productTitle.substring(0, 50), 
            result 
        });
        
        return result;
    } catch (error) {
        logger.error('Attribute extraction failed', { error: error.message, title: productTitle.substring(0, 50) });
        return { battery: null, ram: null, storage: null, brand: null };
    }
}
