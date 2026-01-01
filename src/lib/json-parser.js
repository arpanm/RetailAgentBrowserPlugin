/**
 * Utility for parsing JSON from LLM responses with multiple fallback strategies
 */

import { logger } from './logger.js';

/**
 * Parse JSON from LLM response text using multiple strategies
 * @param {string} text - Raw text from LLM response
 * @param {string} context - Context for logging (mode or operation name)
 * @returns {Object|null} - Parsed JSON object or null if all strategies fail
 */
export function parseJSONFromLLMResponse(text, context = 'unknown') {
    if (!text || typeof text !== 'string') {
        logger.warn('Invalid text input for JSON parsing', { context });
        return null;
    }

    const strategies = [
        // Strategy 1: Clean markdown blocks and parse
        (txt) => {
            const cleaned = txt
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .trim();
            return JSON.parse(cleaned);
        },
        
        // Strategy 2: Extract first JSON object with greedy matching
        (txt) => {
            const match = txt.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error('No JSON object found');
        },
        
        // Strategy 3: Extract JSON object with balanced braces
        (txt) => {
            const startIdx = txt.indexOf('{');
            if (startIdx === -1) throw new Error('No opening brace found');
            
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let endIdx = -1;
            
            for (let i = startIdx; i < txt.length; i++) {
                const char = txt[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            endIdx = i;
                            break;
                        }
                    }
                }
            }
            
            if (endIdx === -1) throw new Error('No closing brace found');
            
            const jsonStr = txt.substring(startIdx, endIdx + 1);
            return JSON.parse(jsonStr);
        },
        
        // Strategy 4: Extract multiple JSON objects and return the first valid one
        (txt) => {
            const matches = txt.match(/\{[^{}]*\}/g);
            if (!matches) throw new Error('No JSON objects found');
            
            for (const match of matches) {
                try {
                    return JSON.parse(match);
                } catch (e) {
                    // Try next match
                }
            }
            throw new Error('No valid JSON objects found');
        },
        
        // Strategy 5: Try to fix common JSON errors
        (txt) => {
            let cleaned = txt
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .trim();
            
            // Extract JSON object
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No JSON object found');
            
            cleaned = match[0];
            
            // Fix common errors
            cleaned = cleaned
                // Fix trailing commas in objects
                .replace(/,\s*}/g, '}')
                // Fix trailing commas in arrays
                .replace(/,\s*\]/g, ']')
                // Fix single quotes to double quotes (risky but common error)
                .replace(/'/g, '"')
                // Fix unquoted keys (limited regex, may not catch all)
                .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            
            return JSON.parse(cleaned);
        },
        
        // Strategy 6: Parse as array if object parsing fails
        (txt) => {
            const match = txt.match(/\[[\s\S]*\]/);
            if (match) {
                const arr = JSON.parse(match[0]);
                // If it's an array of objects, return the first object
                if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
                    return arr[0];
                }
                // Otherwise, wrap the array in an object
                return { data: arr };
            }
            throw new Error('No array found');
        },
        
        // Strategy 7: Try parsing after removing all text before first { and after last }
        (txt) => {
            const firstBrace = txt.indexOf('{');
            const lastBrace = txt.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
                throw new Error('Invalid JSON structure');
            }
            
            const jsonStr = txt.substring(firstBrace, lastBrace + 1);
            return JSON.parse(jsonStr);
        }
    ];

    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
        try {
            const result = strategies[i](text);
            
            // Validate result is an object
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                logger.debug('JSON parsing succeeded', { 
                    strategy: i + 1, 
                    context,
                    keys: Object.keys(result)
                });
                return result;
            } else if (result && typeof result === 'object') {
                // Result is valid but might be an array or other structure
                logger.debug('JSON parsing returned non-object', { 
                    strategy: i + 1,
                    context,
                    type: Array.isArray(result) ? 'array' : typeof result
                });
                return result;
            }
        } catch (error) {
            logger.debug('JSON parsing strategy failed', { 
                strategy: i + 1,
                context,
                error: error.message,
                sample: text.substring(0, 100)
            });
        }
    }

    // All strategies failed
    logger.error('All JSON parsing strategies failed', { 
        context,
        textSample: text.substring(0, 200)
    });
    
    return null;
}

/**
 * Validate that a parsed JSON object has required fields
 * @param {Object} obj - Parsed JSON object
 * @param {string[]} requiredFields - Array of required field names
 * @returns {boolean} - True if all required fields exist
 */
export function validateJSONStructure(obj, requiredFields = []) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    
    for (const field of requiredFields) {
        if (!(field in obj)) {
            logger.warn('Missing required field in JSON', { field });
            return false;
        }
    }
    
    return true;
}


