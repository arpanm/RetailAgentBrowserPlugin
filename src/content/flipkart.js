/**
 * Flipkart Content Script
 */

import { FlipkartPlatform } from './platforms/flipkart-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';
import { navigateToFlipkartLogin, clickFlipkartLoginButton, enterFlipkartPhoneNumber, sendFlipkartOTP, checkFlipkartLoginProgress } from './shared/login-handlers.js';
import { filterProducts, isUnavailable, matchesFilters } from '../lib/product-matcher.js';

// Register Flipkart platform
const flipkartPlatform = new FlipkartPlatform();
platformRegistry.register(flipkartPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    if (request.action === 'SEARCH') {
        (async () => {
            try {
                logger.info('Flipkart: Executing search', { query: request.query, filters: request.filters, sort: request.sort });
                const success = await flipkartPlatform.search(request.query, request.filters || {}, request.sort);
                sendResponse({ success });
            } catch (error) {
                logger.error('Flipkart: Search failed', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'APPLY_FILTERS') {
        (async () => {
            try {
                logger.info('Flipkart: Applying filters', { filters: request.filters });
                await flipkartPlatform.applyFilters(request.filters || {});
                sendResponse({ success: true });
            } catch (error) {
                logger.error('Flipkart: Failed to apply filters', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'GET_SEARCH_RESULTS') {
        (async () => {
            try {
                const products = await flipkartPlatform.getSearchResults();
                
                // Filter products if filters provided
                let filteredProducts = products;
                if (request.filters && Object.keys(request.filters).length > 0) {
                    try {
                        // First pass: filter out unavailable
                        filteredProducts = products.filter(item => !isUnavailable(item));
                        
                        // Second pass: apply filter matching
                        filteredProducts = filterProducts(filteredProducts, request.filters);
                        
                        logger.info('Flipkart: Filtered products', { 
                            original: products.length,
                            afterUnavailable: products.filter(item => !isUnavailable(item)).length,
                            filtered: filteredProducts.length,
                            filters: Object.keys(request.filters)
                        });
                        
                        // If no products match filters, log why
                        if (filteredProducts.length === 0 && products.length > 0) {
                            logger.warn('Flipkart: No products matched filters', {
                                totalProducts: products.length,
                                filters: request.filters,
                                sampleProducts: products.slice(0, 3).map(p => ({
                                    title: p.title?.substring(0, 60),
                                    matches: matchesFilters(p, request.filters)
                                }))
                            });
                        }
                    } catch (filterError) {
                        logger.warn('Flipkart: Filtering failed, using all products', { error: filterError.message });
                        filteredProducts = products;
                    }
                }
                
                const serializableProducts = JSON.parse(JSON.stringify(filteredProducts));
                sendResponse({ items: serializableProducts, success: true });
            } catch (error) {
                logger.error('Flipkart: Failed to get search results', error);
                sendResponse({ items: [], success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    // Handle other actions
    try {
        if (request.action === 'CLICK_BUY_NOW') {
            flipkartPlatform.buyNow().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'ADD_TO_CART') {
            flipkartPlatform.addToCart().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'GET_PRODUCT_DETAILS') {
            flipkartPlatform.getProductDetails().then(details => {
                sendResponse({ details, success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'CHECK_LOGIN_STATUS') {
            (async () => {
                try {
                    const accountLink = document.querySelector('._1_3w1N, [href*="/account"]');
                    const loggedIn = accountLink && !accountLink.textContent.includes('Login');
                    sendResponse({ loggedIn });
                } catch (error) {
                    sendResponse({ loggedIn: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'DETECT_LOGIN_SCREEN') {
            (async () => {
                try {
                    const url = window.location.href.toLowerCase();
                    const loginScreenDetected = url.includes('/account/login') ||
                                               document.querySelector('input[type="tel"], input[name="phone"]') !== null;
                    sendResponse({ loginScreenDetected });
                } catch (error) {
                    sendResponse({ loginScreenDetected: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'NAVIGATE_TO_LOGIN') {
            (async () => {
                try {
                    const result = await navigateToFlipkartLogin();
                    sendResponse({ success: true, alreadyLoggedIn: result.alreadyLoggedIn });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'CLICK_LOGIN_BUTTON') {
            (async () => {
                try {
                    const result = await clickFlipkartLoginButton();
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'ENTER_PHONE_NUMBER') {
            (async () => {
                try {
                    const result = await enterFlipkartPhoneNumber(request.phoneNumber);
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'SEND_OTP') {
            (async () => {
                try {
                    const result = await sendFlipkartOTP();
                    sendResponse({ success: true, message: result.message });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'CHECK_LOGIN_PROGRESS') {
            (async () => {
                try {
                    const result = checkFlipkartLoginProgress();
                    sendResponse(result);
                } catch (error) {
                    sendResponse({ loginCompleted: false, error: error.message });
                }
            })();
            return true;
        } else {
            sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        logger.error('Flipkart content script error', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return false;
});

