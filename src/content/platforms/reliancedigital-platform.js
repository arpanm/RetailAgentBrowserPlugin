/**
 * RelianceDigital Platform Implementation
 * 
 * Search Flow:
 * 1. Find search input
 * 2. Type query
 * 3. Press Enter to search
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';

export class RelianceDigitalPlatform extends EcommercePlatform {
    constructor() {
        super('reliancedigital', {
            enabled: true,
            domains: ['reliancedigital.in'],
            selectors: {
                search: {
                    input: 'input[name="searchTerm"], input[type="search"], input[placeholder*="Search" i]',
                    button: 'button[type="submit"]',
                },
                results: {
                    container: '[class*="sp__product"], [class*="product-card"], [class*="product-item"]',
                    title: '[class*="sp__name"], h2, h3',
                    link: 'a[href*="/product"], a',
                    price: '[class*="price"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[class*="add-to-cart"]',
                        'button[class*="addtocart"]',
                        '[class*="pdp__button"]',
                        'button[class*="btn-primary"]'
                    ],
                    addToCart: 'button[class*="add-to-cart"]',
                    title: 'h1, [class*="pdp__title"]',
                    price: '[class*="pdp__offerPrice"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('RelianceDigital: Performing search', { query });
            
            // Step 1: Find search input
            const inputSelectors = [
                'input[name="searchTerm"]',
                'input[type="search"]',
                'input[placeholder*="Search" i]',
                'input[id*="search" i]',
                'input[class*="search"]'
            ];
            
            let searchInput = null;
            for (const sel of inputSelectors) {
                const inputs = document.querySelectorAll(sel);
                for (const inp of inputs) {
                    if (inp.offsetParent !== null) {
                        searchInput = inp;
                        logger.info(`RelianceDigital: Found search input: ${sel}`);
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
            
            logger.info('RelianceDigital: Query entered, pressing Enter...');
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
            
            logger.info('RelianceDigital: Search submitted', { query });
            return true;
        } catch (error) {
            logger.error('RelianceDigital: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('RelianceDigital: Extracting products');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const products = [];
            const containerSelectors = [
                '[class*="sp__product"]',
                '[class*="product-card"]',
                '[class*="product-item"]'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`RelianceDigital: Found ${containers.length} products`);
                    break;
                }
            }
            
            containers.forEach((container, idx) => {
                try {
                    const linkEl = container.querySelector('a[href*="/product"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    const titleEl = container.querySelector('[class*="sp__name"], h2, h3') || linkEl;
                    const title = titleEl?.textContent?.trim() || 'Product';
                    
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.reliancedigital.in${href}`;
                    
                    products.push({
                        index: idx,
                        title,
                        price,
                        link: fullUrl,
                        image,
                        platform: 'reliancedigital'
                    });
                } catch (e) {
                    // Skip
                }
            });
            
            logger.info(`RelianceDigital: Extracted ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('RelianceDigital: Failed to get results', error);
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
            logger.info('RelianceDigital: Opening product', { title: product.title });
            
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('RelianceDigital: Failed to select product', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('RelianceDigital: Clicking Add to Cart');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = this.selectors.product.buyNow;
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('RelianceDigital: Add to Cart clicked');
                    return true;
                }
            }
            
            throw new Error('Add to Cart button not found');
        } catch (error) {
            logger.error('RelianceDigital: Failed to click button', error);
            throw error;
        }
    }

    async addToCart() {
        return this.buyNow();
    }

    async getProductDetails() {
        try {
            const title = document.querySelector('h1, [class*="pdp__title"]')?.textContent?.trim() || '';
            const price = document.querySelector('[class*="pdp__offerPrice"], [class*="price"]')?.textContent?.trim() || '';
            return { title, price, url: window.location.href };
        } catch (error) {
            throw error;
        }
    }
}
