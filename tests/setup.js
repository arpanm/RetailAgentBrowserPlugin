import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';
import { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Mock Chrome APIs globally for tests
global.chrome = {
    runtime: {
        sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onMessageExternal: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onConnectExternal: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        lastError: null,
    },
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(),
            clear: jest.fn().mockResolvedValue(),
        },
    },
    action: {
        onClicked: {
            addListener: jest.fn(),
        },
    },
    sidePanel: {
        open: jest.fn(),
    },
    tabs: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        get: jest.fn().mockResolvedValue({ url: 'https://amazon.in' }),
        query: jest.fn().mockResolvedValue([]),
        sendMessage: jest.fn().mockReturnValue(Promise.resolve({ success: true })),
        update: jest.fn().mockResolvedValue({ id: 1 }),
    },
    scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: true }]),
    },
};

// Mock window/global objects if needed
global.globalThis = global;
global.jest = global.jest || jest;
global.describe = global.describe || describe;
global.it = global.it || it;
global.test = global.test || test;
global.expect = global.expect || expect;
global.beforeEach = global.beforeEach || beforeEach;
global.afterEach = global.afterEach || afterEach;
global.beforeAll = global.beforeAll || beforeAll;
global.afterAll = global.afterAll || afterAll;

