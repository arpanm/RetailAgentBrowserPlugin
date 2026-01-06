import {
    chooseModel,
    cacheWorkingModel,
    getCachedModel,
    listModels,
} from "../../src/lib/llm-providers.js";

describe("LLM providers", () => {
    beforeEach(() => {
        global.chrome = {
            storage: {
                local: {
                    set: jest.fn(async (obj) => Object.assign(global.__storage, obj)),
                    get: jest.fn(async (keys) => {
                        const res = {};
                        keys.forEach((k) => (res[k] = global.__storage[k]));
                        return res;
                    }),
                },
            },
        };
        global.__storage = {};
        global.fetch = jest.fn();
    });

    test("provider selection lists models (Gemini)", async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ models: [{ name: "gemini-pro" }, { name: "gemini-1.5" }] }),
        });
        const models = await listModels("gemini", "k");
        expect(models).toEqual(["gemini-pro", "gemini-1.5"]);
    });

    test("chooseModel uses preferred when available, caches daily", async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ id: "gpt-4" }, { id: "gpt-3.5" }] }),
        });
        const chosen = await chooseModel("openai", "key-123456", "gpt-4");
        expect(chosen).toBe("gpt-4");
        const cached = await getCachedModel("openai", "key-123456");
        expect(cached).toBe("gpt-4");
    });

    test("chooseModel falls back to first model when preferred missing", async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ id: "claude-3" }] }),
        });
        const chosen = await chooseModel("anthropic", "key-999999", "missing");
        expect(chosen).toBe("claude-3");
    });
});


