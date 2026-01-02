/**
 * Ajio Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/ajio-platform.js'));
        console.log('RetailAgent: Ajio content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load Ajio content script', error);
    }
})();

