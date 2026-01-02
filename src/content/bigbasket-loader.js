/**
 * BigBasket Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/bigbasket-platform.js'));
        console.log('RetailAgent: BigBasket content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load BigBasket content script', error);
    }
})();

