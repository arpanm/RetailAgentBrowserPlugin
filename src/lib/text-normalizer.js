/**
 * Text Normalization Utility
 * Normalizes text for consistent filter matching across platforms
 */

import { logger } from './logger.js';

/**
 * Normalize filter text for matching
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
export function normalizeFilterText(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase().trim();
    
    // Remove special characters but keep spaces and numbers
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Remove common filler words
    const fillerWords = ['and', 'or', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'above', 'below', 'up'];
    const words = normalized.split(' ');
    normalized = words.filter(word => !fillerWords.includes(word)).join(' ');
    
    return normalized.trim();
}

/**
 * Normalize RAM size text
 * Handles variations like "6GB", "6 GB", "6gb", "6 GiB"
 * @param {string} text - RAM size text
 * @returns {string} - Normalized RAM size (e.g., "6gb")
 */
export function normalizeRAMSize(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase().trim();
    
    // Remove spaces between number and unit
    normalized = normalized.replace(/(\d+)\s*(gb|gib|g)/i, '$1gb');
    
    // Handle "and above" variations
    normalized = normalized.replace(/\s*(and\s*)?(above|up|more|plus|\+)/gi, '+');
    
    return normalized;
}

/**
 * Normalize battery capacity text
 * Handles variations like "5000mAh", "5000 mAh", "5000MAH"
 * @param {string} text - Battery capacity text
 * @returns {string} - Normalized battery (e.g., "5000mah")
 */
export function normalizeBatteryCapacity(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase().trim();
    
    // Remove spaces between number and unit
    normalized = normalized.replace(/(\d+)\s*(mah|mAh|MAH)/i, '$1mah');
    
    // Handle "and above" variations
    normalized = normalized.replace(/\s*(and\s*)?(above|up|more|plus|\+)/gi, '+');
    
    return normalized;
}

/**
 * Normalize storage size text
 * Handles variations like "128GB", "128 GB", "128gb"
 * @param {string} text - Storage size text
 * @returns {string} - Normalized storage (e.g., "128gb")
 */
export function normalizeStorageSize(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase().trim();
    
    // Remove spaces between number and unit
    normalized = normalized.replace(/(\d+)\s*(gb|tb|gib|tib|g|t)/i, (match, num, unit) => {
        if (unit.startsWith('t')) {
            return `${num}tb`;
        }
        return `${num}gb`;
    });
    
    // Handle "and above" variations
    normalized = normalized.replace(/\s*(and\s*)?(above|up|more|plus|\+)/gi, '+');
    
    return normalized;
}

/**
 * Normalize brand name
 * @param {string} text - Brand name
 * @returns {string} - Normalized brand name
 */
export function normalizeBrandName(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase().trim();
    
    // Remove special characters
    normalized = normalized.replace(/[^\w\s]/g, '');
    
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    
    return normalized;
}

/**
 * Normalize price text
 * Handles variations like "₹15,499", "Rs. 15499", "$15.99"
 * @param {string} text - Price text
 * @returns {number|null} - Normalized price as number
 */
export function normalizePrice(text) {
    if (!text) return null;
    
    try {
        // Remove currency symbols and commas
        let normalized = text.replace(/[₹$Rs.,\s]/gi, '');
        
        // Extract first number
        const match = normalized.match(/\d+/);
        if (match) {
            return parseInt(match[0], 10);
        }
        
        return null;
    } catch (error) {
        logger.warn('Failed to normalize price', { text, error: error.message });
        return null;
    }
}

/**
 * Extract numeric value from text
 * @param {string} text - Text containing number
 * @returns {number|null} - Extracted number
 */
export function extractNumber(text) {
    if (!text) return null;
    
    try {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    } catch (error) {
        return null;
    }
}

/**
 * Check if two texts match after normalization
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @param {Object} options - Matching options
 * @returns {boolean} - True if texts match
 */
export function textsMatch(text1, text2, options = {}) {
    const {
        exact = false,
        caseSensitive = false,
        ignoreSpecialChars = true
    } = options;
    
    if (!text1 || !text2) return false;
    
    let t1 = text1.trim();
    let t2 = text2.trim();
    
    if (!caseSensitive) {
        t1 = t1.toLowerCase();
        t2 = t2.toLowerCase();
    }
    
    if (ignoreSpecialChars) {
        t1 = t1.replace(/[^\w\s]/g, '');
        t2 = t2.replace(/[^\w\s]/g, '');
    }
    
    if (exact) {
        return t1 === t2;
    } else {
        return t1.includes(t2) || t2.includes(t1);
    }
}

/**
 * Fuzzy match text with multiple variations
 * @param {string} text - Text to match
 * @param {Array<string>} variations - Array of text variations
 * @param {number} threshold - Match threshold (0-1), default 0.6
 * @returns {boolean} - True if any variation matches
 */
export function fuzzyMatch(text, variations, threshold = 0.6) {
    if (!text || !variations || variations.length === 0) return false;
    
    const normalized = normalizeFilterText(text);
    
    for (const variation of variations) {
        const normalizedVariation = normalizeFilterText(variation);
        
        // Exact match after normalization
        if (normalized === normalizedVariation) {
            return true;
        }
        
        // Substring match
        if (normalized.includes(normalizedVariation) || normalizedVariation.includes(normalized)) {
            return true;
        }
        
        // Calculate similarity score
        const similarity = calculateSimilarity(normalized, normalizedVariation);
        if (similarity >= threshold) {
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate text similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
        return 1.0;
    }
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Generate text variations for matching
 * @param {string} text - Original text
 * @returns {Array<string>} - Array of text variations
 */
export function generateTextVariations(text) {
    if (!text) return [];
    
    const variations = [text];
    const lower = text.toLowerCase();
    const upper = text.toUpperCase();
    
    variations.push(lower, upper);
    
    // Add variations with/without spaces
    variations.push(text.replace(/\s+/g, ''));
    variations.push(text.replace(/(\d+)([a-zA-Z])/g, '$1 $2'));
    
    // Add variations with/without special characters
    variations.push(text.replace(/[^\w\s]/g, ''));
    variations.push(text.replace(/[^\w]/g, ''));
    
    // Remove duplicates
    return [...new Set(variations)];
}

