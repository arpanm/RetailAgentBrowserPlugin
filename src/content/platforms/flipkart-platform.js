/**
 * Flipkart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, sortResults, discoverAvailableFilters } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class FlipkartPlatform extends EcommercePlatform {
    constructor() {
        super('flipkart', {
            enabled: true,
            domains: ['flipkart.com'],
            selectors: {
                search: {
                    input: 'input[name="q"], input[placeholder*="Search"]',
                    button: 'button[type="submit"], .L0Z3Pu',
                },
                results: {
                    container: [
                        'div[data-id]',
                        '._1AtVbE',
                        '._2kHMtA',
                        'div.sl-so-container',
                        'div._1xHGtK',
                        'div._4ddp_z'
                    ],
                    title: [
                        '._4rR01T',
                        'a.IRpwTa',
                        'div.ygS67m',
                        'a.s1Q9rs',
                        '._2WkVRV',
                        'a[title]'
                    ],
                    link: [
                        'a.IRpwTa',
                        'a._1fQZEK',
                        'a.s1Q9rs',
                        'a[href*="/p/"]',
                        'a._2UzuFa'
                    ],
                    price: [
                        '._30jeq3',
                        '._1_WHN1',
                        '._25b18c',
                        '[class*="price"]'
                    ],
                    rating: [
                        '._3LWZlK',
                        '._2_R_DZ',
                        '[class*="rating"]'
                    ],
                    image: [
                        '._396cs4',
                        'img[src*="flipkart"]',
                        '._312yB9'
                    ],
                },
                product: {
                    buyNow: '._2KpZ6l._2U9uOA._3v1-ww, button:contains("BUY NOW")',
                    addToCart: '._2KpZ6l._2U9uOA.ihZ75k._3AWRsL, button:contains("ADD TO CART")',
                    title: '.B_NuCI',
                    price: '._30jeq3._16Jk6d',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Flipkart: Performing search', { query, filters, sort });
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
            logger.error('Flipkart: Search failed', error);
            throw error;
        }
    }

    async applyFilters(filters) {
        try {
            logger.info('Flipkart: Applying filters', { filters });
            
            if (!filters || Object.keys(filters).length === 0) {
                logger.info('Flipkart: No filters to apply');
                return true;
            }
            
            // Wait for page to fully load
            await new Promise(resolve => setTimeout(resolve, 3000));
            globalThis.scrollTo(0, 0);
            
            const initialUrl = globalThis.location.href;

            // Discover and apply filters dynamically
            let availableFilters = await discoverAvailableFilters();
            
            // Prioritize Brand
            const keys = Object.keys(filters).sort((a, b) => {
                if (a === 'brand') return -1;
                if (b === 'brand') return 1;
                return 0;
            });

            for (const key of keys) {
                const value = filters[key];
                if (!value) continue;

                const targetLabels = [];
                if (key === 'brand') targetLabels.push('brand', 'brands', 'brand name');
                if (key === 'ram') targetLabels.push('ram', 'memory', 'system memory', 'internal memory');
                if (key === 'storage') targetLabels.push('storage', 'internal storage', 'ssd capacity');
                if (key === 'battery') targetLabels.push('battery', 'battery capacity', 'battery power', 'mah', 'mAh');
                if (key === 'rating') targetLabels.push('customer ratings', 'rating', 'avg. customer review');

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
                        
                        // Standard text matching
                        return itemText.includes(valueStr) || 
                               itemText.includes(cleanValue) || 
                               itemTextClean.includes(valueClean) ||
                               (key === 'battery' && numericValue && itemText.includes(numericValue.toString()));
                    });

                    if (target) {
                        logger.info(`Flipkart: Applying discovered filter ${key} -> ${target.text}`);
                        const prevUrl = globalThis.location.href;
                        const prevProductCount = document.querySelectorAll('div[data-id], ._1AtVbE').length;
                        
                        // Try clicking the filter
                        await safeClick(target.element);
                        
                        // Wait for page update - check for URL change or DOM update
                        let urlChanged = false;
                        let domUpdated = false;
                        
                        for (let i = 0; i < 10; i++) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            if (globalThis.location.href !== prevUrl) {
                                urlChanged = true;
                                logger.info(`Flipkart: Filter ${key} triggered URL change`);
                                break;
                            }
                            
                            const currentProductCount = document.querySelectorAll('div[data-id], ._1AtVbE').length;
                            if (currentProductCount !== prevProductCount) {
                                domUpdated = true;
                                logger.info(`Flipkart: Filter ${key} triggered DOM update (products: ${prevProductCount} -> ${currentProductCount})`);
                                break;
                            }
                            
                            // Check for loading indicators
                            const loadingIndicator = document.querySelector('[class*="loading"], [aria-busy="true"]');
                            if (!loadingIndicator && i > 2) {
                                // No loading indicator and waited a bit, might be done
                                break;
                            }
                        }
                        
                        // If no change detected, try alternative methods
                        if (!urlChanged && !domUpdated) {
                            logger.warn(`Flipkart: Filter ${key} didn't trigger change, trying alternative methods`);
                            
                            // Try with dispatchEvent
                            await safeClick(target.element, { useDispatchEvent: true });
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Check if parent element needs clicking
                            const parent = target.element.closest('a, button, [role="button"]');
                            if (parent && parent !== target.element) {
                                await safeClick(parent);
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }

                        // Wait a bit more for any final updates
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Rediscover as DOM changes
                        availableFilters = await discoverAvailableFilters();
                    } else {
                        logger.warn(`Flipkart: No matching element found for filter ${key} -> ${value}`, {
                            availableOptions: filterGroup.elements.slice(0, 5).map(e => ({
                                text: e.text,
                                isRAM: e.isRAM,
                                isBattery: e.isBattery,
                                ramValue: e.ramValue,
                                batteryValue: e.batteryValue
                            }))
                        });
                    }
                }
            }
            
            logger.info('Flipkart: Filter application completed');
            return true;
        } catch (error) {
            logger.warn('Flipkart: Failed to apply some filters', { error: error.message });
            return true;
        }
    }

    async getSearchResults() {
        try {
            logger.info('Flipkart: Extracting products from page');
            
            // Try multiple container selectors
            const containerSelectors = Array.isArray(this.selectors.results.container) 
                ? this.selectors.results.container 
                : [this.selectors.results.container];
            
            let products = [];
            
            for (const selector of containerSelectors) {
                try {
                    await waitForCondition(async () => {
                        const found = extractProducts(
                            selector,
                            {
                                title: this.selectors.results.title,
                                price: this.selectors.results.price,
                                link: this.selectors.results.link,
                                image: this.selectors.results.image,
                                rating: this.selectors.results.rating,
                                reviews: '._13vcmD',
                            }
                        );
                        if (found.length > 0) {
                            products = found;
                            return true;
                        }
                        return false;
                    }, { timeout: 3000, interval: 500 });
                    
                    if (products.length > 0) {
                        logger.info(`Flipkart: Successfully extracted ${products.length} products with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    logger.debug(`Flipkart: Selector ${selector} failed or timed out`);
                }
            }

            if (products.length === 0) {
                logger.warn('Flipkart: No products found with any selector, trying manual extraction');
                products = this._manualExtractProducts();
            }
            
            // Filter out sponsored items - additional pass for Flipkart
            const nonSponsored = products.filter(product => {
                const titleLower = (product.title || '').toLowerCase();
                const garbageKeywords = ['sponsored', 'ad', 'promoted'];
                return !garbageKeywords.some(kw => titleLower.includes(kw));
            });

            // Ensure all products are plain serializable objects
            const serializableProducts = nonSponsored.map(product => ({
                index: typeof product.index === 'number' ? product.index : 0,
                title: String(product.title || ''),
                price: String(product.price || ''),
                link: String(product.link || ''),
                image: String(product.image || ''),
                rating: String(product.rating || ''),
                reviews: String(product.reviews || '')
            }));
            
            logger.info(`Flipkart: Found ${serializableProducts.length} products total`);
            return serializableProducts;
        } catch (error) {
            logger.error('Flipkart: Failed to get search results', error);
            throw error;
        }
    }
    
    _manualExtractProducts() {
        const products = [];
        // Try to find product links directly
        const productLinks = document.querySelectorAll('a[href*="/p/"]');
        logger.info(`Flipkart: Found ${productLinks.length} product links manually`);
        
        productLinks.forEach((link, index) => {
            try {
                const container = link.closest('div[data-id]') || link.closest('div')?.parentElement;
                if (!container) return;
                
                // Extract title
                const titleEl = container.querySelector('._4rR01T, ._2UzuFa, a.IRpwTa');
                const title = titleEl ? titleEl.textContent.trim() : link.textContent.trim();
                
                // Extract price
                const priceEl = container.querySelector('._30jeq3, ._1_WHN1, ._25b18c');
                const price = priceEl ? priceEl.textContent.trim() : '';
                
                // Get link
                const href = link.href || link.getAttribute('href') || '';
                const fullLink = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
                
                // Extract image
                const imgEl = container.querySelector('img._396cs4, img._312yB9');
                const image = imgEl ? imgEl.src : '';
                
                // Extract rating
                const ratingEl = container.querySelector('._3LWZlK, ._2_R_DZ');
                const rating = ratingEl ? ratingEl.textContent.trim() : '';
                
                if (title && fullLink) {
                    products.push({
                        index,
                        title,
                        price,
                        link: fullLink,
                        image,
                        rating,
                        reviews: ''
                    });
                }
            } catch (error) {
                logger.warn('Flipkart: Error extracting product manually', { error: error.message, index });
            }
        });
        
        return products;
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
            logger.info('Flipkart: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            await clickProduct(product.link);
            return product;
        } catch (error) {
            logger.error('Flipkart: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        await addToCart({ button: this.selectors.product.addToCart });
        return true;
    }

    async buyNow() {
        await clickBuyNow({ button: this.selectors.product.buyNow });
        return true;
    }

    async sortResults(sortOption) {
        try {
            // Mapping intent sorts to Flipkart native sort options
            const sortMap = {
                'price_low': 'price_asc',
                'price_high': 'price_desc',
                'relevance': 'relevance',
                'newest': 'newest'
            };
            
            const flipkartSort = sortMap[sortOption] || sortOption;

            await sortResults(flipkartSort, {
                dropdown: '._10W_6G, select' // Flipkart usually has a sort bar or dropdown
            });
            return true;
        } catch (error) {
            logger.error('Flipkart: Failed to sort results', error);
            return false;
        }
    }
}
