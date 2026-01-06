/**
 * Unit tests for Address Manager
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { addressManager, Address } from '../../src/lib/address-manager.js';

// Mock chrome.storage
global.chrome = {
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(undefined),
        },
    },
};

describe('Address', () => {
    it('should create address with required fields', () => {
        const address = new Address({
            name: 'John Doe',
            phone: '1234567890',
            addressLine1: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345',
        });

        expect(address.name).toBe('John Doe');
        expect(address.getFormattedAddress()).toContain('123 Main St');
    });

    it('should validate address', () => {
        const address = new Address({
            name: 'John Doe',
            phone: '1234567890',
            addressLine1: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345',
        });

        const validation = address.validate();
        expect(validation.valid).toBe(true);
    });

    it('should fail validation with missing fields', () => {
        const address = new Address({});
        const validation = address.validate();
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
    });
});

describe('AddressManager', () => {
    beforeEach(() => {
        addressManager.addresses = [];
        addressManager.defaultAddress = null;
    });

    it('should add address', async () => {
        const addressData = {
            name: 'John Doe',
            phone: '1234567890',
            addressLine1: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345',
        };

        const address = await addressManager.addAddress(addressData);
        expect(address.id).toBeDefined();
        expect(addressManager.addresses.length).toBe(1);
    });

    it('should set first address as default', async () => {
        const addressData = {
            name: 'John Doe',
            phone: '1234567890',
            addressLine1: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345',
        };

        await addressManager.addAddress(addressData);
        expect(addressManager.defaultAddress).toBeDefined();
        expect(addressManager.defaultAddress.isDefault).toBe(true);
    });

    it('should get default address', () => {
        const address = new Address({
            name: 'John Doe',
            phone: '1234567890',
            addressLine1: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345',
            isDefault: true,
        });

        addressManager.addresses = [address];
        addressManager.defaultAddress = address;

        expect(addressManager.getDefaultAddress()).toBe(address);
    });
});

