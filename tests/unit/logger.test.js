/**
 * Unit tests for Logger
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { logger } from '../../src/lib/logger.js';

describe('Logger', () => {
    beforeEach(() => {
        logger.clearLogs();
        logger.setLevel('INFO');
    });

    it('should log info messages', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        logger.info('Test message');
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
        const consoleSpy = jest.spyOn(console, 'error');
        logger.error('Test error');
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should filter debug messages when level is INFO', () => {
        logger.setLevel('INFO');
        const consoleSpy = jest.spyOn(console, 'debug');
        logger.debug('Debug message');
        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should store logs in memory', () => {
        logger.info('Test message');
        const logs = logger.getLogs();
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[logs.length - 1].message).toBe('Test message');
    });

    it('should clear logs', async () => {
        logger.info('Test message');
        await logger.clearLogs();
        const logs = logger.getLogs();
        expect(logs.length).toBe(0);
    });
});

