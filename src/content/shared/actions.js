/**
 * Shared action utilities for common ecommerce operations
 */

import { logger } from '../../lib/logger.js';
import { findElement, safeClick, fillInput, scrollIntoView, getText } from './selectors.js';

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
                const validContainers = Array.from(found).filter(el => {
                    // Quick check if it's a likely product container
                    const text = el.textContent || el.innerText || '';
                    return el.querySelector('a') && (text.length > 5);
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
            // Get link element - try multiple approaches
            const linkSelectors = Array.isArray(productSelectors.link) 
                ? productSelectors.link 
                : [productSelectors.link];
            
            let linkElement = null;
            for (const linkSelector of linkSelectors) {
                linkElement = container.querySelector(linkSelector);
                if (linkElement) break;
            }
            
            // If still not found, try common patterns
            if (!linkElement) {
                linkElement = container.querySelector('a[href*="/p/"], a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/product/"]');
            }
            if (!linkElement) {
                linkElement = container.querySelector('h2 a, h3 a, a');
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
                link: linkElement?.href || linkElement?.getAttribute('href') || '',
                image: imageElement?.src || imageElement?.getAttribute('src') || '',
                rating: getText(container.querySelector(productSelectors.rating)),
                reviews: getText(container.querySelector(productSelectors.reviews)),
            };

            // Ensure link is absolute URL
            if (product.link && !product.link.startsWith('http')) {
                try {
                    if (typeof globalThis !== 'undefined' && globalThis.location) {
                        product.link = new URL(product.link, globalThis.location.origin).href;
                    } else {
                        // Platform-specific fallback
                        const origin = globalThis.location?.origin || 'https://www.flipkart.com';
                        product.link = product.link.startsWith('/') 
                            ? `${origin}${product.link}` 
                            : `${origin}/${product.link}`;
                    }
                } catch (e) {
                    logger.warn('Failed to convert relative URL to absolute', { link: product.link, error: e.message });
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
            '.filter-section',
            '.sidebar-filter',
            '[aria-label*="filter" i]',
            '[aria-label*="refinement" i]',
            '.refinement-section',
            '#filters',
            '#refinements'
        ].join(', '));

        if (filterContainers.length === 0) {
            logger.warn('No common filter containers found');
            return {};
        }

        // Expanded "See more" links if they exist to find more filters
        const expanders = document.querySelectorAll('a[aria-expanded="false"], .s-expander-button, ._2Go1ky');
        for (const expander of expanders) {
            try {
                if (getText(expander).toLowerCase().includes('more')) {
                    expander.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) { /* ignore */ }
        }

        filterContainers.forEach(container => {
            // 2. Identify filter groups within the container
            const groups = container.querySelectorAll([
                'div[id^="p_"]', // Amazon specific
                '.a-section.a-spacing-none',
                'section',
                '.filter-group',
                'div[class*="filter" i]',
                'div[class*="refinement" i]',
                '._213e_G', // Flipkart specific
                '._2hb093'
            ].join(', '));

            groups.forEach(group => {
                const header = group.querySelector('span.a-text-bold, h3, h4, h5, ._3V_o9G, [class*="header" i], b, strong');
                let label = getText(header).trim().toLowerCase();
                
                if (!label) {
                    label = group.getAttribute('aria-label') || group.id || '';
                    label = label.replace(/[_-]/g, ' ').toLowerCase();
                }

                if (label && label.length > 2) {
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
                        discoveredFilters[label].goButton = group.querySelector('input[type="submit"], button, .a-button-input');
                    }

                    // 3. Find interactive elements
                    const items = group.querySelectorAll('a, input[type="checkbox"], input[type="radio"], label, button, [role="button"]');
                    items.forEach(item => {
                        const itemText = getText(item).trim();
                        if (itemText) {
                            discoveredFilters[label].elements.push({
                                text: itemText.toLowerCase(),
                                element: item,
                                // Identify if it's a rating filter (e.g., "4 stars & up")
                                isRating: itemText.includes('★') || /^\d\s*stars?/i.test(itemText) || item.querySelector('.a-icon-star')
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

