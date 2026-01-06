/**
 * Ajio Content Script
 * Handles Ajio-specific page interactions
 */

import { AjioPlatform } from './platforms/ajio-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';

// Register Ajio platform
const ajioPlatform = new AjioPlatform();
platformRegistry.register(ajioPlatform);

// Notify background that page loaded (wait for DOM to be ready)
function notifyPageLoaded() {
    chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyPageLoaded);
} else {
    notifyPageLoaded();
}

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SEARCH') {
        (async () => {
            try {
                logger.info('Ajio: Executing search', { query: request.query, filters: request.filters, sort: request.sort });
                const success = await ajioPlatform.search(request.query, request.filters || {}, request.sort);
                sendResponse({ success });
            } catch (error) {
                logger.error('Ajio: Search failed', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'GET_SEARCH_RESULTS') {
        (async () => {
            try {
                logger.info('Content script: Getting search results...');
                const products = await ajioPlatform.getSearchResults();
                logger.info(`Content script: Found ${products.length} products`);
                
                const validProducts = products.filter(item => {
                    const hasTitle = item.title && item.title.trim().length > 0;
                    const hasLink = item.link && item.link.trim().length > 0;
                    return hasTitle && hasLink;
                });
                
                const serializableProducts = JSON.parse(JSON.stringify(validProducts));
                sendResponse({ items: serializableProducts, success: true });
            } catch (error) {
                logger.error('Content script: Error getting search results', error);
                sendResponse({ items: [], success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'CLICK_BUY_NOW') {
        ajioPlatform.buyNow().then(success => {
            sendResponse({ success });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'ADD_TO_CART') {
        ajioPlatform.addToCart().then(success => {
            sendResponse({ success });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'GET_PRODUCT_DETAILS') {
        ajioPlatform.getProductDetails().then(details => {
            sendResponse({ details, success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    
    return false;
});

