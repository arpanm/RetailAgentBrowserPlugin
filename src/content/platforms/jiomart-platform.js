/**
 * JioMart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';
import { filterProducts, shouldExcludeProduct } from '../../lib/product-filter.js';

export class JioMartPlatform extends EcommercePlatform {
    constructor() {
        super('jiomart', {
            enabled: true,
            domains: ['jiomart.com'],
            selectors: {
                search: {
                    input: 'input[type="search"], input[placeholder*="Search" i], input[name*="search"]',
                    button: 'button[type="submit"]',
                },
                results: {
                    container: '.plp-card-wrapper, [class*="product-card"], [class*="product-item"]',
                    title: '[class*="plp-card-details-name"], h3',
                    link: 'a[href*="/p/"]',
                    price: '[class*="price"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[class*="add-to-cart"]',
                        'button[class*="addtocart"]',
                        '[class*="pdp-add-to-cart"]'
                    ],
                    addToCart: 'button[class*="add-to-cart"]',
                    title: 'h1, [class*="pdp-title"]',
                    price: '[class*="pdp-price"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('JioMart: Performing search', { query });
            
            const inputSelectors = [
                'input[type="search"]',
                'input[placeholder*="Search" i]',
                'input[name*="search"]',
                'input[class*="search"]'
            ];
            
            let searchInput = null;
            for (const sel of inputSelectors) {
                const inputs = document.querySelectorAll(sel);
                for (const inp of inputs) {
                    if (inp.offsetParent !== null) {
                        searchInput = inp;
                        logger.info(`JioMart: Found search input: ${sel}`);
                        break;
                    }
                }
                if (searchInput) break;
            }
            
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            searchInput.focus();
            searchInput.value = query;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            await new Promise(r => setTimeout(r, 300));
            
            // Press Enter
            searchInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            
            const form = searchInput.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
            
            logger.info('JioMart: Search submitted', { query });
            return true;
        } catch (error) {
            logger.error('JioMart: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('JioMart: Extracting products');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const containerSelectors = [
                '.plp-card-wrapper',
                '[class*="product-card"]',
                '[class*="product-item"]'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`JioMart: Found ${containers.length} containers`);
                    break;
                }
            }
            
            // Filter out sponsored and out-of-stock products
            const { valid, stats } = filterProducts(containers, 'jiomart');
            logger.info('JioMart: Filtered products', stats);
            
            const products = [];
            
            valid.forEach((container, idx) => {
                try {
                    const linkEl = container.querySelector('a[href*="/p/"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    const titleEl = container.querySelector('[class*="plp-card-details-name"], h3') || linkEl;
                    const title = titleEl?.textContent?.trim() || 'Product';
                    
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.jiomart.com${href}`;
                    
                    const product = {
                        index: idx,
                        title,
                        price,
                        link: fullUrl,
                        image,
                        platform: 'jiomart'
                    };
                    
                    if (!shouldExcludeProduct(product, 'jiomart')) {
                        products.push(product);
                    }
                } catch (e) {
                    // Skip
                }
            });
            
            logger.info(`JioMart: Extracted ${products.length} valid products`);
            return products;
        } catch (error) {
            logger.error('JioMart: Failed to get results', error);
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
            logger.info('JioMart: Opening product', { title: product.title });
            
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('JioMart: Failed to select product', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('JioMart: Clicking Add to Cart');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = this.selectors.product.buyNow;
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('JioMart: Add to Cart clicked');
                    return true;
                }
            }
            
            throw new Error('Add to Cart button not found');
        } catch (error) {
            logger.error('JioMart: Failed to click button', error);
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
