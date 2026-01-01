/**
 * Shared action utilities for common ecommerce operations
 */

import { logger } from '../../lib/logger.js';
import { findElement, safeClick, fillInput, scrollIntoView, getText } from './selectors.js';
import { parsePrice } from '../../lib/product-matcher.js';

/**
 * Perform search on a page
 */
export async function performSearch(searchQuery, searchSelectors, options = {}) {
    try {
        logger.info('Performing search', { query: searchQuery });

        // Find search input
        const searchInput = await findElement(searchSelectors.input, {
            maxRetries: options.maxRetries || 3,
        });

        // Fill search input
        await fillInput(searchSelectors.input, searchQuery, {
            simulateTyping: options.simulateTyping || false,
        });

        // Click search button or submit form
        if (searchSelectors.button) {
            const searchButton = await findElement(searchSelectors.button);
            await safeClick(searchButton);
        } else if (searchSelectors.submit) {
            // Submit form
            const form = searchInput.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        } else {
            // Press Enter
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }

        logger.info('Search submitted', { query: searchQuery });
        return true;
    } catch (error) {
        logger.error('Search failed', error, { query: searchQuery });
        throw error;
    }
}

/**
 * Extract product information from search results
 */
export function extractProducts(containerSelector, productSelectors) {
    const products = [];
    
    // Handle array of selectors
    const containerSelectors = Array.isArray(containerSelector) ? containerSelector : [containerSelector];
    let containers = [];
    
    for (const selector of containerSelectors) {
        try {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                // Filter out non-product items (like headers, carousels) if they have no title/link
                // Be more strict for valid containers
                const validContainers = Array.from(found).filter(el => {
                    const text = (el.textContent || el.innerText || '').toLowerCase();
                    const hasLink = el.querySelector('a');
                    const hasTitle = !!el.querySelector(Array.isArray(productSelectors.title) ? productSelectors.title.join(',') : productSelectors.title);
                    
                    // Real products usually have a price or image too
                    const hasPrice = !!el.querySelector(Array.isArray(productSelectors.price) ? productSelectors.price.join(',') : productSelectors.price);
                    
                    // Skip common navigation blocks
                    const isGarbage = text.includes('visit the help section') || 
                                     text.includes('customer service') || 
                                     text.includes('feedback') ||
                                     text.includes('skip to main') ||
                                     text.includes('related searches') ||
                                     text.includes('explore similar');

                    return hasLink && hasTitle && !isGarbage && (hasPrice || text.length > 20);
                });
                
                if (validContainers.length > 0) {
                    containers = validContainers;
                    logger.debug(`Found ${containers.length} valid containers with selector: ${selector}`);
                    break;
                }
            }
        } catch (e) {
            logger.warn(`Selector failed: ${selector}`, { error: e.message });
            continue;
        }
    }
    
    if (containers.length === 0) {
        logger.warn('No containers found with any selector', { selectors: containerSelectors });
        return products;
    }

    containers.forEach((container, index) => {
        try {
            // Get text to check for garbage early
            const containerText = (container.textContent || container.innerText || '').toLowerCase();
            
            // Skip common non-product items - expanded list
            const garbageKeywords = [
                'visit the help section', 'customer service', 'your account', 
                'your orders', 'feedback', 'skip to main search',
                'explore more', 'need help', 'related to your search',
                'sign in', 'create account', 'cart', 'wishlist',
                'browse', 'departments', 'today\'s deals', 'best sellers',
                'new releases', 'customer reviews', 'write a review',
                'see all buying options', 'add to list', 'share',
                'sponsored', 'advertisement', 'promoted', '[ad]'
            ];
            if (garbageKeywords.some(kw => containerText.includes(kw))) {
                logger.debug('Skipping garbage container', { text: containerText.substring(0, 100) });
                return;
            }

            // Get link element - try multiple approaches with priority
            const linkSelectors = Array.isArray(productSelectors.link) 
                ? productSelectors.link 
                : [productSelectors.link];
            
            let linkElement = null;
            let productUrl = null;
            
            // Priority 1: Try provided selectors
            for (const linkSelector of linkSelectors) {
                linkElement = container.querySelector(linkSelector);
                if (linkElement) {
                    productUrl = linkElement.href || linkElement.getAttribute('href');
                    if (productUrl) break;
                }
            }
            
            // Priority 2: Try data attributes that might contain URLs
            if (!productUrl) {
                const dataAttributes = ['data-url', 'data-link', 'data-href', 'data-product-url', 'data-canonical-url'];
                for (const attr of dataAttributes) {
                    const element = container.querySelector(`[${attr}]`);
                    if (element) {
                        productUrl = element.getAttribute(attr);
                        if (productUrl) {
                            linkElement = element;
                            break;
                        }
                    }
                }
            }
            
            // Priority 3: Try product-specific URL patterns
            if (!productUrl) {
                linkElement = container.querySelector('a[href*="/p/"], a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/product/"], a[href*="/d/"], a[href*="/item/"]');
                if (linkElement) {
                    productUrl = linkElement.href || linkElement.getAttribute('href');
                }
            }
            
            // Priority 4: Try title links (often most reliable)
            if (!productUrl) {
                linkElement = container.querySelector('h2 a, h3 a, h4 a, .title a, [class*="title"] a, [class*="Title"] a');
                if (linkElement) {
                    productUrl = linkElement.href || linkElement.getAttribute('href');
                }
            }
            
            // Priority 5: Try image links
            if (!productUrl) {
                const imageLink = container.querySelector('a > img, a img');
                if (imageLink && imageLink.parentElement && imageLink.parentElement.tagName === 'A') {
                    linkElement = imageLink.parentElement;
                    productUrl = linkElement.href || linkElement.getAttribute('href');
                } else {
                    linkElement = container.querySelector('a[href] img')?.closest('a');
                    if (linkElement) {
                        productUrl = linkElement.href || linkElement.getAttribute('href');
                    }
                }
            }
            
            // Priority 6: Try any link that looks like a product link
            if (!productUrl) {
                const allLinks = container.querySelectorAll('a[href]');
                for (const link of allLinks) {
                    const href = link.getAttribute('href') || '';
                    if (href.match(/\/[pd]p\/|\/product\/|\/gp\/product\/|\/item\//i)) {
                        linkElement = link;
                        productUrl = href;
                        break;
                    }
                }
            }
            
            // Priority 7: Construct URL from ASIN/product ID if available
            if (!productUrl) {
                // Amazon ASIN
                const asin = container.getAttribute('data-asin') || 
                            container.querySelector('[data-asin]')?.getAttribute('data-asin');
                if (asin && asin.trim().length > 0) {
                    productUrl = `/dp/${asin}`;
                    logger.debug('Constructed URL from ASIN', { asin, url: productUrl });
                }
                
                // Flipkart product ID
                const productId = container.getAttribute('data-id') ||
                                 container.getAttribute('data-pid') ||
                                 container.querySelector('[data-id], [data-pid]')?.getAttribute('data-id');
                if (!productUrl && productId && productId.trim().length > 0) {
                    productUrl = `/p/${productId}`;
                    logger.debug('Constructed URL from product ID', { productId, url: productUrl });
                }
            }
            
            // Priority 8: Last resort - any link
            if (!productUrl) {
                linkElement = container.querySelector('a[href]');
                if (linkElement) {
                    productUrl = linkElement.href || linkElement.getAttribute('href');
                }
            }
            
            // Update linkElement to ensure we have one if productUrl exists
            if (productUrl && !linkElement) {
                linkElement = { href: productUrl, getAttribute: (attr) => attr === 'href' ? productUrl : null };
            }
            
            // Get title
            const titleSelectors = Array.isArray(productSelectors.title) 
                ? productSelectors.title 
                : [productSelectors.title];
            
            let titleElement = null;
            for (const titleSelector of titleSelectors) {
                titleElement = container.querySelector(titleSelector);
                if (titleElement) break;
            }
            
            const title = getText(titleElement) || (linkElement ? getText(linkElement) : '');
            
            // Final garbage check on title
            if (!title || garbageKeywords.some(kw => title.toLowerCase().includes(kw)) || title.length < 3) {
                return;
            }

            // Get price
            const priceSelectors = Array.isArray(productSelectors.price) 
                ? productSelectors.price 
                : [productSelectors.price];
            
            let priceElement = null;
            for (const priceSelector of priceSelectors) {
                priceElement = container.querySelector(priceSelector);
                if (priceElement) break;
            }
            
            // Get image
            const imageSelectors = Array.isArray(productSelectors.image) 
                ? productSelectors.image 
                : [productSelectors.image];
            
            let imageElement = null;
            for (const imageSelector of imageSelectors) {
                imageElement = container.querySelector(imageSelector);
                if (imageElement) break;
            }
            
            const product = {
                index,
                title: title,
                price: getText(priceElement),
                link: productUrl || linkElement?.href || linkElement?.getAttribute?.('href') || '',
                image: imageElement?.src || imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src') || '',
                rating: getText(container.querySelector(productSelectors.rating)),
                reviews: getText(container.querySelector(productSelectors.reviews)),
            };

            // Ensure link is absolute URL and clean it up
            if (product.link) {
                try {
                    let cleanedLink = product.link.trim();
                    
                    // Remove Amazon's redirection/tracking from link
                    if (cleanedLink.includes('/url?')) {
                        try {
                            const urlParams = new URLSearchParams(cleanedLink.split('?')[1]);
                            const actualUrl = urlParams.get('url') || urlParams.get('u') || urlParams.get('redirect');
                            if (actualUrl) {
                                cleanedLink = decodeURIComponent(actualUrl);
                            }
                        } catch (e) {
                            logger.debug('Failed to parse /url? redirect', { link: cleanedLink });
                        }
                    }
                    
                    // Handle Amazon's specific encoded URLs like /gp/slredirect/picassoRedirect.html/
                    if (cleanedLink.includes('picassoRedirect')) {
                        try {
                            // Get origin with fallback
                            const baseUrl = globalThis.location?.origin || 
                                           (cleanedLink.startsWith('/') ? 'https://www.amazon.in' : '');
                            const urlParts = new URL(cleanedLink, baseUrl);
                            const targetUrl = urlParts.searchParams.get('url') || urlParts.searchParams.get('link');
                            if (targetUrl) {
                                cleanedLink = decodeURIComponent(targetUrl);
                            }
                        } catch (e) {
                            logger.debug('Failed to parse picassoRedirect', { link: cleanedLink });
                        }
                    }

                    // Handle other redirect patterns (/slredirect/, /gp/redirect/, /redirect/)
                    const redirectPatterns = ['/slredirect/', '/gp/redirect/', '/redirect/', '/redir/'];
                    if (redirectPatterns.some(pattern => cleanedLink.includes(pattern))) {
                        try {
                            const baseUrl = globalThis.location?.origin || 
                                           (cleanedLink.startsWith('/') ? 'https://www.amazon.in' : '');
                            const urlParts = new URL(cleanedLink, baseUrl);
                            const targetUrl = urlParts.searchParams.get('url') || 
                                            urlParts.searchParams.get('redirectUrl') ||
                                            urlParts.searchParams.get('target') ||
                                            urlParts.searchParams.get('link');
                            if (targetUrl) {
                                cleanedLink = decodeURIComponent(targetUrl);
                            }
                        } catch (e) {
                            logger.debug('Failed to parse redirect pattern', { link: cleanedLink });
                        }
                    }

                    // Decode URL if it has encoded parts
                    if (cleanedLink.includes('%')) {
                        try {
                            // Decode multiple times if necessary (sometimes double-encoded)
                            let prevLink = cleanedLink;
                            for (let i = 0; i < 3; i++) {
                                try {
                                    const decoded = decodeURIComponent(cleanedLink);
                                    if (decoded === cleanedLink) break; // No more decoding needed
                                    cleanedLink = decoded;
                                } catch (e) {
                                    break;
                                }
                            }
                        } catch (e) {
                            // If decoding fails, try partial decode
                            try {
                                cleanedLink = cleanedLink
                                    .replace(/%20/g, ' ')
                                    .replace(/%2F/g, '/')
                                    .replace(/%3A/g, ':')
                                    .replace(/%3F/g, '?')
                                    .replace(/%3D/g, '=')
                                    .replace(/%26/g, '&');
                            } catch (e2) {}
                        }
                    }

                    // Ensure absolute URL with comprehensive fallback
                    if (!cleanedLink.startsWith('http')) {
                        let origin;
                        try {
                            // Try to get origin from current location
                            origin = globalThis.location?.origin;
                        } catch (e) {}
                        
                        // Fallback origins based on common patterns
                        if (!origin) {
                            if (cleanedLink.includes('/dp/') || cleanedLink.includes('/gp/')) {
                                origin = 'https://www.amazon.in';
                            } else if (cleanedLink.includes('/p/')) {
                                origin = 'https://www.flipkart.com';
                            } else {
                                origin = 'https://www.amazon.in'; // Default fallback
                            }
                        }
                        
                        try {
                            cleanedLink = new URL(cleanedLink, origin).href;
                        } catch (e) {
                            // If URL constructor fails, try simple concatenation
                            if (cleanedLink.startsWith('/')) {
                                cleanedLink = origin + cleanedLink;
                            } else {
                                cleanedLink = origin + '/' + cleanedLink;
                            }
                            logger.debug('Used fallback URL concatenation', { link: cleanedLink, origin });
                        }
                    }
                    
                    // Clean up any remaining issues (double slashes, etc.)
                    cleanedLink = cleanedLink.replace(/([^:])\/\//g, '$1/');
                    
                    // Final validation - ensure it's a valid URL
                    try {
                        const validUrl = new URL(cleanedLink);
                        // Additional validation: must have http/https protocol
                        if (validUrl.protocol === 'http:' || validUrl.protocol === 'https:') {
                            product.link = cleanedLink;
                        } else {
                            logger.warn('Invalid protocol in URL', { protocol: validUrl.protocol, link: cleanedLink });
                            // Try to fix by prepending https
                            product.link = 'https://' + cleanedLink.replace(/^[^:]+:\/\//, '');
                        }
                    } catch (e) {
                        logger.warn('Invalid URL after cleaning', { original: product.link, cleaned: cleanedLink });
                        // Still use it if it looks like it might be a valid URL
                        if (cleanedLink.includes('/dp/') || cleanedLink.includes('/p/') || cleanedLink.includes('/gp/')) {
                            product.link = cleanedLink;
                        } else {
                            // Skip this product if link is truly invalid
                            product.link = '';
                        }
                    }
                } catch (e) {
                    logger.warn('Failed to clean or convert product URL', { link: product.link, error: e.message });
                    // Keep original link as fallback
                }
            }

            // Filter out invalid products - must have both title and link
            if (product.title && product.title.trim() && product.link && product.link.trim()) {
                products.push(product);
            } else {
                logger.debug('Skipping invalid product', { 
                    hasTitle: !!product.title, 
                    hasLink: !!product.link,
                    title: product.title?.substring(0, 50),
                    link: product.link?.substring(0, 80)
                });
            }
        } catch (error) {
            logger.warn('Failed to extract product', { error: error.message, index });
        }
    });

    logger.debug(`Extracted ${products.length} products from search results`);
    return products;
}

/**
 * Click on a product from search results
 */
export async function clickProduct(productLink, options = {}) {
    try {
        logger.info('Clicking product', { link: productLink });

        // If productLink is a URL, navigate directly
        if (productLink.startsWith('http')) {
            globalThis.location.href = productLink;
            return;
        }

        // Otherwise, find and click the element
        const productElement = await findElement(productLink, options);
        await safeClick(productElement);

        logger.info('Product clicked');
        return true;
    } catch (error) {
        logger.error('Failed to click product', error);
        throw error;
    }
}

/**
 * Add product to cart
 */
export async function addToCart(addToCartSelectors, options = {}) {
    try {
        logger.info('Adding product to cart');

        const addToCartButton = await findElement(addToCartSelectors.button, {
            maxRetries: options.maxRetries || 3,
        });

        await scrollIntoView(addToCartButton);
        await safeClick(addToCartButton, {
            waitForClickable: true,
        });

        logger.info('Product added to cart');
        return true;
    } catch (error) {
        logger.error('Failed to add to cart', error);
        throw error;
    }
}

/**
 * Click buy now button
 */
export async function clickBuyNow(buyNowSelectors, options = {}) {
    try {
        logger.info('Clicking Buy Now');

        const buyNowButton = await findElement(buyNowSelectors.button, {
            maxRetries: options.maxRetries || 5,
            initialDelay: options.initialDelay || 1000,
        });

        // Scroll into view with more options
        await scrollIntoView(buyNowButton, {
            behavior: 'smooth',
            block: 'center',
            delay: 1000
        });

        // Wait for button to be visible and enabled
        const waitTimeout = options.waitTimeout || 10000;
        const startTime = Date.now();
        while (Date.now() - startTime < waitTimeout) {
            const rect = buyNowButton.getBoundingClientRect();
            const style = globalThis.getComputedStyle(buyNowButton);
            const isVisible = rect.width > 0 && rect.height > 0 && 
                            style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            style.opacity !== '0';
            const isEnabled = !buyNowButton.disabled && 
                            !buyNowButton.hasAttribute('aria-disabled') ||
                            buyNowButton.getAttribute('aria-disabled') !== 'true';
            
            if (isVisible && isEnabled) {
                logger.info('Buy Now button is visible and enabled');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Try multiple click methods
        let clicked = false;
        
        // Method 1: Direct click
        try {
            buyNowButton.click();
            clicked = true;
            logger.info('Buy Now clicked using direct click');
        } catch (e) {
            logger.warn('Direct click failed, trying dispatchEvent', { error: e.message });
        }

        // Method 2: Mouse event
        if (!clicked) {
            try {
                buyNowButton.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: globalThis
                }));
                clicked = true;
                logger.info('Buy Now clicked using MouseEvent');
            } catch (e) {
                logger.warn('MouseEvent click failed, trying safeClick', { error: e.message });
            }
        }

        // Method 3: Use safeClick utility
        if (!clicked) {
            await safeClick(buyNowButton, {
                waitForClickable: true,
                waitTimeout: waitTimeout,
                useDispatchEvent: true
            });
            clicked = true;
            logger.info('Buy Now clicked using safeClick');
        }

        // Wait a bit to ensure click was processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        logger.info('Buy Now clicked successfully');
        return true;
    } catch (error) {
        logger.error('Failed to click Buy Now', error);
        throw error;
    }
}

/**
 * Apply filters to search results
 */
export async function applyFilters(filters, filterSelectors, options = {}) {
    try {
        logger.info('Applying filters', { filters });

        for (const [filterType, filterValue] of Object.entries(filters)) {
            if (!filterSelectors[filterType]) {
                logger.warn(`No selector found for filter: ${filterType}`);
                continue;
            }

            try {
                const filterElement = await findElement(filterSelectors[filterType].container);
                
                if (filterSelectors[filterType].type === 'checkbox') {
                    const checkbox = filterElement.querySelector(`[value="${filterValue}"]`);
                    if (checkbox && !checkbox.checked) {
                        await safeClick(checkbox);
                    }
                } else if (filterSelectors[filterType].type === 'dropdown') {
                    await selectOption(filterSelectors[filterType].container, filterValue);
                } else if (filterSelectors[filterType].type === 'range') {
                    // Handle price range or other range filters
                    const minInput = filterElement.querySelector(filterSelectors[filterType].min);
                    const maxInput = filterElement.querySelector(filterSelectors[filterType].max);
                    
                    if (filterValue.min && minInput) {
                        await fillInput(minInput, filterValue.min.toString());
                    }
                    if (filterValue.max && maxInput) {
                        await fillInput(maxInput, filterValue.max.toString());
                    }
                }

                logger.debug(`Filter applied: ${filterType}`, { value: filterValue });
            } catch (error) {
                logger.warn(`Failed to apply filter: ${filterType}`, { error: error.message });
            }
        }

        return true;
    } catch (error) {
        logger.error('Failed to apply filters', error);
        throw error;
    }
}

/**
 * Select option from dropdown (helper function)
 */
async function selectOption(selector, value) {
    const element = await findElement(selector);
    if (element.tagName === 'SELECT') {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Discover available filters on the current search results page semantically
 * @returns {Promise<Object>} Map of filter labels to their control elements
 */
export async function discoverAvailableFilters() {
    try {
        logger.info('Discovering available filters on page...');
        const discoveredFilters = {};

        // 1. Identify common filter containers
        const filterContainers = document.querySelectorAll([
            '#s-refinements', // Amazon sidebar
            '._1AtVbE', // Flipkart sidebar
            '._1KO7_1', // Flipkart filter sidebar
            '._36fx1h', // Flipkart filter section
            '#layered-nav-container',
            '.filters-container',
            '.filter-section',
            '.sidebar-filter',
            '[aria-label*="filter" i]',
            '[aria-label*="refinement" i]',
            '.refinement-section',
            '#filters',
            '#refinements',
            '.search-left-nav',
            'aside'
        ].join(', '));

        if (filterContainers.length === 0) {
            logger.warn('No common filter containers found, trying to find any refinement section');
            const anyRefinement = document.querySelectorAll('[id*="refinement" i], [class*="refinement" i], [id*="filter" i], [class*="filter" i]');
            if (anyRefinement.length > 0) {
                logger.info(`Found ${anyRefinement.length} potential refinement elements`);
            }
        }

        // Expand "See more" links if they exist to find more filters
        // Only do this once per page to avoid infinite loops or excessive reloads
        if (!globalThis._filtersExpanded) {
            logger.info('Expanding collapsed filter sections...');
            
            // Find all possible expander elements
            const expanderSelectors = [
                'a[aria-expanded="false"]',
                'button[aria-expanded="false"]',
                '.s-expander-button',
                '._2Go1ky', // Flipkart
                '[class*="see-more" i]',
                '[class*="show-more" i]',
                '[class*="view-more" i]',
                '[class*="expand" i]',
                'a[href="#"]', // Generic show more links
                'button[type="button"]' // Generic expand buttons
            ];
            
            const expanders = document.querySelectorAll(expanderSelectors.join(', '));
            let expandedCount = 0;
            
            for (const expander of expanders) {
                try {
                    const text = getText(expander).toLowerCase();
                    const isExpanderLink = text.includes('more') || 
                                          text.includes('see all') || 
                                          text.includes('show all') ||
                                          text.includes('view all') ||
                                          text.includes('expand') ||
                                          expander.getAttribute('aria-expanded') === 'false';
                    
                    if (isExpanderLink) {
                        // Check if it's in a filter context
                        const parent = expander.closest('#s-refinements, aside, .sidebar, [class*="filter"], [class*="refinement"]');
                        if (parent) {
                            logger.debug('Expanding filter section', { text: text.substring(0, 50) });
                            
                            // Scroll into view first
                            expander.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await new Promise(resolve => setTimeout(resolve, 200));
                            
                            // Try clicking with safeClick
                            try {
                                await safeClick(expander, {
                                    waitForClickable: true,
                                    retries: 2,
                                    retryDelay: 300,
                                    useMultipleStrategies: true
                                });
                                
                                // Wait for expansion animation to complete
                                await new Promise(resolve => setTimeout(resolve, 500));
                                
                                // Verify expansion succeeded
                                const ariaExpanded = expander.getAttribute('aria-expanded');
                                if (ariaExpanded === 'true') {
                                    logger.debug('Filter section expanded successfully');
                                    expandedCount++;
                                }
                            } catch (clickError) {
                                logger.debug('Failed to expand filter section', { 
                                    error: clickError.message,
                                    text: text.substring(0, 50)
                                });
                            }
                        }
                    }
                } catch (e) {
                    logger.debug('Error processing expander', { error: e.message });
                }
            }
            
            if (expandedCount > 0) {
                logger.info(`Expanded ${expandedCount} filter sections`);
                // Wait a moment for all expansions to settle
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            globalThis._filtersExpanded = true;
        }

        filterContainers.forEach(container => {
            // 2. Identify filter groups within the container
            const groups = container.querySelectorAll([
                'div[id^="p_"]', // Amazon specific
                '.a-section.a-spacing-none',
                'section',
                '.filter-group',
                'div[class*="filter-group" i]',
                'div[class*="refinement-group" i]',
                'div[class*="filter-section" i]',
                'div[class*="facet" i]', // common in ecommerce
                '._213e_G', // Flipkart specific
                '._2hb093',
                'div:has(> span.a-text-bold)',
                'div:has(> h3)',
                'div:has(> h4)',
                'div:has(> ._3V_o9G)'
            ].join(', '));

            groups.forEach(group => {
                const header = group.querySelector('span.a-text-bold, h3, h4, h5, ._3V_o9G, [class*="header" i], [class*="title" i], b, strong');
                let label = getText(header).trim().toLowerCase();
                
                if (!label) {
                    label = group.getAttribute('aria-label') || group.id || '';
                    label = label.replace(/[_-]/g, ' ').toLowerCase();
                }

                if (label && label.length > 2) {
                    // Clean label (remove numbers, counts etc.)
                    label = label.replace(/\(\d+\)/g, '').trim();

                    if (!discoveredFilters[label]) {
                        discoveredFilters[label] = {
                            elements: [],
                            group: group,
                            type: 'selection' // default
                        };
                    }

                    // Check if it's a range filter (price)
                    const inputs = group.querySelectorAll('input[type="number"], input[type="text"]');
                    if (inputs.length >= 2) {
                        discoveredFilters[label].type = 'range';
                        discoveredFilters[label].inputs = Array.from(inputs);
                        discoveredFilters[label].goButton = group.querySelector('input[type="submit"], button, .a-button-input, [class*="go" i]');
                    }

                    // 3. Find interactive elements
                    const items = group.querySelectorAll('a, input[type="checkbox"], input[type="radio"], label, button, [role="button"], span[class*="refinement"]');
                    items.forEach(item => {
                        const itemText = getText(item).trim();
                        if (itemText) {
                            const itemTextLower = itemText.toLowerCase();
                            
                            // Enhanced detection for battery capacity filters (mAh)
                            const batteryMatch = itemText.match(/(\d+)\s*(?:mah|mAh|battery)/i);
                            const isBattery = batteryMatch !== null;
                            
                            // Enhanced detection for RAM filters (GB)
                            const ramMatch = itemText.match(/(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory)/i);
                            const isRAM = ramMatch !== null || (itemTextLower.includes('gb') && (itemTextLower.includes('ram') || itemTextLower.includes('memory')));
                            
                            // Enhanced detection for storage filters
                            const storageMatch = itemText.match(/(\d+)\s*(?:gb|tb|gigabytes?|terabytes?)\s*(?:storage|ssd|hdd|hard\s*disk)/i);
                            const isStorage = storageMatch !== null;
                            
                            discoveredFilters[label].elements.push({
                                text: itemTextLower,
                                element: item,
                                // Identify if it's a rating filter (e.g., "4 stars & up")
                                isRating: itemText.includes('★') || /^\d\s*stars?/i.test(itemText) || item.querySelector('.a-icon-star') || item.querySelector('[class*="star" i]'),
                                // Enhanced attribute detection
                                isBattery,
                                isRAM,
                                isStorage,
                                batteryValue: batteryMatch ? parseInt(batteryMatch[1]) : null,
                                ramValue: ramMatch ? parseInt(ramMatch[1]) : null,
                                storageValue: storageMatch ? parseInt(storageMatch[1]) : null
                            });
                        }
                    });
                }
            });
        });

        logger.info('Filters discovery completed', { 
            foundCategories: Object.keys(discoveredFilters) 
        });
        return discoveredFilters;
    } catch (error) {
        logger.error('Filter discovery failed', error);
        return {};
    }
}

/**
 * Sort search results
 */
export async function sortResults(sortOption, sortSelectors, options = {}) {
    try {
        logger.info('Sorting results', { sortOption });

        await findElement(sortSelectors.dropdown, {
            maxRetries: options.maxRetries || 2,
        });

        await selectOption(sortSelectors.dropdown, sortOption);
        
        // Wait for results to reload
        await new Promise(resolve => setTimeout(resolve, options.waitAfterSort || 2000));

        logger.info('Results sorted');
        return true;
    } catch (error) {
        logger.error('Failed to sort results', error);
        throw error;
    }
}

/**
 * Get simplified page content for LLM analysis
 */
export async function getSimplifiedPageContent(platformName) {
    // Check DOM availability
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        logger.error('DOM not available in current context');
        return JSON.stringify({ 
            error: 'DOM not available',
            platform: platformName,
            products: [],
            filters: [],
            buttons: [],
            inputs: []
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    try {
        const content = {
            title: document.title || '',
            url: window.location?.href || '',
            platform: platformName,
            products: [],
            filters: [],
            buttons: [],
            inputs: []
        };

        // 1. Extract Products (top 20 for brevity)
        try {
            const productSelectors = {
                amazon: {
                    container: '[data-asin]:not([data-asin=""])',
                    title: 'h2 a span, h2 a',
                    price: '.a-price .a-offscreen',
                    link: 'h2 a[href]'
                },
                flipkart: {
                    container: 'div[data-id], ._1AtVbE',
                    title: '._4rR01T, a.IRpwTa',
                    price: '._30jeq3',
                    link: 'a[href*="/p/"]'
                }
            }[platformName] || {
                container: '.s-result-item, .product-item',
                title: 'h2, .title',
                price: '.price',
                link: 'a[href]'
            };

            const products = extractProducts(productSelectors.container, productSelectors);
            content.products = products.slice(0, 20).map(p => {
                try {
                    return {
                        title: p.title || '',
                        price: p.price || '',
                        priceNumeric: parsePrice(p.price || ''),
                        link: p.link || '',
                        image: p.image || '',
                        rating: p.rating || '',
                        reviews: p.reviews || '',
                        // Extract basic attributes from title for LLM
                        titleLower: (p.title || '').toLowerCase()
                    };
                } catch (err) {
                    logger.warn('Failed to process product', { error: err.message });
                    return null;
                }
            }).filter(p => p !== null);
        } catch (err) {
            logger.warn('Failed to extract products for page content', { error: err.message });
        }

        // 2. Extract Filters
        try {
            const availableFilters = await discoverAvailableFilters();
            for (const [label, info] of Object.entries(availableFilters)) {
                try {
                    content.filters.push({
                        category: label,
                        options: info.elements.slice(0, 5).map(e => e.text || '')
                    });
                } catch (err) {
                    logger.warn('Failed to process filter', { label, error: err.message });
                }
            }
        } catch (err) {
            logger.warn('Failed to discover filters for page content', { error: err.message });
        }

        // 3. Extract Primary Buttons
        try {
            const buttonSelectors = [
                'button', 'a.button', '[role="button"]', 
                'input[type="submit"]', 'input[type="button"]',
                '#buy-now-button', '#add-to-cart-button', '._2KpZ6l'
            ];
            const buttons = document.querySelectorAll(buttonSelectors.join(','));
            buttons.forEach(btn => {
                try {
                    const text = getText(btn).trim();
                    if (text && text.length > 2 && text.length < 30) {
                        const id = btn.id ? `#${btn.id}` : '';
                        const className = btn.className ? `.${btn.className.split(' ').join('.')}` : '';
                        content.buttons.push({
                            text: text.toLowerCase(),
                            selector: id || className || btn.tagName.toLowerCase()
                        });
                    }
                } catch (err) {
                    logger.debug('Failed to process button', { error: err.message });
                }
            });
        } catch (err) {
            logger.warn('Failed to extract buttons for page content', { error: err.message });
        }

        // 4. Extract Visible Inputs
        try {
            const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
            inputs.forEach(input => {
                try {
                    if (input.offsetParent !== null) {
                        content.inputs.push({
                            name: input.name || input.id || 'unknown',
                            placeholder: input.placeholder || '',
                            selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`
                        });
                    }
                } catch (err) {
                    logger.debug('Failed to process input', { error: err.message });
                }
            });
        } catch (err) {
            logger.warn('Failed to extract inputs for page content', { error: err.message });
        }

        return JSON.stringify(content, null, 2);
    } catch (error) {
        logger.error('Failed to get simplified page content', error);
        // Return partial content structure even on error
        return JSON.stringify({ 
            error: error.message,
            platform: platformName,
            title: document?.title || '',
            url: window?.location?.href || '',
            products: [],
            filters: [],
            buttons: [],
            inputs: []
        });
    }
}


