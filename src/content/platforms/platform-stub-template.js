import { EcommercePlatform } from "../../lib/ecommerce-platforms.js";

export class StubPlatform extends EcommercePlatform {
    constructor(name, domains) {
        super(name, { enabled: true, domains });
    }

    async extractProductsFromPage() {
        // Minimal stub: cannot extract without selectors; signal needs user action.
        return {
            products: [],
            needsUserAction: true,
            reason: "stub_platform_no_extract",
        };
    }

    async openProductPage(product) {
        if (product?.url) {
            window.open(product.url, "_blank");
        }
    }
}


