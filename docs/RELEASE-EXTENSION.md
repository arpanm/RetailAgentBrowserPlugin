## Extension Release Checklist

- **Versioning**: bump `manifest.json` version; tag in git.
- **Build**: run `npm install`; `npm test`; package via `npm run build` or `zip` of `dist` if configured.
- **Allowlist**: confirm `externally_connectable` matches production web origins.
- **Permissions**: verify host permissions include supported platforms; remove unused.
- **Security**: origin checks, capability gating, redaction in place (bridge tests passing).
- **QA**:
  - `npm test`
  - Bridge tests and command tests pass.
  - Spot-check Amazon/Flipkart flows; sanity for new platforms (best-effort).
- **Artifacts**: produce zip for Web Store upload; keep changelog.
- **Store submission**: fill listing, screenshots, privacy description (local-only by default).


