/**
 * JioMart Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/jiomart-platform.js'));
        console.log('RetailAgent: JioMart content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load JioMart content script', error);
    }
})();

