/**
 * JioMart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText, waitForCondition } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class JioMartPlatform extends EcommercePlatform {
    constructor() {
        super('jiomart', {
            enabled: true,
            domains: ['jiomart.com'],
            selectors: {
                search: {
                    input: 'input[type="text"][name="search"], input[type="search"], input[placeholder*="Search" i]',
                    button: 'button[type="submit"], .search-btn, [data-testid="search-button"]',
                },
                results: {
                    container: [
                        '.plp-card-wrapper',
                        '.ais-InfiniteHits-item',
                        '[class*="ProductCard"]',
                        '[class*="product-card"]',
                        '.plp-card',
                        'li[class*="product"]'
                    ],
                    title: '[class*="plp-card-details-name"], [class*="product-name"], h2, h3, .title, a[href*="/p/"]',
                    link: 'a[href*="/p/"], a[href*="/product"]',
                    price: '[class*="plp-card-details-price"], [class*="price"], .offer-price',
                    rating: '[class*="rating"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[title*="Add to Cart"]',
                        'button.addtocartbtn',
                        'button.buy-now',
                        'button#btnAddToCart',
                        '[data-testid="add-to-cart"]',
                        '.add-to-cart-btn',
                        '.buy-now-btn'
                    ],
                    addToCart: 'button[title*="Add to Cart"], button.addtocartbtn',
                    title: 'h1, .product-title',
                    price: '.offer-price, .price',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('JioMart: Performing search', { query, filters, sort });
            
            // For JioMart, navigate directly to search URL (most reliable)
            const searchUrl = `https://www.jiomart.com/search/${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
            
            logger.info('JioMart: Search submitted via URL navigation', { query, searchUrl });

            // Wait for search results to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (error) {
            logger.error('JioMart: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('JioMart: Extracting products from page');
            
            const containerSelectors = Array.isArray(this.selectors.results.container) 
                ? this.selectors.results.container 
                : [this.selectors.results.container];
            
            let products = [];
            
            for (const selector of containerSelectors) {
                try {
                    await waitForCondition(async () => {
                        const found = extractProducts(selector, {
                            title: this.selectors.results.title,
                            price: this.selectors.results.price,
                            link: this.selectors.results.link,
                            image: this.selectors.results.image,
                            rating: this.selectors.results.rating,
                        });
                        if (found.length > 0) {
                            products = found;
                            return true;
                        }
                        return false;
                    }, { timeout: 10000, interval: 500 });
                    
                    if (products.length > 0) {
                        logger.info(`JioMart: Successfully extracted ${products.length} products with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    logger.debug(`JioMart: Selector ${selector} failed or timed out`);
                }
            }

            if (products.length === 0) {
                logger.warn('JioMart: No products found with any selector');
                return [];
            }

            // Ensure all products are plain serializable objects
            const serializableProducts = products.map((product, idx) => ({
                index: idx,
                title: String(product.title || ''),
                price: String(product.price || ''),
                link: String(product.link || ''),
                image: String(product.image || ''),
                rating: String(product.rating || ''),
                reviews: String(product.reviews || ''),
                platform: 'jiomart'
            }));
            
            logger.info(`JioMart: Found ${serializableProducts.length} products total`);
            return serializableProducts;
        } catch (error) {
            logger.error('JioMart: Failed to get search results', error);
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
            logger.info('JioMart: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            await clickProduct(product.link);
            return product;
        } catch (error) {
            logger.error('JioMart: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('JioMart: Adding to cart');
            await addToCart({ button: this.selectors.product.addToCart });
            return true;
        } catch (error) {
            logger.error('JioMart: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('JioMart: Clicking Buy Now');
            
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            let lastError = null;
            for (const selector of selectors) {
                try {
                    logger.info(`JioMart: Trying Buy Now selector: ${selector}`);
                    await clickBuyNow({ button: selector }, {
                        maxRetries: 5,
                        initialDelay: 1000,
                        waitTimeout: 10000
                    });
                    logger.info('JioMart: Buy Now clicked successfully');
                    return true;
                } catch (error) {
                    logger.warn(`JioMart: Selector ${selector} failed`, { error: error.message });
                    lastError = error;
                    continue;
                }
            }
            
            throw lastError || new Error('All Buy Now selectors failed');
        } catch (error) {
            logger.error('JioMart: Failed to click Buy Now', error);
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
            logger.error('JioMart: Failed to get product details', error);
            throw error;
        }
    }
}
