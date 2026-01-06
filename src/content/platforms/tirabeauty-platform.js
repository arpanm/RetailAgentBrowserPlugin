/**
 * TiraBeauty Platform Implementation
 * 
 * Search Flow:
 * 1. Find search input
 * 2. Type query
 * 3. Press Enter to search
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';

export class TiraBeautyPlatform extends EcommercePlatform {
    constructor() {
        super('tirabeauty', {
            enabled: true,
            domains: ['tirabeauty.com'],
            selectors: {
                search: {
                    input: 'input[type="search"], input[placeholder*="Search" i], input[class*="search"]',
                    button: 'button[type="submit"]',
                },
                results: {
                    container: '[class*="ProductCard"], [class*="product-card"], [class*="product-item"]',
                    title: '[class*="product-name"], h3',
                    link: 'a[href*="/product"], a',
                    price: '[class*="price"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[class*="add-to-bag"]',
                        'button[class*="addtobag"]',
                        'button[class*="add-to-cart"]',
                        '[data-testid="add-to-bag"]',
                        'button[class*="btn-primary"]'
                    ],
                    addToCart: 'button[class*="add-to-bag"]',
                    title: 'h1, [class*="pdp-title"], [class*="product-name"]',
                    price: '[class*="pdp-price"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('TiraBeauty: Performing search', { query });
            
            // Step 1: Find search input
            const inputSelectors = [
                'input[type="search"]',
                'input[placeholder*="Search" i]',
                'input[class*="search"]',
                'input[name*="search"]',
                'input[id*="search" i]'
            ];
            
            let searchInput = null;
            for (const sel of inputSelectors) {
                const inputs = document.querySelectorAll(sel);
                for (const inp of inputs) {
                    if (inp.offsetParent !== null) {
                        searchInput = inp;
                        logger.info(`TiraBeauty: Found search input: ${sel}`);
                        break;
                    }
                }
                if (searchInput) break;
            }
            
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            // Step 2: Focus, clear, and type
            searchInput.focus();
            searchInput.value = '';
            await new Promise(r => setTimeout(r, 200));
            
            // Set value directly
            searchInput.value = query;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            logger.info('TiraBeauty: Query entered, pressing Enter...');
            await new Promise(r => setTimeout(r, 300));
            
            // Step 3: Press Enter - this is what works
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            searchInput.dispatchEvent(enterEvent);
            
            // Also dispatch keyup
            searchInput.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter', 
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
            
            // Try form submit as backup
            const form = searchInput.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
            
            logger.info('TiraBeauty: Search submitted', { query });
            return true;
        } catch (error) {
            logger.error('TiraBeauty: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('TiraBeauty: Extracting products');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const products = [];
            const containerSelectors = [
                '[class*="ProductCard"]',
                '[class*="product-card"]',
                '[class*="product-item"]',
                'article'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`TiraBeauty: Found ${containers.length} products`);
                    break;
                }
            }
            
            containers.forEach((container, idx) => {
                try {
                    const linkEl = container.querySelector('a[href*="/product"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    const titleEl = container.querySelector('[class*="product-name"], h3') || linkEl;
                    const title = titleEl?.textContent?.trim() || 'Product';
                    
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.tirabeauty.com${href}`;
                    
                    products.push({
                        index: idx,
                        title,
                        price,
                        link: fullUrl,
                        image,
                        platform: 'tirabeauty'
                    });
                } catch (e) {
                    // Skip
                }
            });
            
            logger.info(`TiraBeauty: Extracted ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('TiraBeauty: Failed to get results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        try {
            const products = await this.getSearchResults();
            if (products.length === 0) {
                throw new Error('No products found');
            }
            
            const product = products[Math.min(productIndex, products.length - 1)];
            logger.info('TiraBeauty: Opening product', { title: product.title });
            
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('TiraBeauty: Failed to select product', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('TiraBeauty: Clicking Add to Bag');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = this.selectors.product.buyNow;
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('TiraBeauty: Add to Bag clicked');
                    return true;
                }
            }
            
            throw new Error('Add to Bag button not found');
        } catch (error) {
            logger.error('TiraBeauty: Failed to click button', error);
            throw error;
        }
    }

    async addToCart() {
        return this.buyNow();
    }

    async getProductDetails() {
        try {
            const title = document.querySelector('h1, [class*="pdp-title"]')?.textContent?.trim() || '';
            const price = document.querySelector('[class*="pdp-price"], [class*="price"]')?.textContent?.trim() || '';
            return { title, price, url: window.location.href };
        } catch (error) {
            throw error;
        }
    }
}
