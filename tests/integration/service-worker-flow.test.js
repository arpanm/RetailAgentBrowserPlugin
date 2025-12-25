/**
 * Integration tests for Service Worker Flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the gemini module
vi.mock('../../src/lib/gemini.js', () => ({
    generateContent: vi.fn(),
    setLogAction: vi.fn(),
}));

import { generateContent } from '../../src/lib/gemini.js';

describe('Service Worker Flow Integration', () => {
    let sw;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset state
        sw = await import('../../src/background/service_worker.js');
        sw.resetState();
        // Mock API key
        chrome.storage.local.get.mockResolvedValue({ geminiApiKey: 'test-key' });
    });

    it('should process user query and create tab', async () => {
        vi.mocked(generateContent).mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify({
                            product: 'iphone',
                            platform: 'amazon',
                            filters: { brand: 'apple' }
                        })
                    }]
                }
            }]
        });

        // Mock chrome.tabs.create
        chrome.tabs.create.mockResolvedValue({ id: 456 });

        // Start processing
        await sw.handleUserQuery('buy iphone');

        expect(sw.currentState.status).toBe('SEARCHING');
        expect(sw.currentState.tabId).toBe(456);
        expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
            url: expect.stringContaining('amazon.in')
        }));
    });
});

