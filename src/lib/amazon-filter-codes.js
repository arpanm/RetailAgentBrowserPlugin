/**
 * Amazon Filter Code Mapper
 * Comprehensive mapping of filter types to Amazon filter IDs and value codes
 */

import { logger } from './logger.js';

/**
 * Amazon Filter ID Mapping
 * Maps user-friendly filter names to Amazon's internal filter IDs
 */
export const AMAZON_FILTER_IDS = {
    // Customer Reviews
    rating: 'p_123',
    
    // Price Range
    price: 'p_36',
    
    // Battery Capacity
    battery: 'p_n_g-101015098008111',
    
    // RAM Size
    ram: 'p_n_g-1003495121111',
    
    // Internal Storage
    storage: 'p_n_g-1003492455111',
    
    // Brand
    brand: 'p_89',
    
    // Operating System
    os: 'p_n_g-1003469290111',
    
    // Screen Size
    screenSize: 'p_n_feature_nineteen_browse-bin',
    
    // Connectivity
    connectivity: 'p_n_feature_browse-bin',
    
    // Condition
    condition: 'p_n_condition-type',
    
    // Discount
    discount: 'p_n_pct_off-with-tax',
    
    // Availability
    availability: 'p_n_availability'
};

/**
 * Customer Reviews Filter Codes
 * p_123 filter ID
 */
export const RATING_CODES = {
    '4': '46655',  // 4 Stars & Up
    '3': '46654',  // 3 Stars & Up
    '2': '46653',  // 2 Stars & Up
    '1': '46652'   // 1 Star & Up
};

/**
 * RAM Size Filter Codes
 * p_n_g-1003495121111 filter ID
 */
export const RAM_CODES = {
    '2': '44897277031',   // 2 GB
    '3': '44897278031',   // 3 GB
    '4': '44897279031',   // 4 GB
    '6': '44897287031',   // 6 GB
    '8': '44897288031',   // 8 GB
    '12': '44897289031',  // 12 GB
    '16': '44897290031',  // 16 GB
    '32': '44897291031'   // 32 GB
};

/**
 * Battery Capacity Filter Codes
 * p_n_g-101015098008111 filter ID
 */
export const BATTERY_CODES = {
    '3000': '91805324031',  // 3000 mAh & Above
    '4000': '91805325031',  // 4000 mAh & Above
    '5000': '91805326031',  // 5000 mAh & Above
    '6000': '92071917031',  // 6000 mAh & Above
    '7000': '92071918031'   // 7000 mAh & Above
};

/**
 * Storage Size Filter Codes
 * p_n_g-1003492455111 filter ID
 */
export const STORAGE_CODES = {
    '32': '44349045031',   // 32 GB
    '64': '44349046031',   // 64 GB
    '128': '44349047031',  // 128 GB
    '256': '44349048031',  // 256 GB
    '512': '44349049031',  // 512 GB
    '1024': '44349050031'  // 1 TB
};

/**
 * Condition Type Filter Codes
 * p_n_condition-type filter ID
 */
export const CONDITION_CODES = {
    'new': '2224371031',
    'renewed': '8609959031',
    'used': '1270070031'
};

/**
 * Availability Filter Codes
 * p_n_availability filter ID
 */
export const AVAILABILITY_CODES = {
    'available': '1318483031',
    'include_out_of_stock': '1318485031'
};

/**
 * Convert user filter value to Amazon filter code
 * @param {string} filterType - Type of filter (rating, ram, battery, storage, etc.)
 * @param {string|number} value - Filter value
 * @returns {string|null} - Amazon filter code or null if not found
 */
export function getFilterCode(filterType, value) {
    try {
        const normalizedValue = String(value).toLowerCase().replace(/[^0-9]/g, '');
        
        switch (filterType.toLowerCase()) {
            case 'rating':
                const ratingValue = Math.floor(parseInt(normalizedValue));
                return RATING_CODES[String(ratingValue)] || null;
                
            case 'ram':
                const ramGB = parseInt(normalizedValue);
                return RAM_CODES[String(ramGB)] || null;
                
            case 'battery':
                const batterymAh = parseInt(normalizedValue);
                // Find closest matching or higher battery code
                const batteryKeys = Object.keys(BATTERY_CODES).map(k => parseInt(k)).sort((a, b) => a - b);
                const matchingBattery = batteryKeys.find(k => k <= batterymAh) || batteryKeys[0];
                return BATTERY_CODES[String(matchingBattery)] || null;
                
            case 'storage':
                const storageGB = parseInt(normalizedValue);
                return STORAGE_CODES[String(storageGB)] || null;
                
            case 'condition':
                return CONDITION_CODES[String(value).toLowerCase()] || null;
                
            case 'availability':
                return AVAILABILITY_CODES[String(value).toLowerCase()] || null;
                
            default:
                logger.warn(`Unknown filter type: ${filterType}`);
                return null;
        }
    } catch (error) {
        logger.error(`Error getting filter code for ${filterType}:${value}`, error);
        return null;
    }
}

/**
 * Get multiple RAM codes for "greater than or equal to" filtering
 * @param {number} minRAM - Minimum RAM in GB
 * @returns {string[]} - Array of RAM codes
 */
export function getRAMCodesGTE(minRAM) {
    const ramValues = Object.keys(RAM_CODES).map(k => parseInt(k)).sort((a, b) => a - b);
    const matchingRAMs = ramValues.filter(v => v >= minRAM);
    return matchingRAMs.map(v => RAM_CODES[String(v)]);
}

/**
 * Get multiple battery codes for "greater than or equal to" filtering
 * @param {number} minBattery - Minimum battery in mAh
 * @returns {string[]} - Array of battery codes
 */
export function getBatteryCodesGTE(minBattery) {
    const batteryValues = Object.keys(BATTERY_CODES).map(k => parseInt(k)).sort((a, b) => a - b);
    const matchingBatteries = batteryValues.filter(v => v >= minBattery);
    return matchingBatteries.map(v => BATTERY_CODES[String(v)]);
}

/**
 * Get multiple storage codes for "greater than or equal to" filtering
 * @param {number} minStorage - Minimum storage in GB
 * @returns {string[]} - Array of storage codes
 */
export function getStorageCodesGTE(minStorage) {
    const storageValues = Object.keys(STORAGE_CODES).map(k => parseInt(k)).sort((a, b) => a - b);
    const matchingStorages = storageValues.filter(v => v >= minStorage);
    return matchingStorages.map(v => STORAGE_CODES[String(v)]);
}

/**
 * Convert price from rupees to paise
 * @param {number} rupees - Price in rupees
 * @returns {number} - Price in paise
 */
export function rupeesToPaise(rupees) {
    return Math.round(rupees * 100);
}

/**
 * Convert price from paise to rupees
 * @param {number} paise - Price in paise
 * @returns {number} - Price in rupees
 */
export function paiseToRupees(paise) {
    return Math.round(paise / 100);
}

/**
 * Build price filter string
 * @param {number|null} minPrice - Minimum price in rupees (null for no min)
 * @param {number|null} maxPrice - Maximum price in rupees (null for no max)
 * @returns {string} - Price filter string in format "minPaise-maxPaise"
 */
export function buildPriceFilter(minPrice, maxPrice) {
    const minPaise = minPrice ? rupeesToPaise(minPrice) : '';
    const maxPaise = maxPrice ? rupeesToPaise(maxPrice) : '';
    return `${minPaise}-${maxPaise}`;
}

/**
 * Parse price filter string
 * @param {string} priceFilter - Price filter in format "minPaise-maxPaise"
 * @returns {Object} - {minPrice, maxPrice} in rupees
 */
export function parsePriceFilter(priceFilter) {
    try {
        const [minPaise, maxPaise] = priceFilter.split('-').map(v => v ? parseInt(v) : null);
        return {
            minPrice: minPaise ? paiseToRupees(minPaise) : null,
            maxPrice: maxPaise ? paiseToRupees(maxPaise) : null
        };
    } catch (error) {
        logger.error('Error parsing price filter', error);
        return { minPrice: null, maxPrice: null };
    }
}

/**
 * Build complete filter refinement string
 * @param {Object} filters - User filters object
 * @returns {string} - Complete rh parameter value
 */
export function buildFilterRefinement(filters) {
    const refinements = [];
    
    try {
        // 1. Price filter (highest priority)
        if (filters.price_min !== undefined || filters.price_max !== undefined) {
            const priceFilter = buildPriceFilter(filters.price_min || null, filters.price_max || null);
            refinements.push(`${AMAZON_FILTER_IDS.price}:${priceFilter}`);
        }
        
        // 2. Rating filter
        if (filters.rating) {
            const ratingCode = getFilterCode('rating', filters.rating);
            if (ratingCode) {
                refinements.push(`${AMAZON_FILTER_IDS.rating}:${ratingCode}`);
            }
        }
        
        // 3. Battery filter
        if (filters.battery) {
            const batteryCodes = getBatteryCodesGTE(filters.battery);
            if (batteryCodes.length > 0) {
                refinements.push(`${AMAZON_FILTER_IDS.battery}:${batteryCodes.join('|')}`);
            }
        }
        
        // 4. RAM filter
        if (filters.ram) {
            const ramValue = parseInt(String(filters.ram).replace(/[^0-9]/g, ''));
            const ramCodes = getRAMCodesGTE(ramValue);
            if (ramCodes.length > 0) {
                refinements.push(`${AMAZON_FILTER_IDS.ram}:${ramCodes.join('|')}`);
            }
        }
        
        // 5. Storage filter
        if (filters.storage) {
            const storageValue = parseInt(String(filters.storage).replace(/[^0-9]/g, ''));
            const storageCodes = getStorageCodesGTE(storageValue);
            if (storageCodes.length > 0) {
                refinements.push(`${AMAZON_FILTER_IDS.storage}:${storageCodes.join('|')}`);
            }
        }
        
        // 6. Brand filter (note: brand codes are dynamic, would need lookup)
        // Brand filtering is typically done via DOM clicking or separate lookup
        
        // 7. Condition filter
        if (filters.condition) {
            const conditionCode = getFilterCode('condition', filters.condition);
            if (conditionCode) {
                refinements.push(`${AMAZON_FILTER_IDS.condition}:${conditionCode}`);
            }
        }
        
        logger.info('Built filter refinement', {
            filters,
            refinements: refinements.length,
            refinementString: refinements.join(',')
        });
        
        return refinements.join(',');
        
    } catch (error) {
        logger.error('Error building filter refinement', error);
        return '';
    }
}

/**
 * Parse rh parameter into filter object
 * @param {string} rhParam - The rh URL parameter value
 * @returns {Object} - Parsed filters
 */
export function parseFilterRefinement(rhParam) {
    const filters = {
        price_min: null,
        price_max: null,
        rating: null,
        battery: null,
        ram: null,
        storage: null,
        brand: null,
        other: {}
    };
    
    if (!rhParam) return filters;
    
    try {
        const refinements = rhParam.split(',');
        
        for (const refinement of refinements) {
            const [filterId, value] = refinement.split(':');
            
            if (!filterId || !value) continue;
            
            switch (filterId) {
                case AMAZON_FILTER_IDS.price:
                    const priceData = parsePriceFilter(value);
                    filters.price_min = priceData.minPrice;
                    filters.price_max = priceData.maxPrice;
                    break;
                    
                case AMAZON_FILTER_IDS.rating:
                    // Find rating by code
                    const ratingEntry = Object.entries(RATING_CODES).find(([_, code]) => code === value);
                    filters.rating = ratingEntry ? parseInt(ratingEntry[0]) : null;
                    break;
                    
                case AMAZON_FILTER_IDS.battery:
                    // Find min battery by codes
                    const batteryCodes = value.split('|');
                    const batteryEntries = Object.entries(BATTERY_CODES)
                        .filter(([_, code]) => batteryCodes.includes(code))
                        .map(([mah]) => parseInt(mah));
                    filters.battery = batteryEntries.length > 0 ? Math.min(...batteryEntries) : null;
                    break;
                    
                case AMAZON_FILTER_IDS.ram:
                    // Find min RAM by codes
                    const ramCodesArray = value.split('|');
                    const ramEntries = Object.entries(RAM_CODES)
                        .filter(([_, code]) => ramCodesArray.includes(code))
                        .map(([gb]) => parseInt(gb));
                    filters.ram = ramEntries.length > 0 ? Math.min(...ramEntries) : null;
                    break;
                    
                case AMAZON_FILTER_IDS.storage:
                    // Find min storage by codes
                    const storageCodesArray = value.split('|');
                    const storageEntries = Object.entries(STORAGE_CODES)
                        .filter(([_, code]) => storageCodesArray.includes(code))
                        .map(([gb]) => parseInt(gb));
                    filters.storage = storageEntries.length > 0 ? Math.min(...storageEntries) : null;
                    break;
                    
                default:
                    // Store unknown filters
                    filters.other[filterId] = value;
                    break;
            }
        }
        
        logger.debug('Parsed filter refinement', { rhParam, filters });
        
    } catch (error) {
        logger.error('Error parsing filter refinement', error);
    }
    
    return filters;
}

/**
 * Validate filter values
 * @param {Object} filters - Filters to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
export function validateFilters(filters) {
    const errors = [];
    
    // Validate price range
    if (filters.price_min !== null && filters.price_max !== null) {
        if (filters.price_min >= filters.price_max) {
            errors.push('Minimum price must be less than maximum price');
        }
    }
    
    // Validate rating
    if (filters.rating !== null) {
        if (filters.rating < 1 || filters.rating > 5) {
            errors.push('Rating must be between 1 and 5');
        }
    }
    
    // Validate RAM
    if (filters.ram !== null) {
        const ramValue = parseInt(String(filters.ram).replace(/[^0-9]/g, ''));
        if (!RAM_CODES[String(ramValue)]) {
            errors.push(`Unsupported RAM value: ${ramValue}GB`);
        }
    }
    
    // Validate battery
    if (filters.battery !== null) {
        const batteryValue = parseInt(String(filters.battery).replace(/[^0-9]/g, ''));
        if (batteryValue < 1000 || batteryValue > 10000) {
            errors.push('Battery capacity must be between 1000 and 10000 mAh');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

