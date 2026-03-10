/**
 * LLM-Based Filter Analyzer
 * Analyzes page DOM and uses LLM to determine which filters to apply
 */

import { logger } from './logger.js';

/**
 * Extract all available filters from the current page
 * @param {string} platform - Platform name
 * @returns {Object} Available filters with their options and URL params
 */
export function extractAvailableFilters(platform = 'generic') {
    const filters = {
        platform,
        url: window.location.href,
        categories: []
    };

    try {
        // Platform-specific filter extraction
        if (platform === 'flipkart') {
            filters.categories = extractFlipkartFilters();
        } else if (platform === 'jiomart') {
            filters.categories = extractJioMartFilters();
        } else if (platform === 'ajio') {
            filters.categories = extractAjioFilters();
        } else if (platform === 'amazon') {
            filters.categories = extractAmazonFilters();
        } else {
            filters.categories = extractGenericFilters();
        }

        logger.info('Extracted available filters', { 
            platform, 
            categoryCount: filters.categories.length 
        });

    } catch (error) {
        logger.error('Failed to extract filters', error);
    }

    return filters;
}

/**
 * Extract filters from Flipkart search results page
 */
function extractFlipkartFilters() {
    const categories = [];
    
    // Find filter sections - Flipkart uses various class names
    const filterSections = document.querySelectorAll([
        '._1KO7_1',           // Main filter sidebar
        '._36fx1h',           // Filter section
        '._3pLy-c',           // Filter group
        '[class*="filterSection"]',
        '[class*="filter-section"]'
    ].join(', '));

    filterSections.forEach(section => {
        try {
            // Get section title
            const titleEl = section.querySelector('._2Fr-Un, ._3_esEL, [class*="title"]');
            const title = titleEl?.textContent?.trim()?.toLowerCase() || '';
            
            if (!title) return;
            
            // Get filter options
            const options = [];
            const optionEls = section.querySelectorAll('label, a[href*="facets"], [class*="filterOption"]');
            
            optionEls.forEach(opt => {
                const text = opt.textContent?.trim();
                const href = opt.getAttribute('href') || '';
                const checkbox = opt.querySelector('input[type="checkbox"]');
                
                if (text && text.length > 0 && text.length < 100) {
                    options.push({
                        text,
                        href,
                        checked: checkbox?.checked || false,
                        urlParam: extractUrlParam(href)
                    });
                }
            });
            
            if (options.length > 0) {
                categories.push({
                    name: title,
                    options: options.slice(0, 20) // Limit options
                });
            }
        } catch (e) {
            // Skip problematic section
        }
    });

    // Also extract from URL params if present
    const urlParams = new URL(window.location.href).searchParams;
    
    return categories;
}

/**
 * Extract filters from JioMart search results page
 */
function extractJioMartFilters() {
    const categories = [];
    
    // JioMart filter structure
    const filterSections = document.querySelectorAll([
        '[class*="filter-section"]',
        '[class*="filterSection"]',
        '[class*="facet"]',
        '.filter-group',
        '[data-filter]'
    ].join(', '));

    filterSections.forEach(section => {
        try {
            const titleEl = section.querySelector('[class*="filter-title"], [class*="title"], h3, h4');
            const title = titleEl?.textContent?.trim()?.toLowerCase() || '';
            
            if (!title) return;
            
            const options = [];
            const optionEls = section.querySelectorAll('label, a, [class*="option"], input[type="checkbox"]');
            
            optionEls.forEach(opt => {
                const text = (opt.textContent || opt.value || '').trim();
                const checkbox = opt.querySelector('input[type="checkbox"]') || (opt.type === 'checkbox' ? opt : null);
                
                if (text && text.length > 0 && text.length < 100) {
                    options.push({
                        text,
                        checked: checkbox?.checked || false,
                        value: opt.value || text
                    });
                }
            });
            
            if (options.length > 0) {
                categories.push({
                    name: title,
                    options: options.slice(0, 20)
                });
            }
        } catch (e) {
            // Skip
        }
    });

    // JioMart URL structure: ?q=query&brand=X&price_min=Y&price_max=Z
    return categories;
}

/**
 * Extract filters from Ajio search results page
 */
function extractAjioFilters() {
    const categories = [];
    
    // Ajio filter structure
    const filterSections = document.querySelectorAll([
        '[class*="filter"]',
        '[class*="facet"]',
        '.refinement-section',
        '[data-filter-name]'
    ].join(', '));

    filterSections.forEach(section => {
        try {
            const titleEl = section.querySelector('[class*="filter-title"], [class*="header"], h3, h4, span');
            const title = titleEl?.textContent?.trim()?.toLowerCase() || '';
            
            if (!title || title.length > 50) return;
            
            const options = [];
            const optionEls = section.querySelectorAll('label, a, li, [class*="option"]');
            
            optionEls.forEach(opt => {
                const text = opt.textContent?.trim();
                const href = opt.getAttribute('href') || '';
                
                if (text && text.length > 0 && text.length < 100) {
                    options.push({
                        text,
                        href,
                        urlParam: href ? extractAjioUrlParam(href) : null
                    });
                }
            });
            
            if (options.length > 0) {
                categories.push({
                    name: title,
                    options: options.slice(0, 20)
                });
            }
        } catch (e) {
            // Skip
        }
    });

    // Ajio URL structure: ?query=:relevance:filter1:value1:filter2:value2&text=query
    return categories;
}

/**
 * Extract filters from Amazon search results page  
 */
function extractAmazonFilters() {
    const categories = [];
    
    const filterSections = document.querySelectorAll('#s-refinements .a-section, [class*="refinement"]');
    
    filterSections.forEach(section => {
        try {
            const titleEl = section.querySelector('.a-section-header, [class*="title"], span');
            const title = titleEl?.textContent?.trim()?.toLowerCase() || '';
            
            if (!title) return;
            
            const options = [];
            const optionEls = section.querySelectorAll('a[href], label');
            
            optionEls.forEach(opt => {
                const text = opt.textContent?.trim();
                const href = opt.getAttribute('href') || '';
                
                if (text && text.length > 0 && text.length < 100) {
                    options.push({
                        text,
                        href,
                        urlParam: extractUrlParam(href)
                    });
                }
            });
            
            if (options.length > 0) {
                categories.push({
                    name: title,
                    options: options.slice(0, 20)
                });
            }
        } catch (e) {
            // Skip
        }
    });

    return categories;
}

/**
 * Extract filters generically
 */
function extractGenericFilters() {
    const categories = [];
    
    const filterContainers = document.querySelectorAll([
        '[class*="filter"]',
        '[class*="facet"]',
        '[class*="refinement"]',
        'aside',
        '.sidebar'
    ].join(', '));

    filterContainers.forEach(container => {
        try {
            const sections = container.querySelectorAll('[class*="section"], [class*="group"], div > div');
            
            sections.forEach(section => {
                const titleEl = section.querySelector('h3, h4, [class*="title"], [class*="header"]');
                const title = titleEl?.textContent?.trim()?.toLowerCase() || '';
                
                if (!title || title.length > 50) return;
                
                const options = [];
                const optionEls = section.querySelectorAll('label, a, li');
                
                optionEls.forEach(opt => {
                    const text = opt.textContent?.trim();
                    if (text && text.length > 0 && text.length < 100) {
                        options.push({ text });
                    }
                });
                
                if (options.length > 0) {
                    categories.push({
                        name: title,
                        options: options.slice(0, 15)
                    });
                }
            });
        } catch (e) {
            // Skip
        }
    });

    return categories;
}

/**
 * Extract URL parameter from href
 */
function extractUrlParam(href) {
    if (!href) return null;
    try {
        const url = new URL(href, window.location.origin);
        const params = {};
        url.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    } catch (e) {
        return null;
    }
}

/**
 * Extract Ajio-specific URL param (query string format)
 */
function extractAjioUrlParam(href) {
    if (!href) return null;
    // Ajio uses format like :filter:value
    const match = href.match(/:([^:]+):([^:&]+)/g);
    if (match) {
        return match.map(m => m.replace(/^:/, ''));
    }
    return null;
}

/**
 * Build filter URL for a platform
 * @param {string} platform - Platform name
 * @param {string} baseUrl - Current search URL
 * @param {Object} filtersToApply - Filters determined by LLM
 * @returns {string} URL with filters applied
 */
export function buildFilterUrl(platform, baseUrl, filtersToApply) {
    try {
        const url = new URL(baseUrl);
        
        if (platform === 'flipkart') {
            return buildFlipkartFilterUrl(url, filtersToApply);
        } else if (platform === 'jiomart') {
            return buildJioMartFilterUrl(url, filtersToApply);
        } else if (platform === 'ajio') {
            return buildAjioFilterUrl(url, filtersToApply);
        }
        
        return baseUrl;
    } catch (error) {
        logger.error('Failed to build filter URL', error);
        return baseUrl;
    }
}

/**
 * Build Flipkart filter URL
 * Format: &p[]=facets.X[]=Y
 */
function buildFlipkartFilterUrl(url, filters) {
    const params = url.searchParams;
    
    // Price filter
    if (filters.price_max) {
        params.append('p[]', `facets.price_range.from=Min`);
        params.append('p[]', `facets.price_range.to=${filters.price_max}`);
    }
    if (filters.price_min) {
        params.set('p[]', `facets.price_range.from=${filters.price_min}`);
    }
    
    // RAM filter
    if (filters.ram) {
        const ramValue = filters.ram.toString().replace(/gb/i, '').trim();
        params.append('p[]', `facets.ram%5B%5D=${ramValue}+GB`);
    }
    
    // Brand filter
    if (filters.brand) {
        params.append('p[]', `facets.brand%5B%5D=${encodeURIComponent(filters.brand)}`);
    }
    
    // Storage filter
    if (filters.storage) {
        const storageValue = filters.storage.toString().replace(/gb/i, '').trim();
        params.append('p[]', `facets.internal_storage%5B%5D=${storageValue}+GB`);
    }
    
    return url.toString();
}

/**
 * Build JioMart filter URL
 * Format: &brand=X&price_min=Y&price_max=Z
 */
function buildJioMartFilterUrl(url, filters) {
    const params = url.searchParams;
    
    if (filters.brand) {
        params.set('brand', filters.brand);
    }
    if (filters.price_max) {
        params.set('price_max', filters.price_max);
    }
    if (filters.price_min) {
        params.set('price_min', filters.price_min);
    }
    if (filters.category) {
        params.set('category_level_1', filters.category);
    }
    
    return url.toString();
}

/**
 * Build Ajio filter URL
 * Format: ?query=:relevance:filter1:value1:filter2:value2&text=query
 */
function buildAjioFilterUrl(url, filters) {
    const params = url.searchParams;
    const text = params.get('text') || '';
    
    // Build query string with filters
    let queryParts = [':relevance'];
    
    if (filters.price_max) {
        if (filters.price_max <= 500) {
            queryParts.push(':pricerange:Below Rs.500');
        } else if (filters.price_max <= 1000) {
            queryParts.push(':pricerange:Rs. 500 to Rs. 1000');
        } else if (filters.price_max <= 2000) {
            queryParts.push(':pricerange:Rs. 1000 to Rs. 2000');
        } else {
            queryParts.push(`:pricerange:Below Rs.${filters.price_max}`);
        }
    }
    
    if (filters.gender) {
        queryParts.push(`:genderfilter:${filters.gender}`);
    }
    
    if (filters.size) {
        queryParts.push(`:verticalsizegroupformat:${filters.size.toUpperCase()}`);
    }
    
    if (filters.color) {
        queryParts.push(`:verticalcolorfamily:${filters.color}`);
    }
    
    if (filters.category) {
        queryParts.push(`:l1l3nestedcategory:${filters.category}`);
    }
    
    params.set('query', queryParts.join(''));
    params.set('text', text);
    
    return url.toString();
}

/**
 * Create LLM prompt for filter matching
 */
export function createFilterMatchPrompt(userIntent, availableFilters) {
    return `You are a shopping assistant. Given the user's shopping intent and available filters on an e-commerce page, determine which filters should be applied.

User Intent: "${userIntent}"

Available Filters on Page:
${JSON.stringify(availableFilters.categories.slice(0, 10), null, 2)}

Based on the user's intent, determine which filters to apply. Return ONLY a valid JSON object with these fields:
- brand: string or null (e.g., "Samsung", "Nike")
- price_min: number or null
- price_max: number or null  
- ram: string or null (e.g., "4GB", "6GB")
- storage: string or null (e.g., "64GB", "128GB")
- size: string or null (e.g., "S", "M", "L", "XL")
- color: string or null (e.g., "White", "Black")
- gender: string or null ("Men", "Women", "Unisex")
- category: string or null

Example response:
{"brand": "Samsung", "price_max": 20000, "ram": "4GB", "storage": null, "size": null, "color": null, "gender": null, "category": "Smartphones"}

Return ONLY the JSON object, no other text.`;
}

