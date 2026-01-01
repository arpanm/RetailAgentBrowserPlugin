/**
 * Walmart Content Script
 */

import { WalmartPlatform } from './platforms/walmart-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';
import { getSimplifiedPageContent } from './shared/actions.js';

// Register Walmart platform
const walmartPlatform = new WalmartPlatform();
platformRegistry.register(walmartPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        if (request.action === 'EXTRACT_PAGE_CONTENT') {
            const content = await getSimplifiedPageContent('walmart');
            sendResponse({ content, success: true });
        } else if (request.action === 'GET_SEARCH_RESULTS') {
            const products = await walmartPlatform.getSearchResults();
            sendResponse({ items: products, success: true });
        } else if (request.action === 'CLICK_BUY_NOW') {
            const success = await walmartPlatform.buyNow();
            sendResponse({ success });
        } else if (request.action === 'ADD_TO_CART') {
            const success = await walmartPlatform.addToCart();
            sendResponse({ success });
        } else if (request.action === 'GET_PRODUCT_DETAILS') {
            const details = await walmartPlatform.getProductDetails();
            sendResponse({ details, success: true });
        } else {
            sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        logger.error('Walmart content script error', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
});

