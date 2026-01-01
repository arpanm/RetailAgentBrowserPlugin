/**
 * Flipkart Content Script
 */

import { FlipkartPlatform } from './platforms/flipkart-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';
import { navigateToFlipkartLogin, clickFlipkartLoginButton, enterFlipkartPhoneNumber, sendFlipkartOTP, checkFlipkartLoginProgress } from './shared/login-handlers.js';
import { getSimplifiedPageContent } from './shared/actions.js';

// Register Flipkart platform
const flipkartPlatform = new FlipkartPlatform();
platformRegistry.register(flipkartPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    if (request.action === 'EXTRACT_PAGE_CONTENT') {
        getSimplifiedPageContent('flipkart').then(content => {
            sendResponse({ content, success: true });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

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
                logger.info(`Flipkart: Found ${products.length} products (sending ALL to service worker for processing)`);
                
                // Send ALL products to service worker - filtering will be done there
                // This ensures products are available for LLM analysis even if rule-based filtering fails
                
                // Only filter out clearly invalid products (no title or link)
                const validProducts = products.filter(item => {
                    const hasTitle = item.title && item.title.trim().length > 0;
                    const hasLink = item.link && item.link.trim().length > 0;
                    return hasTitle && hasLink;
                });
                
                logger.info('Flipkart: Valid products after basic validation', { 
                    original: products.length,
                    valid: validProducts.length
                });
                
                const serializableProducts = JSON.parse(JSON.stringify(validProducts));
                logger.info('Flipkart: Sending response', { 
                    itemCount: serializableProducts.length,
                    sampleTitles: serializableProducts.slice(0, 3).map(p => p.title?.substring(0, 50))
                });
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

