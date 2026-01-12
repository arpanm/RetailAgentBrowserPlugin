/**
 * Ajio Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { logger } from '../../lib/logger.js';
import { filterProducts, shouldExcludeProduct } from '../../lib/product-filter.js';

export class AjioPlatform extends EcommercePlatform {
    constructor() {
        super('ajio', {
            enabled: true,
            domains: ['ajio.com'],
            selectors: {
                search: {
                    input: 'input[name="searchVal"], input[type="search"], input[placeholder*="Search" i]',
                    button: 'button[type="submit"], .ic-search',
                },
                results: {
                    container: '.item, [class*="product-item"], [class*="rilrtl-products-list__item"]',
                    title: '[class*="brand"], [class*="name"]',
                    link: 'a[href*="/p/"]',
                    price: '[class*="price"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        '[class*="add-to-bag"]',
                        '[class*="addtobag"]',
                        'button[class*="add"]'
                    ],
                    addToCart: '[class*="add-to-bag"]',
                    title: 'h1, .product-title',
                    price: '[class*="prod-sp"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Ajio: Performing search', { query });
            
            // Navigate to search URL
            const searchUrl = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
            
            logger.info('Ajio: Search submitted', { query, searchUrl });
            return true;
        } catch (error) {
            logger.error('Ajio: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('Ajio: Extracting products');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
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
                    logger.info(`Ajio: Found ${containers.length} containers with: ${selector}`);
                    break;
                }
            }
            
            // Filter out sponsored and out-of-stock products
            const { valid, stats } = filterProducts(containers, 'ajio');
            logger.info('Ajio: Filtered products', stats);
            
            const products = [];
            
            valid.forEach((container, idx) => {
                try {
                    const linkEl = container.querySelector('a[href*="/p/"]') || container.querySelector('a');
                    if (!linkEl) return;
                    
                    const href = linkEl.href || linkEl.getAttribute('href');
                    if (!href) return;
                    
                    const brandEl = container.querySelector('[class*="brand"]');
                    const nameEl = container.querySelector('[class*="name"]');
                    const title = [brandEl?.textContent?.trim(), nameEl?.textContent?.trim()].filter(Boolean).join(' ') || linkEl.textContent?.trim();
                    
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.ajio.com${href}`;
                    
                    const product = {
                        index: idx,
                        title: title || 'Unknown Product',
                        price,
                        link: fullUrl,
                        image,
                        platform: 'ajio'
                    };
                    
                    // Double-check product should not be excluded
                    if (!shouldExcludeProduct(product, 'ajio')) {
                        products.push(product);
                    }
                } catch (e) {
                    // Skip
                }
            });
            
            logger.info(`Ajio: Extracted ${products.length} valid products`);
            return products;
        } catch (error) {
            logger.error('Ajio: Failed to get results', error);
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
            logger.info('Ajio: Opening product', { title: product.title });
            
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('Ajio: Failed to select product', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('Ajio: Clicking Add to Bag');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = this.selectors.product.buyNow;
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('Ajio: Add to Bag clicked');
                    return true;
                }
            }
            
            throw new Error('Add to Bag button not found');
        } catch (error) {
            logger.error('Ajio: Failed to click button', error);
            throw error;
        }
    }

    async addToCart() {
        return this.buyNow();
    }

    async getProductDetails() {
        try {
            const title = document.querySelector('h1, .product-title')?.textContent?.trim() || '';
            const price = document.querySelector('[class*="prod-sp"], [class*="price"]')?.textContent?.trim() || '';
            return { title, price, url: window.location.href };
        } catch (error) {
            throw error;
        }
    }
}
