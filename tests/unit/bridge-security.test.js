import {
    isOriginAllowed,
    validateProtocolVersion,
    NonceCache,
    capabilityAllowed,
    redactSensitive,
    SUPPORTED_PROTOCOL_VERSION,
    validateHandshake,
} from "../../src/background/bridge-security.js";

describe("Bridge security helpers", () => {
    const allowlist = [
        "https://ai-retail-concierge.vercel.app",
        "http://localhost:5173",
    ];

    test("T-EB-01/02: origin allowlist allows known and denies others", () => {
        expect(isOriginAllowed("https://ai-retail-concierge.vercel.app", allowlist)).toBe(true);
        expect(isOriginAllowed("http://localhost:5173", allowlist)).toBe(true);
        expect(isOriginAllowed("https://evil.example.com", allowlist)).toBe(false);
    });

    test("T-EB-03: protocolVersion mismatch throws", () => {
        expect(() => validateProtocolVersion(999, SUPPORTED_PROTOCOL_VERSION)).toThrow(
            /protocolVersion_mismatch/
        );
        expect(() => validateProtocolVersion(SUPPORTED_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSION)).not.toThrow();
    });

    test("T-EB-04: nonce replay rejected", () => {
        const cache = new NonceCache();
        expect(cache.use("abc")).toBe(true);
        expect(cache.use("abc")).toBe(false);
        expect(cache.use("def")).toBe(true);
    });

    test("T-EB-05: capability enforcement", () => {
        const granted = ["parseIntent", "searchPlatforms"];
        expect(capabilityAllowed("parseIntent", granted)).toBe(true);
        expect(capabilityAllowed("buyNow", granted)).toBe(false);
    });

    test("T-EB-07: redaction strips sensitive fields", () => {
        const redacted = redactSensitive({
            apiKey: "secret",
            nested: { paymentToken: "tok_123", ok: 1 },
            ok: "keep",
        });
        expect(redacted.apiKey).toBe("[redacted]");
        expect(redacted.nested.paymentToken).toBe("[redacted]");
        expect(redacted.nested.ok).toBe(1);
        expect(redacted.ok).toBe("keep");
    });

    test("validateHandshake enforces origin, protocol, and nonce", () => {
        const cache = new NonceCache();
        expect(() =>
            validateHandshake(
                { origin: "https://ai-retail-concierge.vercel.app", protocolVersion: SUPPORTED_PROTOCOL_VERSION, nonce: "n1" },
                allowlist,
                cache
            )
        ).not.toThrow();
        expect(() =>
            validateHandshake(
                { origin: "https://evil.example.com", protocolVersion: SUPPORTED_PROTOCOL_VERSION, nonce: "n2" },
                allowlist,
                cache
            )
        ).toThrow(/origin_not_allowed/);
        expect(() =>
            validateHandshake(
                { origin: "https://ai-retail-concierge.vercel.app", protocolVersion: 999, nonce: "n3" },
                allowlist,
                cache
            )
        ).toThrow(/protocolVersion_mismatch/);
        expect(() =>
            validateHandshake(
                { origin: "https://ai-retail-concierge.vercel.app", protocolVersion: SUPPORTED_PROTOCOL_VERSION, nonce: "n1" },
                allowlist,
                cache
            )
        ).toThrow(/nonce_replay/);
    });
});

