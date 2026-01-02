## DevX Strategy (RetailAgent + ai-retail-concierge)

- **Two-repo, copy-on-build**: keep types/schemas in ai-retail-concierge, export a generated snapshot consumed by RetailAgent only if needed; otherwise mirror shared schemas manually (current approach).
- **Local linking option**: use `npm link` or `pnpm link` for a small shared package of Zod schemas if expanded later.
- **Commands**:
  - Web: `npm run lint`, `npm run test`, `npm run test:e2e`.
  - Extension: `npm test`.
- **CI**: run per-repo; avoid cross-repo builds to keep pipelines fast.
- **When changing contracts**: update Zod schemas + adapter tests in web, mirror necessary fields in extension parse/comparison, and rerun both test suites.

