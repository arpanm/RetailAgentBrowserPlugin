/**
 * RelianceDigital Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/reliancedigital-platform.js'));
        console.log('RetailAgent: RelianceDigital content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load RelianceDigital content script', error);
    }
})();

