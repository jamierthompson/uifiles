# fix-docs-integration

Lens: `docs-integration`. Inputs read in full: the ten `fix-*.md` reports, `BRIEF-fix-common.md`,
and the current `vitest.config.ts`, `tests/a11y.ts`, `tests/axe-tags.ts`, `tests/setup.ts`,
`e2e/helpers.ts`, `e2e/previews.spec.ts`, `e2e/registry.spec.ts`, `e2e/chat-keyboard.spec.ts`,
`playwright.config.ts`, `tsconfig.json`, `.github/workflows/{ci,upstream-diff}.yml`,
`scripts/sync-upstream.ts`, `scripts/sync-tokens.ts` (header), `registry/ai/upstream.lock.json`,
`package.json`, `app/globals.css`, and the component sources each documented claim rests on
(`reasoning`, `model-selector`, `code-block`, `context`, `tool`, `branch`, `image`, `sources`,
`inline-citation`, `queue`, `confirmation`, `chain-of-thought`, `prompt-input`, the chat block).
The working tree was clean at `c78f339` when I started, so the diff below is mine alone except
for `registry/ai/registry.json` and `registry/blocks/registry.json`, which another owner edited
concurrently (not touched by me).

## Changed, per file

- **`LICENSE-ai-elements` → `licenses/APACHE-2.0-ai-elements.txt`** (`git mv`, staged as a
  100% rename, content byte-identical: `git diff --cached -M --summary` →
  `rename LICENSE-ai-elements => licenses/APACHE-2.0-ai-elements.txt (100%)`). Root
  licence-like files are now exactly `LICENSE`, so licensee sees one licence (MIT).
- **`NOTICE`** — the AI Elements paragraph points at `licenses/APACHE-2.0-ai-elements.txt`.
- **`README.md`** — licence section points at the new path; one new paragraph under "Use it"
  says items that render markdown need Streamdown's `@source` line and math needs
  `@import "katex/dist/katex.min.css"` (or formulas render twice), linking to the `docs` of
  `@uifiles/response` at `https://uifiles.dev/r/response.json`. Install commands, the
  GitHub-path caveat (`tool` is the only AI item with an `@uifiles/*` dependency; verified
  against `registry/ai/registry.json`) and the "what CI runs" sentence were checked against
  `ci.yml`/`package.json` and left as they were (accurate).
- **`AGENTS.md`** — rewritten section by section, `next dev` block untouched:
  - Commands: `pnpm test:coverage` row (v8 over `registry/**` + `lib/**`, `page.tsx` excluded,
    per-file 80/80/70), `pnpm test:e2e` (light+dark, endpoints, chat keyboard walk;
    `pnpm registry:build && pnpm dev` locally, `pnpm start` in CI), `pnpm gate` does not run
    e2e; the exact CI sequence (`pnpm audit`, gate steps with coverage, `pnpm build`,
    `git diff --exit-code -- registry`, `pnpm test:e2e`), `sync-tokens` exit 1 on drift.
  - Layout: `licenses/APACHE-2.0-ai-elements.txt` in the `registry/ai/` row, new rows for
    `scripts/`, `tests/setup.ts`, `tests/axe-tags.ts`, `.github/workflows/`, and
    `LICENSE`/`licenses/`/`NOTICE` with the licensee reason.
  - Rules: declare every bare npm import (`cn` included) and what `registry.test.ts` checks;
    strict flags are on in `tsconfig.json` (`T | undefined`, conditional spread); the ref-held
    stable-callback rule in prose; the cmdk `Command.Empty`/`Command.Separator` listbox rule
    citing `model-selector`; the three consumer CSS lines for Streamdown/KaTeX; the upstream
    lock structure (`upstream` field, keyed by shipped item) and `sync-upstream` exit codes
    0/1/2; layout-dependent attributes go through post-mount state (hydration).
  - Tests: `tests/a11y.ts` exports incl. `AXE_TAGS`; `<main>` fixtures; `tests/setup.ts`
    fail-on-console with `allowConsole()`; port upstream tests first, behaviour names, no
    `skip`/`retry`, three runs; Vitest browser facts (exact locators, 414×896, 15 s,
    `await unmount()`, `toHaveTextContent` exact and RegExp-stringifying,
    `toMatchTextContent`/`expect.poll` for substrings, `optimizeDeps.include`); portaled popups
    (`[data-base-ui-portal]`, `[data-base-ui-focus-guard]`) and the pointer-parking caveat;
    fake timers with `toFake` + `element.click()` in `act`; coverage thresholds; e2e helpers
    (`gotoHydrated`, `waitForIdle`, `collectPageProblems`, `expectNoAxeViolations`,
    `COLOR_SCHEMES`); CI facts (`NEXT_PUBLIC_BASE_URL=https://uifiles.dev`, Playwright cache
    keyed by version, SHA-pinned actions, `workflows.test.ts`).
  - Tailwind: both-modes rule with `--radius` light-only; the `prefers-reduced-motion` guard in
    `@layer base` (no per-component `motion-reduce:`).
- **`docs/architecture.md`** — §1 licensing row points at the new path and states why it is
  outside the root; §3 the lock description now says "per shipped item … `upstream` names the
  file it was cut from" (the old "keyed by upstream file" was wrong against the current lock);
  new "Intentional divergences from AI Elements" list (one bullet per item: code-block,
  context, image, reasoning incl. the second-stream open decision, branch, tool, chat block,
  prompt-input, queue, confirmation, sources, inline-citation, model-selector,
  chain-of-thought, task/plan, tokens → §4); §3 table row no longer claims every divergence is
  already in `docs` (it says they "belong in each item's `docs`"); §4 token departures
  re-read and left as they were (values match `app/globals.css`); §5 Browser bullet gains the
  console guard, End-to-end gains light/dark, clean console, `gotoHydrated`, `pnpm start` vs
  dev, Gate gains audit-first, coverage thresholds, the `git diff --exit-code -- registry`
  check, `NEXT_PUBLIC_BASE_URL`, cached browsers; Strict compilation says the flags are in
  `tsconfig.json`; Upstream drift gains the 0/1/2 exit codes and the comment-or-create/label
  behaviour of the workflow.
- **`docs/porting-ai-elements.md`** — §0 lock structure corrected (per shipped item,
  `upstream: "message"` on `branch`/`response`, enforced by `registry.test.ts`); §1 confirmed
  the ref-held snippet (already correct) and added the licence path/`NOTICE` note and the
  "no root `LICENSE*`" rule; "Everything else" gains the conditional-spread pattern, the RSC
  lazy-children/`Children.toArray` note, Streamdown's `<span data-streamdown="strong">` and
  the consumer CSS lines; §4 gains the console guard, the portal/focus-guard/pointer-parking
  pattern, `await unmount()`, `toHaveTextContent` semantics, `console.log` not forwarded, and
  fake-timer usage (`toFake`, `element.click()` in `act`); §5 verify block gains prettier,
  the unit files, `pnpm test:coverage` with the thresholds, and points at the divergence list.
- **`CHANGELOG.md`** — `[0.1.0]` rewritten in Keep a Changelog form: Added (chat error row and
  Retry/`ChatErrorMarker`, prompt-input `screenshot` code and accept patterns, new props on
  branch/sources/model-selector/code-block/logo, reduced-motion guard, tests incl. coverage
  thresholds and light/dark e2e, OSS files and `licenses/`), Changed (token departures, `Image`
  `alt` required, context rows, `ModelSelectorLogo` decorative, citation trigger is a button,
  `Confirmation` accepted state for errored calls, reasoning auto-open rules, full-alpha
  tokens, 24 px targets, chat status-to-last-message), Fixed (the high-severity bugs by short
  description). No round/agent wording.
- **`CONTRIBUTING.md`** — new "Tests" bullet (port upstream tests, behaviour names,
  `tests/setup.ts`/`allowConsole()`, three runs); CI paragraph adds the coverage thresholds,
  audit-first, `pnpm test:e2e` with `NEXT_PUBLIC_BASE_URL`; the strict flags are stated as on
  in `pnpm typecheck`; Licensing names the new path and forbids a second root `LICENSE*`.
- **`skills/uifiles/SKILL.md`** — the "read each item's `docs`" line now names the Streamdown
  `@source`/stylesheet lines and the KaTeX stylesheet for `response`/`reasoning`/`chat`.
  Commands and the block landing paths (`components/blocks/`, `lib/`, `app/chat/`) verified
  against `registry/blocks/registry.json`.
- **`.claude/rules/registry.md`** — `registry:build` rewrites `registry/base/registry.json`
  (commit it; CI diff check), both-modes token rule with the exit-1 drift check, declare every
  bare npm import, divergences and post-install CSS go in `docs`, licence path, lock entry per
  shipped item.
- **`tests/unit/site.test.ts`** — the Apache test reads `licenses/APACHE-2.0-ai-elements.txt`;
  new test "keeps LICENSE as the only licence-like file at the root" (root *files* matching
  `/^(licen[sc]e|copying)/i` must equal `["LICENSE"]`; directories excluded, since `licenses/`
  would otherwise match); the README/NOTICE test asserts both name the new path and neither
  still says `LICENSE-ai-elements`.

## Claims I could not verify here

- GitHub's actual licence badge after the move: based on licensee's root-only scan (the
  app-docs fixer read `license_file.rb`/`project.rb`); no GitHub API call was possible.
- `pnpm test:coverage` clearing the thresholds on today's tree: the tooling fixer measured
  it (lowest `branch.tsx` 71.79% branches) before the leaves fixer changed `branch.tsx`; I did
  not re-run the full suite (long; not in my brief). The docs state the configured thresholds,
  which are verified in `vitest.config.ts`.
- e2e/CI green: not run (forbidden). The docs describe `ci.yml`, `playwright.config.ts` and
  `e2e/*.ts` as they are on disk.
- The `v0.1.0` tag does not exist yet; README's GitHub-path example and the CHANGELOG link
  depend on the lead creating it (unchanged from the app-docs fixer's note).
- `uifiles.dev` liveness (README, skill and the new response-docs link assume it).

## Owner decisions surfaced in the docs

- `reasoning`: a second stream now auto-opens and auto-closes once (upstream never auto-closed
  a second stream). Recorded as "Open decision" in `docs/architecture.md` §3; parity means not
  resetting `autoCloseSpentRef` when a stream starts (reasoning fixer's note).
- Registry `docs` strings: the concurrent registry edit landed the KaTeX note on
  `response`/`reasoning`/`chat`, the chat `error`/`onRetry`/`ChatErrorMarker`/`button`
  changes, and the other fixers' strings (the stale queue "keeps upstream's
  text-muted-foreground/50" sentence is gone; every item's `docs` grew), all verified after
  the edit appeared. The architecture divergence list is the human-readable record of the
  same divergences and says each "belongs in the item's `docs`".

## References left in files I do not own

- None. `grep -rn "LICENSE-ai-elements"` (excluding `node_modules`, `.git`, `public`,
  `.next`, `coverage`, `test-results`) finds only the two negative assertions in
  `tests/unit/site.test.ts`. The two-line headers in `registry/ai/*.tsx` name the upstream
  file and "Apache-2.0", never the licence file (`grep -c "LICENSE\|licen" registry/ai/*.tsx`
  → 0 in every file), so nothing there needs a change.

## Test output

```
pnpm exec prettier --write AGENTS.md CHANGELOG.md CONTRIBUTING.md README.md docs/architecture.md docs/porting-ai-elements.md skills/uifiles/SKILL.md .claude/rules/registry.md tests/unit/site.test.ts
pnpm exec prettier --check <same>            # All matched files use Prettier code style!
pnpm exec vitest run --project unit tests/unit/site.test.ts
#  Test Files  1 passed (1)
#       Tests  32 passed (32)      (31 before; +1 root-licence-file test)
pnpm exec biome check tests/unit/site.test.ts   # Checked 1 file in 15ms. No fixes applied.
git diff --cached -M --summary                  # rename LICENSE-ai-elements => licenses/APACHE-2.0-ai-elements.txt (100%)
grep -n "plan.md" AGENTS.md README.md CONTRIBUTING.md docs/*.md skills/uifiles/SKILL.md .claude/rules/registry.md   # no matches
```

`NOTICE` has no extension, so prettier was not run on it (it would refuse to infer a parser);
it is plain text, hand-wrapped to the file's existing width.

## Not done (out of ownership / not asked)

- Did not commit, build, run dev or e2e.
- Did not touch `registry/ai/registry.json`, `registry/blocks/registry.json` (concurrently
  edited by their owner), `registry/ai/*.tsx`, workflows, or any test other than `site.test.ts`.
