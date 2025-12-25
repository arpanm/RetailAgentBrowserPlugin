/**
 * Unit tests for State Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the gemini module
vi.mock('../../src/lib/gemini.js', () => ({
    generateContent: vi.fn(),
    setLogAction: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
}));

import { generateContent } from '../../src/lib/gemini.js';

// Use dynamic import because service_worker.js has side effects
let sw;

describe('State Management', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset currentState before each test
        sw = await import('../../src/background/service_worker.js');
        sw.resetState();
        // Mock API key
        chrome.storage.local.get.mockResolvedValue({ geminiApiKey: 'test-key' });
    });

    it('should initialize with IDLE state', () => {
        expect(sw.currentState.status).toBe('IDLE');
    });

    it('should transition to SEARCHING after handleUserQuery', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify({
                            product: 'test product',
                            platform: 'amazon',
                            filters: {}
                        }),
                    }],
                },
            }],
        };

        generateContent.mockResolvedValue(mockResponse);
        
        // Mock chrome.tabs.create
        chrome.tabs.create.mockResolvedValue({ id: 123 });

        await sw.handleUserQuery('buy something');
        
        expect(sw.currentState.status).toBe('SEARCHING');
        expect(sw.currentState.tabId).toBe(123);
        expect(sw.currentState.data.product).toBe('test product');
    });

    it('should transition to SELECTING after successful search', async () => {
        sw.currentState.status = 'SEARCHING';
        sw.currentState.tabId = 123;
        sw.currentState.data = { product: 'test', platform: 'amazon' };
        
        // Mock chrome.tabs.sendMessage for SEARCH
        chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
            if (msg.action === 'SEARCH') {
                callback({ success: true });
            }
        });
        
        // We don't use fake timers here to avoid complexity with multiple awaits
        // Instead we can mock the executeNextStep or just verify the transition
        // Or wrap the timeout in a way that we can skip it
        
        await sw.executeNextStep(123);
        
        expect(sw.currentState.status).toBe('SELECTING');
    });

    it('should reset state correctly', () => {
        sw.currentState.status = 'COMPLETED';
        sw.currentState.tabId = 123;
        sw.resetState();
        expect(sw.currentState.status).toBe('IDLE');
        expect(sw.currentState.tabId).toBe(null);
    });
});

