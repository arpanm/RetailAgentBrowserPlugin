/**
 * Amazon URL Filter Builder
 * Builds Amazon search URLs with filter parameters
 */

import { logger } from './logger.js';
import {
    AMAZON_FILTER_IDS,
    buildFilterRefinement,
    validateFilters,
    rupeesToPaise,
    getRAMCodesGTE,
    getBatteryCodesGTE,
    getStorageCodesGTE,
    getFilterCode
} from './amazon-filter-codes.js';

/**
 * Build Amazon filter URL from user filters
 * @param {string} baseURL - Base search URL
 * @param {Object} filters - User filter object
 * @returns {string} - Complete URL with filters
 */
export function buildAmazonFilterURL(baseURL, filters) {
    try {
        // Validate filters
        const validation = validateFilters(filters);
        if (!validation.valid) {
            logger.warn('Invalid filters', { errors: validation.errors });
            // Continue with valid filters only
        }
        
        const url = new URL(baseURL);
        
        // Build refinement string
        const rhParam = buildFilterRefinement(filters);
        
        if (rhParam) {
            // Set or update rh parameter
            url.searchParams.set('rh', rhParam);
            
            logger.info('Built Amazon filter URL', {
                baseURL,
                filters,
                rhParam,
                finalURL: url.toString()
            });
        } else {
            logger.warn('No filters to apply', { filters });
        }
        
        return url.toString();
        
    } catch (error) {
        logger.error('Error building Amazon filter URL', error);
        return baseURL;
    }
}

/**
 * Add filters to existing Amazon URL
 * Preserves existing URL parameters
 * @param {string} currentURL - Current Amazon URL
 * @param {Object} newFilters - New filters to add/update
 * @returns {string} - Updated URL
 */
export function addFiltersToAmazonURL(currentURL, newFilters) {
    try {
        const url = new URL(currentURL);
        
        // Get existing rh parameter
        const existingRh = url.searchParams.get('rh') || '';
        
        // Parse existing filters
        const existingFilters = parseRhParameter(existingRh);
        
        // Merge with new filters
        const mergedFilters = { ...existingFilters, ...newFilters };
        
        // Build new rh parameter
        const newRh = buildFilterRefinement(mergedFilters);
        
        if (newRh) {
            url.searchParams.set('rh', newRh);
        }
        
        logger.info('Added filters to Amazon URL', {
            existingFilters,
            newFilters,
            mergedFilters,
            finalURL: url.toString()
        });
        
        return url.toString();
        
    } catch (error) {
        logger.error('Error adding filters to Amazon URL', error);
        return currentURL;
    }
}

/**
 * Remove specific filters from Amazon URL
 * @param {string} currentURL - Current Amazon URL
 * @param {string[]} filterTypesToRemove - Array of filter types to remove
 * @returns {string} - Updated URL
 */
export function removeFiltersFromAmazonURL(currentURL, filterTypesToRemove) {
    try {
        const url = new URL(currentURL);
        const existingRh = url.searchParams.get('rh') || '';
        
        if (!existingRh) return currentURL;
        
        const refinements = existingRh.split(',');
        const filterIdsToRemove = filterTypesToRemove.map(type => AMAZON_FILTER_IDS[type]).filter(Boolean);
        
        // Filter out refinements to remove
        const filteredRefinements = refinements.filter(ref => {
            const filterId = ref.split(':')[0];
            return !filterIdsToRemove.includes(filterId);
        });
        
        if (filteredRefinements.length > 0) {
            url.searchParams.set('rh', filteredRefinements.join(','));
        } else {
            url.searchParams.delete('rh');
        }
        
        logger.info('Removed filters from Amazon URL', {
            filterTypesToRemove,
            finalURL: url.toString()
        });
        
        return url.toString();
        
    } catch (error) {
        logger.error('Error removing filters from Amazon URL', error);
        return currentURL;
    }
}

/**
 * Parse rh parameter into filter object
 * @param {string} rhParam - The rh parameter value
 * @returns {Object} - Parsed filters
 */
function parseRhParameter(rhParam) {
    const filters = {};
    
    if (!rhParam) return filters;
    
    try {
        const refinements = rhParam.split(',');
        
        for (const refinement of refinements) {
            const [filterId, value] = refinement.split(':');
            
            if (!filterId || !value) continue;
            
            // Map filter ID back to filter type
            const filterType = Object.keys(AMAZON_FILTER_IDS).find(
                key => AMAZON_FILTER_IDS[key] === filterId
            );
            
            if (filterType) {
                // Store the value (parsing happens in amazon-filter-codes.js)
                filters[filterType] = value;
            }
        }
    } catch (error) {
        logger.error('Error parsing rh parameter', error);
    }
    
    return filters;
}

/**
 * Build URL for specific test case
 * @param {string} searchQuery - Search query
 * @param {Object} filters - Filter object with rating, price, battery, RAM
 * @returns {string} - Complete Amazon search URL with filters
 */
export function buildTestCaseURL(searchQuery, filters) {
    const baseURL = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;
    return buildAmazonFilterURL(baseURL, filters);
}

/**
 * Verify URL contains expected filters
 * @param {string} url - URL to verify
 * @param {Object} expectedFilters - Expected filters
 * @returns {Object} - {matches: boolean, missing: string[], extra: string[]}
 */
export function verifyFiltersInURL(url, expectedFilters) {
    try {
        const urlObj = new URL(url);
        const rhParam = urlObj.searchParams.get('rh');
        
        if (!rhParam) {
            return {
                matches: false,
                missing: Object.keys(expectedFilters),
                extra: []
            };
        }
        
        const actualFilters = parseRhParameter(rhParam);
        const missing = [];
        const extra = [];
        
        // Check expected filters are present
        for (const [key, value] of Object.entries(expectedFilters)) {
            if (!actualFilters[key]) {
                missing.push(key);
            }
        }
        
        // Check for extra filters not expected
        for (const key of Object.keys(actualFilters)) {
            if (!expectedFilters.hasOwnProperty(key)) {
                extra.push(key);
            }
        }
        
        const matches = missing.length === 0;
        
        logger.info('URL filter verification', {
            url,
            expectedFilters,
            actualFilters,
            matches,
            missing,
            extra
        });
        
        return { matches, missing, extra };
        
    } catch (error) {
        logger.error('Error verifying filters in URL', error);
        return {
            matches: false,
            missing: Object.keys(expectedFilters),
            extra: []
        };
    }
}

/**
 * Extract rh parameter from URL
 * @param {string} url - Amazon URL
 * @returns {string|null} - rh parameter value or null
 */
export function extractRhParameter(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('rh');
    } catch (error) {
        logger.error('Error extracting rh parameter', error);
        return null;
    }
}

/**
 * Compare two URLs to check if filters match
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} - True if filters match
 */
export function compareFilteredURLs(url1, url2) {
    try {
        const rh1 = extractRhParameter(url1);
        const rh2 = extractRhParameter(url2);
        
        if (!rh1 && !rh2) return true; // Both have no filters
        if (!rh1 || !rh2) return false; // One has filters, one doesn't
        
        // Parse and compare filters
        const filters1 = parseRhParameter(rh1);
        const filters2 = parseRhParameter(rh2);
        
        const keys1 = Object.keys(filters1).sort();
        const keys2 = Object.keys(filters2).sort();
        
        if (keys1.length !== keys2.length) return false;
        if (keys1.join(',') !== keys2.join(',')) return false;
        
        // Compare values
        for (const key of keys1) {
            if (filters1[key] !== filters2[key]) return false;
        }
        
        return true;
        
    } catch (error) {
        logger.error('Error comparing filtered URLs', error);
        return false;
    }
}

/**
 * Build URL for the specific test case mentioned by user
 * Before: https://www.amazon.in/s?k=samsung+phone...&ref=nb_sb_noss (25 results)
 * After: Should have 12 results with specific filters
 */
export function buildSpecificTestCaseURL() {
    const searchQuery = 'samsung phone';
    const filters = {
        rating: 4,           // 4+ stars (p_123:46655)
        price_min: 13000,    // ₹13,000
        price_max: 19500,    // ₹19,500  (p_36:1300000-1950000)
        battery: 5000,       // 5000mAh+ (p_n_g-101015098008111:91805326031|92071917031)
        ram: 6               // 6GB+ (p_n_g-1003495121111:44897287031|44897288031)
    };
    
    const url = buildTestCaseURL(searchQuery, filters);
    
    logger.info('Built specific test case URL', {
        searchQuery,
        filters,
        url,
        expectedResults: 12
    });
    
    return url;
}

/**
 * Decode URL-encoded rh parameter for readability
 * @param {string} url - Amazon URL
 * @returns {string} - Human-readable filter description
 */
export function describeFiltersInURL(url) {
    try {
        const rhParam = extractRhParameter(url);
        
        if (!rhParam) {
            return 'No filters applied';
        }
        
        const filters = parseRhParameter(rhParam);
        const descriptions = [];
        
        for (const [key, value] of Object.entries(filters)) {
            switch (key) {
                case 'rating':
                    descriptions.push(`Rating: ${value}+ stars`);
                    break;
                case 'price':
                    descriptions.push(`Price: ${value}`);
                    break;
                case 'battery':
                    descriptions.push(`Battery: ${value}mAh+`);
                    break;
                case 'ram':
                    descriptions.push(`RAM: ${value}GB+`);
                    break;
                case 'storage':
                    descriptions.push(`Storage: ${value}GB+`);
                    break;
                default:
                    descriptions.push(`${key}: ${value}`);
                    break;
            }
        }
        
        return descriptions.join(', ');
        
    } catch (error) {
        logger.error('Error describing filters in URL', error);
        return 'Error reading filters';
    }
}

