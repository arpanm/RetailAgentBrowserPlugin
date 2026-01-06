/**
 * Unit tests for Error Handler
 */

import { describe, it, expect } from '@jest/globals';
import { ErrorHandler, RetailAgentError, APIError, DOMError, IntentParseError } from '../../src/lib/error-handler.js';

describe('ErrorHandler', () => {
    describe('RetailAgentError', () => {
        it('should create error with code and context', () => {
            const error = new RetailAgentError('Test error', 'TEST_CODE', true, { test: 'data' });
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.recoverable).toBe(true);
            expect(error.context.test).toBe('data');
        });
    });

    describe('APIError', () => {
        it('should create API error with status code', () => {
            const error = new APIError('API Error', 404);
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('API_404');
            expect(error.recoverable).toBe(false);
        });

        it('should mark 5xx errors as recoverable', () => {
            const error = new APIError('Server Error', 500);
            expect(error.recoverable).toBe(true);
        });
    });

    describe('DOMError', () => {
        it('should create DOM error with selector', () => {
            const error = new DOMError('Element not found', '#test-selector');
            expect(error.selector).toBe('#test-selector');
            expect(error.code).toBe('DOM_ELEMENT_NOT_FOUND');
            expect(error.recoverable).toBe(true);
        });
    });

    describe('IntentParseError', () => {
        it('should create intent parse error', () => {
            const error = new IntentParseError('Parse failed', 'user query');
            expect(error.code).toBe('INTENT_PARSE_FAILED');
            expect(error.recoverable).toBe(false);
        });
    });

    describe('getUserFriendlyMessage', () => {
        it('should return user-friendly message for known errors', () => {
            const error = new APIError('Unauthorized', 401);
            const message = ErrorHandler._getUserFriendlyMessage(error);
            expect(message).toContain('Authentication failed');
        });

        it('should return generic message for unknown errors', () => {
            const error = new Error('Unknown error');
            const message = ErrorHandler._getUserFriendlyMessage(error);
            expect(message).toBeTruthy();
        });
    });
});

