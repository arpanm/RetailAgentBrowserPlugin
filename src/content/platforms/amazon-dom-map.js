/**
 * Amazon DOM Structure Mapping
 * Detailed map of Amazon.in DOM structure for precise element targeting
 */

export const AMAZON_DOM_MAP = {
  // Search Results Page
  searchResults: {
    // Main container for all results
    mainContainer: '#s-results-list-atf, [data-component-type="s-search-results"]',
    
    // Product containers
    productContainer: {
      primary: '[data-asin]:not([data-asin=""])',
      alternatives: [
        '[data-component-type="s-search-result"]',
        '.s-result-item[data-asin]',
        'div.sg-col-inner > div[data-asin]'
      ]
    },
    
    // Sponsored product indicators
    sponsored: {
      dataAttribute: 'data-component-type="sp-sponsored-result"',
      adDetailsAttr: 'data-ad-details',
      classes: ['.AdHolder', '.s-sponsored-info-icon'],
      headers: ['.s-sponsored-header'],
      ariaLabel: '[aria-label*="Sponsored"]'
    },
    
    // Product elements within container
    productElements: {
      title: {
        primary: 'h2 a span',
        alternatives: ['h2 a', '[data-cy="title-recipe"] h2 span', 'h2.s-line-clamp-2']
      },
      link: {
        primary: 'h2 a[href*="/dp/"]',
        alternatives: [
          'h2 a[href*="/gp/product/"]',
          '.a-link-normal[href*="/dp/"]',
          'a.s-underline-link-text[href*="/dp/"]'
        ]
      },
      price: {
        primary: '.a-price .a-offscreen',
        alternatives: [
          '.a-price-whole',
          '.a-price',
          '[data-a-color="price"]'
        ]
      },
      image: {
        primary: '.s-image',
        alternatives: [
          'img[data-image-latency]',
          'img.s-product-image'
        ]
      },
      rating: {
        primary: '.a-icon-star-small .a-icon-alt',
        alternatives: [
          '.a-star-rating span',
          '[aria-label*="out of 5 stars"]'
        ]
      },
      reviews: {
        primary: '.s-underline-text',
        alternatives: [
          '[aria-label*="ratings"]',
          '.a-size-base.s-underline-text'
        ]
      }
    },
    
    // Result count indicator
    resultCount: {
      container: '.s-breadcrumb .a-color-state, [data-component-type="s-result-info-bar"]',
      pattern: /1-(\d+) of (over )?([0-9,]+) results/
    }
  },
  
  // Filter Sidebar
  filterSidebar: {
    // Main containers
    container: {
      primary: '#s-refinements',
      alternatives: ['#leftNav', '#filters-left-nav', 'aside[aria-label*="Filter"]']
    },
    
    // Filter groups - critical for Amazon
    filterGroups: {
      // Amazon uses div[id^="p_"] pattern extensively
      idPattern: /^p_(.+)$/,
      selector: 'div[id^="p_"]',
      
      // Common filter IDs
      knownFilters: {
        reviews: {
          id: 'p_123',
          selector: '#p_123',
          values: {
            fourStarsUp: { code: '46655', selector: '#p_123\\:46655' },
            threeStarsUp: { code: '46654', selector: '#p_123\\:46654' },
            twoStarsUp: { code: '46653', selector: '#p_123\\:46653' },
            oneStarUp: { code: '46652', selector: '#p_123\\:46652' }
          }
        },
        price: {
          id: 'p_36',
          selector: '#p_36',
          inputMin: '#low-price',
          inputMax: '#high-price',
          submitButton: 'input[aria-labelledby="p_36-title"]',
          goButton: '.a-button-input[type="submit"]'
        },
        // Dynamic filters (mobile-specific attributes)
        battery: {
          idPattern: 'p_n_g-101015098008111',
          selector: '#p_n_g-101015098008111, [id*="101015098008111"]',
          linkPattern: 'a[href*="101015098008111"]'
        },
        ram: {
          idPattern: 'p_n_g-1003495121111',
          selector: '#p_n_g-1003495121111, [id*="1003495121111"]',
          linkPattern: 'a[href*="1003495121111"]'
        },
        storage: {
          idPattern: 'p_n_g-1003492455111',
          selector: '#p_n_g-1003492455111, [id*="1003492455111"]',
          linkPattern: 'a[href*="1003492455111"]'
        },
        brand: {
          id: 'p_123',  // Brand code varies
          selector: '#brandsRefinements',
          alternatives: ['#p_89', '[id*="brand"]']
        }
      }
    },
    
    // Filter elements within groups
    filterElements: {
      header: {
        selector: 'span.a-text-bold, h4, .a-spacing-small span.a-size-base.a-text-bold',
        alternatives: ['[class*="header"]', 'legend']
      },
      links: {
        selector: 'a[href*="rh="]',
        alternatives: ['li a', 'span.a-list-item a']
      },
      checkboxes: {
        selector: 'input[type="checkbox"]',
        label: 'label[for]'
      },
      expandButton: {
        selector: 'a[aria-expanded="false"], .s-expander-button',
        seeMoreText: ['See more', 'See all', 'Show more']
      }
    },
    
    // Active filters
    activeFilters: {
      container: '.s-breadcrumb, #s-refinements',
      badge: '.a-badge-label',
      clearLink: '.s-navigation-clear-link',
      filterChip: '[data-csa-c-element-type="filter-chip"]'
    }
  },
  
  // Product Page
  productPage: {
    // Page identification
    urlPattern: /\/dp\/([A-Z0-9]{10})/,
    
    // Key elements
    title: {
      primary: '#productTitle',
      alternatives: ['#title', '[id*="product-title"]']
    },
    price: {
      primary: '.a-price .a-offscreen',
      alternatives: ['#priceblock_ourprice', '#priceblock_dealprice', '.a-price-whole']
    },
    buyNow: {
      primary: '#buy-now-button',
      alternatives: [
        'input[name="submit.buy-now"]',
        '[id*="buy-now"]',
        '.a-button-inner:contains("Buy Now")'
      ]
    },
    addToCart: {
      primary: '#add-to-cart-button',
      alternatives: [
        'input[name="submit.add-to-cart"]',
        '[id*="add-to-cart"]'
      ]
    },
    availability: {
      selector: '#availability',
      inStock: ['In stock', 'Available', 'Only .* left in stock'],
      outOfStock: ['Out of stock', 'Currently unavailable', 'Temporarily out of stock']
    }
  },
  
  // Loading States
  loadingIndicators: {
    spinner: '.s-loading, [aria-busy="true"]',
    skeleton: '.s-skeleton, [class*="skeleton"]',
    progressBar: '.a-progress-bar',
    overlay: '.a-modal-scroller, .a-popover-modal'
  },
  
  // URL Parameters
  urlParameters: {
    searchQuery: 'k',            // Search keyword
    refinementHash: 'rh',        // Filter refinements
    sortOrder: 's',              // Sort parameter
    pageNumber: 'page',          // Pagination
    queryId: 'qid',              // Query ID for tracking
    refinementId: 'rnid'         // Refinement navigation ID
  }
};

/**
 * Helper function to get selector with fallbacks
 */
export function getSelector(domPath) {
  const parts = domPath.split('.');
  let current = AMAZON_DOM_MAP;
  
  for (const part of parts) {
    if (!current[part]) return null;
    current = current[part];
  }
  
  if (typeof current === 'string') {
    return current;
  }
  
  if (current.primary) {
    return current.primary;
  }
  
  if (current.selector) {
    return current.selector;
  }
  
  return null;
}

/**
 * Get all possible selectors for an element
 */
export function getAllSelectors(domPath) {
  const parts = domPath.split('.');
  let current = AMAZON_DOM_MAP;
  
  for (const part of parts) {
    if (!current[part]) return [];
    current = current[part];
  }
  
  const selectors = [];
  
  if (typeof current === 'string') {
    return [current];
  }
  
  if (current.primary) {
    selectors.push(current.primary);
  }
  
  if (current.selector) {
    selectors.push(current.selector);
  }
  
  if (current.alternatives && Array.isArray(current.alternatives)) {
    selectors.push(...current.alternatives);
  }
  
  return selectors;
}

/**
 * Check if element matches sponsored indicators
 */
export function matchesSponsoredPattern(element) {
  const patterns = AMAZON_DOM_MAP.searchResults.sponsored;
  
  // Check data-component-type
  if (element.getAttribute('data-component-type') === 'sp-sponsored-result') {
    return true;
  }
  
  // Check data-ad-details
  if (element.hasAttribute('data-ad-details')) {
    return true;
  }
  
  // Check classes
  for (const className of patterns.classes) {
    if (element.querySelector(className)) {
      return true;
    }
  }
  
  // Check headers
  for (const header of patterns.headers) {
    if (element.querySelector(header)) {
      return true;
    }
  }
  
  return false;
}

