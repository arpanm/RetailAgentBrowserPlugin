/**
 * Multi-provider LLM interface for Gemini, OpenAI, Anthropic/Claude.
 * Simplified to support model listing, selection, and per-day caching of a working model.
 */

import { redactSensitive } from '../background/bridge-security.js';

const MODEL_CACHE_PREFIX = 'model_cache';

const providers = {
    gemini: {
        name: 'gemini',
        listModels: async (apiKey) => {
            const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!resp.ok) throw new Error('gemini_list_failed');
            const data = await resp.json();
            return (data.models || []).map((m) => m.name);
        },
    },
    openai: {
        name: 'openai',
        listModels: async (apiKey) => {
            const resp = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!resp.ok) throw new Error('openai_list_failed');
            const data = await resp.json();
            return (data.data || []).map((m) => m.id);
        },
    },
    anthropic: {
        name: 'anthropic',
        listModels: async (apiKey) => {
            const resp = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
            if (!resp.ok) throw new Error('anthropic_list_failed');
            const data = await resp.json();
            return (data.data || []).map((m) => m.id);
        },
    },
};

function todayKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

function keyPrefix(key = '') {
    return key ? key.slice(0, 6) : 'nokey';
}

function cacheKey(provider, key) {
    return `${MODEL_CACHE_PREFIX}:${provider}:${keyPrefix(key)}:${todayKey()}`;
}

export async function cacheWorkingModel(provider, apiKey, model) {
    const key = cacheKey(provider, apiKey);
    await chrome.storage.local.set({ [key]: model });
}

export async function getCachedModel(provider, apiKey) {
    const key = cacheKey(provider, apiKey);
    const res = await chrome.storage.local.get([key]);
    return res[key];
}

export async function listModels(provider, apiKey) {
    const impl = providers[provider];
    if (!impl) throw new Error('unknown_provider');
    return impl.listModels(apiKey);
}

export async function chooseModel(provider, apiKey, preferredModel) {
    const cached = await getCachedModel(provider, apiKey);
    if (cached) return cached;
    const models = await listModels(provider, apiKey);
    if (!models || models.length === 0) throw new Error('no_models');
    const chosen = preferredModel && models.includes(preferredModel) ? preferredModel : models[0];
    await cacheWorkingModel(provider, apiKey, chosen);
    return chosen;
}

export function redactProviderPayload(payload) {
    return redactSensitive(payload);
}

