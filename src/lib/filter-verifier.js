/**
 * Filter Verification System
 * Verifies that filters were applied successfully on e-commerce platforms
 */

import { logger } from './logger.js';
import { parseAmazonFilters, hasFilter } from './amazon-url-parser.js';

/**
 * Verify filters were applied successfully
 * @param {Object} options - Verification options
 * @param {string} options.url - Current page URL
 * @param {Object} options.expectedFilters - Expected filter state
 * @param {number} options.beforeCount - Product count before filters
 * @param {number} options.afterCount - Product count after filters
 * @param {string} options.platform - Platform name (amazon, flipkart, etc.)
 * @returns {Object} - Verification result
 */
export function verifyFiltersApplied(options) {
    const {
        url,
        expectedFilters,
        beforeCount,
        afterCount,
        platform = 'amazon'
    } = options;
    
    const result = {
        success: false,
        checks: {
            urlParameters: false,
            productCountChanged: false,
            allFiltersPresent: false
        },
        details: {},
        errors: []
    };
    
    try {
        // Check 1: URL contains filter parameters
        result.checks.urlParameters = checkUrlParameters(url, expectedFilters, platform);
        
        // Check 2: Product count changed
        if (typeof beforeCount === 'number' && typeof afterCount === 'number') {
            result.checks.productCountChanged = afterCount !== beforeCount && afterCount > 0;
            result.details.beforeCount = beforeCount;
            result.details.afterCount = afterCount;
            result.details.countDiff = beforeCount - afterCount;
        }
        
        // Check 3: All expected filters present
        const filterChecks = checkIndividualFilters(url, expectedFilters, platform);
        result.checks.allFiltersPresent = filterChecks.allPresent;
        result.details.filterChecks = filterChecks.details;
        result.details.missingFilters = filterChecks.missing;
        
        // Overall success: at least URL parameters check passed
        result.success = result.checks.urlParameters;
        
        // Log verification result
        const passedChecks = Object.values(result.checks).filter(c => c).length;
        logger.info(`Filter verification: ${passedChecks}/3 checks passed`, {
            platform,
            url: url.substring(0, 100),
            checks: result.checks
        });
        
        if (!result.success) {
            result.errors.push('Filter verification failed: filters not present in URL');
        }
        
    } catch (error) {
        logger.error('Filter verification error', error);
        result.errors.push(`Verification error: ${error.message}`);
    }
    
    return result;
}

/**
 * Check if URL contains expected filter parameters
 * @param {string} url - Page URL
 * @param {Object} expectedFilters - Expected filters
 * @param {string} platform - Platform name
 * @returns {boolean} - True if URL contains filters
 */
function checkUrlParameters(url, expectedFilters, platform) {
    try {
        const urlObj = new URL(url);
        
        if (platform === 'amazon') {
            const rh = urlObj.searchParams.get('rh');
            return rh !== null && rh.length > 0;
        } else if (platform === 'flipkart') {
            const pParams = urlObj.searchParams.getAll('p[]');
            return pParams.length > 0;
        }
        
        return false;
    } catch (error) {
        logger.warn('Failed to check URL parameters', { error: error.message });
        return false;
    }
}

/**
 * Check individual filters in URL
 * @param {string} url - Page URL
 * @param {Object} expectedFilters - Expected filters
 * @param {string} platform - Platform name
 * @returns {Object} - Filter check results
 */
function checkIndividualFilters(url, expectedFilters, platform) {
    const details = {};
    const missing = [];
    
    try {
        if (platform === 'amazon') {
            const parsedFilters = parseAmazonFilters(url);
            
            // Check price
            if (expectedFilters.price_min !== undefined) {
                details.price_min = parsedFilters.priceMin === expectedFilters.price_min;
                if (!details.price_min) {
                    missing.push('price_min');
                }
            }
            
            if (expectedFilters.price_max !== undefined) {
                details.price_max = parsedFilters.priceMax === expectedFilters.price_max;
                if (!details.price_max) {
                    missing.push('price_max');
                }
            }
            
            // Check rating
            if (expectedFilters.rating) {
                details.rating = parsedFilters.reviews === expectedFilters.rating;
                if (!details.rating) {
                    missing.push('rating');
                }
            }
            
            // Check brand
            if (expectedFilters.brand) {
                const brandLower = expectedFilters.brand.toLowerCase();
                details.brand = parsedFilters.brand.some(b => b.toLowerCase().includes(brandLower));
                if (!details.brand) {
                    missing.push('brand');
                }
            }
            
            // Note: Battery, RAM, Storage use code-based verification
            // which is more complex - we trust the URL builder got it right
            if (expectedFilters.battery) {
                details.battery = parsedFilters.battery.length > 0;
                if (!details.battery) {
                    missing.push('battery');
                }
            }
            
            if (expectedFilters.ram) {
                details.ram = parsedFilters.ram.length > 0;
                if (!details.ram) {
                    missing.push('ram');
                }
            }
            
            if (expectedFilters.storage) {
                details.storage = parsedFilters.storage.length > 0;
                if (!details.storage) {
                    missing.push('storage');
                }
            }
        }
        
    } catch (error) {
        logger.warn('Failed to check individual filters', { error: error.message });
    }
    
    const allPresent = missing.length === 0 && Object.keys(details).length > 0;
    
    return { details, missing, allPresent };
}

/**
 * Verify product count changed after filtering
 * @param {number} beforeCount - Product count before filtering
 * @param {number} afterCount - Product count after filtering
 * @param {Object} options - Options
 * @returns {Object} - Verification result
 */
export function verifyProductCountChanged(beforeCount, afterCount, options = {}) {
    const {
        expectDecrease = true,
        allowSameCount = false,
        minProducts = 1
    } = options;
    
    const result = {
        success: false,
        beforeCount,
        afterCount,
        changed: false,
        validCount: false,
        details: {}
    };
    
    try {
        // Check if count changed
        result.changed = beforeCount !== afterCount;
        
        // Check if count is valid (> 0)
        result.validCount = afterCount >= minProducts;
        
        // Check if count decreased (expected for filters)
        const decreased = afterCount < beforeCount;
        const increased = afterCount > beforeCount;
        
        result.details.decreased = decreased;
        result.details.increased = increased;
        result.details.percentChange = beforeCount > 0 
            ? Math.round(((afterCount - beforeCount) / beforeCount) * 100)
            : 0;
        
        // Determine success
        if (expectDecrease) {
            result.success = decreased && result.validCount;
        } else {
            result.success = (allowSameCount ? afterCount >= 0 : result.changed) && result.validCount;
        }
        
        logger.debug('Product count verification', result);
        
    } catch (error) {
        logger.error('Failed to verify product count', error);
    }
    
    return result;
}

/**
 * Verify DOM indicators show filters are active
 * @param {Document} document - DOM document
 * @param {Object} expectedFilters - Expected filters
 * @param {string} platform - Platform name
 * @returns {Object} - Verification result
 */
export function verifyDOMIndicators(document, expectedFilters, platform = 'amazon') {
    const result = {
        success: false,
        indicatorsFound: [],
        details: {}
    };
    
    try {
        if (platform === 'amazon') {
            // Check for applied filters section
            const appliedFiltersSection = document.querySelector('#applied-filters, [data-component-type="s-applied-filters"]');
            if (appliedFiltersSection) {
                result.indicatorsFound.push('applied-filters-section');
            }
            
            // Check for filter chips/badges
            const filterChips = document.querySelectorAll('.a-color-state, .s-selected-filter, [data-action="s-clear-refinement"]');
            if (filterChips.length > 0) {
                result.indicatorsFound.push('filter-chips');
                result.details.chipCount = filterChips.length;
            }
            
            // Check for URL-based indicators (refined search text)
            const refinedText = Array.from(document.querySelectorAll('span, div')).find(
                el => el.textContent.includes('results for') || el.textContent.includes('filtered by')
            );
            if (refinedText) {
                result.indicatorsFound.push('refined-text');
            }
            
            // Check for active filter checkboxes
            const checkedFilters = document.querySelectorAll('#s-refinements input[type="checkbox"]:checked');
            if (checkedFilters.length > 0) {
                result.indicatorsFound.push('checked-filters');
                result.details.checkedCount = checkedFilters.length;
            }
        } else if (platform === 'flipkart') {
            // Flipkart filter indicators
            const appliedFilters = document.querySelectorAll('[class*="clear"], [class*="applied"]');
            if (appliedFilters.length > 0) {
                result.indicatorsFound.push('applied-filters');
                result.details.filterCount = appliedFilters.length;
            }
        }
        
        result.success = result.indicatorsFound.length > 0;
        
        logger.debug('DOM indicators verification', {
            platform,
            found: result.indicatorsFound.length,
            indicators: result.indicatorsFound
        });
        
    } catch (error) {
        logger.error('Failed to verify DOM indicators', error);
    }
    
    return result;
}

/**
 * Comprehensive filter verification
 * Combines URL, product count, and DOM checks
 * @param {Object} options - All verification options
 * @returns {Object} - Complete verification result
 */
export function comprehensiveVerification(options) {
    const {
        url,
        expectedFilters,
        beforeCount,
        afterCount,
        document,
        platform = 'amazon'
    } = options;
    
    const result = {
        success: false,
        urlCheck: null,
        countCheck: null,
        domCheck: null,
        overallConfidence: 0,
        recommendation: ''
    };
    
    try {
        // Perform all checks
        result.urlCheck = verifyFiltersApplied({
            url,
            expectedFilters,
            beforeCount,
            afterCount,
            platform
        });
        
        if (typeof beforeCount === 'number' && typeof afterCount === 'number') {
            result.countCheck = verifyProductCountChanged(beforeCount, afterCount);
        }
        
        if (document) {
            result.domCheck = verifyDOMIndicators(document, expectedFilters, platform);
        }
        
        // Calculate confidence score (0-100)
        let confidence = 0;
        let checksRun = 0;
        
        if (result.urlCheck) {
            checksRun++;
            if (result.urlCheck.success) confidence += 50; // URL check is most important
        }
        
        if (result.countCheck) {
            checksRun++;
            if (result.countCheck.success) confidence += 30;
        }
        
        if (result.domCheck) {
            checksRun++;
            if (result.domCheck.success) confidence += 20;
        }
        
        result.overallConfidence = Math.round(confidence);
        
        // Determine overall success (at least 50% confidence)
        result.success = result.overallConfidence >= 50;
        
        // Provide recommendation
        if (result.overallConfidence >= 80) {
            result.recommendation = 'Filters applied successfully';
        } else if (result.overallConfidence >= 50) {
            result.recommendation = 'Filters partially applied, verify manually';
        } else {
            result.recommendation = 'Filter application likely failed, retry recommended';
        }
        
        logger.info('Comprehensive filter verification complete', {
            confidence: result.overallConfidence,
            success: result.success,
            recommendation: result.recommendation
        });
        
    } catch (error) {
        logger.error('Comprehensive verification failed', error);
        result.recommendation = 'Verification error occurred';
    }
    
    return result;
}

/**
 * Quick verification - just checks URL
 * @param {string} url - Page URL
 * @param {Object} expectedFilters - Expected filters
 * @param {string} platform - Platform name
 * @returns {boolean} - True if filters present in URL
 */
export function quickVerify(url, expectedFilters, platform = 'amazon') {
    try {
        return checkUrlParameters(url, expectedFilters, platform);
    } catch (error) {
        logger.warn('Quick verification failed', { error: error.message });
        return false;
    }
}

