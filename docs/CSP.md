## Content Security Policy (CSP) – RetailAgent

### Extension (MV3)
- **Service worker**: relies on default MV3 CSP; avoid `eval`/inline scripts.
- **Content scripts**: no remote scripts; only DOM scraping and automation logic. Disable `unsafe-inline` in any injected UI.
- **Assets**: package icons/images; avoid remote fonts unless explicitly allowlisted.
- **Network**: only to e-commerce sites (per platform), LLM APIs (Gemini/OpenAI/Anthropic), and allowed webapp origins via `externally_connectable`.
- **Web↔extension bridge**: origin-checked; no `postMessage` from untrusted frames; keep allowlist aligned with `manifest.json`.

### Website (ai-retail-concierge)
- **Scripts**: disallow `unsafe-inline`/`unsafe-eval`; allow Vite bundles and trusted CDNs if any (prefer self-hosted).
- **Connections**: allow `https://api.openai.com`, `https://api.anthropic.com`, Google AI endpoints, Supabase URL, and extension id via `chrome-extension://<ID>` for messaging.
- **Frames**: disallow iframes except extension/runtime needs (avoid embedding untrusted).
- **Images/media**: allow product CDN domains; keep list minimal.
- **Style**: avoid inline styles; allow `self` and trusted font/icon CDNs if required; prefer self-hosted.

### Operational notes
- Keep extension `manifest.json` allowlist in sync with web origins.
- Audit new third-party scripts before adding to CSP.
- Ensure Supabase Edge Functions send proper CORS/CSP headers for webapp origins.

