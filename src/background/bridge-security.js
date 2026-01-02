/**
 * Bridge security helpers for web↔extension communication.
 * These are pure helpers; service_worker integration will follow.
 */

const SENSITIVE_KEYS_REGEX = /(apiKey|token|address|payment|card|cvv|phone|email|contact)/i;
export const SUPPORTED_PROTOCOL_VERSION = 1;

export function isOriginAllowed(origin, allowlist = []) {
    try {
        const url = new URL(origin);
        return allowlist.some((allowed) => {
            // simple prefix match on host+protocol
            if (!allowed) return false;
            return origin.startsWith(allowed.replace(/\/+\*?$/, ''));
        }) && !!url.protocol && !!url.hostname;
    } catch (_e) {
        return false;
    }
}

export function validateProtocolVersion(protocolVersion, supported = SUPPORTED_PROTOCOL_VERSION) {
    if (protocolVersion !== supported) {
        throw new Error('protocolVersion_mismatch');
    }
    return true;
}

export class NonceCache {
    constructor() {
        this.seen = new Set();
    }
    use(nonce) {
        if (!nonce) return false;
        if (this.seen.has(nonce)) return false;
        this.seen.add(nonce);
        return true;
    }
}

export function capabilityAllowed(command, grantedCapabilities = []) {
    return grantedCapabilities.includes(command);
}

export function redactSensitive(payload) {
    if (payload == null || typeof payload !== 'object') return payload;
    if (Array.isArray(payload)) return payload.map(redactSensitive);
    const clone = {};
    for (const [k, v] of Object.entries(payload)) {
        if (SENSITIVE_KEYS_REGEX.test(k)) {
            clone[k] = '[redacted]';
        } else if (typeof v === 'object' && v !== null) {
            clone[k] = redactSensitive(v);
        } else {
            clone[k] = v;
        }
    }
    return clone;
}

export function validateHandshake({ origin, protocolVersion, nonce }, allowlist, nonceCache) {
    if (!isOriginAllowed(origin, allowlist)) {
        throw new Error("origin_not_allowed");
    }
    validateProtocolVersion(protocolVersion, SUPPORTED_PROTOCOL_VERSION);
    if (!nonceCache.use(nonce)) {
        throw new Error("nonce_replay");
    }
    return true;
}

