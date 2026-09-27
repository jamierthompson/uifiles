## What

<!-- One paragraph: what changed and why. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm gate` and `pnpm test:e2e` pass locally
- [ ] Opened the affected `/preview/<name>` page in `pnpm dev` and looked at it (light and dark)
- [ ] Tests cover the change (browser test with axe via `tests/a11y.ts` for UI; unit test otherwise)
- [ ] New item: registry entry with a retrieval-quality `description`, preview page, browser test
- [ ] AI Elements port: Apache header, `registry/ai/upstream.lock.json` updated, API changes in `docs`
- [ ] Tokens changed in `app/globals.css`, and the regenerated `registry/base/registry.json` is committed
- [ ] Docs updated where a command, count or rule changed (`AGENTS.md`, `README.md`, `docs/`, `CHANGELOG.md`)
- [ ] Conventional commit title with a scope
