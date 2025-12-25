/**
 * Amazon Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, sortResults, discoverAvailableFilters } from '../shared/actions.js';
import { safeClick, fillInput, getText } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

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
                    container: '[data-component-type="s-search-result"], .s-result-item, .s-card-container',
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
            let products = [];
            
            try {
                await waitForCondition(async () => {
                    products = extractProducts(
                        this.selectors.results.container,
                        {
                            title: this.selectors.results.title,
                            price: this.selectors.results.price,
                            link: this.selectors.results.link,
                            image: this.selectors.results.image,
                            rating: this.selectors.results.rating,
                            reviews: '.a-size-base',
                        }
                    );
                    return products.length > 0;
                }, { timeout: 5000, interval: 500 });
            } catch (e) {
                logger.warn('Amazon: Wait for products timed out, using what we found so far', { found: products.length });
            }

            // Filter out sponsored items - more comprehensive check
            const nonSponsored = products.filter((product, index) => {
                const containers = document.querySelectorAll(this.selectors.results.container);
                const container = containers[index];
                if (!container) return false;
                
                // Check for sponsored indicators
                const containerText = container.textContent || container.innerText || '';
                const isSponsored = 
                    container.querySelector('.s-sponsored-label-text') ||
                    container.querySelector('[data-component-type="sp-sponsored-result"]') ||
                    container.querySelector('.s-sponsored-information') ||
                    container.closest('[data-component-type="sp-sponsored-result"]') ||
                    containerText.includes('Sponsored') ||
                    containerText.includes('Ad') ||
                    container.classList.contains('AdHolder') ||
                    container.getAttribute('data-ad-id') ||
                    container.querySelector('[data-ad-id]');
                
                if (isSponsored) {
                    logger.debug('Filtered out sponsored product', { 
                        title: product.title?.substring(0, 50) 
                    });
                }
                
                return !isSponsored;
            });

            // Ensure all products are plain serializable objects (no DOM references)
            const serializableProducts = nonSponsored.map(product => ({
                index: typeof product.index === 'number' ? product.index : 0,
                title: String(product.title || ''),
                price: String(product.price || ''),
                link: String(product.link || ''),
                image: String(product.image || ''),
                rating: String(product.rating || ''),
                reviews: String(product.reviews || '')
            }));

            logger.info(`Amazon: Found ${serializableProducts.length} products`);
            
            return serializableProducts;
        } catch (error) {
            logger.error('Amazon: Failed to get search results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        try {
            const products = await this.getSearchResults();
            if (productIndex >= products.length) {
                throw new Error(`Product index ${productIndex} out of range`);
            }

            const product = products[productIndex];
            logger.info('Amazon: Selecting product', { index: productIndex, title: product.title });
            
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
            logger.info('Amazon: Applying filters', { filters });
            
            if (!filters || Object.keys(filters).length === 0) {
                logger.info('Amazon: No filters to apply');
                return true;
            }
            
            // Wait for page to fully load
            await new Promise(resolve => setTimeout(resolve, 3000));
            globalThis.scrollTo(0, 0);
            
            const initialUrl = globalThis.location.href;

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
                        }
                    }
                } catch (e) { logger.warn('Price filter failed', e); }
            }

            // 2. Discover and apply other filters dynamically
            let availableFilters = await discoverAvailableFilters();
            
            // Prioritize Brand
            const keys = Object.keys(filters).sort((a, b) => {
                if (a === 'brand') return -1;
                if (b === 'brand') return 1;
                return 0;
            });

            for (const key of keys) {
                const value = filters[key];
                if (!value || key.startsWith('price')) continue;

                const targetLabels = [];
                if (key === 'brand') targetLabels.push('brand', 'brands', 'brand name');
                if (key === 'ram') targetLabels.push('ram', 'memory', 'internal memory', 'computer memory size');
                if (key === 'storage') targetLabels.push('storage', 'internal storage', 'ssd capacity', 'hard disk size');
                if (key === 'rating') targetLabels.push('customer review', 'avg. customer review', 'customer ratings');
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
                    
                    const target = filterGroup.elements.find(el => {
                        const itemText = el.text.toLowerCase();
                        const itemTextClean = itemText.replace(/\s+/g, '');
                        const valueClean = valueStr.replace(/\s+/g, '');
                        
                        return itemText.includes(valueStr) || 
                               itemText.includes(cleanValue) || 
                               itemTextClean.includes(valueClean) ||
                               (key === 'ram' && itemText.includes(valueStr.replace('gb', '')) && itemText.includes('gb'));
                    });

                    if (target) {
                        logger.info(`Amazon: Applying discovered filter ${key} -> ${target.text}`);
                        const prevUrl = globalThis.location.href;
                        await safeClick(target.element);
                        
                        // Wait and validate
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        if (globalThis.location.href === prevUrl) {
                            logger.warn(`Amazon: Filter ${key} didn't trigger navigation, trying with dispatchEvent`);
                            await safeClick(target.element, { useDispatchEvent: true });
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }

                        // Rediscover after application as DOM changes
                        availableFilters = await discoverAvailableFilters();
                    } else {
                        logger.warn(`Amazon: No matching element found for filter ${key} -> ${value}`, {
                            availableOptions: filterGroup.elements.map(e => e.text)
                        });
                    }
                }
            }
            
            logger.info('Amazon: Filter application completed');
            return true;
        } catch (error) {
            logger.warn('Amazon: Failed to apply some filters', { error: error.message });
            return true;
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
