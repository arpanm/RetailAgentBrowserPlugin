/**
 * Amazon Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, applyFilters, sortResults } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';
import { retryDOMOperation } from '../../lib/retry.js';

export class AmazonPlatform extends EcommercePlatform {
    constructor() {
        super('amazon', {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
            selectors: {
                search: {
                    input: '#twotabsearchtextbox',
                    button: 'input[type="submit"][value="Go"]',
                    form: 'form.nav-searchbar',
                },
                results: {
                    container: '[data-component-type="s-search-result"], .s-result-item, .s-card-container',
                    title: 'h2 a span, h2 a, [data-cy="title-recipe"] h2 span',
                    link: 'h2 a[href*="/dp/"], h2 a[href*="/gp/product/"], .a-link-normal[href*="/dp/"]',
                    price: '.a-price .a-offscreen, .a-price',
                    rating: '.a-icon-alt, .a-star-rating',
                    image: '.s-image',
                },
                product: {
                    buyNow: [
                        '#buy-now-button',
                        '#sc-buy-box-ptc-button',
                        '[name="submit.buy-now"]',
                        '[data-action="buy-now"]',
                        'input[name="submit.buy-now"]',
                        '#buyNow_feature_div input',
                        '#buy-now-button-announce',
                        '.buy-now-button',
                        '#buybox input[value*="Buy Now"]'
                    ],
                    addToCart: '#add-to-cart-button, #add-to-cart-button-ubb',
                    title: '#productTitle',
                    price: '.a-price .a-offscreen, .a-price-whole',
                },
                checkout: {
                    address: '#address-book-entry-0, [data-action="select-shipping-address"]',
                    continue: 'input[name="shipToThisAddress"], [data-action="continue"]',
                    payment: '#payment-button, [data-action="select-payment-method"]',
                    placeOrder: '#placeYourOrder, [name="placeYourOrder1"]',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Amazon: Performing search', { query, filters, sort });
            
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });

            // Wait for search results to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Apply filters if provided
            if (Object.keys(filters).length > 0) {
                await this.applyFilters(filters);
            }

            // Apply sort if provided
            if (sort) {
                await this.sortResults(sort);
            }

            return true;
        } catch (error) {
            logger.error('Amazon: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            const products = extractProducts(
                this.selectors.results.container,
                {
                    title: this.selectors.results.title,
                    price: this.selectors.results.price,
                    link: this.selectors.results.link,
                    image: this.selectors.results.image,
                    rating: this.selectors.results.rating,
                    reviews: '.a-size-base',
                }
            );

            // Filter out sponsored items - more comprehensive check
            const nonSponsored = products.filter((product, index) => {
                const containers = document.querySelectorAll(this.selectors.results.container);
                const container = containers[index];
                if (!container) return false;
                
                // Check for sponsored indicators
                const isSponsored = 
                    container.querySelector('.s-sponsored-label-text') ||
                    container.querySelector('[data-component-type="sp-sponsored-result"]') ||
                    container.querySelector('.s-sponsored-information') ||
                    container.closest('[data-component-type="sp-sponsored-result"]') ||
                    container.innerText.includes('Sponsored') ||
                    container.innerText.includes('Ad') ||
                    container.classList.contains('AdHolder') ||
                    container.getAttribute('data-ad-id') ||
                    container.querySelector('[data-ad-id]');
                
                if (isSponsored) {
                    logger.debug('Filtered out sponsored product', { 
                        title: product.title?.substring(0, 50) 
                    });
                }
                
                return !isSponsored;
            });

            // Ensure all products are plain serializable objects (no DOM references)
            const serializableProducts = nonSponsored.map(product => ({
                index: typeof product.index === 'number' ? product.index : 0,
                title: String(product.title || ''),
                price: String(product.price || ''),
                link: String(product.link || ''),
                image: String(product.image || ''),
                rating: String(product.rating || ''),
                reviews: String(product.reviews || '')
            }));

            logger.info(`Amazon: Found ${serializableProducts.length} products`);
            
            return serializableProducts;
        } catch (error) {
            logger.error('Amazon: Failed to get search results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        try {
            const products = await this.getSearchResults();
            if (productIndex >= products.length) {
                throw new Error(`Product index ${productIndex} out of range`);
            }

            const product = products[productIndex];
            logger.info('Amazon: Selecting product', { index: productIndex, title: product.title });
            
            await clickProduct(product.link);
            return product;
        } catch (error) {
            logger.error('Amazon: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('Amazon: Adding to cart');
            await addToCart({
                button: this.selectors.product.addToCart,
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('Amazon: Clicking Buy Now');
            
            // Try multiple selectors with increased retries and wait time
            const selectors = Array.isArray(this.selectors.product.buyNow) 
                ? this.selectors.product.buyNow 
                : [this.selectors.product.buyNow];
            
            let lastError = null;
            for (const selector of selectors) {
                try {
                    logger.info(`Amazon: Trying Buy Now selector: ${selector}`);
                    await clickBuyNow({
                        button: selector,
                    }, {
                        maxRetries: 5,
                        initialDelay: 1000,
                        waitTimeout: 10000
                    });
                    logger.info('Amazon: Buy Now clicked successfully');
                    return true;
                } catch (error) {
                    logger.warn(`Amazon: Selector ${selector} failed`, { error: error.message });
                    lastError = error;
                    continue;
                }
            }
            
            // If all selectors failed, throw the last error
            throw lastError || new Error('All Buy Now selectors failed');
        } catch (error) {
            logger.error('Amazon: Failed to click Buy Now', error);
            throw error;
        }
    }

    async getProductDetails() {
        try {
            const title = getText(document.querySelector(this.selectors.product.title));
            const price = getText(document.querySelector(this.selectors.product.price));
            
            return {
                title,
                price,
                url: window.location.href,
            };
        } catch (error) {
            logger.error('Amazon: Failed to get product details', error);
            throw error;
        }
    }

    async applyFilters(filters) {
        try {
            logger.info('Amazon: Applying filters', { filters });
            
            if (!filters || Object.keys(filters).length === 0) {
                logger.info('Amazon: No filters to apply');
                return true;
            }
            
            // Wait for page to fully load and filters sidebar to appear
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Scroll to top to ensure filters are visible
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            logger.info('Amazon: Page ready for filter application');
            
            // Apply price range filter
            if (filters.price_min || filters.price_max) {
                try {
                    // Amazon price filter is usually in a sidebar
                    const priceContainer = document.querySelector('#p_36, [aria-label*="price"], .a-section[aria-label*="Price"]');
                    if (priceContainer) {
                        // Try to find price input fields
                        const minInput = priceContainer.querySelector('input[name="low-price"], input[placeholder*="Min"]');
                        const maxInput = priceContainer.querySelector('input[name="high-price"], input[placeholder*="Max"]');
                        
                        if (minInput && filters.price_min) {
                            minInput.value = filters.price_min;
                            minInput.dispatchEvent(new Event('input', { bubbles: true }));
                            minInput.dispatchEvent(new Event('change', { bubbles: true }));
                            logger.info('Amazon: Set min price', { price: filters.price_min });
                        }
                        
                        if (maxInput && filters.price_max) {
                            maxInput.value = filters.price_max;
                            maxInput.dispatchEvent(new Event('input', { bubbles: true }));
                            maxInput.dispatchEvent(new Event('change', { bubbles: true }));
                            logger.info('Amazon: Set max price', { price: filters.price_max });
                        }
                        
                        // Try to find and click "Go" button
                        const goButton = priceContainer.querySelector('input[type="submit"], button, .a-button-input');
                        if (goButton) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            goButton.click();
                            logger.info('Amazon: Clicked price filter apply button');
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                } catch (priceError) {
                    logger.warn('Amazon: Failed to apply price filter', { error: priceError.message });
                }
            }
            
            // Apply brand filter
            if (filters.brand) {
                try {
                    // Wait for brand filter section to load
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Try multiple selectors for brand filter
                    const brandSelectors = [
                        '#p_89', // Brand filter container
                        '#brandsRefinements',
                        '[aria-label*="Brand"]',
                        '[aria-label*="brand"]',
                        '.a-checkbox[aria-label*="Brand"]',
                        '.a-checkbox[aria-label*="brand"]',
                        '[id*="brand"]'
                    ];
                    
                    let brandApplied = false;
                    const brandText = filters.brand.toLowerCase();
                    
                    logger.info('Amazon: Searching for brand filter', { brand: filters.brand, selectors: brandSelectors });
                    
                    for (const containerSelector of brandSelectors) {
                        const brandContainer = document.querySelector(containerSelector);
                        if (!brandContainer) {
                            logger.debug('Amazon: Brand container not found', { selector: containerSelector });
                            continue;
                        }
                        
                        logger.info('Amazon: Found brand container', { selector: containerSelector });
                        
                        // Look for brand link/checkbox - try multiple approaches
                        const allElements = brandContainer.querySelectorAll('a, span, label, .a-checkbox, input[type="checkbox"]');
                        logger.info('Amazon: Found elements in brand container', { count: allElements.length });
                        
                        for (const el of allElements) {
                            const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
                            const brandWords = brandText.split(/\s+/);
                            const matches = brandWords.some(word => text.includes(word));
                            
                            if (matches) {
                                logger.info('Amazon: Found matching brand element', { 
                                    text: text.substring(0, 50),
                                    tagName: el.tagName,
                                    className: el.className
                                });
                                
                                // Try clicking
                                try {
                                    if (el.tagName === 'LABEL' || el.classList.contains('a-checkbox')) {
                                        const checkbox = el.querySelector('input[type="checkbox"]') || el;
                                        if (checkbox) {
                                            checkbox.click();
                                            brandApplied = true;
                                        }
                                    } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                                        if (!el.checked) {
                                            el.click();
                                            brandApplied = true;
                                        }
                                    } else {
                                        el.click();
                                        brandApplied = true;
                                    }
                                    
                                    if (brandApplied) {
                                        logger.info('Amazon: Applied brand filter', { brand: filters.brand, selector: containerSelector });
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        break;
                                    }
                                } catch (clickError) {
                                    logger.warn('Amazon: Failed to click brand element', { error: clickError.message });
                                }
                            }
                        }
                        
                        if (brandApplied) break;
                    }
                    
                    if (!brandApplied) {
                        logger.warn('Amazon: Brand filter not found', { brand: filters.brand });
                    }
                } catch (brandError) {
                    logger.warn('Amazon: Failed to apply brand filter', { error: brandError.message });
                }
            }
            
            // Apply storage filter (if available in Amazon filters)
            if (filters.storage) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const storageText = filters.storage.replace(/gb/i, '').trim();
                    const storageLink = Array.from(document.querySelectorAll('a, span, label')).find(el => {
                        const text = (el.textContent || '').toLowerCase();
                        // Support various labels like "256 GB", "256GB", "SSD 256GB"
                        return (text.includes(`${storageText}gb`) || text.includes(`${storageText} gb`)) &&
                               (el.closest('#p_n_feature_nine_browse-bin') || 
                                el.closest('#p_n_feature_seven_browse-bin') ||
                                el.closest('#p_n_feature_browse-bin') ||
                                el.closest('[aria-label*="Storage"]') ||
                                el.closest('[aria-label*="SSD"]'));
                    });
                    if (storageLink) {
                        storageLink.click();
                        logger.info('Amazon: Applied storage filter', { storage: filters.storage });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (storageError) {
                    logger.warn('Amazon: Failed to apply storage filter', { error: storageError.message });
                }
            }
            
            // Apply RAM filter (if available in Amazon filters)
            if (filters.ram) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const ramText = filters.ram.replace(/gb/i, '').replace(/more than/i, '').trim();
                    const ramLink = Array.from(document.querySelectorAll('a, span, label')).find(el => {
                        const text = (el.textContent || '').toLowerCase();
                        // Support "16 GB", "16GB", etc.
                        return (text.includes(`${ramText}gb`) || text.includes(`${ramText} gb`)) &&
                               (el.closest('#p_n_feature_eight_browse-bin') || 
                                el.closest('#p_n_feature_five_browse-bin') ||
                                el.closest('[aria-label*="RAM"]') ||
                                el.closest('[aria-label*="Memory"]'));
                    });
                    if (ramLink) {
                        ramLink.click();
                        logger.info('Amazon: Applied RAM filter', { ram: filters.ram });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (ramError) {
                    logger.warn('Amazon: Failed to apply RAM filter', { error: ramError.message });
                }
            }
            
            // Apply battery filter (if available in Amazon filters)
            if (filters.battery) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const batteryText = filters.battery.toString();
                    const batteryLink = Array.from(document.querySelectorAll('a, span, label')).find(el => {
                        const text = (el.textContent || '').toLowerCase();
                        return text.includes(`${batteryText}mah`) || text.includes(`${batteryText} mah`) &&
                               (el.closest('[aria-label*="Battery"]') || el.closest('[aria-label*="battery"]'));
                    });
                    if (batteryLink) {
                        batteryLink.click();
                        logger.info('Amazon: Applied battery filter', { battery: filters.battery });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (batteryError) {
                    logger.warn('Amazon: Failed to apply battery filter', { error: batteryError.message });
                }
            }
            
            // Apply rating filter
            if (filters.rating) {
                try {
                    const ratingValue = Math.floor(filters.rating);
                    const ratingLink = Array.from(document.querySelectorAll('a, span')).find(el => {
                        const text = el.textContent || '';
                        return text.includes(`${ratingValue} Star`) || text.includes(`${ratingValue}+`) &&
                               (el.closest('#p_72') || el.closest('[aria-label*="Rating"]'));
                    });
                    if (ratingLink) {
                        ratingLink.click();
                        logger.info('Amazon: Applied rating filter', { rating: filters.rating });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (ratingError) {
                    logger.warn('Amazon: Failed to apply rating filter', { error: ratingError.message });
                }
            }
            
            logger.info('Amazon: Filter application completed');
            return true;
        } catch (error) {
            logger.warn('Amazon: Failed to apply some filters', { error: error.message });
            // Don't throw - filters are optional
            return true;
        }
    }

    async sortResults(sortOption) {
        try {
            await sortResults(sortOption, {
                dropdown: '#s-result-sort-select',
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to sort results', error);
            throw error;
        }
    }
}

