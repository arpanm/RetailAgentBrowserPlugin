/**
 * Amazon Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, sortResults, discoverAvailableFilters } from '../shared/actions.js';
import { getText, waitForCondition, safeClick, fillInput } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';
import { buildAmazonFilterURL, verifyFiltersInURL, extractRhParameter } from '../../lib/amazon-url-filter-builder.js';
import { isSponsoredProduct } from '../../lib/sponsored-detector.js';

export class AmazonPlatform extends EcommercePlatform {
    constructor() {
        super('amazon', {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
            selectors: {
                search: {
                    input: '#twotabsearchtextbox',
                    button: 'input[type="submit"][value="Go"]',
                    form: 'form.nav-searchbar',
                },
                results: {
                    container: [
                        '[data-asin]:not([data-asin=""])',
                        '[data-component-type="s-search-result"]',
                        '.s-result-item'
                    ],
                    title: 'h2 a span, h2 a, [data-cy="title-recipe"] h2 span',
                    link: 'h2 a[href*="/dp/"], h2 a[href*="/gp/product/"], .a-link-normal[href*="/dp/"]',
                    price: '.a-price .a-offscreen, .a-price',
                    rating: '.a-icon-alt, .a-star-rating',
                    image: '.s-image',
                },
                product: {
                    buyNow: [
                        '#buy-now-button',
                        '#sc-buy-box-ptc-button',
                        '[name="submit.buy-now"]',
                        '[data-action="buy-now"]',
                        'input[name="submit.buy-now"]',
                        '#buyNow_feature_div input',
                        '#buy-now-button-announce',
                        '.buy-now-button',
                        '#buybox input[value*="Buy Now"]'
                    ],
                    addToCart: '#add-to-cart-button, #add-to-cart-button-ubb',
                    title: '#productTitle',
                    price: '.a-price .a-offscreen, .a-price-whole',
                },
                checkout: {
                    address: '#address-book-entry-0, [data-action="select-shipping-address"]',
                    continue: 'input[name="shipToThisAddress"], [data-action="continue"]',
                    payment: '#payment-button, [data-action="select-payment-method"]',
                    placeOrder: '#placeYourOrder, [name="placeYourOrder1"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Amazon: Performing search', { query, filters, sort });
            
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });

            // Wait for search results to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Apply filters if provided
            if (Object.keys(filters).length > 0) {
                await this.applyFilters(filters);
            }

            // Apply sort if provided
            if (sort) {
                await this.sortResults(sort);
            }

            return true;
        } catch (error) {
            logger.error('Amazon: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('Amazon: Extracting products from page');
            let allContainers = [];
            
            // Try different result selectors if primary one fails
            const resultSelectors = Array.isArray(this.selectors.results.container) 
                ? this.selectors.results.container 
                : [this.selectors.results.container];

            for (const selector of resultSelectors) {
                try {
                    const containers = document.querySelectorAll(selector);
                    if (containers.length > 0) {
                        allContainers = Array.from(containers);
                        logger.info(`Amazon: Found ${allContainers.length} product containers with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    logger.debug(`Amazon: Selector ${selector} failed`);
                }
            }

            if (allContainers.length === 0) {
                logger.warn('Amazon: No product containers found');
                return [];
            }

            // Filter out sponsored products FIRST
            const organicContainers = [];
            const sponsoredContainers = [];
            
            for (const container of allContainers) {
                if (isSponsoredProduct(container, 'amazon')) {
                    sponsoredContainers.push(container);
                } else {
                    organicContainers.push(container);
                }
            }
            
            logger.info('Amazon: Filtered sponsored products', {
                total: allContainers.length,
                organic: organicContainers.length,
                sponsored: sponsoredContainers.length
            });

            // Extract products from organic containers only
            const products = [];
            
            for (let i = 0; i < organicContainers.length; i++) {
                const container = organicContainers[i];
                
                try {
                    // Extract title
                    const titleSelectors = Array.isArray(this.selectors.results.title) 
                        ? this.selectors.results.title 
                        : [this.selectors.results.title];
                    let title = '';
                    for (const sel of titleSelectors) {
                        const titleEl = container.querySelector(sel);
                        if (titleEl) {
                            title = titleEl.textContent?.trim() || '';
                            if (title) break;
                        }
                    }
                    
                    // Extract link
                    const linkSelectors = Array.isArray(this.selectors.results.link) 
                        ? this.selectors.results.link 
                        : [this.selectors.results.link];
                    let link = '';
                    for (const sel of linkSelectors) {
                        const linkEl = container.querySelector(sel);
                        if (linkEl) {
                            link = linkEl.getAttribute('href') || '';
                            if (link) {
                                // Ensure absolute URL
                                if (!link.startsWith('http')) {
                                    link = `https://www.amazon.in${link}`;
                                }
                                break;
                            }
                        }
                    }
                    
                    // Extract price
                    const priceSelectors = Array.isArray(this.selectors.results.price) 
                        ? this.selectors.results.price 
                        : [this.selectors.results.price];
                    let price = '';
                    for (const sel of priceSelectors) {
                        const priceEl = container.querySelector(sel);
                        if (priceEl) {
                            price = priceEl.textContent?.trim() || '';
                            if (price) break;
                        }
                    }
                    
                    // Extract image
                    const imageEl = container.querySelector(this.selectors.results.image);
                    const image = imageEl?.src || '';
                    
                    // Extract rating
                    const ratingEl = container.querySelector(this.selectors.results.rating);
                    const rating = ratingEl?.textContent?.trim() || '';
                    
                    // Extract ASIN
                    const asin = container.getAttribute('data-asin') || '';
                    
                    // Only add if has essential fields
                    // Extract delivery information
                    let delivery = null;
                    try {
                        const deliverySelectors = [
                            '.s-result-item [data-cy="delivery-recipe"] span',
                            '.s-result-item .a-text-bold:contains("Get it")',
                            '.s-result-item span:contains("FREE delivery")',
                            '.s-result-item span:contains("Delivery")',
                            '.s-result-item .a-color-base.a-text-bold'
                        ];
                        
                        for (const sel of deliverySelectors) {
                            const deliveryElem = container.querySelector(sel);
                            if (deliveryElem && deliveryElem.textContent) {
                                const text = deliveryElem.textContent.trim();
                                if (text.toLowerCase().includes('deliver') || 
                                    text.toLowerCase().includes('get it') ||
                                    text.match(/\d+\s*(day|week)/i)) {
                                    delivery = text;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        logger.debug('Failed to extract delivery', e);
                    }
                    
                    // Extract availability information
                    let availability = 'Unknown';
                    try {
                        const availabilitySelectors = [
                            '.s-result-item .a-size-base.a-color-base',
                            '.s-result-item .a-size-base.a-color-price',
                            '.s-result-item span.a-color-success',
                            '.s-result-item span.a-color-state'
                        ];
                        
                        for (const sel of availabilitySelectors) {
                            const availElem = container.querySelector(sel);
                            if (availElem && availElem.textContent) {
                                const text = availElem.textContent.trim().toLowerCase();
                                if (text.includes('in stock') || text.includes('available')) {
                                    availability = 'In Stock';
                                    break;
                                } else if (text.includes('out of stock') || text.includes('unavailable')) {
                                    availability = 'Out of Stock';
                                    break;
                                } else if (text.includes('only') && text.includes('left')) {
                                    availability = 'Limited Stock';
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        logger.debug('Failed to extract availability', e);
                    }
                    
                    if (title && link) {
                        products.push({
                            index: i,
                            title,
                            price,
                            link,
                            image,
                            rating,
                            reviews: '',
                            asin,
                            sponsored: false,
                            delivery,
                            availability,
                            platform: 'amazon'
                        });
                    }
                } catch (error) {
                    logger.debug(`Amazon: Failed to extract product ${i}`, error);
                }
            }

            logger.info(`Amazon: Successfully extracted ${products.length} organic products`);
            
            return products;
        } catch (error) {
            logger.error('Amazon: Failed to get search results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        try {
            const products = await this.getSearchResults();
            if (products.length === 0) {
                throw new Error('No products found to select');
            }
            if (productIndex >= products.length) {
                throw new Error(`Product index ${productIndex} out of range (max ${products.length - 1})`);
            }

            const product = products[productIndex];
            logger.info('Amazon: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            // Check if link is valid
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            await clickProduct(product.link);
            return product;
        } catch (error) {
            logger.error('Amazon: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('Amazon: Adding to cart');
            await addToCart({
                button: this.selectors.product.addToCart,
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('Amazon: Clicking Buy Now');
            
            // Try multiple selectors with increased retries and wait time
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            let lastError = null;
            for (const selector of selectors) {
                try {
                    logger.info(`Amazon: Trying Buy Now selector: ${selector}`);
                    await clickBuyNow({
                        button: selector,
                    }, {
                        maxRetries: 5,
                        initialDelay: 1000,
                        waitTimeout: 10000
                    });
                    logger.info('Amazon: Buy Now clicked successfully');
                    return true;
                } catch (error) {
                    logger.warn(`Amazon: Selector ${selector} failed`, { error: error.message });
                    lastError = error;
                    continue;
                }
            }
            
            // If all selectors failed, throw the last error
            throw lastError || new Error('All Buy Now selectors failed');
        } catch (error) {
            logger.error('Amazon: Failed to click Buy Now', error);
            throw error;
        }
    }

    async getProductDetails() {
        try {
            const title = getText(document.querySelector(this.selectors.product.title));
            const price = getText(document.querySelector(this.selectors.product.price));
            
            return {
                title,
                price,
                url: globalThis.location.href,
            };
        } catch (error) {
            logger.error('Amazon: Failed to get product details', error);
            throw error;
        }
    }

    async applyFilters(filters) {
        try {
            logger.info('Amazon: Applying filters (URL-based method)', { filters });
            
            if (!filters || Object.keys(filters).length === 0) {
                logger.info('Amazon: No filters to apply');
                return true;
            }
            
            // Wait for page to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const initialUrl = globalThis.location.href;
            const initialProductCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
            
            logger.info('Amazon: Initial state', {
                url: initialUrl,
                productCount: initialProductCount
            });
            
            // METHOD 1: URL-based filter application (PRIMARY - MOST RELIABLE)
            const MAX_URL_RETRIES = 3;
            let urlMethodSuccess = false;
            
            for (let attempt = 1; attempt <= MAX_URL_RETRIES; attempt++) {
                try {
                    logger.info(`Amazon: Attempting URL-based filter application (attempt ${attempt}/${MAX_URL_RETRIES})`);
                    
                    // Build filtered URL
                    const filteredURL = buildAmazonFilterURL(initialUrl, filters);
                    
                    if (filteredURL === initialUrl) {
                        logger.warn('Amazon: No valid filters to apply via URL');
                        break;
                    }
                    
                    logger.info('Amazon: Navigating to filtered URL', { filteredURL });
                    
                    // Navigate to filtered URL
                    globalThis.location.href = filteredURL;
                    
                    // Wait for navigation and page load
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Wait for loading indicators to disappear
                    await this._waitForPageStable();
                    
                    // Verify filters were applied
                    const verification = await this._verifyFiltersApplied(filters, initialProductCount);
                    
                    if (verification.success) {
                        logger.info('Amazon: URL-based filter application succeeded', verification);
                        urlMethodSuccess = true;
                        return true;
                    } else {
                        logger.warn(`Amazon: URL-based filter verification failed (attempt ${attempt})`, verification);
                        
                        if (attempt < MAX_URL_RETRIES) {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                } catch (error) {
                    logger.error(`Amazon: URL-based filter application error (attempt ${attempt})`, error);
                }
            }
            
            // METHOD 2: DOM-based filter application (FALLBACK)
            if (!urlMethodSuccess) {
                logger.warn('Amazon: URL-based method failed, falling back to DOM clicking');
                return await this._applyFiltersDOMMethod(filters, initialUrl, initialProductCount);
            }
            
            return true;
            
        } catch (error) {
            logger.error('Amazon: Filter application failed', error);
            return false;
        }
    }

    /**
     * Wait for page to be stable after filter application
     */
    async _waitForPageStable() {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            // Check for loading indicators
            const loadingIndicator = document.querySelector('.s-loading, [class*="loading"], [aria-busy="true"], .s-spinner');
            const isLoading = loadingIndicator && loadingIndicator.offsetParent !== null;
            
            if (!isLoading) {
                // No loading indicator, wait a bit more to ensure stability
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Double-check
                const stillLoading = document.querySelector('.s-loading, [class*="loading"], [aria-busy="true"], .s-spinner');
                if (!stillLoading || stillLoading.offsetParent === null) {
                    logger.debug('Amazon: Page is stable');
                    return;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        logger.warn('Amazon: Page stability timeout reached');
    }

    /**
     * Verify that filters were applied successfully
     */
    async _verifyFiltersApplied(filters, initialProductCount) {
        const currentURL = globalThis.location.href;
        const currentProductCount = document.querySelectorAll('[data-asin]:not([data-asin=""])').length;
        
        // Check 1: URL contains rh parameter
        const rhParam = extractRhParameter(currentURL);
        const hasRhParam = !!rhParam;
        
        // Check 2: Product count changed
        const productCountChanged = currentProductCount !== initialProductCount;
        
        // Check 3: Active filter badges in DOM
        const activeFilterBadges = document.querySelectorAll('.a-badge-label, .s-navigation-item-active');
        const hasActiveFilters = activeFilterBadges.length > 0;
        
        // Check 4: Filter chips/clear link present
        const clearFilterLink = document.querySelector('[aria-label*="Clear filters"], .s-navigation-clear-link');
        const hasClearLink = !!clearFilterLink;
        
        const success = hasRhParam || (productCountChanged && (hasActiveFilters || hasClearLink));
        
        return {
            success,
            currentURL,
            rhParam,
            hasRhParam,
            initialProductCount,
            currentProductCount,
            productCountChanged,
            hasActiveFilters,
            hasClearLink,
            activeFilterCount: activeFilterBadges.length
        };
    }

    /**
     * Fallback: Apply filters using DOM clicking method
     */
    async _applyFiltersDOMMethod(filters, initialUrl, initialProductCount) {
        try {
            logger.info('Amazon: Applying filters via DOM clicking');
            
            globalThis.scrollTo(0, 0);

            // 1. Handle Price Range (usually inputs, high priority)
            if (filters.price_min || filters.price_max) {
                try {
                    const priceContainer = document.querySelector('#p_36, [aria-label*="price" i], .a-section[aria-label*="Price" i]');
                    if (priceContainer) {
                        const minInput = priceContainer.querySelector('input[name="low-price"], input[placeholder*="Min"]');
                        const maxInput = priceContainer.querySelector('input[name="high-price"], input[placeholder*="Max"]');
                        
                        if (minInput && filters.price_min) {
                            await fillInput(minInput, filters.price_min.toString());
                        }
                        if (maxInput && filters.price_max) {
                            await fillInput(maxInput, filters.price_max.toString());
                        }
                        
                        const goButton = priceContainer.querySelector('input[type="submit"], button, .a-button-input');
                        if (goButton) {
                            logger.info('Amazon: Clicking price filter Go button');
                            await safeClick(goButton);
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            await this._waitForPageStable();
                        }
                    }
                } catch (e) { 
                    logger.warn('Amazon: Price filter failed', e); 
                }
            }

            // 2. Discover and apply other filters dynamically
            let availableFilters = await discoverAvailableFilters();
            
            // Prioritize filters: rating > battery > ram > storage
            const keys = Object.keys(filters).sort((a, b) => {
                const priority = { rating: 0, battery: 1, ram: 2, storage: 3, brand: 4 };
                return (priority[a] ?? 999) - (priority[b] ?? 999);
            });

            for (const key of keys) {
                const value = filters[key];
                if (!value || key.startsWith('price')) continue;

                const targetLabels = [];
                if (key === 'brand') targetLabels.push('brand', 'brands', 'brand name');
                if (key === 'ram') targetLabels.push('ram', 'memory', 'internal memory', 'computer memory size', 'system memory');
                if (key === 'storage') targetLabels.push('storage', 'internal storage', 'ssd capacity', 'hard disk size');
                if (key === 'battery') targetLabels.push('battery', 'battery capacity', 'battery power', 'mah', 'mAh');
                if (key === 'rating') targetLabels.push('customer review', 'avg. customer review', 'customer ratings', 'avg customer review');
                if (key === 'color') targetLabels.push('color', 'colour');

                let filterGroup = null;
                for (const label of targetLabels) {
                    if (availableFilters[label]) {
                        filterGroup = availableFilters[label];
                        break;
                    }
                }

                if (filterGroup) {
                    const valueStr = value.toString().toLowerCase();
                    const cleanValue = valueStr.replace(/(\d+)([a-z]+)/, '$1 $2');
                    const numericValue = parseInt(valueStr.replace(/[^\d]/g, ''));
                    
                    const target = filterGroup.elements.find(el => {
                        const itemText = el.text.toLowerCase();
                        const itemTextClean = itemText.replace(/\s+/g, '');
                        const valueClean = valueStr.replace(/\s+/g, '');
                        
                        // Enhanced matching for RAM
                        if (key === 'ram' && el.isRAM && el.ramValue) {
                            const requiredRAM = parseInt(valueStr.replace(/gb/i, ''));
                            return el.ramValue >= requiredRAM;
                        }
                        
                        // Enhanced matching for battery
                        if (key === 'battery' && el.isBattery && el.batteryValue) {
                            return el.batteryValue >= numericValue;
                        }
                        
                        // Enhanced matching for storage
                        if (key === 'storage' && el.isStorage && el.storageValue) {
                            const requiredStorage = parseInt(valueStr.replace(/gb|tb/i, ''));
                            return el.storageValue >= requiredStorage;
                        }
                        
                        // Enhanced matching for rating
                        if (key === 'rating') {
                            const ratingMatch = itemText.match(/(\d+)/);
                            if (ratingMatch) {
                                const itemRating = parseInt(ratingMatch[1]);
                                return itemRating >= numericValue;
                            }
                        }
                        
                        // Standard text matching
                        return itemText.includes(valueStr) || 
                               itemText.includes(cleanValue) || 
                               itemTextClean.includes(valueClean) ||
                               (key === 'ram' && itemText.includes(valueStr.replace('gb', '')) && itemText.includes('gb')) ||
                               (key === 'battery' && numericValue && itemText.includes(numericValue.toString()));
                    });

                    if (target) {
                        logger.info(`Amazon: Clicking discovered filter ${key} -> ${target.text}`);
                        
                        const prevUrl = globalThis.location.href;
                        await safeClick(target.element);
                        
                        // Wait for page update
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await this._waitForPageStable();

                        // Rediscover after application as DOM changes
                        availableFilters = await discoverAvailableFilters();
                    } else {
                        logger.warn(`Amazon: No matching element found for filter ${key} -> ${value}`);
                    }
                }
            }
            
            // Final verification
            const verification = await this._verifyFiltersApplied(filters, initialProductCount);
            logger.info('Amazon: DOM-based filter application completed', verification);
            
            return verification.success;
            
        } catch (error) {
            logger.error('Amazon: DOM-based filter application failed', error);
            return false;
        }
    }

    async sortResults(sortOption) {
        try {
            await sortResults(sortOption, {
                dropdown: '#s-result-sort-select',
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to sort results', error);
            throw error;
        }
    }
}

