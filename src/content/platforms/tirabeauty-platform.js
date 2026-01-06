/**
 * TiraBeauty Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText, waitForCondition } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class TiraBeautyPlatform extends EcommercePlatform {
    constructor() {
        super('tirabeauty', {
            enabled: true,
            domains: ['tirabeauty.com'],
            selectors: {
                search: {
                    input: 'input[type="search"], input[placeholder*="Search" i], input[class*="search"], input[name*="search"]',
                    button: 'button[type="submit"], [class*="search-icon"], svg[class*="search"], .search-btn',
                },
                results: {
                    container: [
                        '[class*="ProductCard"]',
                        '[class*="product-card"]',
                        '[class*="product-item"]',
                        '.product',
                        'article'
                    ],
                    title: '[class*="product-name"], [class*="ProductCard__name"], h3, a[href*="/product"]',
                    link: 'a[href*="/product"], a[href*="/p/"]',
                    price: '[class*="price"], [class*="Price"]',
                    rating: '[class*="rating"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[class*="add-to-bag"]',
                        'button[class*="addtobag"]',
                        'button[class*="add-to-cart"]',
                        '[data-testid="add-to-bag"]',
                        '[data-testid="pdp-add-to-cart"]',
                        'button[class*="btn-primary"]'
                    ],
                    addToCart: 'button[class*="add-to-bag"], button[class*="addtobag"]',
                    title: 'h1, [class*="pdp-title"], [class*="product-name"]',
                    price: '[class*="pdp-price"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('TiraBeauty: Performing search', { query, filters, sort });
            
            // Find search input
            const inputSelectors = [
                'input[type="search"]',
                'input[placeholder*="Search" i]',
                'input[class*="search"]',
                'input[name*="search"]'
            ];
            
            let searchInput = null;
            for (const sel of inputSelectors) {
                searchInput = document.querySelector(sel);
                if (searchInput) {
                    logger.info(`TiraBeauty: Found search input with selector: ${sel}`);
                    break;
                }
            }
            
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            // Focus and fill input
            searchInput.focus();
            searchInput.value = '';
            
            // Type character by character for React
            for (const char of query) {
                searchInput.value += char;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 50));
            }
            
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Wait a bit for autocomplete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to click search button
            const buttonSelectors = [
                'button[type="submit"]',
                '[class*="search-icon"]',
                '[class*="search-btn"]',
                'button[class*="search"]'
            ];
            
            let clicked = false;
            for (const sel of buttonSelectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    clicked = true;
                    logger.info(`TiraBeauty: Clicked search button with selector: ${sel}`);
                    break;
                }
            }
            
            if (!clicked) {
                // Press Enter
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                
                // Try form submit
                const form = searchInput.closest('form');
                if (form) {
                    form.submit();
                }
                logger.info('TiraBeauty: Pressed Enter to search');
            }
            
            logger.info('TiraBeauty: Search submitted', { query });
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (error) {
            logger.error('TiraBeauty: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('TiraBeauty: Extracting products from page');
            
            // Wait for products to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const products = [];
            
            // Try multiple selectors for product containers
            const containerSelectors = [
                '[class*="ProductCard"]',
                '[class*="product-card"]',
                '[class*="product-item"]',
                '.product',
                'article'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`TiraBeauty: Found ${containers.length} products with selector: ${selector}`);
                    break;
                }
            }
            
            containers.forEach((container, idx) => {
                try {
                    // Find link
                    const linkEl = container.querySelector('a[href*="/product"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    // Find title
                    const titleEl = container.querySelector('[class*="product-name"]') || container.querySelector('h3') || linkEl;
                    const title = titleEl?.textContent?.trim() || 'Unknown Product';
                    
                    // Find price
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    // Find image
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.tirabeauty.com${href}`;
                    
                    products.push({
                        index: idx,
                        title,
                        price,
                        link: fullUrl,
                        image,
                        rating: '',
                        reviews: '',
                        platform: 'tirabeauty'
                    });
                } catch (e) {
                    logger.warn('TiraBeauty: Failed to extract product', { index: idx, error: e.message });
                }
            });
            
            logger.info(`TiraBeauty: Extracted ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('TiraBeauty: Failed to get search results', error);
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
            logger.info('TiraBeauty: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            // Navigate directly to product page
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('TiraBeauty: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('TiraBeauty: Adding to cart');
            const selectors = Array.isArray(this.selectors.product.addToCart) 
                ? this.selectors.product.addToCart 
                : this.selectors.product.addToCart.split(', ');
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('TiraBeauty: Add to cart clicked');
                    return true;
                }
            }
            throw new Error('Add to cart button not found');
        } catch (error) {
            logger.error('TiraBeauty: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('TiraBeauty: Clicking Buy Now / Add to Bag');
            
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            for (const selector of selectors) {
                try {
                    const btn = document.querySelector(selector);
                    if (btn && btn.offsetParent !== null) {
                        logger.info(`TiraBeauty: Found button with selector: ${selector}`);
                        btn.click();
                        logger.info('TiraBeauty: Buy Now clicked successfully');
                        return true;
                    }
                } catch (e) {
                    logger.warn(`TiraBeauty: Selector ${selector} failed`, { error: e.message });
                }
            }
            
            throw new Error('Buy Now button not found');
        } catch (error) {
            logger.error('TiraBeauty: Failed to click Buy Now', error);
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
            logger.error('TiraBeauty: Failed to get product details', error);
            throw error;
        }
    }
}
