import { generateContent, listModels } from '../lib/gemini.js';
import { logger } from '../lib/logger.js';
import { ErrorHandler, IntentParseError, APIError } from '../lib/error-handler.js';
import { retryAPICall } from '../lib/retry.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { configManager } from '../lib/config.js';
import { SearchFilter, ProductSorter, ProductComparator } from '../lib/search-filters.js';
import { loginManager } from '../lib/login-manager.js';
// Register platforms in service worker context
// Since service worker and content scripts have separate contexts,
// we need to register platforms here for the service worker to use

// Import EcommercePlatform class
import { EcommercePlatform } from '../lib/ecommerce-platforms.js';

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

// Register platforms immediately
try {
    platformRegistry.register(new SWAmazonPlatform());
    platformRegistry.register(new SWFlipkartPlatform());
    platformRegistry.register(new SWEbayPlatform());
    platformRegistry.register(new SWWalmartPlatform());
    
    logger.info('Platforms registered in service worker', { 
        count: platformRegistry.getAll().length,
        platforms: platformRegistry.getAll().map(p => p.name)
    });
} catch (error) {
    logger.error('Failed to register platforms', error);
    console.error('Platform registration error:', error);
}

// State management
let currentState = {
    status: 'IDLE', // IDLE, PARSING, SEARCHING, SELECTING, CHECKOUT, PROCESSING_PAYMENT, COMPLETED
    data: {},       // Parsed intent data
    tabId: null
};

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

async function handleUserQuery(text) {
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
        const { setLogAction } = await import('../lib/gemini.js');
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

        currentState.data = intent;
        currentState.status = 'SEARCHING';

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
function parseIntentSimple(text) {
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

async function parseIntent(apiKey, text) {
    // Set global logAction for gemini.js
    const { setLogAction } = await import('../lib/gemini.js');
    setLogAction(logAction);
    
    try {
        const systemPrompt = `
    You are a shopping assistant. Extract the following from the user's request.
    Return JSON ONLY. No markdown.
    Fields:
    - product: (string) The search query for the product (remove platform names like "amazon", "flipkart").
    - platform: (string, optional) Preferred ecommerce platform: "amazon", "flipkart", "ebay", "walmart", or null.
    - filters: (object) Key-value pairs for potential filters:
      * price_min: (number) Minimum price in local currency (extract numbers only, no currency symbols)
      * price_max: (number) Maximum price in local currency (extract numbers only, no currency symbols)
      * brand: (string) Brand name (e.g., "motorola", "samsung")
      * storage: (string) Storage capacity (e.g., "128gb", "256gb")
      * ram: (string) RAM capacity (e.g., "6gb", "8gb")
      * battery: (number) Battery capacity in mAh
      * rating: (number) Minimum rating (1-5)
      * category: (string) Product category
      * color: (string) Product color
      * condition: (string) Product condition (new, used, refurbished)
    - sort: (string, optional) Sort option: "price_low", "price_high", "rating", "newest", "relevance"
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

async function startAutomation() {
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
            args: [currentState.data.product]
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
            args: [currentState.data.product]
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
            args: [currentState.data.product]
        });
    }
    
    currentState.status = 'SELECTING';
    // Wait for search to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
}

async function executeNextStep(tabId) {
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
                
                // Use platform's search method via content script
                try {
                    const searchResponsePromise = () => {
                        return new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('Timeout waiting for search response'));
                            }, 10000);
                            
                            chrome.tabs.sendMessage(tabId, { 
                                action: 'SEARCH', 
                                query: currentState.data.product,
                                filters: currentState.data.filters || {},
                                sort: currentState.data.sort || null
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
                        // Wait for search results page to load
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Apply filters after search if not already applied
                        const filters = currentState.data.filters || {};
                        if (Object.keys(filters).length > 0) {
                            logger.info('Applying filters after search', { filters });
                            logAction('Applying filters to search results...', 'info');
                            try {
                                const filterResponse = await new Promise((resolve, reject) => {
                                    const timeout = setTimeout(() => {
                                        logger.warn('Filter application response timeout');
                                        resolve({ success: true, timeout: true });
                                    }, 25000); // 25s timeout for filters
                                    
                                    chrome.tabs.sendMessage(tabId, {
                                        action: 'APPLY_FILTERS',
                                        filters: filters
                                    }, (response) => {
                                        clearTimeout(timeout);
                                        if (chrome.runtime.lastError) {
                                            logger.warn('Filter message error', { error: chrome.runtime.lastError.message });
                                            resolve({ success: true, error: chrome.runtime.lastError.message });
                                        } else {
                                            resolve(response);
                                        }
                                    });
                                });
                                
                                if (filterResponse && (filterResponse.success || filterResponse.timeout)) {
                                    logger.info('Filters applied, waiting for page to reload', { filters });
                                    logAction('Filters applied, waiting for results...', 'info');
                                    // Wait longer for filters to take effect and page to update
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                } else {
                                    logger.warn('Filter application returned failure', { response: filterResponse });
                                    logAction('Some filters may not have been applied', 'warn');
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                }
                            } catch (filterError) {
                                logger.warn('Failed to apply filters after search', { error: filterError.message });
                                logAction(`Filter application note: ${filterError.message}`, 'warn');
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }

                        // Request search results from content script AFTER filters are applied
                        const response = await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('Timeout waiting for search results'));
                            }, 10000);
                            
                            logger.info('Requesting search results from content script', { tabId });
                            chrome.tabs.sendMessage(tabId, {
                                action: 'GET_SEARCH_RESULTS',
                                filters: filters
                            }, (response) => {
                                clearTimeout(timeout);
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else {
                                    resolve(response);
                                }
                            });
                        });
                        
                        const items = response ? response.items : [];
                    } else {
                        logger.warn('Search response indicates failure, using fallback', { response: searchResponse });
                        // Fallback to direct DOM manipulation
                        await executeSearchFallback(tabId);
                    }
                } catch (searchError) {
                    logger.warn('Platform search method failed, using fallback', { error: searchError.message });
                    // Fallback to direct DOM manipulation
                    await executeSearchFallback(tabId);
                    
                    // Apply filters after fallback search too
                    const filters = currentState.data.filters || {};
                    if (Object.keys(filters).length > 0) {
                        logger.info('Applying filters after fallback search', { filters });
                        logAction('Applying filters to search results...', 'info');
                        try {
                            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for search results
                            
                            const filterResponse = await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => {
                                    logger.warn('Filter application response timeout after fallback');
                                    resolve({ success: true, timeout: true });
                                }, 25000);
                                
                                chrome.tabs.sendMessage(tabId, {
                                    action: 'APPLY_FILTERS',
                                    filters: filters
                                }, (response) => {
                                    clearTimeout(timeout);
                                    if (chrome.runtime.lastError) {
                                        logger.warn('Filter message error after fallback', { error: chrome.runtime.lastError.message });
                                        resolve({ success: true, error: chrome.runtime.lastError.message });
                                    } else {
                                        resolve(response);
                                    }
                                });
                            });
                            
                            if (filterResponse && (filterResponse.success || filterResponse.timeout)) {
                                logger.info('Filters applied successfully after fallback', { filters });
                                logAction('Filters applied, waiting for results...', 'info');
                                await new Promise(resolve => setTimeout(resolve, 5000));
                            } else {
                                logger.warn('Filter application returned failure after fallback', { response: filterResponse });
                                logAction('Some filters may not have been applied', 'warn');
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        } catch (filterError) {
                            logger.warn('Failed to apply filters after fallback search', { error: filterError.message });
                            logAction(`Filter application note: ${filterError.message}`, 'warn');
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }
                    }
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

        // Wait a bit for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get results from content script
        try {
            logger.info('Requesting search results from content script', { tabId });
            
            // Use promise wrapper for chrome.tabs.sendMessage with timeout
            const getSearchResults = () => {
                return new Promise((resolve, reject) => {
                    logger.info('Sending message to content script', { tabId });
                    
                    // Set a timeout to avoid hanging forever
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for content script response'));
                    }, 10000); // 10 second timeout
                    
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
                
                logger.info('Extracted search results', { count: items.length });
                logAction(`Found ${items.length} items on page.`, 'info');
            } catch (extractError) {
                logger.error('Error extracting items from response', extractError);
                logAction('Error processing search results.', 'error');
                return;
            }

            if (items.length > 0) {
                try {
                    const filters = currentState.data.filters || {};
                    logger.info('Starting product matching', { 
                        totalProducts: items.length,
                        filters: Object.keys(filters)
                    });
                    
                    // Second-level matching: Try each product until we find one that matches filters
                    let bestItem = null;
                    let itemIndex = 0;
                    
                    // We check title/attributes from the product data objects returned from content script
                    while (itemIndex < items.length && !bestItem) {
                        const item = items[itemIndex];
                        
                        // Skip if no link
                        if (!item.link || item.link === '') {
                            logger.debug('Skipping product - no link', { index: itemIndex });
                            itemIndex++;
                            continue;
                        }
                        
                        // Check if product matches filters based on title/attributes
                        let matches = true;
                        const title = (item.title || '').toLowerCase();
                        
                        // Skip sponsored results if they weren't already filtered (extra check)
                        if (title.includes('sponsored') || title.includes(' ad ')) {
                            logger.debug('Skipping product - appears sponsored', { index: itemIndex, title: title.substring(0, 40) });
                            itemIndex++;
                            continue;
                        }

                        // Brand check
                        if (filters.brand && matches) {
                            const brandLower = filters.brand.toLowerCase().trim();
                            const brandWords = brandLower.split(/\s+/);
                            const hasBrand = brandWords.some(word => title.includes(word));
                            
                            // Check for conflicting brands
                            const conflictingBrands = ['samsung', 'apple', 'iphone', 'macbook', 'xiaomi', 'redmi', 'oneplus', 'oppo', 'vivo', 'realme', 'nokia', 'lg', 'sony', 'lenovo', 'hp', 'dell', 'asus', 'acer'];
                            const mentionedBrands = conflictingBrands.filter(brand => 
                                brand !== brandLower && 
                                brand !== 'macbook' && 
                                title.includes(brand)
                            );
                            
                            if (!hasBrand || (mentionedBrands.length > 0 && !title.includes(brandLower))) {
                                logger.info('Product failed brand check', {
                                    title: item.title?.substring(0, 60),
                                    requiredBrand: filters.brand
                                });
                                matches = false;
                            }
                        }
                        
                        // Storage check
                        if (filters.storage && matches) {
                            const storageLower = filters.storage.toLowerCase().replace(/\s+/g, '');
                            const storageVal = parseInt(storageLower.replace(/\D/g, ''));
                            
                            // Extract storage from title
                            const storageMatch = title.match(/(\d+)\s*(?:gb|gigabytes?|tb|terabytes?|ssd|hdd)/i);
                            if (!storageMatch) {
                                logger.debug('Product storage info not in title, accepting anyway', {
                                    title: item.title?.substring(0, 60),
                                    requiredStorage: filters.storage
                                });
                                // Don't reject if not in title, might be in description
                            } else {
                                const foundStorageVal = parseInt(storageMatch[1]);
                                const foundUnit = storageMatch[0].toLowerCase();
                                
                                // Normalize to GB for comparison if needed
                                let normalizedFound = foundStorageVal;
                                if (foundUnit.includes('tb')) normalizedFound *= 1024;
                                
                                let normalizedRequired = storageVal;
                                if (storageLower.includes('tb')) normalizedRequired *= 1024;

                                if (normalizedFound < normalizedRequired) {
                                    logger.debug('Product failed storage check - too low', {
                                        title: item.title?.substring(0, 60),
                                        required: normalizedRequired,
                                        found: normalizedFound
                                    });
                                    matches = false;
                                }
                            }
                        }
                        
                        // RAM check
                        if (filters.ram && matches) {
                            const ramLower = filters.ram.toLowerCase().replace(/\s+/g, '').replace(/morethan/i, '');
                            const ramVal = parseInt(ramLower.replace(/\D/g, ''));
                            
                            const ramMatch = title.match(/(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory|unified\s*memory)/i);
                            if (!ramMatch) {
                                logger.debug('Product RAM info not in title, accepting anyway', {
                                    title: item.title?.substring(0, 60),
                                    requiredRAM: filters.ram
                                });
                            } else {
                                const foundRam = parseInt(ramMatch[1]);
                                if (foundRam < ramVal) {
                                    logger.debug('Product failed RAM check - too low', {
                                        title: item.title?.substring(0, 60),
                                        required: ramVal,
                                        found: foundRam
                                    });
                                    matches = false;
                                }
                            }
                        }
                        
                        // Battery check
                        if (filters.battery && matches) {
                            const batteryMatch = title.match(/(\d+)\s*(?:mah|mAh|battery)/i);
                            if (!batteryMatch) {
                                logger.debug('Product failed battery check - not found', {
                                    title: item.title?.substring(0, 60),
                                    requiredBattery: filters.battery
                                });
                                matches = false;
                            } else {
                                const foundBattery = parseInt(batteryMatch[1]);
                                if (foundBattery < filters.battery) {
                                    logger.debug('Product failed battery check - too low', {
                                        title: item.title?.substring(0, 60),
                                        requiredBattery: filters.battery,
                                        foundBattery: foundBattery
                                    });
                                    matches = false;
                                }
                            }
                        }
                        
                        if (matches) {
                            bestItem = item;
                            logger.info('Found matching product', {
                                title: item.title?.substring(0, 60),
                                price: item.price,
                                index: itemIndex,
                                matchedFilters: Object.keys(filters)
                            });
                            logAction(`Found matching product: ${item.title?.substring(0, 50)}`, 'info');
                            break;
                        } else {
                            logger.info('Product does not match filters, trying next', {
                                title: item.title?.substring(0, 60),
                                index: itemIndex
                            });
                        }
                        
                        itemIndex++;
                    }
                    
                    if (!bestItem) {
                        logger.warn('No products matched filters after second-level check', {
                            totalProducts: items.length,
                            filters: Object.keys(filters),
                            checkedProducts: itemIndex
                        });
                        logAction('No suitable products found matching your criteria after checking all products.', 'warn');
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

                    // Navigate to product page
                    logger.info('Navigating to product', { url: productLink, tabId });
                    try {
                        await chrome.tabs.update(tabId, { url: productLink });
                        logger.info('Navigation initiated successfully', { url: productLink });
                        logAction(`Opening product page...`, 'info');
                    } catch (navError) {
                        logger.error('Navigation failed', null, { errorMessage: String(navError.message || 'Unknown error') });
                        logAction(`Failed to navigate: ${navError.message}`, 'error');
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
                logAction('No suitable products found.', 'warn');
                logger.warn('No products in response', { itemCount: items ? items.length : 0 });
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
        // Check for login screen first
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
                logAction('Could not click "Buy Now". Trying Add to Cart instead...', 'warn');
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
            logAction(`Error clicking Buy Now: ${e.message}`, 'error');
            
            // Try Add to Cart as fallback even on error
            try {
                logAction('Trying Add to Cart as fallback...', 'info');
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
