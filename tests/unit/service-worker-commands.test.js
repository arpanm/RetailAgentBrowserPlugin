import {
    __test_handleWebCommand as handleWebCommand,
    __test_registerPort,
    __test_clearPorts,
} from "../../src/background/service_worker.js";

describe("Service worker commands (happy paths)", () => {
    const sessionId = "sess-test";
    let messages;
    const mockPort = {
        postMessage: (msg) => messages.push(msg),
    };

    beforeEach(() => {
        messages = [];
        __test_clearPorts();
        __test_registerPort(sessionId, mockPort);

        global.chrome = {
            tabs: {
                create: jest.fn().mockResolvedValue({ id: 101 }),
                sendMessage: jest.fn().mockResolvedValue({ success: true }),
            },
            runtime: {
                onMessageExternal: { addListener: jest.fn(), removeListener: jest.fn() },
                onConnectExternal: { addListener: jest.fn(), removeListener: jest.fn() },
            },
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({ preferences: { grantedCapabilities: [] } }),
                    set: jest.fn().mockResolvedValue(),
                },
            },
        };
    });

    test("parseIntent emits completed with structured intent (T-SW-01 happy)", async () => {
        await handleWebCommand({ command: "parseIntent", payload: { query: "best phone" } }, sessionId);
        const completed = messages.find((m) => m.type === "completed" && m.result);
        expect(completed.result.intentType).toBeDefined();
    });

    test("searchPlatforms opens tabs and emits tabOpened + completed (T-SW-03 happy)", async () => {
        await handleWebCommand(
            {
                command: "searchPlatforms",
                payload: { intent: { query: "laptop", platforms: ["amazon"] } },
            },
            sessionId
        );
        expect(global.chrome.tabs.create).toHaveBeenCalled();
        expect(messages.some((m) => m.type === "tabOpened")).toBe(true);
        expect(messages.some((m) => m.type === "completed")).toBe(true);
    });

    test("compare emits comparisonReady with winner (T-SW-05 happy)", async () => {
        await handleWebCommand(
            {
                command: "compare",
                payload: {
                    products: [
                        { id: "p1", title: "A", price: 20, url: "x", platform: "amazon" },
                        { id: "p2", title: "B", price: 10, url: "x", platform: "amazon" },
                    ],
                },
            },
            sessionId
        );
        const ready = messages.find((m) => m.type === "comparisonReady");
        expect(ready.result.winnerId).toBe("p2");
    });

    test("openProduct requires userGesture and emits productOpened (T-SW-06 happy)", async () => {
        await handleWebCommand(
            {
                command: "openProduct",
                payload: { userGesture: true, product: { id: "p1", url: "https://example.com", title: "X" } },
            },
            sessionId
        );
        expect(global.chrome.tabs.create).toHaveBeenCalled();
        expect(messages.some((m) => m.type === "productOpened")).toBe(true);
    });

    test("buyNow stops at checkout boundary and emits needsUserAction (T-SW-07 happy)", async () => {
        await handleWebCommand(
            {
                command: "buyNow",
                payload: { userGesture: true, product: { id: "p1", url: "https://example.com", title: "X" } },
            },
            sessionId
        );
        expect(messages.some((m) => m.type === "needsUserAction")).toBe(true);
    });

    test("trackOrder completes with status unknown (best-effort)", async () => {
        await handleWebCommand(
            {
                command: "trackOrder",
                payload: { userGesture: true, orderId: "o1" },
            },
            sessionId
        );
        expect(messages.some((m) => m.type === "completed")).toBe(true);
    });

    test("cancelOrder emits needsUserAction", async () => {
        await handleWebCommand(
            {
                command: "cancelOrder",
                payload: { userGesture: true, orderId: "o1" },
            },
            sessionId
        );
        expect(messages.some((m) => m.type === "needsUserAction")).toBe(true);
    });

    test("setPreferences stores and getPreferences returns redacted keys", async () => {
        const storage = {};
        global.chrome.storage = {
            local: {
                set: jest.fn(async (obj) => Object.assign(storage, obj)),
                get: jest.fn(async (keys) => {
                    const res = {};
                    keys.forEach((k) => (res[k] = storage[k]));
                    return res;
                }),
            },
        };

        await handleWebCommand(
            {
                command: "setPreferences",
                payload: {
                    geminiApiKey: "secret-g",
                    openaiApiKey: "secret-o",
                    anthropicApiKey: "secret-a",
                    preferences: { theme: "dark" },
                },
            },
            sessionId
        );
        await handleWebCommand({ command: "getPreferences", payload: {} }, sessionId);
        const completed = messages.find((m) => m.type === "completed" && m.data);
        expect(completed.data.geminiApiKey).toBe("[redacted]");
        expect(completed.data.preferences.theme).toBe("dark");
    });
});

