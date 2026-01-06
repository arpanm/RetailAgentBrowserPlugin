/**
 * Unit tests for Retry Logic
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { retryWithBackoff, RetryConfig, retryDOMOperation, retryAPICall } from '../../src/lib/retry.js';

describe('Retry Logic', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('retryWithBackoff', () => {
        it('should succeed on first attempt', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await retryWithBackoff(fn);
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure', async () => {
            const networkError = new Error('network error');
            networkError.name = 'NetworkError';
            
            const fn = jest.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValue('success');

            const promise = retryWithBackoff(fn, new RetryConfig({ maxRetries: 2, initialDelay: 100 }));
            
            // Fast-forward time
            jest.advanceTimersByTime(200);
            
            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should fail after max retries', async () => {
            vi.useRealTimers();
            const networkError = new Error('network error');
            networkError.name = 'NetworkError';
            
            const fn = jest.fn().mockRejectedValue(networkError);
            const config = new RetryConfig({ maxRetries: 2, initialDelay: 10, maxDelay: 50 });

            await expect(retryWithBackoff(fn, config)).rejects.toThrow('network error');
            expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });
    });

    describe('RetryConfig', () => {
        it('should use default values', () => {
            const config = new RetryConfig();
            expect(config.maxRetries).toBe(3);
            expect(config.initialDelay).toBe(1000);
        });

        it('should accept custom values', () => {
            const config = new RetryConfig({ maxRetries: 5, initialDelay: 500 });
            expect(config.maxRetries).toBe(5);
            expect(config.initialDelay).toBe(500);
        });
    });
});

