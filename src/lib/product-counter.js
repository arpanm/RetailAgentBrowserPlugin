/**
 * Product Counter Utility
 * Counts products before and after filter application for verification
 */

import { logger } from './logger.js';

/**
 * Count products on current page
 * @param {string} containerSelector - Product container selector
 * @returns {number} - Number of products found
 */
export function countProducts(containerSelector) {
    try {
        const selectors = Array.isArray(containerSelector) ? containerSelector : [containerSelector];
        
        for (const selector of selectors) {
            try {
                const containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    // Filter out non-product containers
                    const validProducts = Array.from(containers).filter(el => {
                        // Must have a link
                        const hasLink = el.querySelector('a[href]');
                        // Must have some content
                        const hasContent = (el.textContent || '').trim().length > 20;
                        // Should not be a navigation element
                        const text = (el.textContent || '').toLowerCase();
                        const isNav = text.includes('visit the help') || 
                                     text.includes('customer service') ||
                                     text.includes('skip to main');
                        
                        return hasLink && hasContent && !isNav;
                    });
                    
                    logger.debug('Product count', { 
                        selector, 
                        total: containers.length, 
                        valid: validProducts.length 
                    });
                    
                    return validProducts.length;
                }
            } catch (e) {
                continue;
            }
        }
        
        return 0;
    } catch (error) {
        logger.error('Failed to count products', error);
        return 0;
    }
}

/**
 * Extract result count from Amazon result info bar
 * Parses text like "1-16 of 1,000+ results"
 * @returns {Object} - { displayedStart, displayedEnd, total, totalText }
 */
export function extractAmazonResultCount() {
    try {
        // Try multiple selectors for result count
        const selectors = [
            '.s-breadcrumb .a-color-state',
            '[data-component-type="s-result-info-bar"]',
            '.s-result-count',
            '[data-cel-widget="search_result_info_bar"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) continue;
            
            const text = element.textContent || '';
            
            // Pattern: "1-16 of 1,000+ results"
            const pattern1 = /(\d+)-(\d+)\s+of\s+(over\s+)?([0-9,]+)\+?\s+results?/i;
            const match1 = text.match(pattern1);
            
            if (match1) {
                return {
                    displayedStart: parseInt(match1[1]),
                    displayedEnd: parseInt(match1[2]),
                    total: parseInt(match1[4].replace(/,/g, '')),
                    totalText: match1[4],
                    isApproximate: text.includes('+') || text.includes('over')
                };
            }
            
            // Pattern: "1,000+ results"
            const pattern2 = /([0-9,]+)\+?\s+results?/i;
            const match2 = text.match(pattern2);
            
            if (match2) {
                return {
                    displayedStart: null,
                    displayedEnd: null,
                    total: parseInt(match2[1].replace(/,/g, '')),
                    totalText: match2[1],
                    isApproximate: text.includes('+')
                };
            }
        }
        
        logger.debug('Could not extract Amazon result count');
        return null;
        
    } catch (error) {
        logger.error('Failed to extract Amazon result count', error);
        return null;
    }
}

/**
 * Extract result count from Flipkart
 * @returns {Object} - { total, totalText }
 */
export function extractFlipkartResultCount() {
    try {
        const selectors = [
            '._1LKTO3',
            '.BUOuZu',
            '[class*="result-count"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) continue;
            
            const text = element.textContent || '';
            
            // Pattern: "Showing 1 – 24 of 1,234 results"
            const pattern = /(\d+)\s*(?:–|-)\s*(\d+)\s+of\s+([0-9,]+)/i;
            const match = text.match(pattern);
            
            if (match) {
                return {
                    displayedStart: parseInt(match[1]),
                    displayedEnd: parseInt(match[2]),
                    total: parseInt(match[3].replace(/,/g, '')),
                    totalText: match[3]
                };
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Failed to extract Flipkart result count', error);
        return null;
    }
}

/**
 * Get product count based on platform
 * @param {string} platform - Platform name
 * @returns {Object} - { domCount, reportedCount, source }
 */
export function getProductCount(platform = 'amazon') {
    const containerSelectors = {
        amazon: ['[data-asin]:not([data-asin=""])', '[data-component-type="s-search-result"]'],
        flipkart: ['[data-id]', '._1AtVbE', '._13oc-S']
    };
    
    const selectors = containerSelectors[platform] || containerSelectors.amazon;
    const domCount = countProducts(selectors);
    
    let reportedCount = null;
    if (platform === 'amazon' || platform.includes('amazon')) {
        reportedCount = extractAmazonResultCount();
    } else if (platform === 'flipkart') {
        reportedCount = extractFlipkartResultCount();
    }
    
    return {
        domCount,
        reportedCount,
        source: platform
    };
}

/**
 * Product count tracker for before/after filter comparison
 */
export class ProductCountTracker {
    constructor() {
        this.counts = {
            beforeFilters: null,
            afterFilters: null,
            history: []
        };
    }
    
    /**
     * Record product count before filters
     * @param {string} platform - Platform name
     */
    recordBeforeFilters(platform = 'amazon') {
        const count = getProductCount(platform);
        this.counts.beforeFilters = {
            ...count,
            timestamp: Date.now()
        };
        
        this.counts.history.push({
            type: 'before',
            ...count,
            timestamp: Date.now()
        });
        
        logger.info('Product count before filters', {
            domCount: count.domCount,
            reportedTotal: count.reportedCount?.total
        });
        
        return count;
    }
    
    /**
     * Record product count after filters
     * @param {string} platform - Platform name
     */
    recordAfterFilters(platform = 'amazon') {
        const count = getProductCount(platform);
        this.counts.afterFilters = {
            ...count,
            timestamp: Date.now()
        };
        
        this.counts.history.push({
            type: 'after',
            ...count,
            timestamp: Date.now()
        });
        
        logger.info('Product count after filters', {
            domCount: count.domCount,
            reportedTotal: count.reportedCount?.total
        });
        
        return count;
    }
    
    /**
     * Get count change summary
     * @returns {Object} - Summary of count changes
     */
    getSummary() {
        const before = this.counts.beforeFilters;
        const after = this.counts.afterFilters;
        
        if (!before || !after) {
            return {
                available: false,
                message: 'Incomplete data'
            };
        }
        
        const domChange = after.domCount - before.domCount;
        const reportedChange = (after.reportedCount?.total || 0) - (before.reportedCount?.total || 0);
        
        const decreased = domChange < 0 || reportedChange < 0;
        const increased = domChange > 0 || reportedChange > 0;
        const unchanged = domChange === 0 && reportedChange === 0;
        
        return {
            available: true,
            before: {
                dom: before.domCount,
                reported: before.reportedCount?.total
            },
            after: {
                dom: after.domCount,
                reported: after.reportedCount?.total
            },
            change: {
                dom: domChange,
                reported: reportedChange
            },
            decreased,
            increased,
            unchanged,
            message: this.getChangeMessage(decreased, increased, unchanged, domChange, reportedChange)
        };
    }
    
    /**
     * Generate human-readable message about count change
     */
    getChangeMessage(decreased, increased, unchanged, domChange, reportedChange) {
        if (decreased) {
            return `Products decreased (DOM: ${domChange}, Reported: ${reportedChange}) - filters likely applied`;
        } else if (increased) {
            return `Products increased (DOM: ${domChange}, Reported: ${reportedChange}) - unexpected`;
        } else if (unchanged) {
            return 'Product count unchanged - filters may not have applied';
        } else {
            return 'Unable to determine count change';
        }
    }
    
    /**
     * Verify that filters were applied based on count change
     * @returns {boolean} - True if count decreased (indicating filters worked)
     */
    verifyFiltersApplied() {
        const summary = this.getSummary();
        
        if (!summary.available) {
            logger.warn('Cannot verify filters - incomplete count data');
            return false;
        }
        
        // Filters should decrease product count
        const verified = summary.decreased;
        
        logger.info('Filter verification by count', {
            verified,
            summary
        });
        
        return verified;
    }
    
    /**
     * Reset tracker
     */
    reset() {
        this.counts = {
            beforeFilters: null,
            afterFilters: null,
            history: []
        };
    }
}

/**
 * Global product count tracker instance
 */
export const globalProductCountTracker = new ProductCountTracker();

