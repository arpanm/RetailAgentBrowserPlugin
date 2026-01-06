import { describe, it, expect } from '@jest/globals';
import { matchesFilters, rankResults, verifyAttributes, isUnavailable } from '../../src/lib/product-matcher.js';

describe('Product Matcher', () => {
    const sampleProducts = [
        { title: 'Apple MacBook Pro M3 16GB RAM 512GB SSD', price: '₹1,69,900', rating: '4.8', link: 'http://link1' },
        { title: 'Apple MacBook Air M2 8GB RAM 256GB SSD', price: '₹99,900', rating: '4.5', link: 'http://link2' },
        { title: 'Samsung Galaxy Book3 16GB RAM 512GB SSD', price: '₹84,900', rating: '4.2', link: 'http://link3' },
        { title: 'Apple MacBook Pro M3 Max 32GB RAM 1TB SSD', price: '₹3,49,900', rating: '4.9', link: 'http://link4' }
    ];

    describe('matchesFilters', () => {
        it('should match brand correctly', () => {
            const filters = { brand: 'apple' };
            expect(matchesFilters(sampleProducts[0], filters)).toBe(true);
            expect(matchesFilters(sampleProducts[2], filters)).toBe(false);
        });

        it('should match RAM correctly with normalization', () => {
            const filters = { ram: '16gb' };
            expect(matchesFilters(sampleProducts[0], filters)).toBe(true);
            expect(matchesFilters(sampleProducts[1], filters)).toBe(false);
        });

        it('should match storage correctly', () => {
            const filters = { storage: '512gb' };
            expect(matchesFilters(sampleProducts[0], filters)).toBe(true);
            expect(matchesFilters(sampleProducts[1], filters)).toBe(false);
        });
    });

    describe('rankResults', () => {
        it('should rank by cheapest when requested', () => {
            const intent = { sortStrategy: 'cheapest' };
            const ranked = rankResults(sampleProducts, intent);
            expect(ranked[0].title).toContain('Samsung'); // Lowest price
        });

        it('should rank by best rated when requested', () => {
            const intent = { sortStrategy: 'best_rated' };
            const ranked = rankResults(sampleProducts, intent);
            expect(ranked[0].rating).toBe('4.9'); // Highest rating
        });
    });

    describe('verifyAttributes', () => {
        it('should verify specific attributes in title', () => {
            const attributes = { chip: 'M3', ram: '16GB' };
            const result = verifyAttributes(sampleProducts[0], attributes);
            expect(result.matches).toBe(true);
        });

        it('should fail when attribute is missing', () => {
            const attributes = { chip: 'M2' };
            const result = verifyAttributes(sampleProducts[0], attributes);
            expect(result.matches).toBe(false);
        });
    });

    describe('isUnavailable', () => {
        it('should detect out of stock products', () => {
            expect(isUnavailable({ title: 'Sony PS5 (Out of Stock)' })).toBe(true);
            expect(isUnavailable({ title: 'Sony PS5' })).toBe(false);
        });
    });
});

