---
name: RetailConcierge+Extension
overview: Make ai-retail-concierge a fully functional website by using the existing RetailAgent Chrome extension for in-browser automation (Amazon/Flipkart) via a secure web↔extension bridge, with a hybrid LLM approach (local user key and optional backend).
todos:
  - id: W0-tdd-standards
    content: Adopt TDD standards and quality gates (tests written before implementation; 'done' means green)
    status: pending
  - id: W0-test-infra-web
    content: "ai-retail-concierge: add test stack (Vitest + Testing Library + MSW) and baseline smoke tests"
    status: pending
    dependencies:
      - W0-tdd-standards
  - id: W0-test-infra-ext
    content: "RetailAgent: add/confirm test stack for extension bridge + service worker logic (Jest + bridge harness) and baseline smoke tests"
    status: pending
    dependencies:
      - W0-tdd-standards
  - id: W0-e2e-harness
    content: Create Playwright E2E harness that loads the RetailAgent extension and drives ai-retail-concierge against fixture pages (no real checkout)
    status: pending
    dependencies:
      - W0-test-infra-web
      - W0-test-infra-ext
  - id: W1-req-clarify-success
    content: "Define V1 success criteria (what “fully functional” means: supported platforms, flows, limits, UX boundaries)"
    status: pending
    dependencies:
      - W0-tdd-standards
  - id: W1-req-user-journeys
    content: "Document end-to-end user journeys: compare+manual select, compare+auto pick, purchase assist, post-purchase, offline shop connect"
    status: pending
    dependencies:
      - W1-req-clarify-success
  - id: W1-req-platform-scope
    content: "Lock platform scope: Amazon + Flipkart + (JioMart, Ajio, RelianceDigital, TiraBeauty, BigBasket, Blinkit, Zepto) and define capability tiers per platform (search/compare vs buy vs post-order)"
    status: pending
    dependencies:
      - W1-req-user-journeys
  - id: W1-req-journey-coverage
    content: "Define which ai-retail-concierge journeys must be fulfilled by RetailAgent capabilities: search+compare, manual select, auto-buy assist, checkout boundary, order tracking, cancel, return/refund, support, reorder, offline store connect"
    status: pending
    dependencies:
      - W1-req-user-journeys
  - id: W1-req-compliance
    content: Define compliance constraints (user-gesture gating, no auto-payment, ToS constraints)
    status: pending
    dependencies:
      - W1-req-clarify-success
  - id: W2-contract-types
    content: Create shared contract spec for IntentV1/FilterV1/ProductV1/OrderV1/ComparisonResultV1 + JSON schema
    status: pending
    dependencies:
      - W1-req-user-journeys
      - W0-test-infra-web
  - id: W2-contract-tests
    content: Write contract tests (schema validation + fixtures + forward/backward compatibility)
    status: pending
    dependencies:
      - W2-contract-types
  - id: W2-contract-commands
    content: Define command set (parseIntent, searchPlatforms, compare, openProduct, buyNow, addToCart, trackOrder, return, supportTicket, findLocalShops)
    status: pending
    dependencies:
      - W2-contract-types
  - id: W2-contract-events
    content: Define event stream schema (log/progress/results/needsUserAction/errors) with versioning
    status: pending
    dependencies:
      - W2-contract-types
  - id: W2-contract-mapping
    content: Map RetailAgent internal state machine to contract events (IDLE/PARSING/SEARCHING/SELECTING/COMPARING/PRODUCT_PAGE/CHECKOUT/COMPLETED)
    status: pending
    dependencies:
      - W2-contract-events
  - id: W3-ext-origin-allowlist
    content: Add `externally_connectable` allowlist and environment-based allowed origins to `/Users/arpan1.mukherjee/code/RetailAgent/manifest.json`
    status: pending
    dependencies:
      - W2-contract-commands
      - W0-test-infra-ext
      - W2-contract-tests
  - id: W3-ext-bridge-tests
    content: Write extension bridge tests (origin allowlist, handshake, protocol mismatch, replay/nonce, capability checks, redaction)
    status: pending
    dependencies:
      - W0-test-infra-ext
      - W2-contract-tests
  - id: W3-ext-handshake
    content: Implement secure handshake (origin check + nonce + sessionId + protocolVersion) in `/Users/arpan1.mukherjee/code/RetailAgent/src/background/service_worker.js`
    status: pending
    dependencies:
      - W3-ext-origin-allowlist
      - W3-ext-bridge-tests
  - id: W3-ext-port-protocol
    content: Implement long-lived Port-based connection for streaming events to the web app
    status: pending
    dependencies:
      - W3-ext-handshake
      - W2-contract-events
  - id: W3-ext-job-model
    content: Add job/session model in service worker to avoid collisions between multiple web requests
    status: pending
    dependencies:
      - W3-ext-port-protocol
  - id: W3-ext-permission-gating
    content: "Implement user-gesture gating: web requests must be user-initiated (UI button click) and show confirmation for sensitive actions"
    status: pending
    dependencies:
      - W3-ext-job-model
      - W1-req-compliance
  - id: W3-ext-command-parseIntent
    content: Expose `parseIntent` via web bridge using existing RetailAgent parsing (Gemini + fallback)
    status: pending
    dependencies:
      - W2-contract-commands
      - W3-ext-job-model
  - id: W3-ext-command-search
    content: Expose `searchPlatforms` command to open tabs, inject scripts, and run platform searches
    status: pending
    dependencies:
      - W3-ext-command-parseIntent
  - id: W3-ext-command-compare
    content: Expose `compare` command using RetailAgent comparator and emit `comparisonReady` event
    status: pending
    dependencies:
      - W3-ext-command-search
  - id: W3-ext-command-openProduct
    content: Expose `openProduct` command to navigate to selected product URL/tab
    status: pending
    dependencies:
      - W3-ext-command-compare
  - id: W3-ext-command-buyNow
    content: Expose `buyNow/addToCart` assistive automation with retry limits and checkout detection
    status: pending
    dependencies:
      - W3-ext-command-openProduct
  - id: W3-ext-command-tests
    content: Write service worker command tests (parseIntent/search/compare/openProduct/buyNow) for happy+failure paths
    status: pending
    dependencies:
      - W3-ext-bridge-tests
      - W2-contract-tests
  - id: W3-ext-command-postPurchase-track
    content: Expose `trackOrder` command (where supported) using existing order-tracker logic or DOM extraction
    status: pending
    dependencies:
      - W3-ext-job-model
  - id: W3-ext-command-postPurchase-cancel
    content: Expose `cancelOrder` command (best-effort per platform; emit `needsUserAction` when manual steps are required)
    status: pending
    dependencies:
      - W3-ext-command-postPurchase-track
      - W1-req-journey-coverage
  - id: W3-ext-command-postPurchase-reorder
    content: Expose `reorder` command (use prior order context to find product and restart buy journey)
    status: pending
    dependencies:
      - W3-ext-command-postPurchase-track
      - W1-req-journey-coverage
  - id: W3-ext-command-postPurchase-return
    content: Expose `initiateReturn/refund` command (best-effort + user steps when required)
    status: pending
    dependencies:
      - W3-ext-command-postPurchase-track
  - id: W3-ext-command-supportTicket
    content: Expose `createSupportTicket` command (best-effort)
    status: pending
    dependencies:
      - W3-ext-command-postPurchase-track
  - id: W3-ext-observability
    content: Add structured logging and event emission for every major step (for web UI display)
    status: pending
    dependencies:
      - W3-ext-port-protocol
  - id: W3-ext-error-surface
    content: Standardize error mapping to user-friendly messages and `needsUserAction` events
    status: pending
    dependencies:
      - W3-ext-observability
      - W2-contract-events
  - id: W3-ext-settings-storage
    content: Add extension-side storage for user API keys and preferences used by hybrid mode (local-first)
    status: pending
    dependencies:
      - W3-ext-handshake
  - id: W3-llm-multi-provider
    content: "RetailAgent: add multi-provider LLM support (Gemini + OpenAI + Anthropic/Claude) with a shared provider interface"
    status: pending
    dependencies:
      - W0-test-infra-ext
      - W7-security-pii
  - id: W3-llm-model-discovery-cache
    content: "RetailAgent: check available models per provider and cache best working model in browser storage per day (per provider + key prefix)"
    status: pending
    dependencies:
      - W3-llm-multi-provider
  - id: W3-llm-tests
    content: "RetailAgent: tests for provider selection, model listing, model fallback, daily cache behavior, and redaction (no keys in logs/events)"
    status: pending
    dependencies:
      - W3-llm-model-discovery-cache
      - W2-contract-tests
  - id: W4-web-ext-detect
    content: Implement extension detection + install CTA in `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/pages/Index.tsx`
    status: pending
    dependencies:
      - W3-ext-origin-allowlist
      - W0-test-infra-web
  - id: W4-web-extensionClient
    content: Create `extensionClient` module (connect/handshake/send/subscribe/reconnect/timeouts)
    status: pending
    dependencies:
      - W2-contract-commands
      - W2-contract-events
      - W4-web-ext-detect
      - W2-contract-tests
  - id: W4-web-extensionClient-tests
    content: Write extensionClient tests (connect, disconnect/reconnect, timeout, protocol mismatch, command error mapping)
    status: pending
    dependencies:
      - W4-web-extensionClient
  - id: W4-web-chat-intent
    content: "Wire `/src/components/ChatInterface.tsx` to call hybrid intent pipeline: backend optional + extension parseIntent fallback"
    status: pending
    dependencies:
      - W4-web-extensionClient
      - W5-hybrid-routing
  - id: W4-web-products-replace-mock
    content: Replace mock product search in UI with real `searchPlatforms/compare` calls and event-driven updates
    status: pending
    dependencies:
      - W4-web-chat-intent
      - W3-ext-command-compare
      - W3-llm-tests
  - id: W4-web-remove-hardcoded-catalog
    content: "ai-retail-concierge: remove hard-coded product catalog / demo product generation and rely on RetailAgent for real search+compare results"
    status: pending
    dependencies:
      - W4-web-products-replace-mock
  - id: W4-web-product-schema-adapter
    content: Build adapter from RetailAgent Product schema to ai-retail-concierge `Product` type in `/src/pages/Index.tsx`
    status: pending
    dependencies:
      - W2-contract-types
      - W4-web-products-replace-mock
  - id: W4-web-comparison-ui
    content: Update `/src/components/ProductPanel.tsx` to show comparison metadata (deliveryDays, offers, reasoning, confidence) when available
    status: pending
    dependencies:
      - W4-web-product-schema-adapter
  - id: W4-web-manual-select-flow
    content: "Implement manual selection: user clicks product → web sends `openProduct` to extension and transitions UI to checkout assist"
    status: pending
    dependencies:
      - W4-web-comparison-ui
      - W3-ext-command-openProduct
  - id: W4-web-auto-purchase-flow
    content: "Implement auto-purchase: web sends `buyNow` for best product and shows step-by-step progress + user action prompts"
    status: pending
    dependencies:
      - W4-web-comparison-ui
      - W3-ext-command-buyNow
  - id: W4-web-checkoutPanel-assist
    content: Refactor `/src/components/CheckoutPanel.tsx` to represent “assistive checkout” (status, prompts, deep links) not fake order placement
    status: pending
    dependencies:
      - W4-web-manual-select-flow
  - id: W4-web-orderTracker-real
    content: Refactor `/src/components/OrderTracker.tsx` to use extension `trackOrder` (and optional backend storage)
    status: pending
    dependencies:
      - W3-ext-command-postPurchase-track
      - W5-hybrid-storage
  - id: W4-web-remove-hardcoded-orders
    content: "ai-retail-concierge: remove hard-coded sample orders and simulated order placement; source order state from RetailAgent capabilities (local-first, optional backend sync)"
    status: pending
    dependencies:
      - W4-web-orderTracker-real
  - id: W4-web-localShops-integration
    content: Wire `/src/components/LocalShopsPanel.tsx` to `supabase/functions/local-shops` and enrich results with “open in maps/call” actions
    status: pending
    dependencies:
      - W6-offline-shops
  - id: W4-web-ui-tests
    content: "Write UI tests: chat submit → productsFound render → manual select → checkout assist; plus error/progress rendering"
    status: pending
    dependencies:
      - W4-web-products-replace-mock
      - W4-web-extensionClient-tests
  - id: W5-hybrid-routing
    content: Design routing policy between local LLM (extension) and backend LLM (Supabase) per user/account
    status: pending
    dependencies:
      - W1-req-clarify-success
  - id: W5-hybrid-auth
    content: Add auth/session concept for backend mode (Supabase auth or minimal token)
    status: pending
    dependencies:
      - W5-hybrid-routing
  - id: W5-hybrid-shopping-agent-contract
    content: Update `supabase/functions/shopping-agent` to return `IntentV1` + personalization weights instead of mock products (or add new endpoint)
    status: pending
    dependencies:
      - W2-contract-types
      - W5-hybrid-routing
  - id: W5-hybrid-personalization
    content: Implement personalization weights UI (price/rating/delivery/availability) and persist (local + optional backend)
    status: pending
    dependencies:
      - W2-contract-types
      - W5-hybrid-shopping-agent-contract
  - id: W5-hybrid-storage
    content: "Implement storage strategy: local-first (browser/extension) and optional Supabase tables for orders/preferences (backend mode)"
    status: pending
    dependencies:
      - W5-hybrid-auth
  - id: W6-offline-shops
    content: "Harden `supabase/functions/local-shops` for production: CORS allowlist, API key handling, rate limits, caching, and schema stability"
    status: pending
    dependencies:
      - W1-req-compliance
  - id: W6-offline-availability
    content: Define offline availability model (unknown/available/limited) and integrate “call to confirm” workflow in UI
    status: pending
    dependencies:
      - W6-offline-shops
  - id: W7-security-origin
    content: Implement strict origin checks in extension for all incoming web messages; deny-by-default
    status: pending
    dependencies:
      - W3-ext-origin-allowlist
  - id: W7-security-capabilities
    content: Implement per-command capability checks (some commands allowed only after explicit user consent)
    status: pending
    dependencies:
      - W3-ext-permission-gating
  - id: W7-security-pii
    content: Define PII handling rules (addresses/phone/payment) and ensure local-only storage by default
    status: pending
    dependencies:
      - W5-hybrid-storage
  - id: W7-security-logging
    content: Ensure logs/events do not leak sensitive values; redact before emitting to web app/backend
    status: pending
    dependencies:
      - W3-ext-observability
      - W7-security-pii
  - id: W7-security-csp
    content: Review and document CSP requirements for both extension pages and the website
    status: pending
    dependencies:
      - W1-req-compliance
  - id: W8-automation-amazon-parity
    content: Ensure Amazon automation paths used by web app match RetailAgent stable flows (URL filters, sponsored filtering, buy-now retries)
    status: pending
    dependencies:
      - W3-ext-command-search
      - W3-ext-command-buyNow
  - id: W8-automation-flipkart-parity
    content: Ensure Flipkart automation paths used by web app match RetailAgent stable flows (AJAX handling, fallback path continuation)
    status: pending
    dependencies:
      - W3-ext-command-search
      - W3-ext-command-buyNow
  - id: W8-platform-ajio
    content: Add Ajio.com platform to RetailAgent (search, extract, compare; buy assist best-effort)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-jiomart
    content: Add JioMart.com platform to RetailAgent (search, extract, compare; buy assist best-effort)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-reliancedigital
    content: Add RelianceDigital.in platform to RetailAgent (search, extract, compare; buy assist best-effort)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-tirabeauty
    content: Add TiraBeauty.com platform to RetailAgent (search, extract, compare; buy assist best-effort)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-bigbasket
    content: Add BigBasket.com platform to RetailAgent (search, extract, compare; cart/buy assist best-effort; handle location/pincode flows)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-blinkit
    content: Add Blinkit.com platform to RetailAgent (search, extract, compare; cart/buy assist best-effort; handle location/pincode flows)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-zepto
    content: Add Zepto.com platform to RetailAgent (search, extract, compare; cart/buy assist best-effort; handle location/pincode flows)
    status: pending
    dependencies:
      - W1-req-platform-scope
      - W2-contract-types
  - id: W8-platform-fixtures-tests
    content: "Add fixture-driven tests for each new platform: selectors, product extraction, search flows, and fallbacks"
    status: pending
    dependencies:
      - W0-test-infra-ext
      - W8-platform-ajio
      - W8-platform-jiomart
      - W8-platform-reliancedigital
      - W8-platform-tirabeauty
      - W8-platform-bigbasket
      - W8-platform-blinkit
      - W8-platform-zepto
  - id: W8-compare-multi-platform
    content: Extend comparison orchestration to support N platforms and safely close losing tabs (Amazon, Flipkart, Ajio, JioMart, RelianceDigital, TiraBeauty, BigBasket, Blinkit, Zepto)
    status: pending
    dependencies:
      - W8-platform-fixtures-tests
      - W3-ext-command-compare
  - id: W8-postpurchase-multi-platform
    content: Implement post-order journeys across platforms where feasible (track/cancel/return/support/reorder) and document per-platform capability matrix + fallbacks to `needsUserAction`
    status: pending
    dependencies:
      - W1-req-journey-coverage
      - W3-ext-command-postPurchase-track
      - W3-ext-command-postPurchase-cancel
      - W3-ext-command-postPurchase-return
      - W3-ext-command-supportTicket
      - W3-ext-command-postPurchase-reorder
      - W8-platform-fixtures-tests
  - id: W8-automation-multi-tab
    content: Implement multi-tab orchestration for comparison (open/close tabs, preserve user’s main tab)
    status: pending
    dependencies:
      - W3-ext-command-compare
  - id: W8-automation-cancellation
    content: Add cancellation/stop command to abort jobs safely and clean up tabs/listeners
    status: pending
    dependencies:
      - W3-ext-job-model
  - id: W8-automation-resume
    content: Add resume/retry-from-last-step support where safe (idempotent steps)
    status: pending
    dependencies:
      - W8-automation-cancellation
  - id: W9-testing-contract
    content: Add unit tests for contract schemas and adapters in ai-retail-concierge
    status: pending
    dependencies:
      - W2-contract-types
  - id: W9-testing-extension-bridge
    content: Add integration tests for web↔extension handshake and command routing
    status: pending
    dependencies:
      - W3-ext-handshake
      - W4-web-extensionClient
  - id: W9-testing-e2e
    content: Add Playwright E2E scenarios for compare+manual select and compare+auto pick (smoke)
    status: pending
    dependencies:
      - W8-automation-multi-tab
      - W8-compare-multi-platform
      - W4-web-manual-select-flow
      - W4-web-auto-purchase-flow
      - W0-e2e-harness
  - id: W9-testing-regression
    content: Add regression test harness for Amazon/Flipkart selector drift (snapshot + alerting)
    status: pending
    dependencies:
      - W8-automation-amazon-parity
      - W8-automation-flipkart-parity
  - id: W10-devx-monorepo-strategy
    content: Decide dev workflow across two repos (local linking, shared types package, or copy-on-build)
    status: pending
    dependencies:
      - W2-contract-types
  - id: W10-devx-shared-types
    content: Implement shared types distribution approach (e.g., small package or generated schema)
    status: pending
    dependencies:
      - W10-devx-monorepo-strategy
  - id: W10-release-extension
    content: "Define extension release pipeline: versioning, packaging, publishing checklist"
    status: pending
    dependencies:
      - W7-security-origin
      - W9-testing-extension-bridge
  - id: W10-release-webapp
    content: "Define web app deployment pipeline: environment config, allowed origins, rollback strategy"
    status: pending
    dependencies:
      - W4-web-extensionClient
      - W7-security-csp
  - id: W10-release-docs
    content: "Write end-user docs: install extension, connect site, privacy expectations, supported flows and limitations"
    status: pending
    dependencies:
      - W10-release-extension
      - W10-release-webapp
  - id: W10-telemetry-optional
    content: "Optional: add privacy-preserving telemetry (opt-in) for failure modes and selector drift"
    status: pending
    dependencies:
      - W7-security-logging
---

# Plan: Turn ai-retail-concierge into a functional web product powered by RetailAgent extension

## Goals

- Use the existing automation **code + architecture** from `/Users/arpan1.mukherjee/code/RetailAgent/` (MV3 extension) to power the UI prototype in `/Users/arpan1.mukherjee/code/ai-retail-concierge/`.
- Deliver a **website-only experience** where the user installs the extension; all automation happens in the user’s browser.
- Support **hybrid LLM**:
- **Local mode**: user brings their own API key (stored locally).
- **Backend mode**: optional Supabase Edge Functions for managed accounts (already scaffolded in `ai-retail-concierge/supabase/functions/*`).

## Test-driven development (TDD) plan

### Delivery rule: tests first

- Every behavior change must have a test (new or updated) written **before** implementation.
- A task is only “finished” when its required test cases are passing locally and in CI.

### Definition of Done (applies to every implementation task)

- Unit + integration tests green for the repo(s) touched.
- E2E smoke green for flows touched (fixture-based).
- No new lints.
- No secrets/PII in logs/events (redaction tests pass).

### Required test commands (must be green before marking any task complete)

These are the minimum commands we will standardize in the first TDD infra tasks:

- Web app (`/Users/arpan1.mukherjee/code/ai-retail-concierge/`)
- `npm run lint`
- `npm run test` (unit/integration)
- `npm run test:e2e` (Playwright smoke; fixture-based)
- Extension (`/Users/arpan1.mukherjee/code/RetailAgent/`)
- `npm test` (Jest unit/integration)
- `npm run test:bridge` (bridge-specific suite; can alias to `npm test`)
- `npm run test:e2e` (optional; if we wire Playwright to load extension from this repo directly)

No task that changes behavior should be marked complete unless the relevant commands are green.

### Test strategy (deterministic-first)

- **Primary**: fixture-driven tests (stable HTML fixtures representing Amazon/Flipkart DOM variants) to avoid flaky tests and ToS risk.
- **Secondary**: optional canary runs against real sites as manual/periodic checks (not required for “done”).
- LLM calls are **mocked** in tests; intent parsing validated via golden fixtures.

### Comprehensive test catalog (IDs)

#### Contract tests (shared)

- **T-CT-01**: `IntentV1` schema accepts valid examples; rejects invalid types.
- **T-CT-02**: `FilterV1` supports price/rating/brand/ram/storage/battery; rejects unknown keys unless under `extensions`.
- **T-CT-03**: `ProductV1` required fields: `id`, `title`, `price`, `url`, `platform`; optional enrichments allowed.
- **T-CT-04**: `ComparisonResultV1` winner must reference a candidate product.
- **T-CT-05**: Backward compatibility: old clients ignore unknown fields.
- **T-CT-06**: Forward compatibility: new optional fields don’t break parsers.

#### Extension bridge tests (RetailAgent)

- **T-EB-01**: Reject non-allowlisted origins (deny-by-default).
- **T-EB-02**: Accept allowlisted origins.
- **T-EB-03**: Reject protocolVersion mismatch.
- **T-EB-04**: Reject nonce replay.
- **T-EB-05**: Capability enforcement denies sensitive commands without consent.
- **T-EB-06**: Port disconnect cancels running job and emits terminal event.
- **T-EB-07**: Redaction: events/log payloads never include apiKey/address/payment details.

#### Service worker command tests (RetailAgent)

- **T-SW-01**: `parseIntent` returns structured intent from stubbed LLM response.
- **T-SW-02**: `parseIntent` falls back to simple parser on LLM failure.
- **T-SW-03**: `searchPlatforms` opens tab(s) and sends `SEARCH` command.
- **T-SW-04**: `searchPlatforms` handles content script timeout → fallback path.
- **T-SW-05**: `compare` produces deterministic winner for fixture inputs.
- **T-SW-06**: `openProduct` navigates to URL and emits `productOpened`.
- **T-SW-07**: `buyNow` stops at checkout boundary and emits `needsUserAction` for login/OTP.
- **T-SW-08**: Retry limits enforced (no infinite loops).
- **T-SW-09**: Cancellation stops further actions and closes/cleans up tabs (where configured).

#### LLM provider tests (RetailAgent)

- **T-LLM-01**: Provider selection works (Gemini/OpenAI/Anthropic) based on configured keys and user preference.
- **T-LLM-02**: Model listing works per provider (stubbed API responses).
- **T-LLM-03**: Model fallback works when a preferred model fails.
- **T-LLM-04**: Daily cache stores the chosen working model for a provider+key prefix and reuses it same day.
- **T-LLM-05**: Cache rotates next day (does not reuse yesterday’s cached model blindly).
- **T-LLM-06**: Redaction: logs/events never contain API keys or provider auth headers.

#### Content script / platform fixture tests (RetailAgent)

- **T-CS-AZ-01**: Amazon fixture: sponsored products are filtered out before extraction.
- **T-CS-AZ-02**: Amazon fixture: URL filter builder outputs expected `rh` for price/rating/battery/ram.
- **T-CS-FK-01**: Flipkart fixture: AJAX path continues without relying on PAGE_LOADED.
- **T-CS-FK-02**: Flipkart fixture: fallback search path continues to extraction/selecting.
- **T-CS-AJ-01**: Ajio fixture: product extraction returns valid `ProductV1` list.
- **T-CS-JM-01**: JioMart fixture: search + extraction works with expected selectors.
- **T-CS-RD-01**: RelianceDigital fixture: search + extraction works.
- **T-CS-TB-01**: TiraBeauty fixture: search + extraction works.
- **T-CS-BB-01**: BigBasket fixture: search + extraction works (including pincode/location gate simulation).
- **T-CS-BL-01**: Blinkit fixture: search + extraction works (including location gate simulation).
- **T-CS-ZP-01**: Zepto fixture: search + extraction works (including location gate simulation).

#### Web app tests (ai-retail-concierge)

- **T-WEB-01**: Extension not installed → show install CTA.
- **T-WEB-02**: Handshake success → UI enters connected state.
- **T-WEB-03**: Handshake failure → show actionable error + retry.
- **T-WEB-04**: Chat submit triggers parse/execute pipeline.
- **T-WEB-05**: Progress events stream into chat timeline.
- **T-WEB-06**: `productsFound` renders ProductPanel results.
- **T-WEB-07**: Manual select sends `openProduct` and transitions to checkout assist.
- **T-WEB-08**: Auto-purchase sends `buyNow` and renders step-by-step prompts.
- **T-WEB-09**: Cancellation resets loading state and emits UI confirmation.
- **T-WEB-10**: Offline shops: renders results and supports call/maps actions.
- **T-WEB-11**: No hard-coded catalog: product results come from extension events only (mocked extensionClient in tests).
- **T-WEB-12**: No hard-coded orders: order list is empty until extension/back-end provides real data; UI handles empty state.

#### Offline shops tests (Supabase + web)

- **T-OFF-01**: `local-shops` returns stable schema for query+location.
- **T-OFF-02**: Missing Places key uses mock fallback but maintains schema.
- **T-OFF-03**: Web UI handles empty results and API errors gracefully.

#### E2E smoke tests (Playwright harness, fixture-based)

- **T-E2E-01**: Web detects extension and completes handshake.
- **T-E2E-02**: Compare flow (fixtures): products displayed and winner highlighted.
- **T-E2E-03**: Manual select (fixtures): product opened and checkout-assist view reached.
- **T-E2E-04**: Auto-purchase (fixtures): reaches checkout boundary prompt.
- **T-E2E-05**: Mid-run disconnect: UI recovers into retryable state.
- **T-E2E-06**: Multi-platform compare (fixtures): N-platform comparison completes and closes losing tabs safely.

## Non-goals (for V1)

- Fully unattended checkout/payment completion (most sites require OTP/3DS and user confirmation).
- Scraping that violates platform ToS; design for “assistive automation” with explicit user initiation.

## Key discovery from current repos

- **RetailAgent** already has: service-worker orchestration, platform abstraction, content-script loaders, comparison logic, filter strategies, and robust error handling.
- **ai-retail-concierge** is a Vite/React UI prototype with demo flows (chat → products → checkout → tracking → local shops) in [`/Users/arpan1.mukherjee/code/ai-retail-concierge/src/pages/Index.tsx`](../ai-retail-concierge/src/pages/Index.tsx) and uses Supabase Edge Functions for mock product results in [`/Users/arpan1.mukherjee/code/ai-retail-concierge/supabase/functions/shopping-agent/index.ts`](../ai-retail-concierge/supabase/functions/shopping-agent/index.ts).

## Target architecture

### High-level flow

```mermaid
sequenceDiagram
  participant WebApp as WebApp
  participant Bridge as ExtBridge
  participant SW as ServiceWorker
  participant CS as ContentScript
  participant Site as EcommerceSite

  WebApp->>Bridge: connect(handshake,origin)
  Bridge->>SW: forward(command)
  SW->>CS: sendMessage(SEARCH/APPLY_FILTERS/GET_RESULTS)
  CS->>Site: DOM_automation
  CS->>SW: results+telemetry
  SW->>Bridge: progress/events
  Bridge->>WebApp: stream(progress,results)
```



### Web↔Extension bridge (core enabler)

- Implement a secure protocol that allows the website to request actions from the extension.
- Use **MV3 externally_connectable** + message passing.
- Enforce **origin allowlist**, **capabilities**, and **user-gesture gating** (automation starts only after explicit user action).

## Workstreams

### 1) Product & UX alignment (website-first)

- Map UI screens in ai-retail-concierge to automation states in RetailAgent:
- Chat/intent → compare/search → results ranking → user pick or “auto pick” → open winning tab/product → assisted checkout → post-purchase actions → offline shop connect.

### 2) Shared contract (schemas + commands)

Define shared, versioned types used by both:

- `IntentV1`, `FilterV1`, `ProductV1`, `ComparisonResultV1`, `OrderV1`
- Commands: `parseIntent`, `searchPlatforms`, `compare`, `openProduct`, `buyNow`, `addToCart`, `trackOrder`, `initiateReturn`, `supportTicket`, `findLocalShops`
- Events: `log`, `progress`, `tabOpened`, `productsFound`, `comparisonReady`, `needsUserAction`, `completed`, `error`

### 3) Extension: expose automation as a capability API

Primary files to extend:

- `/Users/arpan1.mukherjee/code/RetailAgent/src/background/service_worker.js`
- `/Users/arpan1.mukherjee/code/RetailAgent/manifest.json`

Key changes:

- Add externally connectable configuration and origin allowlist.
- Add `WEBAPP_*` message handlers in service worker.
- Add job/session model so multiple web requests don’t collide.
- Stream structured events (progress/log/result) back to web app.

### 4) Web app: replace mock flows with extension-powered flows

Primary files to modify:

- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/components/ChatInterface.tsx`
- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/pages/Index.tsx`
- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/components/ProductPanel.tsx`
- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/components/CheckoutPanel.tsx`
- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/components/OrderTracker.tsx`
- `/Users/arpan1.mukherjee/code/ai-retail-concierge/src/components/LocalShopsPanel.tsx`

Key additions:

- Remove hard-coded/demo product catalogs and sample orders from the web app; treat the website as a UI that renders extension-driven search/compare/buy/track workflows.
- A small `extensionClient` module that:
- Detects extension installation
- Connects and handshakes
- Sends commands
- Subscribes to event stream
- Handles reconnect + timeouts

### 5) Hybrid LLM integration

- **Local mode**:
- Use RetailAgent’s LLM layer inside the extension for intent parsing and reasoning.
- Support multiple providers: **Gemini**, **OpenAI**, **Anthropic/Claude**.
- Before using a model, check **available models** for that provider/key and cache the best working model **per day** in browser storage.
- Website UI stores only UI preferences; API keys stored locally (prefer extension storage).
- **Backend mode**:
- Keep Supabase Edge Functions (e.g. `shopping-agent`) as a managed-intent + personalization service.
- Web app calls edge function to get `IntentV1` + personalization weights, then asks extension to execute.

### 6) Comparison engine & personalization

- Reuse RetailAgent’s product comparison scoring logic and expose it via the bridge.
- Add personalization weights from:
- UI settings (price vs rating vs delivery vs availability)
- Optional backend profile (hybrid mode)

### 7) Purchase journey (assistive automation)

- Support two modes:
- **Manual choose**: show comparison list; user chooses product; extension opens that product tab and assists checkout.
- **Auto choose**: extension selects best, opens product, proceeds until checkout boundary.

### 8) Post-purchase and offline store connect

- Post-purchase actions implemented via extension automation where possible.
- Offline store connect can stay backend-driven (Places API in edge function) while the web app orchestrates; extension can optionally open maps/call links.

### 9) Security, privacy, compliance

- Origin allowlist in extension.
- Signed/nonce handshake; per-session tokens.
- Permission prompts and clear UI around what the extension can do.
- Data minimization: store only what is required; sensitive info never leaves device in local mode.

### 10) Testing & release

- Unit tests for message contracts.
- Integration tests for web↔extension handshake.
- Playwright E2E for:
- search/compare flow
- manual select
- buy-now boundary
- error + retry

---

## Deliverables

- A working website (`ai-retail-concierge`) that uses the installed extension (`RetailAgent`) to:
- parse intents
- search Amazon/Flipkart
- compare results
- let the user choose or auto-pick