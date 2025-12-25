/**
 * Unit tests for Config Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configManager } from '../../src/lib/config.js';

// Mock chrome.storage
global.chrome = {
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
        },
    },
};

describe('ConfigManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Deep copy config to avoid test interference
        configManager.config = JSON.parse(JSON.stringify(configManager.config));
    });

    it('should get configuration value', () => {
        configManager.config.test = { nested: { value: 'test' } };
        const value = configManager.get('test.nested.value');
        expect(value).toBe('test');
    });

    it('should return default value when path not found', () => {
        const value = configManager.get('nonexistent.path', 'default');
        expect(value).toBe('default');
    });

    it('should check if feature is enabled', () => {
        configManager.config.features = { ...configManager.config.features, testFeature: true };
        expect(configManager.isFeatureEnabled('testFeature')).toBe(true);
    });

    it('should check if platform is enabled', () => {
        configManager.config.platforms = { 
            ...configManager.config.platforms,
            amazon: { ...configManager.config.platforms.amazon, enabled: true } 
        };
        expect(configManager.isPlatformEnabled('amazon')).toBe(true);
    });

    it('should validate configuration', () => {
        configManager.config.apiKey = 'test-key';
        const validation = configManager.validate();
        expect(validation.valid).toBe(true);
    });

    it('should fail validation without API key', () => {
        configManager.config.apiKey = null;
        const validation = configManager.validate();
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('API key is required');
    });
});

