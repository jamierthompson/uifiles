# Fix round 3b (integration): common brief

Read `/docs/qa/round3/BRIEF-fix-common.md` first; it chains to the round-1 and round-2 fix briefs. Every rule there applies: file ownership, no commits, no build/dev/e2e/server commands (a production server on :3000 serves an OLD build; read only), prove each fix with a test that failed first, mutation-check, run each changed test file three times, report format, console guard (`allowConsole()` only where the console call is asserted).

Round 3b exists because the round-3 fixers' `## Requests for other owners` sections (in `fix-citation-chat.md`, `fix-response-branch-disclosure.md`, `fix-meta.md`) and the manifest pass (`fix-manifest.md`) left work that crosses ownership lines. Two groups, disjoint files:

## Group `markdown-surfaces` (Opus coder)
Owns: `registry/ai/reasoning.tsx`, `registry/ai/code-block.tsx`, `tests/browser/ai/reasoning.test.tsx`, `tests/browser/ai/code-block.test.tsx`, `tests/browser/ai/context.test.tsx`, and in `registry/ai/registry.json` ONLY the `reasoning`, `code-block` and `response` entries, plus the `chat` entry's `docs` in `registry/blocks/registry.json`.
Must NOT touch `registry/ai/response.tsx` or `tests/browser/ai/response.test.tsx` (verifiers are mutation-testing them right now); a needed change there goes under Requests.

## Group `docs-previews-pins` (Opus coder; starts after the round-3 verifiers finish)
Owns: `docs/architecture.md`, `AGENTS.md`, `CHANGELOG.md`, `README.md`, `app/preview/*/page.tsx` (titles and `<h1>` text only), `tests/unit/site.test.ts`, `e2e/previews.spec.ts`, `tests/browser/blocks/chat.test.tsx`, `tests/browser/ai/suggestion.test.tsx`, `tests/unit/tokens.test.ts`.

## Decisions already made by the lead (do not re-litigate)
- The `response` item ships, in its `css` field, the `.katex-display` rule (already there) AND the two stylesheet imports `@import "streamdown/styles.css"` and `@import "katex/dist/katex.min.css"` as empty-object keys. The shadcn CLI's css updater (`node_modules/shadcn/dist/chunk-B2MD6U5O.js`, plugin `update-css`, function `Ld`) inserts an `@import` key after the file's last existing `@import` (or prepends it) and dedupes on identical params, and the CLI itself emits such keys for fonts. The `@source "../node_modules/streamdown/dist/*.js"` line stays a documented manual step because its path is relative to the consumer's CSS file. Items that depend on `@uifiles/response` (reasoning, chat) inherit the `css` through the CLI's merge, so they do not repeat it.
- `ReasoningContent` renders its markdown through `MessageResponse` (import `@/registry/ai/response`), so reasoning content gets the same named scroll regions and the accessible link-safety dialog; `reasoning` gains `@uifiles/response` in `registryDependencies` and its `dependencies` become exactly what `reasoning.tsx` still imports (`tests/unit/registry.test.ts` enforces both directions).
- `code-block.tsx` creates ONE Shiki highlighter (both themes, no languages) lazily and loads grammars on demand, caching the load promise per resolved language and dropping it on failure; ten distinct languages must not trigger Shiki's "10 instances" `console.warn` (the console guard fails the test if it does).
- Preview pages: `<title>` and the `<h1>` text both use the registry item's `title` (`Message Branch`, `Message Response`, `Inline Citation`, `Model Selector`, `Prompt Input`, `Chain of Thought`, `Chat`, `Reasoning` and so on); `tests/unit/site.test.ts` is tightened to compare the page title with `byName(name).title`; `e2e/previews.spec.ts` keeps its `· uifiles` title pattern (and may assert the item title per route).
- `sequence.hooks: "list"` stays unset in `vitest.config.ts` (the meta fixer showed it buys nothing now that the guard is order-independent).
- `docs/architecture.md` §3 lists the `css` field (rule + two imports), the manual `@source` line, the link-safety dialog replacement, and that reasoning renders through Message Response. `AGENTS.md` "Markdown needs CSS the consumer must add" is reworded to match (two of the three lines are installed by the CLI with the `response` item; `@source` remains manual). `CHANGELOG.md` gets a line per user-visible change.

## Reports
`/docs/qa/round3/fix-<group>.md`, standard format (`## Fixed`, `## Not fixed and why`, `## Tests` with a mutation table and three-run evidence, `## Docs strings` (exact sentences for the docs group), `## Requests for other owners`, `## Strict-flag typecheck`, `## Commands run`).
