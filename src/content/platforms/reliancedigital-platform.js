/**
 * RelianceDigital Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText, waitForCondition } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class RelianceDigitalPlatform extends EcommercePlatform {
    constructor() {
        super('reliancedigital', {
            enabled: true,
            domains: ['reliancedigital.in'],
            selectors: {
                search: {
                    input: 'input[name="searchTerm"], input[type="search"], input[placeholder*="Search" i], input[id*="search" i]',
                    button: 'button[type="submit"], .search-icon, [class*="search-btn"], svg[class*="search"]',
                },
                results: {
                    container: [
                        '[class*="sp__product"]',
                        '[class*="product-item"]',
                        '[class*="product-card"]',
                        '.product',
                        '[data-testid*="product"]'
                    ],
                    title: '[class*="sp__name"], [class*="product-name"], h2, h3, a[href*="/product"]',
                    link: 'a[href*="/product"], a[href*="/p/"]',
                    price: '[class*="TextWeb__Text"], [class*="price"], .pdp__offerPrice',
                    rating: '[class*="rating"]',
                    image: 'img',
                },
                product: {
                    buyNow: [
                        'button[class*="add-to-cart"]',
                        'button[class*="addtocart"]',
                        '[class*="pdp__button"]',
                        'button[class*="btn-primary"]',
                        '[data-testid="pdp-add-to-cart"]'
                    ],
                    addToCart: 'button[class*="add-to-cart"], button[class*="addtocart"]',
                    title: 'h1, [class*="pdp__title"]',
                    price: '[class*="pdp__offerPrice"], [class*="price"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('RelianceDigital: Performing search', { query, filters, sort });
            
            // Find search input
            const inputSelectors = [
                'input[name="searchTerm"]',
                'input[type="search"]',
                'input[placeholder*="Search" i]',
                'input[id*="search" i]',
                'input[class*="search"]'
            ];
            
            let searchInput = null;
            for (const sel of inputSelectors) {
                searchInput = document.querySelector(sel);
                if (searchInput) {
                    logger.info(`RelianceDigital: Found search input with selector: ${sel}`);
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
                    logger.info(`RelianceDigital: Clicked search button with selector: ${sel}`);
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
                logger.info('RelianceDigital: Pressed Enter to search');
            }
            
            logger.info('RelianceDigital: Search submitted', { query });
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (error) {
            logger.error('RelianceDigital: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            logger.info('RelianceDigital: Extracting products from page');
            
            // Wait for products to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const products = [];
            
            // Try multiple selectors for product containers
            const containerSelectors = [
                '[class*="sp__product"]',
                '[class*="product-card"]',
                '[class*="product-item"]',
                '.product'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    logger.info(`RelianceDigital: Found ${containers.length} products with selector: ${selector}`);
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
                    const titleEl = container.querySelector('[class*="sp__name"]') || container.querySelector('h2, h3') || linkEl;
                    const title = titleEl?.textContent?.trim() || 'Unknown Product';
                    
                    // Find price
                    const priceEl = container.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';
                    
                    // Find image
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || '';
                    
                    const fullUrl = href.startsWith('http') ? href : `https://www.reliancedigital.in${href}`;
                    
                    products.push({
                        index: idx,
                        title,
                        price,
                        link: fullUrl,
                        image,
                        rating: '',
                        reviews: '',
                        platform: 'reliancedigital'
                    });
                } catch (e) {
                    logger.warn('RelianceDigital: Failed to extract product', { index: idx, error: e.message });
                }
            });
            
            logger.info(`RelianceDigital: Extracted ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('RelianceDigital: Failed to get search results', error);
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
            logger.info('RelianceDigital: Selecting product', { index: productIndex, title: product.title, link: product.link });
            
            if (!product.link || product.link === '') {
                throw new Error('Product link is missing');
            }

            // Navigate directly to product page
            window.location.href = product.link;
            return product;
        } catch (error) {
            logger.error('RelianceDigital: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('RelianceDigital: Adding to cart');
            const selectors = Array.isArray(this.selectors.product.addToCart) 
                ? this.selectors.product.addToCart 
                : this.selectors.product.addToCart.split(', ');
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    logger.info('RelianceDigital: Add to cart clicked');
                    return true;
                }
            }
            throw new Error('Add to cart button not found');
        } catch (error) {
            logger.error('RelianceDigital: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('RelianceDigital: Clicking Buy Now / Add to Cart');
            
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            for (const selector of selectors) {
                try {
                    const btn = document.querySelector(selector);
                    if (btn && btn.offsetParent !== null) {
                        logger.info(`RelianceDigital: Found button with selector: ${selector}`);
                        btn.click();
                        logger.info('RelianceDigital: Buy Now clicked successfully');
                        return true;
                    }
                } catch (e) {
                    logger.warn(`RelianceDigital: Selector ${selector} failed`, { error: e.message });
                }
            }
            
            throw new Error('Buy Now button not found');
        } catch (error) {
            logger.error('RelianceDigital: Failed to click Buy Now', error);
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
            logger.error('RelianceDigital: Failed to get product details', error);
            throw error;
        }
    }
}
