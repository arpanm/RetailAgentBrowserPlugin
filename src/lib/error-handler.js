/**
 * Comprehensive error handling with recovery mechanisms
 */

import { logger } from './logger.js';

export class RetailAgentError extends Error {
    constructor(message, code, recoverable = false, context = {}) {
        super(message);
        this.name = 'RetailAgentError';
        this.code = code;
        this.recoverable = recoverable;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

export class APIError extends RetailAgentError {
    constructor(message, statusCode, response = {}) {
        const recoverable = statusCode >= 500 || statusCode === 429;
        super(message, `API_${statusCode}`, recoverable, { statusCode, response });
        this.name = 'APIError';
        this.statusCode = statusCode;
    }
}

export class DOMError extends RetailAgentError {
    constructor(message, selector, context = {}) {
        super(message, 'DOM_ELEMENT_NOT_FOUND', true, { selector, ...context });
        this.name = 'DOMError';
        this.selector = selector;
    }
}

export class IntentParseError extends RetailAgentError {
    constructor(message, userQuery, context = {}) {
        super(message, 'INTENT_PARSE_FAILED', false, { userQuery, ...context });
        this.name = 'IntentParseError';
    }
}

/**
 * Error handler with recovery strategies
 */
export class ErrorHandler {
    /**
     * Handle error with appropriate recovery strategy
     */
    static async handle(error, context = {}) {
        // Safely extract error message before logging to avoid DOM reference issues
        let safeError = error;
        try {
            // Create a safe copy of the error without DOM references
            if (error && typeof error === 'object') {
                safeError = {
                    message: String(error.message || 'Unknown error'),
                    name: String(error.name || 'Error'),
                    stack: String(error.stack || ''),
                    code: error.code,
                    recoverable: error.recoverable,
                    context: error.context
                };
            }
        } catch (e) {
            // If we can't serialize, create a minimal error object
            safeError = {
                message: 'Error occurred (details unavailable)',
                name: 'Error'
            };
        }
        
        logger.error('Error occurred', safeError, context);

        // Determine if error is recoverable
        if (error instanceof RetailAgentError && error.recoverable) {
            const recovery = await this._attemptRecovery(error, context);
            return {
                success: recovery.success,
                message: recovery.success ? recovery.message : this._getUserFriendlyMessage(error),
                recovery: recovery.recovery
            };
        }

        // Non-recoverable errors - show user-friendly message
        const message = this._getUserFriendlyMessage(error);
        return {
            success: false,
            message: message
        };
    }

    /**
     * Attempt to recover from error
     */
    static async _attemptRecovery(error, context) {
        logger.info('Attempting error recovery', { error: error.code, context });

        if (error instanceof DOMError) {
            return await this._recoverFromDOMError(error, context);
        }

        if (error instanceof APIError) {
            return await this._recoverFromAPIError(error, context);
        }

        return { success: false, message: this._getUserFriendlyMessage(error) };
    }

    /**
     * Recover from DOM-related errors
     */
    static async _recoverFromDOMError(error, context) {
        const { selector, context: errorContext } = error;
        
        // Try alternative selectors if available
        if (context.alternativeSelectors && context.alternativeSelectors.length > 0) {
            logger.info('Trying alternative selectors', { selector, alternatives: context.alternativeSelectors });
            return {
                success: true,
                recovery: 'alternative_selector',
                selectors: context.alternativeSelectors
            };
        }

        // Wait and retry if element might be loading
        if (context.retryable) {
            logger.info('Element might be loading, will retry', { selector });
            return {
                success: true,
                recovery: 'retry',
                delay: context.retryDelay || 2000
            };
        }

        return { success: false, message: this._getUserFriendlyMessage(error) };
    }

    /**
     * Recover from API errors
     */
    static async _recoverFromAPIError(error, context) {
        const { statusCode } = error;

        // Rate limiting - wait and retry
        if (statusCode === 429) {
            const retryAfter = error.context.response?.retryAfter || 60;
            logger.warn('Rate limited, will retry after delay', { retryAfter });
            return {
                success: true,
                recovery: 'retry_after_delay',
                delay: retryAfter * 1000
            };
        }

        // Server errors - retry with backoff
        if (statusCode >= 500 && context.retryable) {
            logger.warn('Server error, will retry', { statusCode });
            return {
                success: true,
                recovery: 'retry_with_backoff',
                maxRetries: context.maxRetries || 3
            };
        }

        return { success: false, message: this._getUserFriendlyMessage(error) };
    }

    /**
     * Get user-friendly error message
     */
    static _getUserFriendlyMessage(error) {
        if (error instanceof RetailAgentError) {
            const messages = {
                'API_401': 'Authentication failed. Please check your API key.',
                'API_403': 'Access denied. Please check your API permissions.',
                'API_429': 'Too many requests. Please wait a moment and try again.',
                'API_500': 'Service temporarily unavailable. Please try again later.',
                'DOM_ELEMENT_NOT_FOUND': 'Page structure changed. Please refresh and try again.',
                'INTENT_PARSE_FAILED': 'Could not understand your request. Please rephrase.',
                'NETWORK_ERROR': 'Network error. Please check your internet connection.',
                'TIMEOUT': 'Request timed out. Please try again.'
            };

            return messages[error.code] || error.message || 'An unexpected error occurred.';
        }

        // Generic error messages
        if (error.message) {
            return error.message;
        }

        return 'An unexpected error occurred. Please try again.';
    }

    /**
     * Wrap async function with error handling
     */
    static wrapAsync(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                const result = await this.handle(error, context);
                if (!result.success && result.recovery) {
                    // Recovery strategy provided, caller should handle
                    throw { ...error, recovery: result };
                }
                throw error;
            }
        };
    }

    /**
     * Create safe DOM operation wrapper
     */
    static safeDOMOperation(operation, selector, options = {}) {
        return async () => {
            try {
                // Check if document is available (not in service worker context)
                if (typeof document === 'undefined') {
                    return { success: false, message: 'DOM operations not available in service worker context' };
                }
                const element = document.querySelector(selector);
                if (!element) {
                    throw new DOMError(`Element not found: ${selector}`, selector, {
                        retryable: options.retryable || false,
                        alternativeSelectors: options.alternativeSelectors || []
                    });
                }
                return await operation(element);
            } catch (error) {
                if (error instanceof DOMError && options.fallback) {
                    logger.warn('DOM operation failed, using fallback', { selector, error: error.message });
                    return await options.fallback();
                }
                throw error;
            }
        };
    }
}

