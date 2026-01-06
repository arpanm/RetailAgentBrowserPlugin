/**
 * Ajio Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText, waitForCondition } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class AjioPlatform extends EcommercePlatform {
    constructor() {
        super('ajio', {
            enabled: true,
            domains: ['ajio.com'],
            selectors: {
                search: {
                    input: 'input[name="searchVal"], input[type="search"], input[placeholder*="Search" i], input[class*="search"]',
                    button: 'button[type="submit"], .ic-search, [class*="search-icon"], svg[class*="search"]',
                },
                results: {
                    container: [
                        '.item',
                        '[class*="product-item"]',
                        '[class*="item_item"]',
                        '[class*="rilrtl-products-list__item"]',
                        '.product-card'
                    ],
                    title: '[class*="brand"], [class*="name"], .nameCls, h2, h3, a[href*="/p/"]',
                    link: 'a[href*="/p/"], a[href*="/product"]',
                    price: '[class*="price"], .price, [class*="Price"]',
                    rating: '[class*="rating"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        '[class*="add-to-bag"]',
                        '[class*="addtobag"]',
                        'button[class*="add"]',
                        '[data-testid="pdp-add-button"]',
                        'button.add-to-cart',
                        'button.buy-now'
                    ],
                    addToCart: '[class*="add-to-bag"], [class*="addtobag"], button[class*="add"]',
                    title: 'h1, .product-title, [class*="prod-name"]',
                    price: '[class*="prod-sp"], [class*="price"], .price',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Ajio: Performing search', { query, filters, sort });
            
            // Navigate directly to search URL
            const searchUrl = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
            
            logger.info('Ajio: Search submitted via URL navigation', { query, searchUrl });
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (error) {
            logger.error('Ajio: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('Ajio: Extracting products from page');
            
            // Wait for products to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const products = [];
            
            // Try multiple selectors for product containers
            const containerSelectors = [
                '.item.rilrtl-products-list__item',
                '[class*="item_item"]',
                '.item',
                '[class*="product"]'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`Ajio: Found ${containers.length} products with selector: ${selector}`);
                    break;
                }
            }
            
            containers.forEach((container, idx) => {
                try {
                    // Find link
                    const linkEl = container.querySelector('a[href*="/p/"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    // Find title
                    const brandEl = container.querySelector('[class*="brand"]');
                    const nameEl = container.querySelector('[class*="name"]');
                    const title = [brandEl?.textContent?.trim(), nameEl?.textContent?.trim()].filter(Boolean).join(' ') || linkEl.textContent?.trim();
                    
                    // Find price
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    // Find image
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.ajio.com${href}`;
                    
                    products.push({
                        index: idx,
                        title: title || 'Unknown Product',
                        price,
                        link: fullUrl,
                        image,
                        rating: '',
                        reviews: '',
                        platform: 'ajio'
                    });
                } catch (e) {
                    logger.warn('Ajio: Failed to extract product', { index: idx, error: e.message });
                }
            });
            
            logger.info(`Ajio: Extracted ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('Ajio: Failed to get search results', error);
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
                productIndex = 0;
            }

            const product = products[productIndex];
            logger.info('Ajio: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            // Navigate directly to product page
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('Ajio: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('Ajio: Adding to cart');
            const selectors = Array.isArray(this.selectors.product.addToCart) 
                ? this.selectors.product.addToCart 
                : this.selectors.product.addToCart.split(', ');
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('Ajio: Add to cart clicked');
                    return true;
                }
            }
            throw new Error('Add to cart button not found');
        } catch (error) {
            logger.error('Ajio: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('Ajio: Clicking Buy Now / Add to Bag');
            
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            for (const selector of selectors) {
                try {
                    const btn = document.querySelector(selector);
                    if (btn && btn.offsetParent !== null) {
                        logger.info(`Ajio: Found button with selector: ${selector}`);
                        btn.click();
                        logger.info('Ajio: Buy Now clicked successfully');
                        return true;
                    }
                } catch (e) {
                    logger.warn(`Ajio: Selector ${selector} failed`, { error: e.message });
                }
            }
            
            throw new Error('Buy Now button not found');
        } catch (error) {
            logger.error('Ajio: Failed to click Buy Now', error);
            throw error;
        }
    }

    async getProductDetails() {
        try {
            const title = document.querySelector(this.selectors.product.title)?.textContent?.trim() || '';
            const price = document.querySelector(this.selectors.product.price)?.textContent?.trim() || '';
            
            return {
                title,
                price,
                url: globalThis.location.href,
            };
        } catch (error) {
            logger.error('Ajio: Failed to get product details', error);
            throw error;
        }
    }
}
