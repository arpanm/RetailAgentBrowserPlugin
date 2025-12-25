/**
 * Integration tests for Amazon Content Script
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractProducts, discoverAvailableFilters } from '../../src/content/shared/actions.js';

describe('Amazon Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('should extract results using shared actions', () => {
        // Set up Amazon-like HTML
        document.body.innerHTML = `
            <div data-component-type="s-search-result" class="s-result-item">
                <h2><a class="a-link-normal" href="/dp/B012345678"><span>Apple iPhone 15</span></a></h2>
                <span class="a-price"><span class="a-offscreen">₹79,900</span></span>
                <div class="a-section s-image-container"><img class="s-image" src="test.jpg"></div>
            </div>
            <div data-component-type="s-search-result" class="s-result-item">
                <h2><a class="a-link-normal" href="/dp/B087654321"><span>Samsung Galaxy S23</span></a></h2>
                <span class="a-price"><span class="a-offscreen">₹74,900</span></span>
                <div class="a-section s-image-container"><img class="s-image" src="test2.jpg"></div>
            </div>
        `;

        const results = extractProducts(
            '[data-component-type="s-search-result"], .s-result-item',
            {
                title: 'h2 a span, h2 a',
                price: '.a-price .a-offscreen, .a-price',
                link: 'h2 a',
                image: '.s-image',
            }
        );

        expect(results.length).toBe(2);
        expect(results[0].title).toBe('Apple iPhone 15');
        expect(results[0].price).toBe('₹79,900');
    });

    it('should discover filters semantically', async () => {
        document.body.innerHTML = `
            <div id="s-refinements">
                <div id="p_89" class="a-section">
                    <span class="a-text-bold">Brands</span>
                    <ul>
                        <li><a href="#">Apple</a></li>
                        <li><a href="#">Samsung</a></li>
                    </ul>
                </div>
                <div id="p_36" class="a-section">
                    <span class="a-text-bold">Price</span>
                    <input type="number" name="low-price">
                    <input type="number" name="high-price">
                    <input type="submit" value="Go">
                </div>
            </div>
        `;

        const filters = await discoverAvailableFilters();
        
        expect(filters.brands).toBeDefined();
        expect(filters.brands.elements.length).toBeGreaterThan(0);
        expect(filters.brands.elements.some(e => e.text.includes('apple'))).toBe(true);
        expect(filters.price).toBeDefined();
        expect(filters.price.type).toBe('range');
    });
});
