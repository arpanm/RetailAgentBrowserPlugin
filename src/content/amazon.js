/**
 * Amazon Content Script
 * Handles Amazon-specific page interactions
 */

import { AmazonPlatform } from './platforms/amazon-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';
import { navigateToAmazonLogin, enterAmazonPhoneNumber, sendAmazonOTP, checkAmazonLoginProgress } from './shared/login-handlers.js';

// Register Amazon platform
const amazonPlatform = new AmazonPlatform();
platformRegistry.register(amazonPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    if (request.action === 'SEARCH') {
        (async () => {
            try {
                logger.info('Amazon: Executing search', { query: request.query, filters: request.filters, sort: request.sort });
                const success = await amazonPlatform.search(request.query, request.filters || {}, request.sort);
                sendResponse({ success });
            } catch (error) {
                logger.error('Amazon: Search failed', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'APPLY_FILTERS') {
        (async () => {
            try {
                logger.info('Amazon: Applying filters', { filters: request.filters });
                await amazonPlatform.applyFilters(request.filters || {});
                sendResponse({ success: true });
            } catch (error) {
                logger.error('Amazon: Failed to apply filters', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    
    if (request.action === 'GET_SEARCH_RESULTS') {
        // Use promise to handle async operation
        (async () => {
            try {
                logger.info('Content script: Getting search results...');
                const products = await amazonPlatform.getSearchResults();
                logger.info(`Content script: Found ${products.length} products`);
                
                // Filter products if filters provided (do filtering in content script where document exists)
                let filteredProducts = products;
                if (request.filters && Object.keys(request.filters).length > 0) {
                    try {
                        const { filterProducts, isUnavailable, matchesFilters } = await import('../lib/product-matcher.js');
                        
                        // First pass: filter out unavailable and sponsored
                        filteredProducts = products.filter(item => !isUnavailable(item));
                        
                        // Second pass: apply filter matching
                        filteredProducts = filterProducts(filteredProducts, request.filters);
                        
                        logger.info('Content script: Filtered products', { 
                            original: products.length, 
                            afterUnavailable: products.filter(item => !isUnavailable(item)).length,
                            filtered: filteredProducts.length,
                            filters: Object.keys(request.filters)
                        });
                        
                        // If no products match filters, log why
                        if (filteredProducts.length === 0 && products.length > 0) {
                            logger.warn('Content script: No products matched filters', {
                                totalProducts: products.length,
                                filters: request.filters,
                                sampleProducts: products.slice(0, 3).map(p => ({
                                    title: p.title?.substring(0, 60),
                                    matches: matchesFilters(p, request.filters)
                                }))
                            });
                        }
                    } catch (filterError) {
                        logger.warn('Content script: Filtering failed, using all products', { error: filterError.message });
                        filteredProducts = products;
                    }
                }

                // Ensure response is fully serializable by converting to JSON and back
                try {
                    const serializableProducts = JSON.parse(JSON.stringify(filteredProducts));
                    logger.info('Content script: Sending response', { itemCount: serializableProducts.length });
                    sendResponse({ items: serializableProducts, success: true });
                } catch (serializeError) {
                    logger.error('Failed to serialize products', serializeError);
                    sendResponse({ items: [], success: false, error: 'Serialization failed' });
                }
            } catch (error) {
                logger.error('Content script: Error getting search results', error);
                sendResponse({ items: [], success: false, error: error.message || 'Unknown error' });
    }
        })();
        
        // Return true to indicate we will send response asynchronously
        return true;
    }
    
    // Handle other actions
    try {
    if (request.action === 'CLICK_BUY_NOW') {
            amazonPlatform.buyNow().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'ADD_TO_CART') {
            amazonPlatform.addToCart().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'GET_PRODUCT_DETAILS') {
            amazonPlatform.getProductDetails().then(details => {
                sendResponse({ details, success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'GET_ADDRESS_OPTIONS') {
            sendResponse({ options: [], success: true });
        } else if (request.action === 'GET_ORDER_DETAILS') {
            const orderIdEl = document.querySelector('bdi') || document.querySelector('.my-orders-order-id');
            const deliveryEl = document.querySelector('.delivery-box__primary-text');

            sendResponse({
                orderId: orderIdEl ? orderIdEl.innerText : 'Pending/Unknown',
                deliveryDate: deliveryEl ? deliveryEl.innerText : 'Unknown',
                success: true
            });
        } else if (request.action === 'CHECK_LOGIN_STATUS') {
            (async () => {
                try {
                    const accountLink = document.querySelector('#nav-link-accountList, #nav-orders');
                    const loggedIn = accountLink && !accountLink.textContent.includes('Sign in');
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
                    const loginScreenDetected = url.includes('/ap/signin') || 
                                               url.includes('/ap/login') ||
                                               document.querySelector('#ap_email, input[name="email"]') !== null;
                    sendResponse({ loginScreenDetected });
                } catch (error) {
                    sendResponse({ loginScreenDetected: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'NAVIGATE_TO_LOGIN') {
            (async () => {
                try {
                    const result = await navigateToAmazonLogin();
                    sendResponse({ success: true, alreadyLoggedIn: result.alreadyLoggedIn });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'CLICK_LOGIN_BUTTON') {
            (async () => {
                try {
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'ENTER_PHONE_NUMBER') {
            (async () => {
                try {
                    const result = await enterAmazonPhoneNumber(request.phoneNumber);
            sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'SEND_OTP') {
            (async () => {
                try {
                    const result = await sendAmazonOTP();
                    sendResponse({ success: true, message: result.message });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        } else if (request.action === 'CHECK_LOGIN_PROGRESS') {
            (async () => {
                try {
                    const result = checkAmazonLoginProgress();
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
        logger.error('Amazon content script error', error);
        sendResponse({ success: false, error: error.message });
    }
    
    // Return false for synchronous handlers
    return false;
});
