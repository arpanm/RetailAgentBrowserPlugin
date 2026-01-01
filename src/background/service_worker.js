import { generateContent, listModels, setLogAction } from '../lib/gemini.js';
import { logger } from '../lib/logger.js';
import { ErrorHandler, IntentParseError, APIError } from '../lib/error-handler.js';
import { retryAPICall } from '../lib/retry.js';
import { platformRegistry, EcommercePlatform } from '../lib/ecommerce-platforms.js';
import { configManager } from '../lib/config.js';
import { loginManager } from '../lib/login-manager.js';
import { rankResults, isUnavailable, matchesFilters } from '../lib/product-matcher.js';
import { analyzePage, ANALYSIS_MODES, extractAttributesWithLLM } from '../lib/page-analyzer.js';


// Create minimal platform instances for service worker
// Full implementations are in content scripts
class SWAmazonPlatform extends EcommercePlatform {
    constructor() {
        super('amazon', {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
        });
    }
}

class SWFlipkartPlatform extends EcommercePlatform {
    constructor() {
        super('flipkart', {
            enabled: true,
            domains: ['flipkart.com'],
        });
    }
}

class SWEbayPlatform extends EcommercePlatform {
    constructor() {
        super('ebay', {
            enabled: true,
            domains: ['ebay.com', 'ebay.in'],
        });
    }
}

class SWWalmartPlatform extends EcommercePlatform {
    constructor() {
        super('walmart', {
            enabled: true,
            domains: ['walmart.com'],
        });
    }
}

class SWShopifyPlatform extends EcommercePlatform {
    constructor() {
        super('shopify', {
            enabled: true,
            domains: ['myshopify.com', 'shopify.com'],
        });
    }
}

// Register platforms immediately
try {
    platformRegistry.register(new SWAmazonPlatform());
    platformRegistry.register(new SWFlipkartPlatform());
    platformRegistry.register(new SWEbayPlatform());
    platformRegistry.register(new SWWalmartPlatform());
    platformRegistry.register(new SWShopifyPlatform());
    
    logger.info('Platforms registered in service worker', { 
        count: platformRegistry.getAll().length,
        platforms: platformRegistry.getAll().map(p => p.name)
    });
} catch (error) {
    logger.error('Failed to register platforms', error);
    console.error('Platform registration error:', error);
}

// State management
export let currentState = {
    status: 'IDLE', // IDLE, PARSING, SEARCHING, SELECTING, CHECKOUT, PROCESSING_PAYMENT, COMPLETED
    data: {},       // Parsed intent data
    tabId: null,
    filtersApplied: false
};

/**
 * Reset state to IDLE
 */
export function resetState() {
    currentState.status = 'IDLE';
    currentState.data = {};
    currentState.tabId = null;
    currentState.filtersApplied = false;
}

// Initialize login manager
loginManager.initialize().catch(error => {
    logger.error('Failed to initialize login manager', error);
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from Popup/Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_QUERY') {
        handleUserQuery(message.text).catch(error => {
            ErrorHandler.handle(error, { context: 'PROCESS_QUERY' });
        });
        sendResponse({ status: 'processing' });
    } else if (message.type === 'LOGIN_PLATFORMS') {
        handlePlatformLogin(message.platforms, message.phoneNumber).catch(error => {
            ErrorHandler.handle(error, { context: 'PLATFORM_LOGIN' });
        });
        sendResponse({ status: 'processing' });
    }
    if (message.type === 'CHECK_MODELS') {
        retryAPICall(() => listModels(message.apiKey), {
            maxRetries: 2,
            retryableErrors: [APIError]
        })
            .then(models => {
                // Filter to only Gemini models
                const geminiModels = (models || []).filter(m => 
                    m.name && m.name.toLowerCase().includes('gemini')
                ).map(m => ({
                    name: m.name,
                    displayName: m.displayName || m.name,
                    supportedGenerationMethods: m.supportedGenerationMethods || []
                }));
                sendResponse({ models: geminiModels });
            })
            .catch(err => {
                const userMessage = ErrorHandler._getUserFriendlyMessage(err);
                sendResponse({ error: userMessage });
            });
        return true; // Keep channel open for async response
    }
    
    // Console command to check available models
    if (message.type === 'CONSOLE_CHECK_MODELS') {
        (async () => {
            try {
                const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
                if (!geminiApiKey) {
                    sendResponse({ error: 'No API key configured' });
                    return;
                }
                
                const models = await listModels(geminiApiKey);
                const geminiModels = (models || []).filter(m => 
                    m.name && m.name.toLowerCase().includes('gemini')
                );
                console.log('Available Gemini Models:', geminiModels.map(m => m.name));
                sendResponse({ models: geminiModels.map(m => m.name) });
            } catch (error) {
                console.error('Failed to list models:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
});

// Function to send updates to Popup and save to storage
async function logAction(text, level = 'INFO') {
    logger[level.toLowerCase()](text);
    // Send to open popup
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: text }).catch(() => { });
}

// Handle messages from Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PAGE_LOADED') {
        // Check state and execute next step
        logAction(`Page loaded: ${message.url}`);
        executeNextStep(sender.tab.id);
    }
});

export async function handleUserQuery(text) {
    try {
    // Clear previous logs on new request
        await logger.clearLogs();

    // 1. Get API Key
    const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
    if (!geminiApiKey) {
            const error = new Error('No API Key found. Please configure your Gemini API key in settings.');
            await ErrorHandler.handle(error, { context: 'API_KEY_MISSING' });
            logAction('Error: No API Key found. Please configure in settings.', 'error');
        return;
    }

        logAction('Analyzing your request...', 'info');

        // 2. Parse Intent - try LLM first, fallback to simple parser
        // Set logAction for gemini.js to send model attempts to chat
        setLogAction(logAction);
        
        let intent;
        try {
            // Try LLM with model fallback (no retry wrapper - generateContent handles model fallback)
            intent = await parseIntent(geminiApiKey, text);
        } catch (error) {
            // If LLM fails completely, use simple parser
            logger.warn('LLM parsing failed, using simple parser', { error: error.message });
            logAction('LLM unavailable, using simple parser', 'warn');
            intent = parseIntentSimple(text);
        }

        logger.info('Parsed Intent', { 
            product: intent.product, 
            platform: intent.platform,
            filters: intent.filters,
            sort: intent.sort
        });

        if (!intent || !intent.product) {
            throw new IntentParseError('Could not understand the product to buy. Please rephrase your request.', text);
        }

        currentState.data = { ...intent, originalQuery: text };
        currentState.status = 'SEARCHING';
        currentState.filtersApplied = false;

        // Log filters if present
        if (intent.filters && Object.keys(intent.filters).length > 0) {
            logAction(`Searching for "${intent.product}" with filters: ${JSON.stringify(intent.filters)}...`, 'info');
        } else {
            logAction(`Searching for "${intent.product}"...`, 'info');
        }

        // 3. Start Automation
        await startAutomation();

    } catch (error) {
        // Safely extract error message to avoid DOM reference issues
        let safeErrorMessage = 'Unknown error';
        try {
            if (error && typeof error === 'object') {
                safeErrorMessage = String(error.message || 'Unknown error');
            } else if (error) {
                safeErrorMessage = String(error);
            }
        } catch (e) {
            safeErrorMessage = 'Error occurred (details unavailable)';
        }
        
        logger.error('Error in handleUserQuery', null, { 
            errorMessage: safeErrorMessage,
            errorName: error?.name || 'Error',
            userQuery: text 
        });
        
        try {
            const result = await ErrorHandler.handle(error, { context: 'HANDLE_USER_QUERY', userQuery: text });
            const errorMessage = result?.message || safeErrorMessage;
            logAction(errorMessage, 'error');
        } catch (handlerError) {
            // If error handler itself fails, just log the safe message
            logAction(safeErrorMessage, 'error');
        }
        
        // Only log to console if it's safe (console.log doesn't serialize objects the same way)
        try {
            console.error('RetailAgent Error:', safeErrorMessage);
        } catch (e) {
            // Ignore console errors
        }
    }
}

/**
 * Simple string parser as fallback when LLM is unavailable
 */
export function parseIntentSimple(text) {
    const lowerText = text.toLowerCase();
    
    // Extract platform
    let platform = null;
    if (lowerText.includes('amazon')) {
        platform = 'amazon';
    } else if (lowerText.includes('flipkart')) {
        platform = 'flipkart';
    } else if (lowerText.includes('ebay')) {
        platform = 'ebay';
    } else if (lowerText.includes('walmart')) {
        platform = 'walmart';
    }
    
    // Remove platform keywords and common shopping words
    let product = text
        .replace(/\b(amazon|flipkart|ebay|walmart|from|on|buy|purchase|get|find|search for|show me|i want|i need)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Default to amazon if no platform specified
    if (!platform) {
        platform = 'amazon';
    }
    
    // Try to extract basic filters
    const filters = {};
    
    // Price range - max price
    const priceMatch = text.match(/(?:under|below|less than|max|maximum|upto|up to|within)\s*(?:rs\.?|₹|rupees?|inr)?\s*(\d+(?:,\d+)*(?:k|thousand)?)/i);
    if (priceMatch) {
        let maxPrice = priceMatch[1].replace(/,/g, '').replace(/k/gi, '');
        if (text.toLowerCase().includes('k') || text.toLowerCase().includes('thousand')) {
            maxPrice = parseFloat(maxPrice) * 1000;
        } else {
            maxPrice = parseFloat(maxPrice);
        }
        filters.price_max = maxPrice;
    }
    
    // Price range - min price
    const minPriceMatch = text.match(/(?:above|over|more than|min|minimum|from|greater than|at least)\s*(?:rs\.?|₹|rupees?|inr)?\s*(\d+(?:,\d+)*(?:k|thousand)?)/i);
    if (minPriceMatch) {
        let minPrice = minPriceMatch[1].replace(/,/g, '').replace(/k/gi, '');
        if (text.toLowerCase().includes('k') || text.toLowerCase().includes('thousand')) {
            minPrice = parseFloat(minPrice) * 1000;
        } else {
            minPrice = parseFloat(minPrice);
        }
        filters.price_min = minPrice;
    }
    
    // Rating
    const ratingMatch = text.match(/(?:rating|rated|stars?)\s*(?:above|over|more than|at least|minimum|greater than)?\s*(\d+(?:\.\d+)?)/i);
    if (ratingMatch) {
        filters.rating = parseFloat(ratingMatch[1]);
    }
    
    // Storage capacity
    const storageMatch = text.match(/(\d+)\s*(?:gb|gigabytes?|tb|terabytes?)\s*(?:storage|memory|space)/i);
    if (storageMatch) {
        filters.storage = storageMatch[0].toLowerCase().replace(/\s+/g, '');
    }
    
    // RAM
    const ramMatch = text.match(/(?:greater than|more than|at least|minimum)?\s*(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory)/i);
    if (ramMatch) {
        filters.ram = `${ramMatch[1]}gb`;
    }
    
    // Battery capacity
    const batteryMatch = text.match(/(?:greater than|more than|at least|minimum)?\s*(\d+)\s*(?:mah|mAh|battery)/i);
    if (batteryMatch) {
        filters.battery = parseInt(batteryMatch[1]);
    }
    
    // Brand
    const brandMatch = text.match(/\b(motorola|samsung|apple|iphone|xiaomi|redmi|oneplus|oppo|vivo|realme|nokia|lg|sony)\b/i);
    if (brandMatch) {
        filters.brand = brandMatch[1].toLowerCase();
    }
    
    logger.info('Simple parser extracted filters', { filters, product, platform });
    
    return {
        product: product || 'product',
        platform: platform,
        filters: filters,
        sort: null,
        delivery_location: null,
        payment_method: null,
        quantity: 1
    };
}

export async function parseIntent(apiKey, text) {
    // Note: setLogAction is now statically imported at the top of the file
    // It should be called before this function is invoked
    
    try {
    const systemPrompt = `
    You are a shopping assistant. Extract the following from the user's request.
    Return JSON ONLY. No markdown.
    Fields:
    - product: (string) The search query for the product (remove platform names like "amazon", "flipkart").
    - platform: (string, optional) Preferred ecommerce platform: "amazon", "flipkart", "ebay", "walmart", or null.
    - filters: (object) Key-value pairs for potential filters:
      * price_min: (number) Minimum price in local currency
      * price_max: (number) Maximum price in local currency
      * brand: (string) Brand name (e.g., "motorola", "samsung")
      * storage: (string) Storage capacity (e.g., "128gb", "256gb")
      * ram: (string) RAM capacity (e.g., "6gb", "8gb")
      * battery: (number) Battery capacity in mAh
      * rating: (number) Minimum rating (1-5)
      * category: (string) Product category
      * color: (string) Product color
      * condition: (string) Product condition (new, used, refurbished)
    - sortStrategy: (string, optional) User's priority: "cheapest", "best_rated", "relevant", "newest"
    - urgency: (string, optional) "delivered_today", "within_week", "none"
    - injectedKeywords: (array of strings) Technical terms or specific attributes from the prompt to add to the search bar for better precision (e.g., "M3 chip", "16GB RAM", "OLED").
    - delivery_location: (string) e.g., "home", "office".
    - payment_method: (string) e.g., "wallet", "card", "upi".
    - quantity: (number, optional) Quantity to purchase.
    
    User Request: "${text}"
    `;

    const response = await generateContent(apiKey, text, systemPrompt);
        
        if (!response || !response.candidates || !response.candidates[0]) {
            throw new IntentParseError('Invalid response from AI service', text);
        }

        const textResp = response.candidates[0].content.parts[0].text;
        // Strip markdown code blocks if present
        const cleanJson = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            const parsed = JSON.parse(cleanJson);
            // Ensure product field exists
            if (!parsed.product) {
                parsed.product = text;
            }
            // Ensure filters object exists
            if (!parsed.filters) {
                parsed.filters = {};
            }
            logger.info('LLM extracted intent', { product: parsed.product, platform: parsed.platform, filters: parsed.filters });
            return parsed;
        } catch (parseError) {
            throw new IntentParseError(`Failed to parse AI response: ${parseError.message}`, text, {
                rawResponse: textResp
            });
        }
    } catch (error) {
        // If LLM fails, fall back to simple parsing
        if (error.message && (error.message.includes('429') || error.message.includes('403') || error.message.includes('quota') || error.message.includes('All Gemini models failed'))) {
            logger.warn('LLM API unavailable, using simple parser', { error: error.message });
            return parseIntentSimple(text);
        }
        
        if (error instanceof IntentParseError) {
            // Even IntentParseError should fallback to simple parser
            logger.warn('LLM parsing failed, using simple parser', { error: error.message });
            return parseIntentSimple(text);
        }
        
        // For other errors, try simple parser as fallback
        logger.warn('LLM parsing failed, using simple parser', { error: error.message });
        return parseIntentSimple(text);
    }
}

export async function startAutomation() {
    try {
        // Determine platform
        const platformName = currentState.data.platform || 
                            (await configManager.get('preferredPlatform')) || 
                            'amazon';
        
        logger.info('Starting automation', { platformName, intent: currentState.data });
        
        let platform;
        try {
            platform = platformRegistry.get(platformName);
            logger.info('Platform found', { platform: platform.name });
        } catch (error) {
            logger.warn(`Platform ${platformName} not found, defaulting to amazon`, error);
            platform = platformRegistry.get('amazon');
        }

        if (!platform || !platform.config || !platform.config.domains || platform.config.domains.length === 0) {
            throw new Error(`Platform ${platformName} configuration is invalid`);
        }

        // Get platform URL - use amazon.in as default for Amazon
        let platformUrl;
        if (platform.name === 'amazon') {
            platformUrl = 'https://www.amazon.in/';
        } else {
            platformUrl = `https://www.${platform.config.domains[0]}/`;
        }
        
        logger.info('Creating tab', { url: platformUrl, platform: platform.name });
        logAction(`Opening ${platform.name} in a new tab...`, 'info');
        
        const tab = await chrome.tabs.create({ url: platformUrl });
    currentState.tabId = tab.id;
        currentState.platform = platform;
        
        logger.info('Tab created successfully', { tabId: tab.id, url: platformUrl });
    } catch (error) {
        logger.error('Error in startAutomation', error, { 
            platformName: currentState.data.platform,
            registeredPlatforms: Array.from(platformRegistry.getAll().map(p => p.name))
        });
        throw error;
    }
}

// Helper function for fallback search (platform-specific DOM manipulation)
async function executeSearchFallback(tabId) {
    const platform = currentState.platform;
    const platformName = platform ? platform.name : 'amazon';
    
    // Get refined query
    const refinedQuery = refineSearchQuery(currentState.data);
    logger.info('Executing fallback search with refined query', { refinedQuery });

    // Try platform-specific selectors
    if (platformName === 'amazon') {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (product) => {
                const input = document.getElementById('twotabsearchtextbox');
                const form = document.querySelector('form.nav-searchbar');
                if (input && form) {
                    input.value = product;
                    const submitBtn = document.querySelector('input[type="submit"]') || 
                                    document.querySelector('#nav-search-submit-button');
                    if (submitBtn) {
                        submitBtn.click();
                    } else {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            },
            args: [refinedQuery]
        });
    } else if (platformName === 'flipkart') {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (product) => {
                const input = document.querySelector('input[name="q"]') || 
                             document.querySelector('input[placeholder*="Search"]');
                const button = document.querySelector('button[type="submit"]') || 
                              document.querySelector('.L0Z3Pu');
                if (input) {
                    input.value = product;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    if (button) {
                        button.click();
                    } else {
                        input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            },
            args: [refinedQuery]
        });
    } else {
        // Generic search - try common patterns
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (product) => {
                const inputs = document.querySelectorAll('input[type="search"], input[name*="search"], input[name*="q"], input[placeholder*="Search" i]');
                for (const input of inputs) {
                    if (input.offsetParent !== null) { // Check if visible
                        input.value = product;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        const form = input.closest('form');
                        if (form) {
                            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                            if (submitBtn) {
                                submitBtn.click();
                                break;
                            } else {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                                break;
                            }
                        }
                    }
                }
            },
            args: [refinedQuery]
        });
    }
    
    currentState.status = 'SELECTING';
    // Wait for search to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
}

/**
 * Refine search query with injected keywords and high-importance filters
 * as requested by the user: "search the whole string along with the filter key values appended"
 */
function refineSearchQuery(data) {
    // 1. Start with the whole original string as requested by the user
    // This provides the most context to the platform's search engine
    let refinedQuery = data.originalQuery || data.product || '';
    
    // Remove common stop words at the beginning that might confuse search
    refinedQuery = refinedQuery.replace(/^(buy|find|search for|look for|get|i want to buy|show me|i need)\s+/i, '');

    // Transform "greater than" / "less than" / "more than" into search-friendly terms
    // Handle cases like "greater than 5000", "more than 6gb", "above 4.5 rating"
    refinedQuery = refinedQuery.replace(/\b(greater than|more than|above|over)\s+(\d+(?:\.\d+)?)(?:\s*(gb|mah|rs|stars?|ratings?))?\b/gi, (match, p1, p2, p3) => {
        return p3 ? `${p2}${p3.toUpperCase()}+` : `${p2}+`;
    });
    refinedQuery = refinedQuery.replace(/\b(less than|under|below)\s+(\d+(?:\.\d+)?)(?:\s*(gb|mah|rs|stars?|ratings?))?\b/gi, (match, p1, p2, p3) => {
        return p3 ? `under ${p2}${p3.toUpperCase()}` : `under ${p2}`;
    });
    
    // Replace "within" for price
    refinedQuery = refinedQuery.replace(/\bwithin\s+(\d+)\b/gi, 'under $1');
    
    // Normalize units
    refinedQuery = refinedQuery.replace(/\b(\d+)\s*gb\b/gi, '$1GB');
    refinedQuery = refinedQuery.replace(/\b(\d+)\s*mah\b/gi, '$1mAh');

    // 2. Add high-importance filters to search query if not already present
    // This follows the user request to have filter key values appended
    const filters = data.filters || {};
    const filterValues = [];
    
    if (filters.brand) filterValues.push(filters.brand);
    if (filters.ram) filterValues.push(`${filters.ram.toString().toUpperCase().replace(/\s/g, '')}`);
    if (filters.storage) filterValues.push(`${filters.storage.toString().toUpperCase().replace(/\s/g, '')}`);
    if (filters.battery) filterValues.push(`${filters.battery}mAh`);
    if (filters.price_max) filterValues.push(`under ${filters.price_max}`);
    
    // Add injected keywords from LLM
    if (data.injectedKeywords && Array.isArray(data.injectedKeywords)) {
        data.injectedKeywords.forEach(keyword => {
            if (keyword) {
                const kwLower = keyword.toLowerCase();
                if (!filterValues.some(v => v.toLowerCase() === kwLower)) {
                    filterValues.push(keyword);
                }
            }
        });
    }

    // Append filter values ONLY if they aren't already mentioned in the query
    // Use a smarter check for numbers (e.g., "20000" matches "20,000" or "20000rs")
    const lowerQuery = refinedQuery.toLowerCase();
    filterValues.forEach(val => {
        const valStr = val.toString().toLowerCase();
        
        // If it's a number (like price or battery), check for the number itself
        if (/^\d+$/.test(valStr)) {
            if (new RegExp(`\\b${valStr}\\b`).test(lowerQuery)) return;
        }

        // Check if value is already in query (handle "6GB" matching "6 gb ram")
        // Remove units for comparison
        const valClean = valStr.replace(/\s+/g, '').replace(/gb|mah|rs|under|above|over/g, '');
        if (valClean.length === 0) return; 

        const queryClean = lowerQuery.replace(/\s+/g, '');
        
        if (!queryClean.includes(valClean)) {
            refinedQuery += ` ${val}`;
        }
    });
    
    // Add platform name if missing
    if (data.platform && !lowerQuery.includes(data.platform.name)) {
        refinedQuery = `${data.platform.name} ${refinedQuery}`;
    }
    
    // Final check: Remove redundant units that might have been added
    refinedQuery = refinedQuery.replace(/\b(\d+)\s*(GB|MAH)\s+(\d+)\s*(?:GB|MAH)\b/gi, (match, p1, p2) => `${p1}${p2}`);
    
    // Final deduplication of words (case-insensitive)
    const words = refinedQuery.split(/\s+/);
    const uniqueWords = [];
    const seenWords = new Set();
    for (const word of words) {
        const lower = word.toLowerCase();
        if (!seenWords.has(lower)) {
            seenWords.add(lower);
            uniqueWords.push(word);
        }
    }
    refinedQuery = uniqueWords.join(' ');

    return refinedQuery.trim();
}

/**
 * Perform LLM-based page analysis and execute recommended action
 */
async function performLLMPageAnalysis(tabId, mode = ANALYSIS_MODES.GENERAL) {
    try {
        logAction('Analyzing page content with AI...', 'info');
        
        // 1. Get simplified page content
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout extracting page content')), 15000);
            chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_PAGE_CONTENT' }, (resp) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(resp);
            });
        });

        if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to extract page content');
        }

        // 2. Call LLM to analyze
        const apiKey = await configManager.get('apiKey');
        const context = {
            intent: currentState.data.originalQuery || currentState.data.product,
            status: currentState.status,
            platform: currentState.platform?.name || 'unknown'
        };

        const recommendation = await analyzePage(apiKey, response.content, context, mode);
        
        // Handle different action types based on mode
        if (mode === ANALYSIS_MODES.ANALYZE_SEARCH_RESULTS && recommendation.action === 'extract_products') {
            logAction(`AI extracted ${recommendation.products?.length || 0} products`, 'info');
            // Process extracted products
            if (recommendation.products && recommendation.products.length > 0) {
                // Validate and use extracted products
                const validProducts = recommendation.products.filter(p => {
                    const hasTitle = p.title && p.title.trim().length > 0;
                    const hasLink = p.link && p.link.trim().length > 0;
                    return hasTitle && hasLink;
                });
                
                if (validProducts.length > 0) {
                    logger.info('Using LLM-extracted products', { 
                        count: validProducts.length,
                        sample: validProducts.slice(0, 2).map(p => ({
                            title: p.title?.substring(0, 50),
                            price: p.priceNumeric || p.price,
                            hasLink: !!p.link
                        }))
                    });
                    // Return products for further processing in calling code
                    return { success: true, products: validProducts, source: 'llm' };
                } else {
                    logger.warn('LLM extracted products but none were valid');
                    return { success: false, error: 'No valid products extracted by LLM' };
                }
            } else {
                logger.warn('LLM did not extract any products');
                return { success: false, error: 'LLM returned no products' };
            }
        }
        
        if (recommendation.reason) {
            logAction(`AI Recommendation: ${recommendation.reason}`, 'info');
        }

        // 3. Execute recommendation
        if (recommendation.action === 'select_product') {
            logAction(`AI selected product: ${recommendation.title}`, 'info');
            currentState.status = 'PRODUCT_PAGE';
            await chrome.tabs.update(tabId, { url: recommendation.url });
        } 
        else if (recommendation.action === 'click') {
            logAction(`AI clicking: ${recommendation.reason}`, 'info');
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (selector) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.click();
                        return true;
                    }
                    return false;
                },
                args: [recommendation.selector]
            });
        }
        else if (recommendation.action === 'input') {
            logAction(`AI entering text: ${recommendation.reason}`, 'info');
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (selector, value) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.value = value;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                },
                args: [recommendation.selector, recommendation.value]
            });
        }
        else if (recommendation.action === 'completed') {
            logAction('Task completed successfully!', 'info');
            currentState.status = 'COMPLETED';
        }
        else if (recommendation.action === 'error') {
            throw new Error(recommendation.message);
        }

        return true;
    } catch (error) {
        logger.error('LLM Page Analysis execution failed', error);
        logAction(`AI analysis failed: ${error.message}`, 'error');
        return false;
    }
}

export async function executeNextStep(tabId) {
    if (tabId !== currentState.tabId) return;

    if (currentState.status === 'SEARCHING') {
        // Check if we're on search results page or homepage
        try {
            const tab = await chrome.tabs.get(tabId);
            const url = tab.url;
            
            // If already on search results page, skip search and go to selecting
            if (url.includes('/s?') || url.includes('/s/') || url.includes('/search?') || url.includes('/s?')) {
                logger.info('Already on search results page, skipping search');
                currentState.status = 'SELECTING';
                // Continue to SELECTING logic below
            } else {
                // We are on homepage, search for product using platform-specific method
                logAction("Executing Search...", 'info');
                
                // Refine query with context
                const searchData = { ...currentState.data };
                searchData.product = refineSearchQuery(searchData);
                logger.info('Refined search query', { original: currentState.data.product, refined: searchData.product });

                // Use platform's search method via content script
                try {
                    const searchResponsePromise = () => {
                        return new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('Timeout waiting for search response'));
                            }, 45000); // Increased from 10s to 45s for search + filter application
                            
                            chrome.tabs.sendMessage(tabId, { 
                                action: 'SEARCH', 
                                query: searchData.product,
                                filters: searchData.filters || {},
                                sort: searchData.sort || null
                            }, (response) => {
                                clearTimeout(timeout);
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else {
                                    resolve(response);
                                }
                            });
                        });
                    };
                    
                    const searchResponse = await searchResponsePromise();
                    
                    if (searchResponse && searchResponse.success) {
                        logger.info('Search executed successfully');
                        currentState.status = 'SELECTING';
                        // Page loaded event will trigger next step
                    } else {
                        logger.warn('Search response indicates failure, using fallback', { response: searchResponse });
                        // Fallback to direct DOM manipulation
                        await executeSearchFallback(tabId);
                    }
                } catch (searchError) {
                    logger.warn('Platform search method failed, using fallback', { error: searchError.message });
                    // Fallback to direct DOM manipulation
                    await executeSearchFallback(tabId);
                }
            }
        } catch (error) {
            logger.error('Error in SEARCHING step', error);
            logAction('Error executing search.', 'error');
            return;
        }
    }
    else if (currentState.status === 'SELECTING') {
        logAction('Analyzing search results...', 'info');

        // 1. Check if we need to apply filters first
        const filters = currentState.data.filters || {};
        if (Object.keys(filters).length > 0 && !currentState.filtersApplied) {
            logger.info('Applying filters in SELECTING state', { filters });
            logAction('Applying filters to search results...', 'info');
            
            try {
                // Set flag BEFORE applying to avoid infinite loop on page reloads
                currentState.filtersApplied = true;
                
                const filterResponse = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        logger.warn('Filter application response timeout in SELECTING');
                        resolve({ success: true, timeout: true });
                    }, 25000);
                    
                    chrome.tabs.sendMessage(tabId, {
                        action: 'APPLY_FILTERS',
                        filters: filters
                    }, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            logger.warn('Filter message error in SELECTING', { error: chrome.runtime.lastError.message });
                            resolve({ success: true, error: chrome.runtime.lastError.message });
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (filterResponse && (filterResponse.success || filterResponse.timeout)) {
                    logger.info('Filters applied, waiting for results...', { filters });
                    logAction('Filters applied, waiting for results...', 'info');
                    // Page might reload, wait for it
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    // No need to continue here, next PAGE_LOADED will trigger again
                    return;
                }
            } catch (filterError) {
                logger.warn('Failed to apply filters in SELECTING', { error: filterError.message });
                logAction('Proceeding without some filters...', 'warn');
            }
        }

        // 2. Get results from content script
        try {
            logger.info('Requesting search results from content script', { tabId });
            
            // Use promise wrapper for chrome.tabs.sendMessage with timeout
            const getSearchResults = () => {
                return new Promise((resolve, reject) => {
                    logger.info('Sending message to content script', { tabId });
                    
                    // Set a timeout to avoid hanging forever
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for content script response'));
                    }, 20000); // Increased from 10s to 20s
                    
                    chrome.tabs.sendMessage(tabId, { 
                        action: 'GET_SEARCH_RESULTS',
                        filters: currentState.data.filters || {}
                    }, (response) => {
                        clearTimeout(timeout);
                        
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message;
                            logger.error('Chrome runtime error in sendMessage', null, { errorMessage: errorMsg });
                            reject(new Error(errorMsg));
                        } else if (response === undefined || response === null) {
                            logger.warn('No response from content script', {});
                            reject(new Error('No response from content script'));
                        } else {
                            logger.info('Received response from content script', { 
                                hasItems: 'items' in response,
                                itemCount: response.items ? response.items.length : 0,
                                success: response.success
                            });
                            resolve(response);
                        }
                    });
                });
            };
            
            // Wait a bit for content script to be fully loaded
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let response;
            try {
                logger.info('Attempting to get search results (first try)...');
                response = await getSearchResults();
                logger.info('Got response on first try', { 
                    hasResponse: !!response,
                    hasItems: response && 'items' in response,
                    itemCount: response && response.items ? response.items.length : 0
                });
            } catch (sendError) {
                const errorMsg = sendError && sendError.message ? String(sendError.message) : 'Unknown error';
                logger.warn('First attempt failed, retrying...', { error: errorMsg });
                logAction('Content script not ready. Waiting...', 'warn');
                
                // Wait longer and try again
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                    logger.info('Attempting to get search results (retry)...');
                    response = await getSearchResults();
                    logger.info('Got response on retry', { 
                        hasResponse: !!response,
                        hasItems: response && 'items' in response,
                        itemCount: response && response.items ? response.items.length : 0
                    });
                } catch (retryError) {
                    const retryErrorMsg = retryError && retryError.message ? String(retryError.message) : 'Unknown error';
                    logger.error('Failed after retry', null, { 
                        errorMessage: retryErrorMsg,
                        lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No lastError'
                    });
                    logAction('Could not retrieve search results.', 'error');
                    return;
                }
            }
            
            // Safely check response without accessing properties that might trigger getters
            if (!response) {
                logAction('No response from content script.', 'error');
                logger.error('Empty response from content script', null, {});
                return;
            }

            // Safely extract items - use JSON to ensure clean serialization
            // Safely process items
            let items = [];
            try {
                if (response && response.items && Array.isArray(response.items)) {
                    items = response.items;
                } else if (response && Array.isArray(response)) {
                    items = response;
                } else if (response && response.success && response.items) {
                    items = response.items;
                }
                
                logger.info('Extracted search results from content script', { 
                    count: items.length,
                    hasResponse: !!response,
                    responseKeys: response ? Object.keys(response) : []
                });
                logAction(`Found ${items.length} items on page.`, 'info');
            } catch (extractError) {
                logger.error('Error extracting items from response', extractError);
                logAction('Error processing search results.', 'error');
                return;
            }

            // Validate products before processing with scoring system
            const validatedItems = [];
            const invalidItems = [];
            
            for (const item of items) {
                const hasTitle = item && item.title && typeof item.title === 'string' && item.title.trim().length > 0;
                const hasLink = item && item.link && typeof item.link === 'string' && item.link.trim().length > 0;
                
                // Required fields: title and link
                if (hasTitle && hasLink) {
                    // Relaxed URL validation - accept relative URLs and various formats
                        const url = item.link.trim();
                    const isValidUrl = url.startsWith('http://') || 
                                      url.startsWith('https://') || 
                                      url.startsWith('/') ||
                                      url.includes('/dp/') ||  // Amazon product
                                      url.includes('/p/') ||    // Flipkart product
                                      url.includes('/gp/') ||   // Amazon general product
                                      url.includes('product');  // Generic product URL
                    
                    if (isValidUrl) {
                        // Calculate product quality score (for ranking/prioritization)
                        let qualityScore = 0;
                        
                        // Title quality (longer, more descriptive titles score higher)
                        if (item.title.length > 30) qualityScore += 2;
                        else if (item.title.length > 15) qualityScore += 1;
                        
                        // Has price
                        if (item.price && item.price.trim().length > 0) qualityScore += 3;
                        
                        // Has rating
                        if (item.rating && item.rating.trim().length > 0) qualityScore += 2;
                        
                        // Has image
                        if (item.image && item.image.trim().length > 0) qualityScore += 1;
                        
                        // Has reviews count
                        if (item.reviews && item.reviews.trim().length > 0) qualityScore += 1;
                        
                        // Link quality (absolute URLs preferred)
                        if (url.startsWith('http')) qualityScore += 2;
                        else if (url.startsWith('/')) qualityScore += 1;
                        
                        // Attach score to item
                        item._qualityScore = qualityScore;
                        
                            validatedItems.push(item);
                        } else {
                        invalidItems.push({ 
                            reason: 'Invalid URL format', 
                            item: { 
                                title: item.title?.substring(0, 50), 
                                link: item.link?.substring(0, 80),
                                score: 0
                            } 
                        });
                        logger.debug('Product invalid: bad URL format', {
                            title: item.title?.substring(0, 50),
                            link: url?.substring(0, 80)
                        });
                    }
                } else {
                    // Missing required fields
                    const reason = !hasTitle ? 'Missing title' : 'Missing link';
                    invalidItems.push({ 
                        reason: reason, 
                        item: { 
                            hasTitle, 
                            hasLink,
                            title: item?.title?.substring(0, 50),
                            link: item?.link?.substring(0, 80),
                            score: 0
                        } 
                    });
                    logger.debug('Product invalid: missing required field', {
                        reason,
                        title: item?.title?.substring(0, 50),
                        hasLink
                    });
                }
            }
            
            // Sort validated items by quality score (higher scores first)
            validatedItems.sort((a, b) => (b._qualityScore || 0) - (a._qualityScore || 0));
            
            logger.info('Product validation completed', {
                originalCount: items.length,
                validatedCount: validatedItems.length,
                invalidCount: invalidItems.length,
                invalidSamples: invalidItems.slice(0, 3)
            });

            if (validatedItems.length > 0) {
                try {
                    const filters = currentState.data.filters || {};
                    const intent = {
                        sortStrategy: currentState.data.sortStrategy,
                        urgency: currentState.data.urgency
                    };

                    logger.info('Starting product matching and ranking', { 
                        totalProducts: validatedItems.length,
                        filters: Object.keys(filters),
                        filterValues: filters,
                        intent
                    });
                    
                    // 1. Programmatic Ranking based on intent (cheapest, etc.)
                    const rankedItems = rankResults(validatedItems, intent);
                    logger.info('Products ranked', { rankedCount: rankedItems.length });
                    
                    // 2. Second-level matching: Try each product until we find one that matches filters
                    let bestItem = null;
                    let itemIndex = 0;
                    const checkedItems = [];
                    
                    // Filter out duplicate link entries that some platforms produce
                    const uniqueItems = [];
                    const seenLinks = new Set();
                    for (const item of rankedItems) {
                        if (item.link && !seenLinks.has(item.link)) {
                            seenLinks.add(item.link);
                            uniqueItems.push(item);
                        }
                    }

                    while (itemIndex < uniqueItems.length && !bestItem) {
                        const item = uniqueItems[itemIndex];
                        
                        // Skip if no link
                        if (!item.link || item.link === '') {
                            itemIndex++;
                            continue;
                        }
                        
                        // Check if product matches filters using robust product-matcher
                        const matches = matchesFilters(item, filters);
                        const unavailable = isUnavailable(item);
                        
                        checkedItems.push({
                            title: item.title?.substring(0, 40),
                            matches,
                            unavailable
                        });
                        
                        if (matches && !unavailable) {
                            bestItem = item;
                            logger.info('Found matching product', {
                                title: item.title?.substring(0, 60),
                                price: item.price,
                                index: itemIndex,
                                matchedFilters: Object.keys(filters)
                            });
                            logAction(`Found matching product: ${item.title?.substring(0, 50)}`, 'info');
                            break;
                        }
                        
                        itemIndex++;
                    }
                    
                    // 3. Relaxed Matching Fallback: If no strict match, try with just Brand and Category
                    if (!bestItem && uniqueItems.length > 0 && Object.keys(filters).length > 1) {
                        logger.info('No strict match found, attempting relaxed matching');
                        logAction('No perfect match found. Looking for closest match...', 'info');
                        
                        const relaxedFilters = {};
                        if (filters.brand) relaxedFilters.brand = filters.brand;
                        if (filters.category) relaxedFilters.category = filters.category;
                        
                        for (const item of uniqueItems) {
                            if (item.link && matchesFilters(item, relaxedFilters) && !isUnavailable(item)) {
                                bestItem = item;
                                logger.info('Found relaxed match', {
                                    title: item.title?.substring(0, 60),
                                    relaxedFilters: Object.keys(relaxedFilters)
                                });
                                logAction(`Found likely match (relaxed criteria): ${item.title?.substring(0, 50)}`, 'info');
                                break;
                            }
                        }
                    }
                    
                    if (!bestItem) {
                        logger.warn('No products matched filters after strict and relaxed check', {
                            totalProducts: validatedItems.length,
                            originalCount: items.length,
                            validatedCount: validatedItems.length,
                            filters: Object.keys(filters),
                            filterValues: filters,
                            checkedItemsSamples: checkedItems.slice(0, 5),
                            rankedItemsCount: rankedItems.length,
                            uniqueItemsCount: uniqueItems.length
                        });
                        
                        // FALLBACK: Use LLM to analyze the page and extract products
                        logAction('Rule-based matching failed. Asking AI to analyze the page...', 'info');
                        const aiResult = await performLLMPageAnalysis(tabId, ANALYSIS_MODES.ANALYZE_SEARCH_RESULTS);
                        
                        if (aiResult && aiResult.success && aiResult.products && aiResult.products.length > 0) {
                            logger.info('LLM extracted products successfully', { count: aiResult.products.length });
                            logAction(`AI found ${aiResult.products.length} products. Selecting best match...`, 'info');
                            
                            // Process LLM-extracted products
                            const llmProducts = aiResult.products;
                            
                            // Normalize and validate LLM-extracted product links
                            for (const product of llmProducts) {
                                // Ensure absolute URLs
                                if (product.link && !product.link.startsWith('http')) {
                                    const origin = currentState.platform?.name === 'flipkart' 
                                        ? 'https://www.flipkart.com' 
                                        : 'https://www.amazon.in';
                                    try {
                                        product.link = new URL(product.link, origin).href;
                                    } catch (e) {
                                        logger.warn('Failed to normalize LLM product link', { link: product.link });
                                    }
                                }
                            }
                            
                            // Filter LLM products by user filters
                            const llmFilteredProducts = llmProducts.filter(product => {
                                const matches = matchesFilters(product, filters);
                                const unavailable = isUnavailable(product);
                                return matches && !unavailable;
                            });
                            
                            logger.info('LLM products after filtering', { 
                                total: llmProducts.length,
                                filtered: llmFilteredProducts.length,
                                filters: Object.keys(filters)
                            });
                            
                            // Select best product from LLM results
                            let selectedProduct = null;
                            if (llmFilteredProducts.length > 0) {
                                // Use first filtered product (LLM should have ranked them)
                                selectedProduct = llmFilteredProducts[0];
                            } else if (llmProducts.length > 0) {
                                // Fallback: use first LLM product even if doesn't match filters
                                selectedProduct = llmProducts[0];
                                logger.info('Using LLM product without strict filter match');
                            }
                            
                            if (selectedProduct && selectedProduct.link) {
                                const productTitle = String(selectedProduct.title || '');
                                const productPrice = String(selectedProduct.price || '');
                                const productLink = String(selectedProduct.link || '');
                                
                                logAction(`AI selected: ${productTitle}`, 'info');
                                if (productPrice) logAction(`Price: ${productPrice}`, 'info');
                                logAction(`Navigating to product page...`, 'info');
                                
                                currentState.status = 'PRODUCT_PAGE';
                                
                                // Navigate using the same retry logic
                                // (Navigation logic continues below...)
                                try {
                                    await chrome.tabs.update(tabId, { url: productLink });
                                    logger.info('LLM product navigation initiated', { url: productLink });
                                } catch (navError) {
                                    logger.error('Failed to navigate to LLM product', navError);
                                    logAction('Failed to open product page', 'error');
                                }
                                return;
                            }
                        }
                        
                        // Provide detailed summary of why no products were found
                        let errorSummary = 'No suitable products found. ';
                        
                        if (items.length === 0) {
                            errorSummary += 'No items extracted from page. ';
                        } else if (validatedItems.length === 0) {
                            errorSummary += `${items.length} items found but all were invalid. `;
                        } else if (matched.length === 0) {
                            errorSummary += `${validatedItems.length} valid items found but none matched your filters. `;
                            
                            // List active filters
                            const activeFilters = Object.entries(filters)
                                .filter(([k, v]) => v)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ');
                            
                            if (activeFilters) {
                                errorSummary += `Active filters: ${activeFilters}. `;
                            }
                        }
                        
                        errorSummary += 'Try adjusting your search criteria or filters.';
                        
                        logger.warn('Product selection failed - detailed summary', {
                            totalItems: items.length,
                            validItems: validatedItems.length,
                            matchedItems: matched.length,
                            filters: filters
                        });
                        
                        logAction(errorSummary, 'warn');
                        return;
                    }
                    
                    // Safely extract product data
                    const productTitle = String(bestItem.title || '');
                    const productPrice = String(bestItem.price || '');
                    const productLink = String(bestItem.link || '');
                    
                    // Safely log best item
                    const safeBestItem = {
                        title: productTitle,
                        price: productPrice,
                        link: productLink,
                        hasLink: !!productLink && productLink.length > 0,
                        matchedFilters: Object.keys(filters).length > 0
                    };
                    logger.info('Best item selected', safeBestItem);
                    
                    if (!productLink || productLink === '') {
                        logAction('Product link not found in search results.', 'error');
                        logger.error('Invalid product item - no link', null, { item: safeBestItem });
                        return;
                    }

                    logAction(`Found likely match: ${productTitle}`, 'info');
                    logAction(`Price: ${productPrice}`, 'info');
                    if (Object.keys(filters).length > 0) {
                        logAction(`Matches your filters`, 'info');
                    }
                    logAction(`Navigating to product page...`, 'info');

                currentState.status = 'PRODUCT_PAGE';

                    // Store selected product info for potential retry
                    currentState.selectedProduct = {
                        title: bestItem.title,
                        price: bestItem.price,
                        link: productLink
                    };

                    // Navigate to product page with retry logic
                    logger.info('Navigating to product', { url: productLink, tabId });
                    
                    let navigationSucceeded = false;
                    const maxRetries = 3;
                    
                    for (let attempt = 1; attempt <= maxRetries && !navigationSucceeded; attempt++) {
                        try {
                            // Verify tab still exists and is valid
                            let tab;
                            try {
                                tab = await chrome.tabs.get(tabId);
                                if (!tab || !tab.id) {
                                    throw new Error('Tab not found or invalid');
                                }
                            } catch (tabError) {
                                logger.error('Tab validation failed', { attempt, tabId, error: tabError.message });
                                throw new Error(`Tab ${tabId} no longer exists`);
                            }
                            
                            // Attempt navigation using tabs.update
                            logger.info('Navigation attempt via tabs.update', { attempt, url: productLink, tabId });
                            await chrome.tabs.update(tabId, { url: productLink });
                            
                            // Wait a moment to verify navigation initiated
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Verify navigation succeeded by checking tab URL
                            try {
                                const updatedTab = await chrome.tabs.get(tabId);
                                if (updatedTab && (updatedTab.url === productLink || updatedTab.pendingUrl === productLink)) {
                                    navigationSucceeded = true;
                                    logger.info('Navigation verified successfully', { attempt, url: productLink });
                            logAction(`Opening product page...`, 'info');
                        } else {
                                    logger.warn('Navigation not verified, URL mismatch', { 
                                        attempt,
                                        expected: productLink,
                                        actual: updatedTab?.url,
                                        pending: updatedTab?.pendingUrl
                                    });
                                    // Don't throw here, try fallback on last attempt
                                    if (attempt === maxRetries) {
                                        throw new Error('Navigation URL mismatch');
                                    }
                                }
                            } catch (verifyError) {
                                logger.warn('Could not verify navigation', { attempt, error: verifyError.message });
                                // Assume success if we can't verify (tab might be loading)
                                navigationSucceeded = true;
                            }
                            
                    } catch (navError) {
                            const errorMsg = String(navError.message || 'Unknown error');
                            logger.error('Navigation attempt failed', { 
                                attempt,
                                maxRetries,
                                errorMessage: errorMsg,
                                url: productLink,
                                tabId
                            });
                            
                            // On last attempt, try fallback methods
                            if (attempt === maxRetries) {
                                logger.info('Trying content script fallback navigation');
                                logAction('Trying alternative navigation method...', 'info');
                                
                                try {
                                    // Fallback 1: Use content script to navigate
                            await chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                        func: (link) => { 
                                            window.location.href = link;
                                            return true;
                                        },
                                args: [productLink]
                            });
                                    logger.info('Content script navigation initiated');
                                    navigationSucceeded = true;
                                    
                                    // Wait for navigation to start
                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                    
                                } catch (fallbackError1) {
                                    logger.error('Content script navigation failed', fallbackError1);
                                    
                                    try {
                                        // Fallback 2: Try direct tab navigation with different parameters
                                        await chrome.tabs.update(tabId, { 
                                            url: productLink,
                                            active: true
                                        });
                                        logger.info('Fallback direct navigation attempted');
                                        navigationSucceeded = true;
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                        
                                    } catch (fallbackError2) {
                                        logger.error('All navigation methods failed', { 
                                            originalError: errorMsg,
                                            fallbackError1: fallbackError1.message,
                                            fallbackError2: fallbackError2.message
                                        });
                                        logAction(`Failed to navigate after ${maxRetries} attempts`, 'error');
                                    }
                                }
                            } else {
                                // Wait before retry
                                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                            }
                        }
                    }
                    
                    if (!navigationSucceeded) {
                        logAction('Navigation failed. Please try manually opening the product.', 'error');
                    }
                } catch (itemError) {
                    const errorMsg = itemError?.message || String(itemError) || 'Unknown error';
                    logger.error('Error processing best item', null, { 
                        errorMessage: errorMsg,
                        errorStack: itemError?.stack?.substring(0, 200),
                        errorName: itemError?.name
                    });
                    logAction(`Error processing product item: ${errorMsg}`, 'error');
                }
            } else {
                logger.warn('No validated products found', {
                    originalCount: items.length,
                    validatedCount: validatedItems.length,
                    invalidCount: invalidItems.length
                });
                logAction('No products found by rules. Asking AI to analyze page...', 'info');
                const aiSucceeded = await performLLMPageAnalysis(tabId);
                if (!aiSucceeded) {
                    logAction('No suitable products found.', 'warn');
                    logger.warn('No products in response and AI analysis failed', { 
                        itemCount: items ? items.length : 0,
                        validatedCount: validatedItems.length
                    });
                }
            }
        } catch (e) {
            // Safely extract error message without trying to serialize the error object
            const errorMessage = e && typeof e.message === 'string' ? e.message : 'Unknown error';
            const errorName = e && typeof e.name === 'string' ? e.name : 'Error';
            logger.error('Error reading search results', null, { 
                errorMessage: errorMessage,
                errorName: errorName
            });
            logAction(`Error reading search results: ${errorMessage}`, 'error');
        }
    }
    else if (currentState.status === 'PRODUCT_PAGE') {
        // Verify we're actually on a product page, not still on search results
        try {
            const tab = await chrome.tabs.get(tabId);
            const currentUrl = tab?.url || '';
            
            logger.info('Verifying product page navigation', { currentUrl, tabId });
            
            // Check if URL indicates we're still on search results
            const isSearchResultsUrl = currentUrl.includes('/s?') || 
                                       currentUrl.includes('/search?') ||
                                       currentUrl.includes('/search/') ||
                                       (currentUrl.includes('amazon.in') && !currentUrl.match(/\/(dp|gp\/product)\//)) ||
                                       (currentUrl.includes('flipkart.com') && !currentUrl.includes('/p/'));
            
            if (isSearchResultsUrl) {
                logger.warn('Still on search results page, navigation may have failed', { currentUrl });
                logAction('Navigation verification: still on search results. Retrying...', 'warn');
                
                // Retry navigation if we have the product link stored
                if (currentState.selectedProduct?.link) {
                    const productLink = currentState.selectedProduct.link;
                    logger.info('Retrying navigation to product page', { productLink });
                    
                    try {
                        // Try different navigation method
                        await chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: (link) => { 
                                window.location.href = link;
                            },
                            args: [productLink]
                        });
                        
                        // Wait for navigation to complete
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Check again
                        const retryTab = await chrome.tabs.get(tabId);
                        const retryUrl = retryTab?.url || '';
                        
                        if (retryUrl.includes('/s?') || retryUrl.includes('/search')) {
                            logger.error('Navigation retry failed, still on search results', { retryUrl });
                            logAction('Failed to navigate to product page after retry.', 'error');
                            return;
                        }
                        
                        logger.info('Navigation retry succeeded', { retryUrl });
                        
                    } catch (retryError) {
                        logger.error('Navigation retry failed', retryError);
                        logAction('Failed to retry navigation', 'error');
                        return;
                    }
                } else {
                    logger.error('No product link stored for retry');
                    logAction('Cannot retry navigation: no product link available', 'error');
                    currentState.status = 'SELECTING';
                    return;
                }
            } else {
                logger.info('Product page navigation verified', { currentUrl });
            }
            
            // Wait a moment for page to stabilize after verification
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (verifyError) {
            logger.warn('Could not verify product page navigation', { error: verifyError.message });
            // Continue anyway, might be a transient issue
        }
        
        // Check for login screen
        try {
            const platform = currentState.platform;
            if (platform) {
                const loginDetectedPromise = () => {
                    return new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            resolve({ loginScreenDetected: false });
                        }, 5000);
                        
                        chrome.tabs.sendMessage(tabId, { 
                            action: 'DETECT_LOGIN_SCREEN',
                            platform: platform.name 
                        }, (response) => {
                            clearTimeout(timeout);
                            if (chrome.runtime.lastError) {
                                resolve({ loginScreenDetected: false });
                            } else {
                                resolve(response || { loginScreenDetected: false });
                            }
                        });
                    });
                };
                
                const loginDetected = await loginDetectedPromise();
                
                if (loginDetected && loginDetected.loginScreenDetected) {
                    logAction('Login screen detected. Logging in...', 'info');
                    try {
                        await loginManager.handleLogin(platform.name, tabId);
                        logAction('Login completed. Continuing...', 'info');
                        // Wait a bit after login
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (loginError) {
                        logger.error('Login failed', loginError);
                        logAction(`Login failed: ${loginError.message}`, 'error');
                        return;
                    }
                }
            }
        } catch (loginError) {
            logger.warn('Login check failed, continuing', { error: loginError.message });
        }
        
        logAction('On Product Page. Finding "Buy Now" button...', 'info');

        // Wait longer for product page to fully load (Amazon pages can be slow)
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            logger.info('Attempting to click Buy Now', { tabId });
            
            // Use promise wrapper with timeout
            const clickBuyNowPromise = () => {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for Buy Now click response'));
                    }, 15000); // 15 second timeout
                    
                    chrome.tabs.sendMessage(tabId, { action: 'CLICK_BUY_NOW' }, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
            };
            
            const response = await clickBuyNowPromise();
            logger.info('Buy Now response', { response });
            
            if (response && response.success) {
                currentState.status = 'CHECKOUT_FLOW';
                logAction('Clicked Buy Now. Proceeding to Checkout...', 'info');
            } else {
                logAction('Could not click "Buy Now" with rules. Asking AI to analyze page...', 'info');
                const aiSucceeded = await performLLMPageAnalysis(tabId);
                if (aiSucceeded) return;

                logAction('AI could not find action. Trying Add to Cart as last resort...', 'warn');
                // Try Add to Cart as fallback
                await new Promise(resolve => setTimeout(resolve, 2000));
                const cartResponse = await chrome.tabs.sendMessage(tabId, { action: 'ADD_TO_CART' });
                if (cartResponse && cartResponse.success) {
                    logAction('Added to cart successfully. Please proceed to checkout manually.', 'info');
                } else {
                    logAction('Could not add to cart. Product might be out of stock or require login.', 'warn');
                }
            }
            } catch (e) {
            logger.error('Error clicking Buy Now', e, { 
                errorMessage: e.message,
                errorStack: e.stack 
            });
            logAction(`Error clicking Buy Now: ${e.message}. Asking AI to analyze page...`, 'error');
            
            const aiSucceeded = await performLLMPageAnalysis(tabId);
            if (aiSucceeded) return;

            // Try Add to Cart as last fallback
            try {
                logAction('Trying Add to Cart as last resort...', 'info');
                await new Promise(resolve => setTimeout(resolve, 2000));
                const cartResponse = await chrome.tabs.sendMessage(tabId, { action: 'ADD_TO_CART' });
                if (cartResponse && cartResponse.success) {
                    logAction('Added to cart successfully. Please proceed to checkout manually.', 'info');
                }
            } catch (cartError) {
                logger.error('Add to Cart also failed', cartError);
            }
        }
    }
    else if (currentState.status === 'CHECKOUT_FLOW') {
        // This is complex. We might hit a Login page, Address Selection, or straight to Payment.
        logAction('In Checkout Flow. Navigating purchase steps...');

        // Check for Order Confirmation URL
        const currentUrl = (await chrome.tabs.get(tabId)).url;
        if (currentUrl.includes('thank-you') || currentUrl.includes('order-confirmation')) {
            currentState.status = 'COMPLETED';

            const response = await chrome.tabs.sendMessage(tabId, { action: 'GET_ORDER_DETAILS' });
            logAction(`Order Placed Successfully!`);
            logAction(`Order ID: ${response.orderId}`);
            logAction(`Delivery Estimate: ${response.deliveryDate}`);
        }
    }
}

/**
 * Handle platform login for multiple platforms sequentially
 */
async function handlePlatformLogin(platformNames, phoneNumber) {
    try {
        logger.info('Handling platform login', { platforms: platformNames });
        
        // Save phone number if provided
        if (phoneNumber) {
            await loginManager.savePhoneNumber(phoneNumber);
        }
        
        // Process platforms one by one
        for (const platformName of platformNames) {
            try {
                logAction(`Logging into ${platformName}...`, 'info');
                
                // Get platform URL - use direct login URLs
                const loginUrls = {
                    amazon: 'https://www.amazon.in/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.in%2F%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=inflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0',
                    flipkart: 'https://www.flipkart.com/account/login',
                    ebay: 'https://www.ebay.com/signin',
                    walmart: 'https://www.walmart.com/account/login'
                };
                const platformUrl = loginUrls[platformName] || `https://www.${platformName}.com/`;
                
                logger.info('Opening platform page', { platform: platformName, url: platformUrl });
                
                // Open platform page in new tab
                const tab = await chrome.tabs.create({ url: platformUrl });
                logAction(`Opened ${platformName}. Setting up login...`, 'info');
                
                // Wait for page to load (reduced wait times)
                const waitTime = platformName === 'amazon' ? 3000 : 2000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Handle login (will wait for user to enter OTP on website)
                try {
                    await loginManager.handleLogin(platformName, tab.id);
                    logAction(`✓ Login completed for ${platformName}`, 'info');
                } catch (loginError) {
                    logAction(`Login setup incomplete for ${platformName}. Please enter OTP manually on the website.`, 'warn');
                    logger.warn(`Login incomplete for ${platformName}`, { error: loginError.message });
                    // Continue to next platform even if this one fails
                }
                
                // Wait a bit before opening next platform
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                logger.error(`Error logging into ${platformName}`, error);
                logAction(`Error logging into ${platformName}: ${error.message}`, 'error');
                // Continue to next platform
            }
        }
        
        logAction('Platform login process completed. Please enter OTP on each platform website.', 'info');
    } catch (error) {
        logger.error('Platform login failed', error);
        logAction(`Login process failed: ${error.message}`, 'error');
        throw error;
    }
}
