/**
 * Filter Value Mapper
 * Maps user-friendly filter values to platform-specific filter codes
 */

import { logger } from './logger.js';
import { normalizeRAMSize, normalizeBatteryCapacity, normalizeStorageSize, extractNumber } from './text-normalizer.js';

/**
 * Amazon Filter Value Mapper
 */
export class AmazonFilterValueMapper {
    /**
     * Map RAM size to Amazon filter codes
     * @param {string|number} ramSize - RAM size (e.g., "6GB", 6, "8GB")
     * @returns {Array<string>} - Array of filter codes
     */
    static mapRAMSize(ramSize) {
        const normalized = normalizeRAMSize(String(ramSize));
        const numericValue = extractNumber(normalized);
        
        // Known RAM filter codes for Amazon India
        const ramCodes = {
            2: ['44897283031'],
            3: ['44897284031'],
            4: ['44897285031'],
            6: ['44897287031'],
            8: ['44897288031'],
            12: ['44897289031'],
            16: ['44897290031']
        };
        
        // If "and above" or "+", include all higher values
        if (normalized.includes('+') || normalized.includes('above')) {
            const codes = [];
            for (const [size, sizeCodes] of Object.entries(ramCodes)) {
                if (parseInt(size) >= numericValue) {
                    codes.push(...sizeCodes);
                }
            }
            return codes;
        }
        
        return ramCodes[numericValue] || [];
    }
    
    /**
     * Map battery capacity to Amazon filter codes
     * @param {string|number} batteryCapacity - Battery in mAh (e.g., "5000", 5000, "5000mAh")
     * @returns {Array<string>} - Array of filter codes
     */
    static mapBatteryCapacity(batteryCapacity) {
        const normalized = normalizeBatteryCapacity(String(batteryCapacity));
        const numericValue = extractNumber(normalized);
        
        // Known battery filter codes for Amazon India
        const batteryCodes = {
            3000: ['91805324031'],
            4000: ['91805325031'],
            5000: ['92071917031'],
            6000: ['91805326031']
        };
        
        // Find closest match
        let closestMatch = null;
        let closestDiff = Infinity;
        
        for (const [capacity, codes] of Object.entries(batteryCodes)) {
            const diff = Math.abs(parseInt(capacity) - numericValue);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestMatch = codes;
            }
        }
        
        // If "and above" or "+", include all higher values
        if (normalized.includes('+') || normalized.includes('above')) {
            const codes = [];
            for (const [capacity, capacityCodes] of Object.entries(batteryCodes)) {
                if (parseInt(capacity) >= numericValue) {
                    codes.push(...capacityCodes);
                }
            }
            return codes.length > 0 ? codes : (closestMatch || []);
        }
        
        return closestMatch || [];
    }
    
    /**
     * Map storage size to Amazon filter codes
     * @param {string|number} storageSize - Storage size (e.g., "128GB", 128, "256GB")
     * @returns {Array<string>} - Array of filter codes
     */
    static mapStorageSize(storageSize) {
        const normalized = normalizeStorageSize(String(storageSize));
        const numericValue = extractNumber(normalized);
        
        // Known storage filter codes for Amazon India
        const storageCodes = {
            16: ['44349043031'],
            32: ['44349044031'],
            64: ['44349045031'],
            128: ['44349046031'],
            256: ['44349047031'],
            512: ['44349048031'],
            1024: ['44349049031'] // 1TB
        };
        
        // If "and above" or "+", include all higher values
        if (normalized.includes('+') || normalized.includes('above')) {
            const codes = [];
            for (const [size, sizeCodes] of Object.entries(storageCodes)) {
                if (parseInt(size) >= numericValue) {
                    codes.push(...sizeCodes);
                }
            }
            return codes;
        }
        
        return storageCodes[numericValue] || [];
    }
    
    /**
     * Map star rating to Amazon filter code
     * @param {number} stars - Minimum star rating (1-4)
     * @returns {string|null} - Filter code
     */
    static mapStarRating(stars) {
        const ratingCodes = {
            4: '46655',
            3: '46654',
            2: '46653',
            1: '46652'
        };
        
        return ratingCodes[stars] || null;
    }
    
    /**
     * Map price range to Amazon filter format
     * @param {number} minPrice - Minimum price in rupees
     * @param {number} maxPrice - Maximum price in rupees
     * @returns {string} - Price range in paise format (min-max)
     */
    static mapPriceRange(minPrice, maxPrice) {
        const minPaise = minPrice ? Math.round(minPrice * 100) : 0;
        const maxPaise = maxPrice ? Math.round(maxPrice * 100) : 999999999;
        return `${minPaise}-${maxPaise}`;
    }
}

/**
 * Flipkart Filter Value Mapper
 */
export class FlipkartFilterValueMapper {
    /**
     * Map RAM size to Flipkart filter text
     * @param {string|number} ramSize - RAM size
     * @returns {Array<string>} - Array of filter text variations
     */
    static mapRAMSize(ramSize) {
        const normalized = normalizeRAMSize(String(ramSize));
        const numericValue = extractNumber(normalized);
        
        const variations = [
            `${numericValue} GB`,
            `${numericValue}GB`,
            `${numericValue} GB RAM`,
            `${numericValue}GB RAM`
        ];
        
        if (normalized.includes('+') || normalized.includes('above')) {
            variations.push(
                `${numericValue} GB & Above`,
                `${numericValue}GB and Above`
            );
        }
        
        return variations;
    }
    
    /**
     * Map battery capacity to Flipkart filter text
     * @param {string|number} batteryCapacity - Battery capacity
     * @returns {Array<string>} - Array of filter text variations
     */
    static mapBatteryCapacity(batteryCapacity) {
        const normalized = normalizeBatteryCapacity(String(batteryCapacity));
        const numericValue = extractNumber(normalized);
        
        const variations = [
            `${numericValue} mAh`,
            `${numericValue}mAh`,
            `${numericValue} mAh & Above`,
            `${numericValue}mAh and Above`
        ];
        
        return variations;
    }
    
    /**
     * Map storage size to Flipkart filter text
     * @param {string|number} storageSize - Storage size
     * @returns {Array<string>} - Array of filter text variations
     */
    static mapStorageSize(storageSize) {
        const normalized = normalizeStorageSize(String(storageSize));
        const numericValue = extractNumber(normalized);
        
        const variations = [
            `${numericValue} GB`,
            `${numericValue}GB`,
            `${numericValue} GB & Above`,
            `${numericValue}GB and Above`
        ];
        
        if (numericValue >= 1024) {
            const tb = numericValue / 1024;
            variations.push(`${tb} TB`, `${tb}TB`);
        }
        
        return variations;
    }
}

/**
 * Generic filter value mapper
 * Works across platforms
 */
export class GenericFilterValueMapper {
    /**
     * Generate common variations for any filter value
     * @param {string} value - Filter value
     * @param {string} type - Filter type (ram, battery, storage, etc.)
     * @returns {Array<string>} - Array of variations
     */
    static generateVariations(value, type) {
        const variations = [value];
        const numericValue = extractNumber(String(value));
        
        if (!numericValue) {
            return variations;
        }
        
        switch (type) {
            case 'ram':
                variations.push(
                    `${numericValue}GB`,
                    `${numericValue} GB`,
                    `${numericValue}gb`,
                    `${numericValue} gb`,
                    `${numericValue} GB RAM`,
                    `${numericValue}GB RAM`
                );
                break;
                
            case 'battery':
                variations.push(
                    `${numericValue}mAh`,
                    `${numericValue} mAh`,
                    `${numericValue}mah`,
                    `${numericValue} mah`,
                    `${numericValue} mAh Battery`
                );
                break;
                
            case 'storage':
                variations.push(
                    `${numericValue}GB`,
                    `${numericValue} GB`,
                    `${numericValue}gb`,
                    `${numericValue} gb`
                );
                if (numericValue >= 1024) {
                    const tb = numericValue / 1024;
                    variations.push(`${tb}TB`, `${tb} TB`);
                }
                break;
        }
        
        return variations;
    }
}

/**
 * Map filter values based on platform
 * @param {string} platform - Platform name (amazon, flipkart, etc.)
 * @param {string} filterType - Filter type (ram, battery, storage, rating, price)
 * @param {any} value - Filter value
 * @returns {Array<string>|string|null} - Mapped filter codes or text variations
 */
export function mapFilterValue(platform, filterType, value) {
    try {
        if (platform === 'amazon' || platform.includes('amazon')) {
            switch (filterType) {
                case 'ram':
                    return AmazonFilterValueMapper.mapRAMSize(value);
                case 'battery':
                    return AmazonFilterValueMapper.mapBatteryCapacity(value);
                case 'storage':
                    return AmazonFilterValueMapper.mapStorageSize(value);
                case 'rating':
                case 'reviews':
                    return AmazonFilterValueMapper.mapStarRating(value);
                case 'price':
                    // Expect value as {min, max}
                    return AmazonFilterValueMapper.mapPriceRange(value.min, value.max);
                default:
                    return null;
            }
        } else if (platform === 'flipkart') {
            switch (filterType) {
                case 'ram':
                    return FlipkartFilterValueMapper.mapRAMSize(value);
                case 'battery':
                    return FlipkartFilterValueMapper.mapBatteryCapacity(value);
                case 'storage':
                    return FlipkartFilterValueMapper.mapStorageSize(value);
                default:
                    return GenericFilterValueMapper.generateVariations(value, filterType);
            }
        } else {
            // Generic platform
            return GenericFilterValueMapper.generateVariations(value, filterType);
        }
    } catch (error) {
        logger.error('Failed to map filter value', error, { platform, filterType, value });
        return null;
    }
}

