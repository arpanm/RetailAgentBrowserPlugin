/**
 * Zepto Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/zepto-platform.js'));
        console.log('RetailAgent: Zepto content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load Zepto content script', error);
    }
})();


