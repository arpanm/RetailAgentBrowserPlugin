/**
 * Flipkart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
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
            
            // Apply sort if provided (Flipkart sort implementation can be added here)
            if (sort) {
                logger.info('Flipkart: Sort requested but not yet implemented', { sort });
                // TODO: Implement Flipkart sort application
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
            
            // Wait for page to fully load and filters sidebar to appear
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Scroll to top to ensure filters are visible
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            logger.info('Flipkart: Page ready for filter application');
            
            // Apply brand filter
            if (filters.brand) {
                try {
                    const brandText = filters.brand.toLowerCase().trim();
                    const brandLink = Array.from(document.querySelectorAll('a, div, label, span')).find(el => {
                        const text = el.textContent?.toLowerCase() || '';
                        return text.includes(brandText) && 
                               (el.closest('[class*="filter"]') || el.closest('[class*="Brand"]') || el.closest('section'));
                    });
                    if (brandLink) {
                        brandLink.click();
                        logger.info('Flipkart: Applied brand filter', { brand: filters.brand });
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (brandError) {
                    logger.warn('Flipkart: Failed to apply brand filter', { error: brandError.message });
                }
            }
            
            // Apply RAM filter
            if (filters.ram) {
                try {
                    const ramVal = parseInt(filters.ram.toLowerCase().replace(/\D/g, ''));
                    const ramLink = Array.from(document.querySelectorAll('a, div, label, span')).find(el => {
                        const text = el.textContent || '';
                        const textLower = text.toLowerCase();
                        return (textLower.includes(`${ramVal}gb`) || textLower.includes(`${ramVal} gb`)) &&
                               (el.closest('[class*="filter"]') || el.closest('[class*="RAM"]') || el.closest('section'));
                    });
                    if (ramLink) {
                        ramLink.click();
                        logger.info('Flipkart: Applied RAM filter', { ram: filters.ram });
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (ramError) {
                    logger.warn('Flipkart: Failed to apply RAM filter', { error: ramError.message });
                }
            }
            
            // Apply storage filter
            if (filters.storage) {
                try {
                    const storageVal = parseInt(filters.storage.toLowerCase().replace(/\D/g, ''));
                    const storageLink = Array.from(document.querySelectorAll('a, div, label, span')).find(el => {
                        const text = el.textContent || '';
                        const textLower = text.toLowerCase();
                        return (textLower.includes(`${storageVal}gb`) || textLower.includes(`${storageVal} gb`) || 
                                textLower.includes(`${storageVal}tb`) || textLower.includes(`${storageVal} tb`)) &&
                               (el.closest('[class*="filter"]') || el.closest('[class*="Storage"]') || el.closest('section'));
                    });
                    if (storageLink) {
                        storageLink.click();
                        logger.info('Flipkart: Applied storage filter', { storage: filters.storage });
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (storageError) {
                    logger.warn('Flipkart: Failed to apply storage filter', { error: storageError.message });
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
            for (const containerSelector of containerSelectors) {
                try {
                    const containers = document.querySelectorAll(containerSelector);
                    logger.info(`Flipkart: Found ${containers.length} containers with selector: ${containerSelector}`);
                    
                    if (containers.length > 0) {
                        products = extractProducts(
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
                        
                        if (products.length > 0) {
                            logger.info(`Flipkart: Successfully extracted ${products.length} products with selector: ${containerSelector}`);
                            break;
                        }
                    }
                } catch (error) {
                    logger.warn(`Flipkart: Selector ${containerSelector} failed`, { error: error.message });
                    continue;
                }
            }
            
            // If no products found, try manual extraction
            if (products.length === 0) {
                logger.warn('Flipkart: No products found with standard selectors, trying manual extraction');
                products = this._manualExtractProducts();
            }
            
            // Filter out sponsored items
            const nonSponsored = products.filter((product, index) => {
                const containers = document.querySelectorAll(this.selectors.results.container[0] || this.selectors.results.container);
                const container = containers[index];
                if (!container) return false;
                
                // Check for sponsored indicators
                const isSponsored = 
                    container.innerText.includes('Sponsored') ||
                    container.textContent.includes('Sponsored') ||
                    container.innerText.includes('Ad') ||
                    container.textContent.includes('Ad') ||
                    container.querySelector('[class*="sponsored"]') ||
                    container.querySelector('[class*="ad"]') ||
                    container.closest('[class*="sponsored"]') ||
                    container.closest('[class*="ad"]');
                
                if (isSponsored) {
                    logger.info('Flipkart: Filtered out sponsored product', {
                        title: product.title?.substring(0, 50),
                        index: index
                    });
                }
                
                return !isSponsored;
            });
            
            logger.info('Flipkart: Filtered sponsored products', {
                total: products.length,
                nonSponsored: nonSponsored.length
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
}

