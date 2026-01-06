# TDD Standards for RetailAgent

## Principles
- Tests first: write/extend tests before implementing behavior.
- Definition of Done: required tests green, no new lints, no secrets/PII in logs/events.
- Deterministic first: prefer fixture/mocked tests over live site runs.

## Required commands (must be green before completion)
- `npm test` (Jest unit/integration; includes service worker/bridge suites)
- `npm run test:bridge` (bridge-specific suite; can alias to `npm test`)
- `npm run test:e2e` (optional; Playwright loading the extension, fixture-based)

## Data handling
- Never log API keys, provider tokens, addresses, payment data.
- LLM calls should be stubbed in tests; intent parsing validated via fixtures.
- Redact sensitive fields before emitting events to web clients.

## Scope notes
- Multi-LLM support (Gemini, OpenAI, Anthropic/Claude) with per-day model cache.
- Extension bridge must enforce origin allowlist, handshake, capability gating.
- Platform automation should be covered by fixture-based tests per platform.


