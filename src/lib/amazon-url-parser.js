/**
 * Amazon URL Parameter Parser
 * Parses and constructs Amazon filter URLs with rh (refinement hash) parameter
 */

import { logger } from './logger.js';

/**
 * Parse Amazon filter parameters from URL
 * @param {string} url - Amazon search URL
 * @returns {Object} - Parsed filter object
 */
export function parseAmazonFilters(url) {
    const filters = {
        searchQuery: null,
        reviews: null,
        priceMin: null,
        priceMax: null,
        battery: [],
        ram: [],
        storage: [],
        brand: [],
        other: {}
    };
    
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        
        // Extract search query
        filters.searchQuery = params.get('k') || params.get('field-keywords');
        
        // Extract refinement hash (rh parameter)
        const rh = params.get('rh');
        if (!rh) {
            logger.debug('No rh parameter found in URL');
            return filters;
        }
        
        // Parse rh parameter - format: filter_id:value,filter_id:value
        // Values can be separated by | for multiple values in same filter
        const refinements = rh.split(',');
        
        for (const refinement of refinements) {
            const [filterId, ...valueParts] = refinement.split(':');
            const value = valueParts.join(':'); // Rejoin in case value contains ':'
            
            if (!filterId || !value) continue;
            
            // Parse specific filter types
            if (filterId === 'p_123') {
                // Customer Reviews filter
                filters.reviews = parseReviewsFilter(value);
            } else if (filterId === 'p_36') {
                // Price range filter - format: min_in_paise-max_in_paise
                const priceRange = parsePriceFilter(value);
                filters.priceMin = priceRange.min;
                filters.priceMax = priceRange.max;
            } else if (filterId.includes('101015098008111')) {
                // Battery capacity filter
                const batteryValues = value.split('|');
                filters.battery.push(...batteryValues);
            } else if (filterId.includes('1003495121111')) {
                // RAM size filter
                const ramValues = value.split('|');
                filters.ram.push(...ramValues);
            } else if (filterId.includes('1003492455111')) {
                // Storage capacity filter
                const storageValues = value.split('|');
                filters.storage.push(...storageValues);
            } else if (filterId === 'p_89' || filterId.includes('brand')) {
                // Brand filter
                const brandValues = value.split('|');
                filters.brand.push(...brandValues);
            } else {
                // Store other filters
                filters.other[filterId] = value.split('|');
            }
        }
        
        logger.debug('Parsed Amazon filters', filters);
        return filters;
        
    } catch (error) {
        logger.error('Failed to parse Amazon filters', error, { url });
        return filters;
    }
}

/**
 * Parse reviews filter value
 * @param {string} value - Reviews filter code
 * @returns {number|null} - Minimum star rating
 */
function parseReviewsFilter(value) {
    const reviewCodes = {
        '46655': 4, // 4 stars & up
        '46654': 3, // 3 stars & up
        '46653': 2, // 2 stars & up
        '46652': 1  // 1 star & up
    };
    
    return reviewCodes[value] || null;
}

/**
 * Parse price filter value
 * @param {string} value - Price range in paise (format: min-max)
 * @returns {Object} - { min, max } in rupees
 */
function parsePriceFilter(value) {
    try {
        const [minPaise, maxPaise] = value.split('-').map(v => parseInt(v, 10));
        return {
            min: minPaise ? minPaise / 100 : null,
            max: maxPaise ? maxPaise / 100 : null
        };
    } catch (error) {
        logger.warn('Failed to parse price filter', { value });
        return { min: null, max: null };
    }
}

/**
 * Build Amazon filter URL from filter object
 * @param {string} baseUrl - Base Amazon search URL
 * @param {Object} filters - Filter object
 * @returns {string} - URL with filters applied
 */
export function buildAmazonFilterUrl(baseUrl, filters) {
    try {
        const url = new URL(baseUrl);
        const refinements = [];
        
        // Add reviews filter
        if (filters.reviews) {
            const reviewCodes = {
                4: '46655',
                3: '46654',
                2: '46653',
                1: '46652'
            };
            const code = reviewCodes[filters.reviews];
            if (code) {
                refinements.push(`p_123:${code}`);
            }
        }
        
        // Add price range filter
        if (filters.priceMin !== null || filters.priceMax !== null) {
            const minPaise = filters.priceMin ? Math.round(filters.priceMin * 100) : 0;
            const maxPaise = filters.priceMax ? Math.round(filters.priceMax * 100) : 999999999;
            refinements.push(`p_36:${minPaise}-${maxPaise}`);
        }
        
        // Add battery filter
        if (filters.battery && filters.battery.length > 0) {
            const batteryValues = filters.battery.join('|');
            refinements.push(`p_n_g-101015098008111:${batteryValues}`);
        }
        
        // Add RAM filter
        if (filters.ram && filters.ram.length > 0) {
            const ramValues = filters.ram.join('|');
            refinements.push(`p_n_g-1003495121111:${ramValues}`);
        }
        
        // Add storage filter
        if (filters.storage && filters.storage.length > 0) {
            const storageValues = filters.storage.join('|');
            refinements.push(`p_n_g-1003492455111:${storageValues}`);
        }
        
        // Add brand filter
        if (filters.brand && filters.brand.length > 0) {
            const brandValues = filters.brand.join('|');
            refinements.push(`p_89:${brandValues}`);
        }
        
        // Add other filters
        if (filters.other) {
            for (const [filterId, values] of Object.entries(filters.other)) {
                if (Array.isArray(values) && values.length > 0) {
                    refinements.push(`${filterId}:${values.join('|')}`);
                }
            }
        }
        
        // Set rh parameter
        if (refinements.length > 0) {
            url.searchParams.set('rh', refinements.join(','));
        }
        
        logger.debug('Built Amazon filter URL', { refinements: refinements.length });
        return url.href;
        
    } catch (error) {
        logger.error('Failed to build Amazon filter URL', error);
        return baseUrl;
    }
}

/**
 * Extract filter codes from Amazon filter URL
 * Useful for verification
 * @param {string} url - Amazon URL
 * @returns {Array<string>} - Array of filter codes
 */
export function extractFilterCodes(url) {
    const codes = [];
    
    try {
        const urlObj = new URL(url);
        const rh = urlObj.searchParams.get('rh');
        
        if (!rh) return codes;
        
        const refinements = rh.split(',');
        for (const refinement of refinements) {
            const [filterId, value] = refinement.split(':');
            if (filterId && value) {
                // Extract individual codes from pipe-separated values
                const valueCodes = value.split('|');
                codes.push(...valueCodes.map(code => `${filterId}:${code}`));
            }
        }
        
    } catch (error) {
        logger.warn('Failed to extract filter codes', { error: error.message });
    }
    
    return codes;
}

/**
 * Compare two Amazon URLs to check if filters match
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} - True if filters match
 */
export function compareFilterUrls(url1, url2) {
    try {
        const filters1 = parseAmazonFilters(url1);
        const filters2 = parseAmazonFilters(url2);
        
        // Compare each filter type
        const matches = {
            reviews: filters1.reviews === filters2.reviews,
            priceMin: filters1.priceMin === filters2.priceMin,
            priceMax: filters1.priceMax === filters2.priceMax,
            battery: arraysEqual(filters1.battery, filters2.battery),
            ram: arraysEqual(filters1.ram, filters2.ram),
            storage: arraysEqual(filters1.storage, filters2.storage),
            brand: arraysEqual(filters1.brand, filters2.brand)
        };
        
        const allMatch = Object.values(matches).every(m => m);
        
        logger.debug('Filter URL comparison', { matches, allMatch });
        return allMatch;
        
    } catch (error) {
        logger.error('Failed to compare filter URLs', error);
        return false;
    }
}

/**
 * Helper to compare arrays
 */
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
}

/**
 * Check if URL has specific filter applied
 * @param {string} url - Amazon URL
 * @param {string} filterType - Filter type (reviews, price, battery, ram, storage, brand)
 * @param {any} expectedValue - Expected filter value
 * @returns {boolean} - True if filter is applied with expected value
 */
export function hasFilter(url, filterType, expectedValue) {
    try {
        const filters = parseAmazonFilters(url);
        
        switch (filterType) {
            case 'reviews':
                return filters.reviews === expectedValue;
            case 'priceMin':
                return filters.priceMin === expectedValue;
            case 'priceMax':
                return filters.priceMax === expectedValue;
            case 'battery':
            case 'ram':
            case 'storage':
            case 'brand':
                return filters[filterType].includes(expectedValue);
            default:
                return false;
        }
    } catch (error) {
        logger.warn('Failed to check filter', { filterType, error: error.message });
        return false;
    }
}

/**
 * Get human-readable description of filters from URL
 * @param {string} url - Amazon URL
 * @returns {string} - Human-readable filter description
 */
export function describeFilters(url) {
    try {
        const filters = parseAmazonFilters(url);
        const descriptions = [];
        
        if (filters.searchQuery) {
            descriptions.push(`Search: "${filters.searchQuery}"`);
        }
        
        if (filters.reviews) {
            descriptions.push(`${filters.reviews}+ stars`);
        }
        
        if (filters.priceMin || filters.priceMax) {
            const min = filters.priceMin ? `₹${filters.priceMin}` : '₹0';
            const max = filters.priceMax ? `₹${filters.priceMax}` : '∞';
            descriptions.push(`Price: ${min} - ${max}`);
        }
        
        if (filters.battery.length > 0) {
            descriptions.push(`Battery: ${filters.battery.length} filter(s)`);
        }
        
        if (filters.ram.length > 0) {
            descriptions.push(`RAM: ${filters.ram.length} filter(s)`);
        }
        
        if (filters.storage.length > 0) {
            descriptions.push(`Storage: ${filters.storage.length} filter(s)`);
        }
        
        if (filters.brand.length > 0) {
            descriptions.push(`Brand: ${filters.brand.length} filter(s)`);
        }
        
        return descriptions.join(', ') || 'No filters';
        
    } catch (error) {
        logger.error('Failed to describe filters', error);
        return 'Unknown filters';
    }
}

