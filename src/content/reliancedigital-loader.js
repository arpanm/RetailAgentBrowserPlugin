/**
 * RelianceDigital Content Script Loader
 * This wrapper loads the actual ES6 module content script
 * Dynamic import() is allowed in content scripts (not service workers)
 */

(async () => {
    try {
        // Dynamic import the actual module
        await import(chrome.runtime.getURL('src/content/reliancedigital.js'));
        console.log('RetailAgent: RelianceDigital content script loaded successfully');
    } catch (error) {
        console.error('RetailAgent: Failed to load RelianceDigital content script', error);
    }
})();
