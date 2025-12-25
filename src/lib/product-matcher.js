/**
 * Product Matching Module
 * Matches products against filters and requirements
 */

import { logger } from './logger.js';

/**
 * Check if a product matches the given filters
 */
export function matchesFilters(product, filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
        return true; // No filters means match all
    }

    const title = (product.title || '').toLowerCase();
    const price = parsePrice(product.price || '');
    
    // Price filters
    if (filters.price_min && price > 0 && price < filters.price_min) {
        logger.debug('Product filtered out: price too low', { 
            price, 
            min: filters.price_min,
            title: product.title?.substring(0, 50)
        });
        return false;
    }
    
    if (filters.price_max && price > 0 && price > filters.price_max) {
        logger.debug('Product filtered out: price too high', { 
            price, 
            max: filters.price_max,
            title: product.title?.substring(0, 50)
        });
        return false;
    }
    
    // Brand filter - must be strict match
    if (filters.brand) {
        const brandLower = filters.brand.toLowerCase().trim();
        const titleLower = title.toLowerCase();
        
        // Check if title contains the brand name (exact word match preferred)
        const brandWords = brandLower.split(/\s+/);
        const hasBrand = brandWords.some(word => {
            // Try exact word match first (word boundaries)
            const exactMatch = new RegExp(`\\b${word}\\b`, 'i').test(titleLower);
            if (exactMatch) return true;
            // Fallback to substring match
            return titleLower.includes(word);
        });
        
        if (!hasBrand) {
            logger.info('Product filtered out: brand mismatch', { 
                requiredBrand: filters.brand,
                productTitle: product.title?.substring(0, 80),
                titleLower: titleLower.substring(0, 80)
            });
            return false;
        }
        
        // Also check for conflicting brands (if title mentions other brands, reject)
        const conflictingBrands = ['samsung', 'apple', 'iphone', 'xiaomi', 'redmi', 'oneplus', 'oppo', 'vivo', 'realme', 'nokia', 'lg', 'sony'];
        const mentionedBrands = conflictingBrands.filter(brand => 
            brand !== brandLower && titleLower.includes(brand)
        );
        
        if (mentionedBrands.length > 0 && !titleLower.includes(brandLower)) {
            logger.info('Product filtered out: conflicting brand mentioned', { 
                requiredBrand: filters.brand,
                conflictingBrands: mentionedBrands,
                productTitle: product.title?.substring(0, 80)
            });
            return false;
        }
    }
    
    // Storage filter (e.g., "128gb", "256gb")
    if (filters.storage) {
        const storageLower = filters.storage.toLowerCase().replace(/\s+/g, '');
        // Extract all potential storage strings from title
        const matches = [...title.matchAll(/(\d+)\s*(?:gb|gigabytes?|tb|terabytes?)/gi)];
        
        if (matches.length === 0) {
            logger.debug('Product matching storage check: storage not in title, accepting anyway', { 
                storage: filters.storage,
                title: product.title?.substring(0, 50)
            });
            // Don't reject if not in title
        } else {
            const hasMatch = matches.some(match => {
                const productStorage = match[0].toLowerCase().replace(/\s+/g, '');
                return productStorage.includes(storageLower);
            });

            if (!hasMatch) {
                logger.debug('Product filtered out: storage mismatch', { 
                    required: filters.storage,
                    found: matches.map(m => m[0]),
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
        }
    }
    
    // RAM filter (e.g., "6gb", "8gb")
    if (filters.ram) {
        const ramLower = filters.ram.toLowerCase().replace(/\s+/g, '');
        // Extract RAM from title (e.g., "6gb ram", "8gb ram")
        const ramMatch = title.match(/(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory)/i);
        if (!ramMatch) {
            logger.debug('Product matching RAM check: RAM not in title, accepting anyway', { 
                ram: filters.ram,
                title: product.title?.substring(0, 50)
            });
            // Don't reject if not in title, might be in description/attributes
        } else {
            const productRam = ramMatch[0].toLowerCase().replace(/\s+/g, '');
            const requiredRam = parseInt(ramLower.replace(/gb/i, ''));
            const foundRam = parseInt(ramMatch[1]);
            if (foundRam < requiredRam) {
                logger.debug('Product filtered out: RAM too low', { 
                    required: filters.ram,
                    found: ramMatch[0],
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
        }
    }
    
    // Battery filter (e.g., 6000 mAh)
    if (filters.battery) {
        const batteryMatch = title.match(/(\d+)\s*(?:mah|mAh|battery)/i);
        if (!batteryMatch) {
            logger.debug('Product matching battery check: battery not in title, accepting anyway', { 
                battery: filters.battery,
                title: product.title?.substring(0, 50)
            });
            // Don't reject if not in title, might be in description/attributes
        } else {
            const foundBattery = parseInt(batteryMatch[1]);
            if (foundBattery < filters.battery) {
                logger.debug('Product filtered out: battery too low', { 
                    required: filters.battery,
                    found: foundBattery,
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
        }
    }
    
    // Rating filter
    if (filters.rating) {
        const rating = parseRating(product.rating || '');
        if (rating > 0 && rating < filters.rating) {
            logger.debug('Product filtered out: rating too low', { 
                rating,
                min: filters.rating,
                title: product.title?.substring(0, 50)
            });
            return false;
        }
    }
    
    return true;
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    // Remove currency symbols and commas
    const cleaned = priceStr.toString().replace(/[₹$€£,\s]/g, '');
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse rating string to number
 */
function parseRating(ratingStr) {
    if (!ratingStr) return 0;
    // Extract number from rating (e.g., "4.5 out of 5" -> 4.5)
    const match = ratingStr.toString().match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

/**
 * Rank products based on intent (cheapest, best rated, etc.)
 */
export function rankResults(products, intent = {}) {
    const { sortStrategy = 'relevant', urgency = 'none' } = intent;
    
    logger.info('Ranking products', { count: products.length, strategy: sortStrategy });

    return [...products].sort((a, b) => {
        const priceA = parsePrice(a.price);
        const priceB = parsePrice(b.price);
        const ratingA = parseRating(a.rating);
        const ratingB = parseRating(b.rating);

        // 1. Primary Strategy
        if (sortStrategy === 'cheapest') {
            if (priceA !== priceB) return priceA - priceB;
        } else if (sortStrategy === 'best_rated') {
            if (ratingA !== ratingB) return ratingB - ratingA;
        }

        // 2. Secondary: If equal, prefer higher rating
        if (ratingA !== ratingB) return ratingB - ratingA;

        // 3. Tertiary: If still equal, prefer lower price
        return priceA - priceB;
    });
}

/**
 * Perform strict regex-based verification of attributes
 */
export function verifyAttributes(product, attributes = {}) {
    const title = (product.title || '').toLowerCase();
    const results = { matches: true, failures: [] };

    for (const [key, value] of Object.entries(attributes)) {
        if (!value) continue;

        const valStr = value.toString().toLowerCase();
        // Regex for the value with word boundaries, handling units
        const regex = new RegExp(`\\b${valStr.replace(/(\d+)([a-z]+)/, '$1\\s*$2')}\\b`, 'i');
        
        if (!regex.test(title)) {
            results.matches = false;
            results.failures.push(`${key}: ${value}`);
        }
    }

    return results;
}

/**
 * Filter products based on criteria
 */
export function filterProducts(products, filters = {}, intent = {}) {
    if (!filters || Object.keys(filters).length === 0) {
        return products;
    }
    
    logger.info('Starting product filtering', { 
        total: products.length, 
        filters: filters
    });
    
    const filtered = [];
    const rejected = [];
    
    for (const product of products) {
        if (matchesFilters(product, filters)) {
            filtered.push(product);
        } else {
            rejected.push({
                title: product.title?.substring(0, 60),
                reason: 'Does not match filters'
            });
        }
    }
    
    logger.info('Product filtering completed', { 
        total: products.length, 
        filtered: filtered.length,
        rejected: rejected.length,
        filters: Object.keys(filters),
        rejectedSamples: rejected.slice(0, 3) // Log first 3 rejected
    });
    
    return filtered;
}

/**
 * Check if product is unavailable
 */
export function isUnavailable(product) {
    const title = (product.title || '').toLowerCase();
    const unavailableKeywords = [
        'unavailable',
        'out of stock',
        'currently unavailable',
        'not available',
        'sold out',
        'discontinued'
    ];
    
    return unavailableKeywords.some(keyword => title.includes(keyword));
}

