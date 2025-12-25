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
                        '._1AtVbE',
                        '._2kHMtA',
                        '[data-id]',
                        'div[style*="flex"]:has(a[href*="/p/"])',
                        'div:has(._4rR01T)',
                        'div:has(a.IRpwTa)'
                    ],
                    title: [
                        '._4rR01T',
                        'a.IRpwTa',
                        '._2UzuFa',
                        'a[href*="/p/"]',
                        '._1fQZEK'
                    ],
                    link: [
                        'a.IRpwTa',
                        'a._1fQZEK',
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
                if (key === 'ram') targetLabels.push('ram', 'memory', 'system memory');
                if (key === 'storage') targetLabels.push('storage', 'internal storage', 'ssd capacity');
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
                    
                    const target = filterGroup.elements.find(el => {
                        const itemText = el.text.toLowerCase();
                        const itemTextClean = itemText.replace(/\s+/g, '');
                        const valueClean = valueStr.replace(/\s+/g, '');
                        
                        return itemText.includes(valueStr) || 
                               itemText.includes(cleanValue) || 
                               itemTextClean.includes(valueClean);
                    });

                    if (target) {
                        logger.info(`Flipkart: Applying discovered filter ${key} -> ${target.text}`);
                        const prevUrl = globalThis.location.href;
                        await safeClick(target.element);
                        
                        // Wait and validate
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        if (globalThis.location.href === prevUrl) {
                            logger.warn(`Flipkart: Filter ${key} didn't trigger navigation, trying with dispatchEvent`);
                            await safeClick(target.element, { useDispatchEvent: true });
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }

                        // Rediscover as DOM changes
                        availableFilters = await discoverAvailableFilters();
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
            
            const extract = () => {
                let results = [];
                for (const containerSelector of containerSelectors) {
                    try {
                        const containers = document.querySelectorAll(containerSelector);
                        if (containers.length > 0) {
                            const found = extractProducts(
                                containerSelector,
                                {
                                    title: Array.isArray(this.selectors.results.title) 
                                        ? this.selectors.results.title[0] 
                                        : this.selectors.results.title,
                                    price: Array.isArray(this.selectors.results.price) 
                                        ? this.selectors.results.price[0] 
                                        : this.selectors.results.price,
                                    link: Array.isArray(this.selectors.results.link) 
                                        ? this.selectors.results.link[0] 
                                        : this.selectors.results.link,
                                    image: Array.isArray(this.selectors.results.image) 
                                        ? this.selectors.results.image[0] 
                                        : this.selectors.results.image,
                                    rating: Array.isArray(this.selectors.results.rating) 
                                        ? this.selectors.results.rating[0] 
                                        : this.selectors.results.rating,
                                    reviews: '._13vcmD',
                                }
                            );
                            if (found.length > 0) {
                                results = found;
                                logger.info(`Flipkart: Successfully extracted ${found.length} products with selector: ${containerSelector}`);
                                break;
                            }
                        }
                    } catch (e) {
                        logger.warn(`Flipkart: Selector ${containerSelector} failed`, { error: e.message });
                    }
                }
                return results;
            };

            try {
                await waitForCondition(async () => {
                    products = extract();
                    return products.length > 0;
                }, { timeout: 5000, interval: 500 });
            } catch (e) {
                logger.warn('Flipkart: Wait for products timed out, trying manual extraction');
                products = this._manualExtractProducts();
            }
            
            // Filter out sponsored items
            const nonSponsored = products.filter((product, index) => {
                // ... same as before
                const selector = Array.isArray(this.selectors.results.container) ? this.selectors.results.container[0] : this.selectors.results.container;
                const containers = document.querySelectorAll(selector);
                const container = containers[index];
                if (!container) return true; // keep if container not found
                
                const text = container.textContent || container.innerText || '';
                const isSponsored = 
                    text.includes('Sponsored') ||
                    text.includes('Ad') ||
                    container.querySelector('[class*="sponsored" i]') ||
                    container.querySelector('[class*="ad" i]') ||
                    container.closest('[class*="sponsored" i]') ||
                    container.closest('[class*="ad" i]');
                
                if (isSponsored) {
                    logger.info('Flipkart: Filtered out sponsored product', { title: product.title });
                }
                
                return !isSponsored;
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
        const products = await this.getSearchResults();
        if (productIndex >= products.length) {
            throw new Error(`Product index ${productIndex} out of range`);
        }
        await clickProduct(products[productIndex].link);
        return products[productIndex];
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
