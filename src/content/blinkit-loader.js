/**
 * Blinkit Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/blinkit-platform.js'));
        console.log('RetailAgent: Blinkit content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load Blinkit content script', error);
    }
})();


