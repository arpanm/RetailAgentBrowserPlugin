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
    
    // Brand filter - lenient matching with aliases
    if (filters.brand) {
        const brandLower = filters.brand.toLowerCase().trim();
        const titleLower = title.toLowerCase();
        
        // Brand alias mapping for common variations
        const brandAliases = {
            'samsung': ['samsung', 'samsung electronics', 'samsung mobile'],
            'apple': ['apple', 'iphone', 'ipad'],
            'xiaomi': ['xiaomi', 'mi', 'redmi', 'poco'],
            'oneplus': ['oneplus', 'one plus', '1+'],
            'realme': ['realme', 'real me'],
            'vivo': ['vivo', 'iqoo'],
            'oppo': ['oppo', 'reno'],
            'motorola': ['motorola', 'moto'],
            'nokia': ['nokia', 'hmd global'],
            'google': ['google', 'pixel'],
            'asus': ['asus', 'rog'],
            'sony': ['sony', 'xperia'],
            'lg': ['lg', 'lg electronics']
        };
        
        // Get all aliases for the required brand
        let brandVariations = [brandLower];
        for (const [mainBrand, aliases] of Object.entries(brandAliases)) {
            if (aliases.some(alias => brandLower.includes(alias) || alias.includes(brandLower))) {
                brandVariations = [...new Set([...brandVariations, ...aliases])];
                break;
            }
        }
        
        // Check if title contains any brand variation (lenient substring match)
        const hasBrand = brandVariations.some(variation => {
            // Fuzzy matching - allow for minor typos and variations
            const words = variation.split(/\s+/);
            return words.every(word => {
                // Check exact substring match
                if (titleLower.includes(word)) return true;
                
                // Check fuzzy match (allow 1 character difference for words > 3 chars)
                if (word.length > 3) {
                    const regex = new RegExp(word.split('').join('.?'), 'i');
                    if (regex.test(titleLower)) return true;
                }
                
                return false;
            });
        });
        
        if (!hasBrand) {
            logger.debug('Product filtered out: brand mismatch', { 
                requiredBrand: filters.brand,
                brandVariations: brandVariations,
                productTitle: product.title?.substring(0, 80),
                titleLower: titleLower.substring(0, 80)
            });
            return false;
        }
        
        // Note: Removed conflicting brand detection to be more lenient
        // Products can mention accessories or compatibility with other brands
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
    
    // RAM filter (e.g., "6gb", "8gb") - More lenient matching
    if (filters.ram) {
        const ramLower = filters.ram.toLowerCase().replace(/\s+/g, '');
        const requiredRam = parseInt(ramLower.replace(/gb/i, ''));
        
        // Try multiple patterns to find RAM
        const ramPatterns = [
            /(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory)/i,
            /(?:ram|memory)[^\d]*(\d+)\s*(?:gb|gigabytes?)/i,
            /(\d+)\s*(?:gb)\s*(?:ram|memory)/i
        ];
        
        let ramMatch = null;
        for (const pattern of ramPatterns) {
            ramMatch = title.match(pattern);
            if (ramMatch) break;
        }
        
        // Also check if product has RAM attribute from LLM extraction
        if (!ramMatch && product.ram && typeof product.ram === 'number') {
            const productRam = product.ram;
            if (productRam < requiredRam) {
                logger.debug('Product filtered out: RAM too low (from attributes)', { 
                    required: filters.ram,
                    found: productRam,
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
            // RAM from attributes meets requirement, continue
        } else if (ramMatch) {
            const foundRam = parseInt(ramMatch[1]);
            if (foundRam < requiredRam) {
                logger.debug('Product filtered out: RAM too low', { 
                    required: filters.ram,
                    found: ramMatch[0],
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
        } else {
            // RAM not found in title and not in attributes - be lenient, don't reject
            logger.debug('Product matching RAM check: RAM not found, accepting anyway (will check attributes later)', { 
                ram: filters.ram,
                title: product.title?.substring(0, 50)
            });
        }
    }
    
    // Battery filter (e.g., 6000 mAh) - More lenient matching
    if (filters.battery) {
        // Try multiple patterns to find battery
        const batteryPatterns = [
            /(\d+)\s*(?:mah|mAh|battery)/i,
            /(?:battery|mah)[^\d]*(\d+)/i,
            /(\d+)\s*(?:mah)/i
        ];
        
        let batteryMatch = null;
        for (const pattern of batteryPatterns) {
            batteryMatch = title.match(pattern);
            if (batteryMatch) break;
        }
        
        // Also check if product has battery attribute from LLM extraction
        if (!batteryMatch && product.battery && typeof product.battery === 'number') {
            const productBattery = product.battery;
            if (productBattery < filters.battery) {
                logger.debug('Product filtered out: battery too low (from attributes)', { 
                    required: filters.battery,
                    found: productBattery,
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
            // Battery from attributes meets requirement, continue
        } else if (batteryMatch) {
            const foundBattery = parseInt(batteryMatch[1]);
            if (foundBattery < filters.battery) {
                logger.debug('Product filtered out: battery too low', { 
                    required: filters.battery,
                    found: foundBattery,
                    title: product.title?.substring(0, 50)
                });
                return false;
            }
        } else {
            // Battery not found in title and not in attributes - be lenient, don't reject
            logger.debug('Product matching battery check: battery not found, accepting anyway (will check attributes later)', { 
                battery: filters.battery,
                title: product.title?.substring(0, 50)
            });
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
 * Parse price string to number - improved to handle more formats
 */
export function parsePrice(priceStr) {
    if (!priceStr) return 0;
    
    // Handle "from" prices (e.g., "From ₹15,999")
    let cleaned = priceStr.toString().toLowerCase();
    if (cleaned.includes('from')) {
        cleaned = cleaned.replace(/from\s*/i, '');
    }
    
    // Remove currency symbols, commas, and spaces
    cleaned = cleaned.replace(/[₹$€£¥,\s]/g, '');
    
    // Handle "k" or "thousand" notation (e.g., "15k" = 15000)
    const kMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*k/i);
    if (kMatch) {
        return parseFloat(kMatch[1]) * 1000;
    }
    
    // Extract numeric value (handle ranges like "15,999 - 20,000")
    const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
        // Use the lower price from range
        return parseFloat(rangeMatch[1]);
    }
    
    // Extract single price
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

