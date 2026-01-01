/**
 * Enhanced Amazon Platform Implementation
 * Uses new utilities for precise filter application and product extraction
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, sortResults, discoverAvailableFilters } from '../shared/actions.js';
import { getText, waitForCondition, safeClick, fillInput } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';
import { AMAZON_DOM_MAP } from './amazon-dom-map.js';
import { AmazonFilterSelector, findFilterByText, findFilterByTextVariations } from '../../lib/filter-selector-builder.js';
import { AmazonFilterValueMapper, mapFilterValue } from '../../lib/filter-value-mapper.js';
import { parseAmazonFilters, hasFilter, describeFilters } from '../../lib/amazon-url-parser.js';
import { globalProductCountTracker } from '../../lib/product-counter.js';
import { normalizeRAMSize, normalizeBatteryCapacity, normalizeStorageSize, fuzzyMatch } from '../../lib/text-normalizer.js';

/**
 * Enhanced filter application with URL verification and product count tracking
 */
export async function applyFiltersEnhanced(filters) {
    try {
        logger.info('Amazon Enhanced: Applying filters', { filters });
        
        if (!filters || Object.keys(filters).length === 0) {
            logger.info('Amazon: No filters to apply');
            return true;
        }
        
        // Record product count before filters
        globalProductCountTracker.recordBeforeFilters('amazon');
        
        // Wait for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));
        globalThis.scrollTo(0, 0);
        
        const initialUrl = globalThis.location.href;
        let filtersApplied = 0;
        let filtersFailed = 0;
        const filterResults = {};
        
        // Apply filters in priority order
        const filterOrder = ['price_max', 'price_min', 'rating', 'brand', 'ram', 'battery', 'storage', 'color'];
        
        for (const filterType of filterOrder) {
            if (!filters[filterType]) continue;
            
            const filterValue = filters[filterType];
            logger.info(`Amazon: Applying ${filterType} filter`, { value: filterValue });
            
            try {
                const success = await applySingleFilter(filterType, filterValue, filters);
                
                if (success) {
                    filtersApplied++;
                    filterResults[filterType] = 'success';
                    logger.info(`Amazon: Filter ${filterType} applied successfully`);
                    
                    // Wait for page to update
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    filtersFailed++;
                    filterResults[filterType] = 'failed';
                    logger.warn(`Amazon: Filter ${filterType} failed to apply`);
                }
            } catch (error) {
                filtersFailed++;
                filterResults[filterType] = `error: ${error.message}`;
                logger.error(`Amazon: Error applying filter ${filterType}`, error);
            }
        }
        
        // Record product count after filters
        await new Promise(resolve => setTimeout(resolve, 2000));
        globalProductCountTracker.recordAfterFilters('amazon');
        
        // Verify filters were applied
        const countSummary = globalProductCountTracker.getSummary();
        const urlChanged = globalThis.location.href !== initialUrl;
        const filtersVerified = globalProductCountTracker.verifyFiltersApplied();
        
        logger.info('Amazon: Filter application complete', {
            applied: filtersApplied,
            failed: filtersFailed,
            urlChanged,
            countDecreased: countSummary.decreased,
            filterResults,
            countSummary: countSummary.message
        });
        
        // Log detailed URL analysis
        const currentFilters = parseAmazonFilters(globalThis.location.href);
        logger.info('Amazon: Current filters in URL', {
            description: describeFilters(globalThis.location.href),
            filters: currentFilters
        });
        
        return filtersApplied > 0;
        
    } catch (error) {
        logger.error('Amazon: Failed to apply filters', error);
        throw error;
    }
}

/**
 * Apply a single filter with verification and retry logic
 */
async function applySingleFilter(filterType, filterValue, allFilters) {
    const MAX_RETRIES = 3;
    const TIMEOUT_PER_FILTER = 15000; // 15 seconds max per filter
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.debug(`Amazon: Applying ${filterType} filter (attempt ${attempt}/${MAX_RETRIES})`);
            
            const startTime = Date.now();
            const prevUrl = globalThis.location.href;
            
            let success = false;
            
            switch (filterType) {
                case 'price_min':
                case 'price_max':
                    success = await applyPriceFilter(allFilters.price_min, allFilters.price_max);
                    break;
                    
                case 'rating':
                    success = await applyRatingFilter(filterValue);
                    break;
                    
                case 'brand':
                    success = await applyBrandFilter(filterValue);
                    break;
                    
                case 'ram':
                    success = await applyRAMFilter(filterValue);
                    break;
                    
                case 'battery':
                    success = await applyBatteryFilter(filterValue);
                    break;
                    
                case 'storage':
                    success = await applyStorageFilter(filterValue);
                    break;
                    
                case 'color':
                    success = await applyColorFilter(filterValue);
                    break;
                    
                default:
                    logger.warn(`Amazon: Unknown filter type: ${filterType}`);
                    return false;
            }
            
            if (!success) {
                logger.warn(`Amazon: Filter ${filterType} application returned false`);
                continue; // Try again
            }
            
            // Wait for page update with timeout
            const updateSuccess = await waitForFilterUpdate(prevUrl, filterType, TIMEOUT_PER_FILTER - (Date.now() - startTime));
            
            if (updateSuccess) {
                logger.info(`Amazon: Filter ${filterType} verified successfully`);
                return true;
            } else {
                logger.warn(`Amazon: Filter ${filterType} not verified, retrying...`);
            }
            
        } catch (error) {
            logger.error(`Amazon: Error in filter attempt ${attempt}`, error);
            if (attempt === MAX_RETRIES) {
                throw error;
            }
        }
    }
    
    return false;
}

/**
 * Apply price range filter
 */
async function applyPriceFilter(minPrice, maxPrice) {
    try {
        const selectors = AmazonFilterSelector.getPriceRangeInputs();
        
        // Find price container
        const priceContainer = document.querySelector('#p_36') || 
                              document.querySelector('[id*="price"]') ||
                              document.querySelector('[aria-label*="Price" i]');
        
        if (!priceContainer) {
            logger.warn('Amazon: Price filter container not found');
            return false;
        }
        
        // Find inputs
        const minInput = priceContainer.querySelector(selectors.min);
        const maxInput = priceContainer.querySelector(selectors.max);
        
        if (!minInput && !maxInput) {
            logger.warn('Amazon: Price input fields not found');
            return false;
        }
        
        // Fill inputs
        if (minInput && minPrice) {
            minInput.value = '';
            await fillInput(minInput, minPrice.toString());
            logger.debug(`Amazon: Set min price to ${minPrice}`);
        }
        
        if (maxInput && maxPrice) {
            maxInput.value = '';
            await fillInput(maxInput, maxPrice.toString());
            logger.debug(`Amazon: Set max price to ${maxPrice}`);
        }
        
        // Click Go button
        const goButton = priceContainer.querySelector(selectors.button) ||
                        priceContainer.querySelector(selectors.goButton);
        
        if (goButton) {
            await safeClick(goButton, { maxRetries: 3 });
            logger.info('Amazon: Price filter Go button clicked');
            return true;
        } else {
            logger.warn('Amazon: Price filter Go button not found');
            return false;
        }
        
    } catch (error) {
        logger.error('Amazon: Price filter failed', error);
        return false;
    }
}

/**
 * Apply rating filter
 */
async function applyRatingFilter(minStars) {
    try {
        const stars = parseInt(minStars);
        if (stars < 1 || stars > 4) {
            logger.warn('Amazon: Invalid star rating', { stars });
            return false;
        }
        
        const selector = AmazonFilterSelector.getReviewsFilter(stars);
        const filterElement = document.querySelector(selector);
        
        if (filterElement) {
            await safeClick(filterElement, { maxRetries: 3 });
            logger.info(`Amazon: ${stars}+ stars filter clicked`);
            return true;
        } else {
            logger.warn(`Amazon: ${stars}+ stars filter not found`);
            return false;
        }
        
    } catch (error) {
        logger.error('Amazon: Rating filter failed', error);
        return false;
    }
}

/**
 * Apply RAM filter with smart matching
 */
async function applyRAMFilter(ramSize) {
    try {
        // Get filter codes for this RAM size
        const filterCodes = AmazonFilterValueMapper.mapRAMSize(ramSize);
        logger.debug('Amazon: RAM filter codes', { ramSize, codes: filterCodes });
        
        // Find RAM filter container
        const containerSelector = AmazonFilterSelector.getFilterContainer('p_n_g-1003495121111');
        const container = document.querySelector(containerSelector);
        
        if (!container) {
            logger.warn('Amazon: RAM filter container not found');
            return await applyFilterByTextSearch('ram', ramSize);
        }
        
        // Try to find filter by href containing filter code
        for (const code of filterCodes) {
            const link = container.querySelector(`a[href*="${code}"]`);
            if (link) {
                await safeClick(link, { maxRetries: 3 });
                logger.info(`Amazon: RAM filter clicked (code: ${code})`);
                return true;
            }
        }
        
        // Fallback: text-based matching
        logger.debug('Amazon: RAM filter code not found, trying text match');
        return await applyFilterByTextInContainer(container, ramSize, 'ram');
        
    } catch (error) {
        logger.error('Amazon: RAM filter failed', error);
        return false;
    }
}

/**
 * Apply battery filter with smart matching
 */
async function applyBatteryFilter(batteryCapacity) {
    try {
        const filterCodes = AmazonFilterValueMapper.mapBatteryCapacity(batteryCapacity);
        logger.debug('Amazon: Battery filter codes', { batteryCapacity, codes: filterCodes });
        
        const containerSelector = AmazonFilterSelector.getFilterContainer('p_n_g-101015098008111');
        const container = document.querySelector(containerSelector);
        
        if (!container) {
            logger.warn('Amazon: Battery filter container not found');
            return await applyFilterByTextSearch('battery', batteryCapacity);
        }
        
        // Try filter codes
        for (const code of filterCodes) {
            const link = container.querySelector(`a[href*="${code}"]`);
            if (link) {
                await safeClick(link, { maxRetries: 3 });
                logger.info(`Amazon: Battery filter clicked (code: ${code})`);
                return true;
            }
        }
        
        // Fallback: text matching
        return await applyFilterByTextInContainer(container, batteryCapacity, 'battery');
        
    } catch (error) {
        logger.error('Amazon: Battery filter failed', error);
        return false;
    }
}

/**
 * Apply storage filter
 */
async function applyStorageFilter(storageSize) {
    try {
        const filterCodes = AmazonFilterValueMapper.mapStorageSize(storageSize);
        logger.debug('Amazon: Storage filter codes', { storageSize, codes: filterCodes });
        
        const containerSelector = AmazonFilterSelector.getFilterContainer('p_n_g-1003492455111');
        const container = document.querySelector(containerSelector);
        
        if (!container) {
            logger.warn('Amazon: Storage filter container not found');
            return await applyFilterByTextSearch('storage', storageSize);
        }
        
        for (const code of filterCodes) {
            const link = container.querySelector(`a[href*="${code}"]`);
            if (link) {
                await safeClick(link, { maxRetries: 3 });
                logger.info(`Amazon: Storage filter clicked (code: ${code})`);
                return true;
            }
        }
        
        return await applyFilterByTextInContainer(container, storageSize, 'storage');
        
    } catch (error) {
        logger.error('Amazon: Storage filter failed', error);
        return false;
    }
}

/**
 * Apply brand filter
 */
async function applyBrandFilter(brandName) {
    try {
        const container = document.querySelector('#brandsRefinements') ||
                         document.querySelector('#p_89') ||
                         document.querySelector('[id*="brand"]');
        
        if (!container) {
            logger.warn('Amazon: Brand filter container not found');
            return false;
        }
        
        // Expand "See more" if needed
        const seeMore = container.querySelector('a[aria-expanded="false"]');
        if (seeMore) {
            await safeClick(seeMore);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return await applyFilterByTextInContainer(container, brandName, 'brand');
        
    } catch (error) {
        logger.error('Amazon: Brand filter failed', error);
        return false;
    }
}

/**
 * Apply color filter
 */
async function applyColorFilter(color) {
    try {
        return await applyFilterByTextSearch('color', color);
    } catch (error) {
        logger.error('Amazon: Color filter failed', error);
        return false;
    }
}

/**
 * Apply filter by text matching within a container
 */
async function applyFilterByTextInContainer(container, value, filterType) {
    try {
        const links = container.querySelectorAll('a[href*="rh="]');
        const normalized = normalizeFilterValue(value, filterType);
        
        for (const link of links) {
            const text = (link.textContent || '').toLowerCase();
            const normalizedText = normalizeFilterValue(text, filterType);
            
            if (fuzzyMatch(text, [value, normalized], 0.7)) {
                await safeClick(link, { maxRetries: 3 });
                logger.info(`Amazon: Filter clicked by text match`, { filterType, text: link.textContent });
                return true;
            }
        }
        
        logger.warn(`Amazon: No matching filter found for ${filterType}`, { value });
        return false;
        
    } catch (error) {
        logger.error('Amazon: Filter by text in container failed', error);
        return false;
    }
}

/**
 * Apply filter by searching entire page
 */
async function applyFilterByTextSearch(filterType, value) {
    try {
        const availableFilters = await discoverAvailableFilters();
        
        const targetLabels = getFilterLabels(filterType);
        let filterGroup = null;
        
        for (const label of targetLabels) {
            if (availableFilters[label]) {
                filterGroup = availableFilters[label];
                break;
            }
        }
        
        if (!filterGroup) {
            logger.warn(`Amazon: Filter group not found for ${filterType}`);
            return false;
        }
        
        const normalized = normalizeFilterValue(value, filterType);
        
        for (const el of filterGroup.elements) {
            if (fuzzyMatch(el.text, [value, normalized], 0.7)) {
                await safeClick(el.element, { maxRetries: 3 });
                logger.info(`Amazon: Filter clicked by discovery`, { filterType, text: el.text });
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        logger.error('Amazon: Filter by text search failed', error);
        return false;
    }
}

/**
 * Wait for filter update to complete
 */
async function waitForFilterUpdate(prevUrl, filterType, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check URL changed
        if (globalThis.location.href !== prevUrl) {
            logger.debug(`Amazon: URL changed for ${filterType} filter`);
            
            // Verify filter is in URL
            const currentUrl = globalThis.location.href;
            const filters = parseAmazonFilters(currentUrl);
            
            // Wait for loading to complete
            await waitForLoadingComplete(3000);
            
            return true;
        }
        
        // Check for loading indicators
        const isLoading = document.querySelector('.s-loading, [aria-busy="true"]');
        if (isLoading) {
            logger.debug(`Amazon: Page loading for ${filterType} filter`);
            continue;
        }
        
        // Check for active filter badges
        const activeBadges = document.querySelectorAll('.a-badge-label, .s-navigation-clear-link');
        if (activeBadges.length > 0) {
            logger.debug(`Amazon: Active filter badges found for ${filterType}`);
            return true;
        }
    }
    
    logger.warn(`Amazon: Filter update timeout for ${filterType}`);
    return false;
}

/**
 * Wait for loading indicators to disappear
 */
async function waitForLoadingComplete(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const loadingIndicators = document.querySelectorAll('.s-loading, [aria-busy="true"], .s-spinner');
        const isLoading = Array.from(loadingIndicators).some(el => el.offsetParent !== null);
        
        if (!isLoading) {
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return false;
}

/**
 * Normalize filter value based on type
 */
function normalizeFilterValue(value, filterType) {
    switch (filterType) {
        case 'ram':
            return normalizeRAMSize(value);
        case 'battery':
            return normalizeBatteryCapacity(value);
        case 'storage':
            return normalizeStorageSize(value);
        default:
            return value.toString().toLowerCase();
    }
}

/**
 * Get filter labels for a filter type
 */
function getFilterLabels(filterType) {
    const labelMap = {
        brand: ['brand', 'brands', 'brand name'],
        ram: ['ram', 'memory', 'internal memory', 'computer memory size', 'system memory'],
        storage: ['storage', 'internal storage', 'ssd capacity', 'hard disk size'],
        battery: ['battery', 'battery capacity', 'battery power', 'mah', 'mAh'],
        rating: ['customer review', 'avg. customer review', 'customer ratings'],
        color: ['color', 'colour']
    };
    
    return labelMap[filterType] || [filterType];
}

