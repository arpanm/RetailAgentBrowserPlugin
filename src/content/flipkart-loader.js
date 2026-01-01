/**
 * Flipkart Content Script Loader
 * This wrapper loads the actual ES6 module content script
 * Dynamic import() is allowed in content scripts (not service workers)
 */

(async () => {
    try {
        // Dynamic import the actual module
        await import(chrome.runtime.getURL('src/content/flipkart.js'));
        console.log('RetailAgent: Flipkart content script loaded successfully');
    } catch (error) {
        console.error('RetailAgent: Failed to load Flipkart content script', error);
    }
})();

