/**
 * TiraBeauty Content Script Loader
 */
(async () => {
    try {
        await import(chrome.runtime.getURL('src/content/platforms/tirabeauty-platform.js'));
        console.log('RetailAgent: TiraBeauty content script loaded');
    } catch (error) {
        console.error('RetailAgent: Failed to load TiraBeauty content script', error);
    }
})();

