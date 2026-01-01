/**
 * Filter Selector Builder
 * Builds precise CSS selectors for e-commerce platform filters
 */

import { logger } from './logger.js';
import { AMAZON_DOM_MAP } from '../content/platforms/amazon-dom-map.js';

/**
 * Amazon Filter Selector Builder
 * Provides methods to build exact selectors for Amazon filters
 */
export class AmazonFilterSelector {
    /**
     * Get selector for reviews filter
     * @param {number} stars - Minimum star rating (1-4)
     * @returns {string} - CSS selector
     */
    static getReviewsFilter(stars) {
        const codes = {
            4: '46655',
            3: '46654',
            2: '46653',
            1: '46652'
        };
        
        const code = codes[stars];
        if (!code) {
            logger.warn('Invalid star rating', { stars });
            return null;
        }
        
        // Escape colon in CSS selector
        return `#p_123\\:${code}, a[href*="p_123:${code}"]`;
    }
    
    /**
     * Get selectors for price range inputs
     * @returns {Object} - { min, max, button }
     */
    static getPriceRangeInputs() {
        return {
            min: '#low-price, input[name="low-price"], input[aria-labelledby*="low-price"]',
            max: '#high-price, input[name="high-price"], input[aria-labelledby*="high-price"]',
            button: 'input[aria-labelledby="p_36-title"], .a-button-input[type="submit"], form[action*="price"] input[type="submit"]',
            goButton: '.a-button-input, input.a-button-input[type="submit"]'
        };
    }
    
    /**
     * Get selector for battery filter
     * @param {number} minMah - Minimum battery capacity in mAh
     * @returns {string} - CSS selector pattern
     */
    static getBatteryFilter(minMah) {
        // Battery filter uses dynamic codes, so we need to search by text
        // Common patterns: "5000 mAh & Above", "6000 mAh & Above"
        return `#p_n_g-101015098008111 a, [id*="101015098008111"] a, a[href*="101015098008111"]`;
    }
    
    /**
     * Get selector for RAM filter
     * @param {string} ramSize - RAM size (e.g., "6GB", "8GB")
     * @returns {string} - CSS selector pattern
     */
    static getRAMFilter(ramSize) {
        // RAM filter uses dynamic codes
        // Common patterns: "6 GB", "8 GB", "12 GB"
        return `#p_n_g-1003495121111 a, [id*="1003495121111"] a, a[href*="1003495121111"]`;
    }
    
    /**
     * Get selector for storage filter
     * @param {string} storageSize - Storage size (e.g., "128GB", "256GB")
     * @returns {string} - CSS selector pattern
     */
    static getStorageFilter(storageSize) {
        return `#p_n_g-1003492455111 a, [id*="1003492455111"] a, a[href*="1003492455111"]`;
    }
    
    /**
     * Get selector for brand filter
     * @param {string} brandName - Brand name
     * @returns {string} - CSS selector pattern
     */
    static getBrandFilter(brandName) {
        return `#brandsRefinements a, #p_89 a, [id*="brand"] a`;
    }
    
    /**
     * Get selector for filter container by ID pattern
     * @param {string} filterIdPattern - Filter ID pattern (e.g., "p_123", "p_n_g-101015098008111")
     * @returns {string} - CSS selector
     */
    static getFilterContainer(filterIdPattern) {
        // Escape special characters for CSS selector
        const escapedPattern = filterIdPattern.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        return `#${escapedPattern}, [id*="${filterIdPattern}"]`;
    }
    
    /**
     * Get all filter containers
     * @returns {string} - CSS selector for all filter groups
     */
    static getAllFilterContainers() {
        return 'div[id^="p_"]';
    }
    
    /**
     * Get selector for filter links within a container
     * @returns {string} - CSS selector
     */
    static getFilterLinks() {
        return 'a[href*="rh="], li a, span.a-list-item a';
    }
    
    /**
     * Get selector for "See More" expand buttons
     * @returns {string} - CSS selector
     */
    static getSeeMoreButtons() {
        return 'a[aria-expanded="false"], .s-expander-button, a:contains("See more"), a:contains("See all")';
    }
    
    /**
     * Get selector for active filter badges
     * @returns {string} - CSS selector
     */
    static getActiveFilterBadges() {
        return '.a-badge-label, [data-csa-c-element-type="filter-chip"], .s-navigation-clear-link';
    }
    
    /**
     * Build selector for specific filter by text matching
     * @param {string} filterContainer - Filter container selector
     * @param {string} textToMatch - Text to match in filter label
     * @returns {string} - CSS selector
     */
    static buildTextMatchSelector(filterContainer, textToMatch) {
        // This will need to be evaluated in DOM context
        return {
            container: filterContainer,
            textMatch: textToMatch.toLowerCase(),
            linkSelector: 'a[href*="rh="]'
        };
    }
}

/**
 * Flipkart Filter Selector Builder
 */
export class FlipkartFilterSelector {
    /**
     * Get selector for price range inputs
     * @returns {Object} - { min, max, button }
     */
    static getPriceRangeInputs() {
        return {
            min: 'input[placeholder*="Min"], input[name="min"]',
            max: 'input[placeholder*="Max"], input[name="max"]',
            button: 'button:contains("GO"), .submit-btn, button[type="submit"]'
        };
    }
    
    /**
     * Get selector for filter checkboxes
     * @returns {string} - CSS selector
     */
    static getFilterCheckboxes() {
        return '._3uDYxP input[type="checkbox"], ._1AtVbE input[type="checkbox"]';
    }
    
    /**
     * Get selector for filter labels
     * @returns {string} - CSS selector
     */
    static getFilterLabels() {
        return '._3uDYxP label, ._1AtVbE label, ._2gmUFU';
    }
    
    /**
     * Get selector for filter sections
     * @returns {string} - CSS selector
     */
    static getFilterSections() {
        return '._36fx1h, ._1AtVbE, [class*="filter"]';
    }
    
    /**
     * Get selector for brand filter
     * @returns {string} - CSS selector
     */
    static getBrandFilter() {
        return '[title="Brand"] + div input[type="checkbox"], ._3uDYxP:has([title="Brand"]) input';
    }
    
    /**
     * Get selector for RAM filter
     * @returns {string} - CSS selector
     */
    static getRAMFilter() {
        return '[title="RAM"] + div input[type="checkbox"], ._3uDYxP:has([title="RAM"]) input';
    }
    
    /**
     * Get selector for storage filter
     * @returns {string} - CSS selector
     */
    static getStorageFilter() {
        return '[title="Internal Storage"] + div input[type="checkbox"], ._3uDYxP:has([title="Internal Storage"]) input';
    }
    
    /**
     * Get selector for battery filter
     * @returns {string} - CSS selector
     */
    static getBatteryFilter() {
        return '[title="Battery Capacity"] + div input[type="checkbox"], ._3uDYxP:has([title="Battery"]) input';
    }
}

/**
 * Generic filter selector builder
 * Works across platforms with common patterns
 */
export class GenericFilterSelector {
    /**
     * Get common filter container patterns
     * @returns {Array<string>} - Array of CSS selectors
     */
    static getFilterContainers() {
        return [
            '[class*="filter"]',
            '[class*="refinement"]',
            '[class*="facet"]',
            '[id*="filter"]',
            '[id*="refinement"]',
            'aside',
            '.sidebar',
            '[role="complementary"]'
        ];
    }
    
    /**
     * Get common checkbox patterns
     * @returns {Array<string>} - Array of CSS selectors
     */
    static getCheckboxes() {
        return [
            'input[type="checkbox"]',
            'input[type="radio"]',
            '[role="checkbox"]'
        ];
    }
    
    /**
     * Get common link patterns for filters
     * @returns {Array<string>} - Array of CSS selectors
     */
    static getFilterLinks() {
        return [
            'a[href*="filter"]',
            'a[href*="refinement"]',
            'a[href*="facet"]',
            'a[href*="rh="]'
        ];
    }
}

/**
 * Helper function to find filter element by text
 * Must be called in DOM context
 * @param {string} containerSelector - Container to search within
 * @param {string} textToMatch - Text to match (case-insensitive)
 * @param {string} elementType - Type of element to find ('a', 'label', 'input')
 * @returns {HTMLElement|null} - Found element or null
 */
export function findFilterByText(containerSelector, textToMatch, elementType = 'a') {
    try {
        const container = document.querySelector(containerSelector);
        if (!container) {
            logger.warn('Filter container not found', { containerSelector });
            return null;
        }
        
        const elements = container.querySelectorAll(elementType);
        const lowerText = textToMatch.toLowerCase();
        
        for (const element of elements) {
            const text = (element.textContent || element.innerText || '').toLowerCase();
            const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
            const title = (element.getAttribute('title') || '').toLowerCase();
            
            if (text.includes(lowerText) || ariaLabel.includes(lowerText) || title.includes(lowerText)) {
                logger.debug('Found filter by text', { textToMatch, elementText: text });
                return element;
            }
        }
        
        logger.debug('Filter not found by text', { textToMatch, containerSelector });
        return null;
        
    } catch (error) {
        logger.error('Error finding filter by text', error);
        return null;
    }
}

/**
 * Helper function to find filter element by partial text match
 * More flexible than exact match
 * @param {string} containerSelector - Container to search within
 * @param {Array<string>} textVariations - Array of text variations to try
 * @param {string} elementType - Type of element to find
 * @returns {HTMLElement|null} - Found element or null
 */
export function findFilterByTextVariations(containerSelector, textVariations, elementType = 'a') {
    for (const variation of textVariations) {
        const element = findFilterByText(containerSelector, variation, elementType);
        if (element) {
            return element;
        }
    }
    return null;
}

