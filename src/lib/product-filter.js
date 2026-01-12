/**
 * Product Filter Utility
 * Filters out sponsored and out-of-stock products on e-commerce platforms
 */

import { logger } from './logger.js';

/**
 * Check if a product element is sponsored/paid
 */
export function isSponsoredProduct(element, platform = 'generic') {
    if (!element) return false;
    
    try {
        const text = (element.textContent || '').toLowerCase();
        const html = element.innerHTML?.toLowerCase() || '';
        
        // Check for sponsored indicators
        const sponsoredIndicators = [
            'sponsored',
            'ad',
            'advertisement',
            'promoted',
            'featured ad'
        ];
        
        // Platform-specific checks
        if (platform === 'amazon') {
            // Amazon-specific sponsored indicators
            if (element.getAttribute('data-component-type') === 'sp-sponsored-result') return true;
            if (element.hasAttribute('data-ad-details')) return true;
            if (element.classList.contains('AdHolder')) return true;
            if (element.querySelector('.s-sponsored-header, .s-sponsored-info-icon')) return true;
        }
        
        if (platform === 'flipkart') {
            // Flipkart ad label
            const adLabel = element.querySelector('._2VHWtw, [class*="adLabel"]');
            if (adLabel && ['ad', 'sponsored'].includes(adLabel.textContent?.trim().toLowerCase())) return true;
            if (element.hasAttribute('data-ad-id') || element.hasAttribute('data-is-ad')) return true;
        }
        
        // Generic sponsored detection
        for (const indicator of sponsoredIndicators) {
            // Check for exact badge/label (not in product title)
            const badge = element.querySelector(`[class*="sponsor" i], [class*="ad-label" i], [class*="promoted" i]`);
            if (badge && badge.textContent?.toLowerCase().includes(indicator)) {
                return true;
            }
        }
        
        // Check data attributes
        const attrs = element.attributes;
        for (let i = 0; i < attrs.length; i++) {
            const attrName = attrs[i].name.toLowerCase();
            if (attrName.includes('sponsored') || attrName === 'data-ad' || attrName === 'data-is-ad') {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Check if a product is out of stock
 */
export function isOutOfStock(element, platform = 'generic') {
    if (!element) return false;
    
    try {
        const text = (element.textContent || '').toLowerCase();
        
        // Common out-of-stock indicators
        const outOfStockIndicators = [
            'out of stock',
            'out-of-stock',
            'sold out',
            'sold-out',
            'currently unavailable',
            'not available',
            'unavailable',
            'notify me',
            'notify when available',
            'coming soon',
            'pre-order',
            'preorder',
            'back in stock',
            'temporarily out of stock',
            'no stock'
        ];
        
        // Check for out-of-stock text
        for (const indicator of outOfStockIndicators) {
            if (text.includes(indicator)) {
                // Make sure it's not in the title (e.g., "stock market phone case")
                const title = element.querySelector('h2, h3, [class*="title"], [class*="name"]')?.textContent?.toLowerCase() || '';
                if (!title.includes(indicator)) {
                    logger.debug('Out of stock detected', { indicator, platform });
                    return true;
                }
            }
        }
        
        // Platform-specific checks
        if (platform === 'amazon') {
            const availabilityEl = element.querySelector('.a-color-price, [class*="availability"]');
            if (availabilityEl) {
                const availText = availabilityEl.textContent?.toLowerCase() || '';
                if (availText.includes('unavailable') || availText.includes('out of stock')) {
                    return true;
                }
            }
        }
        
        if (platform === 'flipkart') {
            const soldOutEl = element.querySelector('[class*="sold-out"], [class*="coming-soon"]');
            if (soldOutEl) return true;
        }
        
        if (platform === 'ajio' || platform === 'tirabeauty') {
            const stockEl = element.querySelector('[class*="out-of-stock"], [class*="sold-out"], [class*="notify"]');
            if (stockEl) return true;
        }
        
        if (platform === 'reliancedigital' || platform === 'jiomart') {
            const stockEl = element.querySelector('[class*="out-of-stock"], [class*="sold-out"], [class*="unavailable"]');
            if (stockEl) return true;
        }
        
        // Check for disabled add-to-cart buttons
        const addToCartBtn = element.querySelector('button[class*="add"], button[class*="cart"], button[class*="buy"]');
        if (addToCartBtn && (addToCartBtn.disabled || addToCartBtn.classList.contains('disabled'))) {
            return true;
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Filter products - removes sponsored and out-of-stock items
 * 
 * @param {NodeList|Array} containers - Product container elements
 * @param {string} platform - Platform name
 * @returns {Object} - { valid: [], sponsored: [], outOfStock: [], stats: {} }
 */
export function filterProducts(containers, platform = 'generic') {
    const valid = [];
    const sponsored = [];
    const outOfStock = [];
    
    const containerArray = Array.from(containers);
    
    for (const container of containerArray) {
        if (isSponsoredProduct(container, platform)) {
            sponsored.push(container);
        } else if (isOutOfStock(container, platform)) {
            outOfStock.push(container);
        } else {
            valid.push(container);
        }
    }
    
    const stats = {
        total: containerArray.length,
        valid: valid.length,
        sponsored: sponsored.length,
        outOfStock: outOfStock.length
    };
    
    logger.info('Product filtering complete', { platform, ...stats });
    
    return { valid, sponsored, outOfStock, stats };
}

/**
 * Check if a product object should be excluded
 * Use when you already have extracted product data
 */
export function shouldExcludeProduct(product, platform = 'generic') {
    if (!product) return true;
    
    const title = (product.title || '').toLowerCase();
    const price = (product.price || '').toLowerCase();
    
    // Check for sponsored in title
    if (title.includes('[ad]') || title.includes('[sponsored]')) {
        return true;
    }
    
    // Check for out of stock
    const outOfStockPhrases = ['out of stock', 'sold out', 'unavailable', 'coming soon'];
    for (const phrase of outOfStockPhrases) {
        if (price.includes(phrase) || (product.availability || '').toLowerCase().includes(phrase)) {
            return true;
        }
    }
    
    // Check if product is marked as sponsored
    if (product.sponsored === true || product.isSponsored === true) {
        return true;
    }
    
    // Check if product is out of stock
    if (product.outOfStock === true || product.isOutOfStock === true) {
        return true;
    }
    
    return false;
}

