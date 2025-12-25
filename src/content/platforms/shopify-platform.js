/**
 * Shopify Platform Implementation (Generic)
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, sortResults } from '../shared/actions.js';
import { getText } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';

export class ShopifyPlatform extends EcommercePlatform {
    constructor() {
        super('shopify', {
            enabled: true,
            domains: ['myshopify.com', 'shopify.com'],
            selectors: {
                search: {
                    input: 'input[name="q"], input[type="search"]',
                    button: 'button[type="submit"], .search-form__submit',
                },
                results: {
                    container: '.grid-view-item, .product-card, .product-item, .grid__item',
                    title: '.grid-view-item__title, .product-card__title, .product-item__title, h3',
                    link: 'a[href*="/products/"]',
                    price: '.price-item, .product-card__price, .product-item__price',
                    image: 'img[src*="/products/"]',
                },
                product: {
                    buyNow: '[data-testid="Checkout-button"], button[name="checkout"], .shopify-payment-button__button',
                    addToCart: 'button[name="add"], #AddToCart',
                    title: '.product-single__title, .product__title, h1',
                    price: '.product__price, .price-item--regular',
                },
            },
        });
    }

    async search(query, filters = {}, sort = null) {
        try {
            logger.info('Shopify: Performing search', { query, filters, sort });
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });
            return true;
        } catch (error) {
            logger.error('Shopify: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            const products = extractProducts(
                this.selectors.results.container,
                {
                    title: this.selectors.results.title,
                    price: this.selectors.results.price,
                    link: this.selectors.results.link,
                    image: this.selectors.results.image,
                }
            );
            return products;
        } catch (error) {
            logger.error('Shopify: Failed to get search results', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            await clickBuyNow({
                button: this.selectors.product.buyNow,
            });
            return true;
        } catch (error) {
            logger.error('Shopify: Failed to click Buy Now', error);
            throw error;
        }
    }
}

