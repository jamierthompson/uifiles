---
paths:
  - "registry/**"
  - "registry.json"
---

# Registry rules (loaded when touching registry files)

- Validate before you finish: `pnpm registry:validate`, then `pnpm registry:build` (it rewrites
  `registry/base/registry.json`; commit that file, CI fails on an uncommitted diff under
  `registry/`).
- `registry/ui/registry.json` and the `cssVars` of `registry/base` are generated. To change
  tokens edit `app/globals.css` under both `:root` and `.dark` (`scripts/sync-tokens.ts` exits
  1 on drift); to fork a primitive add `files` to its entry and keep the name.
- Declare every bare npm import in the item's `dependencies` (`cn` included), pinned to a range
  when upstream leaves it bare, and no package the item does not use:
  `tests/unit/registry.test.ts` fails on an undeclared import and, for an item that ships
  files, on a declared package that none of its files imports and no `@import` or `@plugin`
  key of its `css` loads.
- CSS a consumer needs goes in the item's `css` field, which the CLI writes into their CSS file
  and merges along the dependency tree. The `response` item ships
  `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"` and the
  `.katex-display` rule; items that depend on `@uifiles/response` do not repeat them (the unit
  test fails on a `css` rule an `@uifiles/*` dependency already ships). Only Streamdown's
  `@source` line stays manual, because its path is relative to the consumer's CSS file.
- Put every intentional divergence from upstream and every remaining manual step (the
  `@source` line) in the item's `docs`; the current list is `docs/architecture.md` §3.
- Item `files[].path` is relative to the `registry.json` that declares it. Targets are plain
  project-relative paths (`components/ai/<name>.tsx`, `app/chat/page.tsx`); use `~/` only for
  project-root files such as `~/AGENTS.md`.
- Block sources nest as `registry/blocks/<block>/{components,lib,hooks}/...` so the CLI's
  import rewrite (`@/registry/<x>/components/...` → components alias, `/lib/` → lib alias)
  lands them where their targets say. A flat `registry/blocks/<block>/<file>` would land in
  `components/<block>/`.
- Cross-item dependencies inside this registry are `@uifiles/<name>`, never relative imports
  across items and never absolute URLs.
- Ported AI Elements files start with the two-line header in
  `docs/porting-ai-elements.md` §1 (upstream file, Apache-2.0, what was modified). The licence
  copy is `licenses/APACHE-2.0-ai-elements.txt`, never a root `LICENSE*` file. Each shipped
  item has an entry in `registry/ai/upstream.lock.json` (`source`, `sha256`, `fetchedAt`, and
  `upstream` when it was cut from a differently named file); update it on every port.
- After adding an item, check `pnpm dev` → `/` lists it with a useful description, and
  `/llms.txt` includes it.
