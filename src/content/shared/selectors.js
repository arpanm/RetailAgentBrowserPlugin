/**
 * Shared selector utilities for common DOM operations across platforms
 */

import { logger } from '../../lib/logger.js';
import { DOMError } from '../../lib/error-handler.js';
import { retryDOMOperation } from '../../lib/retry.js';

/**
 * Find element with multiple selector fallbacks
 */
export async function findElement(selectors, options = {}) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    
    for (const selector of selectorArray) {
        try {
            const element = await retryDOMOperation(
                selector,
                (el) => el,
                {
                    maxRetries: options.maxRetries || 3,
                    initialDelay: options.initialDelay || 500,
                }
            );
            if (element) {
                logger.debug(`Element found with selector: ${selector}`);
                return element;
            }
        } catch (error) {
            logger.debug(`Selector failed: ${selector}`, { error: error.message });
            continue;
        }
    }
    
    throw new DOMError(
        `No element found with any of the provided selectors: ${selectorArray.join(', ')}`,
        selectorArray[0],
        { allSelectors: selectorArray }
    );
}

/**
 * Find multiple elements
 */
export function findElements(selector, parent = document) {
    try {
        const elements = parent.querySelectorAll(selector);
        return Array.from(elements);
    } catch (error) {
        logger.warn(`Failed to find elements with selector: ${selector}`, { error: error.message });
        return [];
    }
}

/**
 * Wait for element to appear
 */
export async function waitForElement(selector, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new DOMError(`Element did not appear within ${timeout}ms: ${selector}`, selector);
}

/**
 * Get element text content safely
 */
export function getText(element, fallback = '') {
    if (!element) return fallback;
    return element.textContent?.trim() || element.innerText?.trim() || fallback;
}

/**
 * Get element attribute safely
 */
export function getAttribute(element, attribute, fallback = '') {
    if (!element) return fallback;
    return element.getAttribute(attribute) || fallback;
}

/**
 * Check if element is visible
 */
export function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(element, options = {}) {
    if (!element) return;
    
    try {
        element.scrollIntoView({
            behavior: options.behavior || 'smooth',
            block: options.block || 'center',
            inline: options.inline || 'nearest',
        });
        
        // Wait a bit for scroll to complete
        await new Promise(resolve => setTimeout(resolve, options.delay || 500));
    } catch (error) {
        logger.warn('Failed to scroll element into view', { error: error.message });
    }
}

/**
 * Click element safely with retry
 */
export async function safeClick(element, options = {}) {
    if (!element) {
        throw new DOMError('Cannot click: element is null', '');
    }

    try {
        // Scroll into view first
        await scrollIntoView(element, options.scrollOptions);
        
        // Wait for element to be clickable
        if (options.waitForClickable) {
            await waitForClickable(element, options.waitTimeout || 5000);
        }

        // Try different click methods
        if (options.useDispatchEvent) {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } else {
            element.click();
        }

        logger.debug('Element clicked successfully');
        return true;
    } catch (error) {
        logger.error('Failed to click element', error);
        throw error;
    }
}

/**
 * Wait for element to be clickable
 */
async function waitForClickable(element, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (isVisible(element) && !element.disabled) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Element not clickable within timeout');
}

/**
 * Fill input field safely
 */
export async function fillInput(selector, value, options = {}) {
    const element = await findElement(selector, options);
    
    if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
        throw new DOMError(`Element is not an input field: ${selector}`, selector);
    }

    // Clear existing value
    element.value = '';
    
    // Set new value
    if (options.simulateTyping) {
        // Simulate typing character by character
        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    } else {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    logger.debug(`Input filled: ${selector}`, { valueLength: value.length });
    return element;
}

/**
 * Select option from dropdown
 */
export async function selectOption(selector, value, options = {}) {
    const element = await findElement(selector, options);
    
    if (element.tagName === 'SELECT') {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        // For custom dropdowns, try to find and click the option
        const optionSelector = options.optionSelector || `[value="${value}"]`;
        const option = await findElement(optionSelector, { parent: element });
        await safeClick(option);
    }

    logger.debug(`Option selected: ${selector}`, { value });
    return element;
}

/**
 * Wait for a condition to be met
 */
export async function waitForCondition(condition, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await condition();
            if (result) {
                return result;
            }
        } catch (error) {
            // Ignore errors during condition check
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
}

