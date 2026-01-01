/**
 * Sponsored Product Detection Utility
 * Detects sponsored/paid products on e-commerce platforms
 */

import { logger } from './logger.js';

/**
 * Check if a product element is sponsored/paid
 * Uses multiple detection methods with priority order
 * 
 * @param {HTMLElement} element - Product container element
 * @param {string} platform - Platform name ('amazon', 'flipkart', etc.)
 * @returns {boolean} - True if sponsored, false otherwise
 */
export function isSponsoredProduct(element, platform = 'amazon') {
  if (!element) {
    return false;
  }
  
  try {
    // Platform-specific detection
    if (platform === 'amazon' || platform.includes('amazon')) {
      return isAmazonSponsored(element);
    } else if (platform === 'flipkart') {
      return isFlipkartSponsored(element);
    }
    
    // Generic detection fallback
    return isGenericSponsored(element);
    
  } catch (error) {
    logger.debug('Error in sponsored detection', { error: error.message });
    return false; // Assume not sponsored on error
  }
}

/**
 * Amazon-specific sponsored product detection
 */
function isAmazonSponsored(element) {
  // Priority 1: data-component-type (most reliable)
  const componentType = element.getAttribute('data-component-type');
  if (componentType === 'sp-sponsored-result') {
    logger.debug('Sponsored detected: data-component-type');
    return true;
  }
  
  // Priority 2: data-ad-details attribute
  if (element.hasAttribute('data-ad-details')) {
    logger.debug('Sponsored detected: data-ad-details');
    return true;
  }
  
  // Priority 3: AdHolder class
  if (element.classList.contains('AdHolder')) {
    logger.debug('Sponsored detected: AdHolder class');
    return true;
  }
  
  // Priority 4: Sponsored header element
  const sponsoredHeader = element.querySelector('.s-sponsored-header');
  if (sponsoredHeader) {
    logger.debug('Sponsored detected: s-sponsored-header');
    return true;
  }
  
  // Priority 5: Sponsored info icon
  const sponsoredIcon = element.querySelector('.s-sponsored-info-icon');
  if (sponsoredIcon) {
    logger.debug('Sponsored detected: s-sponsored-info-icon');
    return true;
  }
  
  // Priority 6: Sponsored label in various locations
  const sponsoredLabels = element.querySelectorAll('[class*="sponsor" i]');
  for (const label of sponsoredLabels) {
    const text = (label.textContent || '').trim().toLowerCase();
    // Exact match or starts with "sponsored"
    if (text === 'sponsored' || text.startsWith('sponsored ')) {
      logger.debug('Sponsored detected: label text');
      return true;
    }
  }
  
  // Priority 7: ARIA label check
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.toLowerCase().includes('sponsored')) {
    logger.debug('Sponsored detected: aria-label');
    return true;
  }
  
  // Priority 8: Check for sponsored badge or tag
  const sponsoredBadge = element.querySelector('[data-sponsored="true"], [data-is-sponsored="true"]');
  if (sponsoredBadge) {
    logger.debug('Sponsored detected: data attribute badge');
    return true;
  }
  
  return false;
}

/**
 * Flipkart-specific sponsored product detection
 */
function isFlipkartSponsored(element) {
  // Flipkart sponsored indicators
  
  // Check for "Ad" label
  const adLabel = element.querySelector('._2VHWtw, [class*="adLabel"]');
  if (adLabel) {
    const text = (adLabel.textContent || '').trim().toLowerCase();
    if (text === 'ad' || text === 'sponsored') {
      logger.debug('Flipkart sponsored detected: ad label');
      return true;
    }
  }
  
  // Check data attributes
  if (element.hasAttribute('data-ad-id') || element.hasAttribute('data-is-ad')) {
    logger.debug('Flipkart sponsored detected: data attribute');
    return true;
  }
  
  // Check for "Sponsored" text in product card
  const sponsoredText = element.querySelector('[class*="sponsor" i]');
  if (sponsoredText) {
    logger.debug('Flipkart sponsored detected: sponsored class');
    return true;
  }
  
  return false;
}

/**
 * Generic sponsored product detection (fallback)
 */
function isGenericSponsored(element) {
  // Check for common sponsored indicators across platforms
  
  // 1. Text content search (least reliable, use carefully)
  const textContent = element.textContent || '';
  const lowerText = textContent.toLowerCase();
  
  // Look for "sponsored" at the beginning of text or as a badge
  const sponsoredPattern = /^[\s]*sponsored[\s]*$/i;
  
  // Check all text nodes
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = (node.textContent || '').trim();
        if (text.length > 0 && text.length < 20) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    if (sponsoredPattern.test(text)) {
      logger.debug('Generic sponsored detected: text pattern');
      return true;
    }
  }
  
  // 2. Check for ad-related classes
  const adClasses = ['ad', 'advertisement', 'promoted', 'featured-ad'];
  for (const cls of adClasses) {
    if (element.classList.contains(cls)) {
      logger.debug('Generic sponsored detected: ad class');
      return true;
    }
  }
  
  // 3. Check for ad-related data attributes
  const attrs = element.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attrName = attrs[i].name.toLowerCase();
    if (attrName.includes('ad-') || attrName.includes('sponsored')) {
      logger.debug('Generic sponsored detected: ad attribute');
      return true;
    }
  }
  
  return false;
}

/**
 * Filter out sponsored products from a list
 * 
 * @param {Array} products - Array of product objects with element property
 * @param {string} platform - Platform name
 * @returns {Object} - { organic: [], sponsored: [], stats: {} }
 */
export function filterSponsoredProducts(products, platform = 'amazon') {
  const organic = [];
  const sponsored = [];
  const stats = {
    total: products.length,
    organic: 0,
    sponsored: 0,
    detectionMethods: {}
  };
  
  for (const product of products) {
    // Check if product has an element property to test
    const element = product.element || product._element;
    
    if (element && isSponsoredProduct(element, platform)) {
      sponsored.push(product);
      stats.sponsored++;
    } else {
      organic.push(product);
      stats.organic++;
    }
  }
  
  logger.info('Sponsored product filtering complete', stats);
  
  return { organic, sponsored, stats };
}

/**
 * Mark product containers in DOM for visual debugging
 * Adds colored borders to sponsored products
 * 
 * @param {Array<HTMLElement>} elements - Product container elements
 * @param {string} platform - Platform name
 */
export function highlightSponsoredProducts(elements, platform = 'amazon') {
  let sponsoredCount = 0;
  let organicCount = 0;
  
  for (const element of elements) {
    if (isSponsoredProduct(element, platform)) {
      // Add red border to sponsored products
      element.style.border = '2px solid red';
      element.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
      
      // Add badge
      const badge = document.createElement('div');
      badge.textContent = 'SPONSORED';
      badge.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        background: red;
        color: white;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
      `;
      element.style.position = 'relative';
      element.insertBefore(badge, element.firstChild);
      
      sponsoredCount++;
    } else {
      // Add green border to organic products
      element.style.border = '2px solid green';
      element.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.3)';
      organicCount++;
    }
  }
  
  logger.info('Visual highlighting applied', { sponsoredCount, organicCount });
}

