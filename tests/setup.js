import { vi } from 'vitest';

// Mock Chrome APIs globally for tests
global.chrome = {
    runtime: {
        sendMessage: vi.fn().mockReturnValue(Promise.resolve()),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        lastError: null,
    },
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(),
            clear: vi.fn().mockResolvedValue(),
        },
    },
    action: {
        onClicked: {
            addListener: vi.fn(),
        },
    },
    sidePanel: {
        open: vi.fn(),
    },
    tabs: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        get: vi.fn().mockResolvedValue({ url: 'https://amazon.in' }),
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockReturnValue(Promise.resolve({ success: true })),
        update: vi.fn().mockResolvedValue({ id: 1 }),
    },
    scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: true }]),
    },
};

// Mock window/global objects if needed
global.globalThis = global;

