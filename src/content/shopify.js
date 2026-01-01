/**
 * Shopify Content Script
 */

import { ShopifyPlatform } from './platforms/shopify-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';
import { getSimplifiedPageContent } from './shared/actions.js';

// Register Shopify platform
const shopifyPlatform = new ShopifyPlatform();
platformRegistry.register(shopifyPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for messages from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PAGE_CONTENT') {
        getSimplifiedPageContent('shopify').then(content => {
            sendResponse({ content, success: true });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (request.action === 'SEARCH') {
        shopifyPlatform.search(request.query, request.filters, request.sort)
            .then(success => sendResponse({ success }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'GET_SEARCH_RESULTS') {
        shopifyPlatform.getSearchResults()
            .then(items => sendResponse({ items, success: true }))
            .catch(error => sendResponse({ items: [], success: false, error: error.message }));
        return true;
    }

    if (request.action === 'CLICK_BUY_NOW') {
        shopifyPlatform.buyNow()
            .then(success => sendResponse({ success }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

