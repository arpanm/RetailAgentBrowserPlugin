/**
 * Amazon Content Script Loader
 * This wrapper loads the actual ES6 module content script
 * Dynamic import() is allowed in content scripts (not service workers)
 */

(async () => {
    try {
        // Dynamic import the actual module
        await import(chrome.runtime.getURL('src/content/amazon.js'));
        console.log('RetailAgent: Amazon content script loaded successfully');
    } catch (error) {
        console.error('RetailAgent: Failed to load Amazon content script', error);
    }
})();


