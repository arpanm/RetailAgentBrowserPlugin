/**
 * JioMart Content Script
 * Handles JioMart-specific page interactions
 */

import { JioMartPlatform } from './platforms/jiomart-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';

// Register JioMart platform
const jiomartPlatform = new JioMartPlatform();
platformRegistry.register(jiomartPlatform);

// Notify background that page loaded (wait for DOM to be ready)
function notifyPageLoaded() {
    chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyPageLoaded);
} else {
    // DOM already loaded
    notifyPageLoaded();
}

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    if (request.action === 'SEARCH') {
        (async () => {
            try {
                logger.info('JioMart: Executing search', { query: request.query, filters: request.filters, sort: request.sort });
                const success = await jiomartPlatform.search(request.query, request.filters || {}, request.sort);
                sendResponse({ success });
            } catch (error) {
                logger.error('JioMart: Search failed', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'GET_SEARCH_RESULTS') {
        (async () => {
            try {
                logger.info('Content script: Getting search results...');
                const products = await jiomartPlatform.getSearchResults();
                logger.info(`Content script: Found ${products.length} products`);
                
                const validProducts = products.filter(item => {
                    const hasTitle = item.title && item.title.trim().length > 0;
                    const hasLink = item.link && item.link.trim().length > 0;
                    return hasTitle && hasLink;
                });
                
                const serializableProducts = JSON.parse(JSON.stringify(validProducts));
                logger.info('Content script: Sending response', { 
                    itemCount: serializableProducts.length,
                    sampleTitles: serializableProducts.slice(0, 3).map(p => p.title?.substring(0, 50))
                });
                sendResponse({ items: serializableProducts, success: true });
            } catch (error) {
                logger.error('Content script: Error getting search results', error);
                sendResponse({ items: [], success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'CLICK_BUY_NOW') {
        jiomartPlatform.buyNow().then(success => {
            sendResponse({ success });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'ADD_TO_CART') {
        jiomartPlatform.addToCart().then(success => {
            sendResponse({ success });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'GET_PRODUCT_DETAILS') {
        jiomartPlatform.getProductDetails().then(details => {
            sendResponse({ details, success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    
    return false;
});

