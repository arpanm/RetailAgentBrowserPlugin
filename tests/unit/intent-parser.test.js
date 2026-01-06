/**
 * Unit tests for Intent Parser
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the gemini module
jest.mock('../../src/lib/gemini.js', () => ({
    generateContent: jest.fn(),
    setLogAction: jest.fn(),
    listModels: jest.fn(),
}));

import { generateContent } from '../../src/lib/gemini.js';

describe('Intent Parser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should parse product intent', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify({
                            product: 'Samsung phone',
                            platform: 'amazon',
                            filters: { price_max: 50000 },
                        }),
                    }],
                },
            }],
        };

        generateContent.mockResolvedValue(mockResponse);

        // Import after mock
        const { parseIntent } = await import('../../src/background/service_worker.js');
        
        const result = await parseIntent('test-key', 'buy samsung phone under 50000');
        
        expect(generateContent).toHaveBeenCalled();
        expect(result.product).toBe('Samsung phone');
        expect(result.filters.price_max).toBe(50000);
    });

    it('should handle invalid JSON response', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{ text: 'Invalid JSON' }],
                },
            }],
        };

        generateContent.mockResolvedValue(mockResponse);

        const { parseIntent } = await import('../../src/background/service_worker.js');
        
        // Should fallback to simple parser on invalid JSON
        const result = await parseIntent('test-key', 'buy samsung phone');
        
        expect(generateContent).toHaveBeenCalled();
        expect(result.product).toBeTruthy();
    });
});

