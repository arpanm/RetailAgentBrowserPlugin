/**
 * eBay Content Script Loader
 * This wrapper loads the actual ES6 module content script
 * Dynamic import() is allowed in content scripts (not service workers)
 */

(async () => {
    try {
        // Dynamic import the actual module
        await import(chrome.runtime.getURL('src/content/ebay.js'));
        console.log('RetailAgent: eBay content script loaded successfully');
    } catch (error) {
        console.error('RetailAgent: Failed to load eBay content script', error);
    }
})();

