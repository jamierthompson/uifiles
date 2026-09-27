# fix-meta

Lens: `meta` (CI wiring, test infrastructure, e2e, docs, site shell). Coordinator additions
from `rendered-surface.md`: N1 (home `<pre>` + mobile Playwright project), N7 (route-block
non-localhost hosts), N8 (`baseUrl()` warning off Vercel). The lead's checkpoint commit
`b85cea8` captured most of this work mid-way; the only uncommitted remainder at hand-off is
`docs/architecture.md` (chat/prompt-input divergence wording) and `registry/ai/registry.json`
(prompt-input F8/F10 strings).

## Fixed

- meta:F1 — `pnpm registry:build` runs before `pnpm test:coverage` in CI, and the two
  built-output checks fail instead of skipping when `CI` is set and `public/r` is missing
  (`it.skipIf(!built && !inCI)` plus an explicit `expect(built, "public/r/registry.json is
  missing: run pnpm registry:build before the tests (ci.yml does)")`) —
  `.github/workflows/ci.yml:52-55`, `tests/unit/registry.test.ts:424-437` — tests:
  `tests/unit/workflows.test.ts` › "builds the registry before the tests, so the built-output
  checks run instead of skipping" (failed before: `expected 5 to be less than -1`, no such
  step) and `tests/unit/tooling.test.ts` › "fail in CI when public/r is missing, naming the
  registry:build step, and skip locally" (runs `registry.test.ts -t "built output"` in a child
  Vitest whose cwd mirrors the repo through symlinks with no `public/`; before the fix that
  child reported `22 skipped` with `CI=true`, after it reports `2 failed` with the message).
- meta:F2 — `optimizeDeps.include` now names `axe-core`, `react`, `react-dom`,
  `react-dom/client`, `react-dom/server` and `vitest-browser-react`; the guard's exemption is
  narrowed from `^(react|react-dom|next|vitest|vitest-browser-react|axe-core)(\/|$)` to
  `^vitest(\/browser)?$`, and it now requires the exact specifier (a listed package root no
  longer covers a subpath) — `vitest.config.ts:6-56`, `tests/unit/test-setup.test.ts:214-243`
  — tests: `test-setup.test.ts` › "lists every bare specifier that registry/**, components/**
  and tests/browser/** import, subpaths included" and › "names the react-dom subpaths the
  server-rendering and hydration tests import" (failed before: `["react-dom/client",
  "react-dom/server"]` missing). Cold-cache behaviour documented in `AGENTS.md` › Tests ›
  "Pre-bundling" and in the config comment. Honest note: I could not reproduce a mid-run
  re-bundle from a stale cache alone (see "Could not reproduce" below).
- meta:F3 — `tests/unit/workflows.test.ts` › "sets CI and the public origin for the whole
  job…" asserts the parsed `env.NEXT_PUBLIC_BASE_URL === "https://uifiles.dev"` at workflow
  scope and that no job or step `env` overrides it (both the build and the e2e steps read
  it); new runner-free `e2e/origin.ts`: `publicOrigin()` throws in CI when the variable is
  unset, `expectsPublicOrigin()` is true in CI or whenever it is set, and
  `e2e/registry.spec.ts:49,114` key the "no localhost" assertions on it — tests:
  `workflows.test.ts` (mutations M4/M4b now caught) and `tooling.test.ts` › "publicOrigin
  fails in CI when NEXT_PUBLIC_BASE_URL is unset…" (failed before: returned localhost).
- meta:F4 / rendered:N7 — `e2e/helpers.ts` `blockExternalRequests()` installs
  `page.route((url) => !isLocalRequest(url.href), route => route.abort("blockedbyclient"))`
  before every `gotoHydrated` navigation, so the network can neither slow a run nor decide
  it; a page that needs a third-party host fails deterministically with `console.error:
  Failed to load resource: net::ERR_BLOCKED_BY_CLIENT` through `collectPageProblems` —
  `e2e/helpers.ts:33-44,75`, `e2e/origin.ts:36-45` — test: `tooling.test.ts` ›
  "isLocalRequest keeps loopback hosts and blocks every other origin"; live check against the
  running server: `/preview/model-selector` fails with exactly those four console errors in
  both themes (its owner is making the preview hermetic; the running server still serves the
  old build), `/preview/chat`, `/preview/reasoning` and the keyboard walk pass.
- meta:F5 / disclosure:F5 — the guard moved to runner-free `tests/console-guard.ts`;
  `registerConsoleGuard()` runs `cleanup()` from `vitest-browser-react` inside the guard's own
  `afterEach` before `stop()` (try/finally), so unmount-time output is charged to the test that
  rendered the tree; `stop()` detects a replaced method: a `vi.spyOn(...).mockImplementation`
  no longer hides anything, because the calls the mock swallowed are recovered from
  `mock.calls` (only the ones the wrapper never saw: the wrapper tags calls forwarded through a
  spy, so a pass-through spy is counted once and `mockImplementationOnce` recovers exactly
  the swallowed call) and reported as `console.error (swallowed by a mock implementation):
  …`; a plain-function replacement fails with "was replaced during the test"; `allowConsole`
  semantics unchanged — `tests/console-guard.ts`, `tests/setup.ts` — tests:
  `test-setup.test.ts` › "charges the calls a spy's mock implementation swallowed to the
  test", › "keeps allowConsole semantics for a swallowing spy on an allowed level", › "counts
  a call once when a pass-through spy forwards it to the wrapper", › "recovers only the calls
  a one-shot mock implementation swallowed", › "fails a test that replaced a console method
  with a plain function, unless the level is allowed", › "registers a beforeEach that starts
  and an afterEach that unmounts before it checks, charging unmount output to the test that
  rendered", › "stops the guard even when the unmount throws…" (all failed before: the old
  guard saw nothing and had no hook registration to test). Browser proof with a temporary
  file (deleted): a swallowing spy over a component that logs in an effect → the test fails
  with the "(swallowed by a mock implementation): effect noise" line; the same with
  `allowConsole("error")` → passes; a pass-through spy → one line; a tree that logs on unmount
  → charged to the rendering test, and the next test passes. Full browser project with the new
  guard: 847/849, and the two failures are unrelated 15 s timeouts in `context.test.tsx`
  (another owner's in-flight work; zero "swallowed"/"replaced" messages in the log).
- meta:F6 — `site.test.ts` › "nothing refers to the retired docs/plan.md: not the docs, not a
  test, script or app source" now scans `app`, `components`, `e2e`, `lib`, `scripts`, `tests`
  (`.ts/.tsx/.md/.json/.yml`), skipping only itself via `import.meta.url` (failed while
  `tests/unit/tokens.test.ts:531` still said "docs/plan.md §5"; its owner has since rewritten
  that comment and the test is green).
- meta:F7 — `waitForIdle` has no fixed sleep: no `[aria-busy="true"]` (30 s), then, if the
  page was busy, no `button` named `/^Thought for/` with `expanded: true` (5 s; every Reasoning
  that streamed closes itself one second after its stream ends), then `settle()` (fonts,
  finite animations, two animation frames) — `e2e/helpers.ts:47-67,92-104`; verified: the
  chat keyboard walk (two idles) 6.5 s, chat previews 6.1–6.2 s on mobile, no flake in three
  runs of those specs.
- meta:F9 — `pnpm audit --prod --audit-level=high` moved after `pnpm test:e2e`, still a hard
  failure (no `continue-on-error`, no `if`) — `ci.yml:61-63` — test: `workflows.test.ts` ›
  "audits production dependencies at the high level, as a hard failure after every test step"
  (failed before: audit index 5 < e2e index).
- meta:F10 — `yaml@^2.9.1` added as a devDependency (`pnpm add -D yaml`; js-yaml was only
  transitive); `workflows.test.ts` rewritten on the parsed documents: `permissions`,
  `concurrency`, `timeout-minutes`, step order by `run`, `env` (workflow, job and step
  levels), Playwright cache `id`/`with`, upload `if`/`with.path`, upstream-diff `shell`/`run`
  lines/`if`/`with.script` order, Dependabot `updates`; the SHA-pin check stays on the raw
  text because comments do not survive parsing. Same assertions as before (M2, M3, M16, M21
  re-run as mutations: all caught) plus the new ones.
- meta:F11 (nit) — `registry/blocks/registry.json` `chat/lib/demo-conversation.ts` is
  `registry:lib`. Verified in the sparse clone: `registryItemFileSchema` accepts any
  `registryItemTypeSchema` value except `registry:file`/`registry:page` with an optional
  `target`; `resolveFilePath` returns the explicit `target` before `resolveFileTargetDirectory`
  is consulted; `add-components.ts` groups by `getTargetAliasKey(target)` (null for a plain
  path) then `FILE_TYPE_TO_CONFIG_KEY["registry:lib"] = "lib"`, the same fallback config in a
  non-monorepo. `pnpm registry:validate`: "Registry is valid." — test: `registry.test.ts` ›
  "types every file by where its target lands: lib/ is registry:lib, app/ is registry:page"
  (failed before with `registry:component`).
- meta:F12 (nit) — `docs/architecture.md` appendix: 49 components
  (`packages/elements/src/*.tsx` in the clone: 49 files); `question` added to the §3
  resolution table ("Not ported yet", shadcn's `questionnaire` as the equivalent).
- meta:F13 (nit) — `app/robots.ts` `host: new URL(baseUrl()).host` (Next's `Robots.host` is
  a string passed through; the directive takes a host name) — test: `site.test.ts` ›
  "allows everything and sets Host to the public host name, not the origin" (failed before:
  `https://uifiles.dev`).
- meta:F14 (nit) — README: `pnpm test:e2e # … locally it builds the registry and starts the
  dev server (or reuses one), in CI it runs against pnpm start`.
- meta:F15 (nit) — the import scanner exempts `next` only in a `registry:page` file
  (`undeclaredImports()` in `registry.test.ts`) — test: › "exempts next only in a
  registry:page file: a component that imports next/* breaks non-Next consumers" (synthetic
  block: page + component both importing `next/link`; expects `['x imports "next" in
  x/widget.tsx']`; failed before with `[]`).
- rendered:N1 (high) — `app/page.tsx`: the install `<pre>` wraps (`whitespace-pre-wrap
  break-words`, no `overflow-x-auto`) instead of scrolling sideways, so there is no scroll
  region to make focusable (Biome's `noNoninteractiveTabindex`/`useSemanticElements` also
  reject a `tabIndex` on `<pre>`; a soft-wrapped command still copies as one line) — test:
  `site.test.ts` › "wraps the install commands instead of scrolling them sideways" (failed
  before: `overflow-x-auto` present). Plus a second Playwright project `chromium-mobile`
  (Desktop Chrome + `viewport 375×812`) running every spec — `playwright.config.ts:15-27` —
  test: `tooling.test.ts` › "runs every spec on Chromium at desktop and at 375 px phone width".
  The running server serves the pre-fix build, so the mobile axe pass on `/` can only be
  confirmed by CI or the next build.
- rendered:N8 (low) — `baseUrl()` prints one `console.warn` per process ("WARNING: production
  build with the public origin … A hosted deploy must set NEXT_PUBLIC_BASE_URL …") when
  `NODE_ENV === "production"`, the origin is local and `VERCEL` is unset; Vercel production
  still throws; documented in `.env.example`, README ("Hosting it yourself") and the AGENTS.md
  layout row — `lib/registry.ts:117-161` — tests: `site.test.ts` › "warns once, without
  throwing, when a production build off Vercel still advertises localhost" and › "stays
  silent for a production build with a public origin, and on a Vercel preview build" (failed
  before: no call).
- prompt-input-chat:F8/F10 (docs strings, per the coordinator's item 9) — the exact
  `description` and `docs` strings from `fix-prompt-input-chat.md` applied to
  `registry/ai/registry.json` › prompt-input; `pnpm registry:validate` clean, Prettier clean.
  chain-of-thought `title` → "Chain of Thought" (structural nit, also requested by
  fix-disclosure.md).
- Docs wording requested by owners: `docs/architecture.md` §3 chat and prompt-input bullets
  updated with the wording in `fix-prompt-input-chat.md` › Requests for other owners.
- Docs for every change above: `AGENTS.md` (command table, layout rows for
  `lib/registry.ts`, `tests/setup.ts`+`tests/console-guard.ts`, `e2e/origin.ts`; Tests ›
  console guard, pre-bundling, end to end, CI facts), `README.md`, `CONTRIBUTING.md`,
  `docs/architecture.md` §5, `docs/porting-ai-elements.md` §4, `CHANGELOG.md` (0.1.0 Added and
  Fixed lines), `.env.example`. `grep -rn plan.md` over the tree: only the site test that
  asserts its absence.

## Not fixed and why

- meta:F8 / rendered:N9 (preview `<title>`s) — component owners are adding `metadata`; not
  mine.
- meta:F4's "make the preview hermetic" half — `app/preview/model-selector/*` belongs to its
  owner (their untracked `logos.ts` / `model-selector-demo.tsx` show it in flight). Until it
  lands, `e2e/previews.spec.ts` › `preview/model-selector` fails deterministically with four
  `net::ERR_BLOCKED_BY_CLIENT` console errors in every project and theme, which is the
  intended behaviour of the route block.
- Registry `docs`/`description` strings other than prompt-input F8/F10 (chat `docs` in
  `fix-prompt-input-chat.md`; queue, reasoning, checkpoint, confirmation, tool in
  `fix-disclosure.md`) — left for the manifest pass as instructed; both reports carry the
  exact replacement strings.
- The guard cannot see a spy that is `mockRestore()`d before the test ends (the wrapper is
  back in place and the swallowed calls are gone with the spy). Documented in AGENTS.md as
  "never replace console methods with a mock implementation"; no test file does this today.

## Tests

- `tests/unit/registry.test.ts`: 22 → 25 (CI-aware built-output checks; `undeclaredImports`
  page-only `next` exemption; migrated "every @/components/ui/<x> import … is a declared bare
  registryDependency"; new file-type-by-target invariant).
- `tests/unit/workflows.test.ts`: 11 → 14, on parsed YAML (migrated "builds the registry
  before the tests" and "sets CI and the public origin for the whole job").
- `tests/unit/tooling.test.ts`: 5 → 17 (both Playwright projects; `e2e/origin.ts` ×4; the
  child-Vitest built-output check; migrated sync-upstream ×4 and generate-aliases ×2).
- `tests/unit/test-setup.test.ts`: 7 → 15 (guard: swallowed calls, allowed level,
  pass-through count, one-shot mock, plain replacement, hook order, cleanup failure; exact
  specifier gap check; react-dom subpaths).
- `tests/unit/site.test.ts`: 32 → 40 (migrated baseUrl edge cases ×3 and the README caveat;
  extended plan.md scan; robots host; install block wraps; production warning ×2).
- `tests/unit/ssr.test.ts`: unchanged (21 cases).
- `tests/unit/qa-round2-meta.test.ts`: all 15 migrated (3 failing → passing after F1–F3 and
  F6, 12 pins), file deleted (`git rm`).
- Mutation checks performed (each restored byte-for-byte, `cmp` verified; script
  `qa/round2/meta-fix/mutate.sh`):
  - `ci.yml` registry:build step removed → workflows › "builds the registry before the tests"
  - `ci.yml` audit moved before the tests → workflows › "audits production dependencies … after every test step"
  - `ci.yml` `NEXT_PUBLIC_BASE_URL` removed (M4) → workflows › "sets CI and the public origin for the whole job"
  - `ci.yml` job-level `env.NEXT_PUBLIC_BASE_URL` override → same test
  - `ci.yml` permissions removed (M2) → workflows › "grants the token read-only contents…"
  - `ci.yml` `--audit-level=critical` (M21) → workflows › "audits production dependencies…"
  - `ci.yml` checkout pinned to `@v5` → workflows › "pins every action to a full commit SHA…"
  - `ci.yml` diff step before build (M16) → workflows › "runs coverage, then the build, the generated-files check and e2e…"
  - `upstream-diff.yml` `code != '0'` (M3) → workflows › "files a report only when a source changed…"
  - `vitest.config.ts` `react-dom/server` dropped → test-setup › both include tests
  - `console-guard.ts` mock recovery removed → test-setup › 3 tests
  - `console-guard.ts` `stop()` before `cleanup()` → test-setup › "registers a beforeEach … charging unmount output…"
  - `e2e/origin.ts` CI throw removed → tooling › "publicOrigin fails in CI…"
  - `e2e/origin.ts` `isLocalRequest` always true → tooling › "isLocalRequest keeps loopback hosts…"
  - `playwright.config.ts` mobile project removed → tooling › "runs every spec on Chromium at desktop and at 375 px"
  - `lib/registry.ts` warning removed → site › "warns once, without throwing…"
  - `app/robots.ts` origin as host → site › "allows everything and sets Host…"
  - `app/page.tsx` `overflow-x-auto` restored → site › "wraps the install commands…"
  - `registry.test.ts` `inCI = false` → tooling › "fail in CI when public/r is missing…"
  - `registry.test.ts` `next` exempt everywhere → registry › "exempts next only in a registry:page file…"
  - `registry/blocks/registry.json` `registry:component` restored → registry › "types every file by where its target lands…" (survived until that invariant was added; caught now)
- Three consecutive runs of my six files: `Test Files 6 passed | Tests 132 passed` ×3
  (`pnpm exec vitest run --project unit tests/unit/{registry,workflows,ssr,tooling,test-setup,site}.test.ts`).
  Whole unit project at hand-off: `8 passed | 296 passed`. Whole browser project once with the
  new guard: `22 passed, 1 failed | 847 passed, 2 failed` (the two are `context.test.tsx`
  15 s timeouts in another owner's in-flight file; nothing guard-related).

## Registry entry changes (applied)

- prompt-input › description and docs: the strings from `fix-prompt-input-chat.md`, verbatim.
- chain-of-thought › title: "Chain of Thought".
- chat › files[1] (`chat/lib/demo-conversation.ts`) › type: "registry:lib".
- Left for the manifest pass (strings ready in the owners' reports): chat › docs
  (`fix-prompt-input-chat.md`); queue › description/docs, reasoning › docs, checkpoint › docs,
  confirmation › docs, tool › description (`fix-disclosure.md`).

## Requests for other owners

- `app/preview/model-selector/page.tsx` (model-selector owner): the e2e route block now aborts
  `https://models.dev/...`, so the preview must not fetch it (local logos or inline SVG);
  until then `previews.spec.ts` › `preview/model-selector` fails in every project with
  `console.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT`.
- `tests/browser/**` (every component owner): `vi.spyOn(console, "error").mockImplementation`
  no longer hides output; a test whose React tree logs must call `allowConsole("error")`. The
  full browser run showed no such failure at hand-off, so the remaining
  `mockImplementation` sites (`branch`, `response`, `image`, `prompt-input`, `chat`,
  `checkpoint`, `task`, `tool`, `confirmation`, `chain-of-thought` tests) are either already
  under `allowConsole` or swallow nothing; replacing them with plain `allowConsole` is still
  the documented pattern.
- `tests/browser/ai/context.test.tsx` (context owner): two tests timed out at 15 s in the
  full browser run (`renders 0% instead of NaN%…`, `renders 0 in the header…`); not seen in
  isolation by me, please check.

## Strict-flag typecheck

- Errors remaining in files I own: none (`pnpm exec tsc --noEmit` exit 0 on the tree at
  hand-off; the `tsconfig.json` already carries the three strict flags).
- Errors in files I do not own: none at hand-off (`tests/browser/ai/inline-citation.test.tsx`
  had four `HTMLElement | SVGElement` errors mid-round; fixed by its owner since).
- `pnpm lint`: clean (144 files). `pnpm format:check`: clean at hand-off (one transient
  warning mid-round on another owner's file).
- actionlint 2.0.6 (WASM, `scratchpad/actionlint-probe/lint.mjs`): `ci.yml` 0 problems,
  `upstream-diff.yml` 0 problems.

## Could not reproduce

- meta:F2's mid-run re-bundle from a warm cache alone. With a scratch `cacheDir` and the old
  include list (react-dom entries dropped), a `button.test.tsx`-only run already bundles
  `react-dom`, `react-dom/client` and `react-dom/server`: `@vitest/browser`'s
  `resolveBrowserOptimizeDeps` passes every globbed test file as an optimizer entry, not only
  the files selected on the CLI, so a partial run scans the whole suite. Adding a new
  `react-dom/server` import to a test file after the cache was built also re-optimised at
  startup, not mid-run (no "new dependencies optimized" / "unexpectedly reloaded" in the
  `DEBUG=vite:deps` logs, `meta-fix/rebundle-{old,new}.log`). The most likely trigger of the
  23:49:47 re-bundle in the reviewer's coverage run is a source file that gained an import
  while the run was in flight (other lenses were mutating `registry/ai/*.tsx` in place at the
  time). The explicit list still removes discovery from the equation for everything the suite
  reaches, which is what Vitest's own warning asks for, and the guard now fails on any gap.

## Release checklist (carried over from meta.md, with status)

1. **Fix the three CI-wiring mediums** (F1–F3): done in this round (`registry:build` before
   `test:coverage` and no silent skip; `react-dom/*` in `optimizeDeps.include` with the guard
   narrowed; `NEXT_PUBLIC_BASE_URL` asserted in `workflows.test.ts` and enforced by
   `e2e/origin.ts` in CI). The two wall-clock assertions in `prompt-input.test.tsx` are the
   prompt-input owner's. Optional items F4, F6, F7 also done; F4's preview half is the
   model-selector owner's (open).
2. **Tag `v0.1.0`** on the curated commit (`git tag -a v0.1.0 -m "0.1.0"` + push). Still
   open: README's GitHub-path example, CHANGELOG's link refs and SECURITY's "latest tag" point
   at it.
3. **Vercel project**: set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev`; do not set
   `NODE_ENV=production` as a project variable. After the first deploy:
   `curl -sI https://uifiles.dev/r/registry.json` → 200 `application/json`,
   `curl -s https://uifiles.dev/llms.txt | grep -c localhost` → 0, `/robots.txt` now prints
   `Host: uifiles.dev`. Self-hosting elsewhere: the build warns once if the variable is
   missing (N8). Open.
4. **Directory PR** to `shadcn-ui/ui` `apps/v4/registry-directory.json` (entry in
   `fix-tooling.md`, validated). Open; prerequisites unchanged.
5. **Repo settings**: private vulnerability reporting, branch protection requiring `gate`,
   topics. Open.
6. **Before opening the PR**: `git status` must show none of the lenses' artefacts
   (`tests/browser/qa-round2/` still holds other owners' files at hand-off, including an
   untracked `probe.test.tsx`; `tests/unit/qa-round2-meta.test.ts` is deleted, the
   leaves-tokens one is its owner's), then `pnpm gate` and `pnpm test:e2e` on a clean clone
   with a cold `node_modules/.vite`. Note the e2e suite now has two projects (≈88 tests) and
   `previews.spec.ts` › `preview/model-selector` stays red until that preview is hermetic.
7. **Judgement calls confirmed this round**: `pnpm audit` stays a hard gate but runs last
   (F9); e2e now covers 375 px as well as desktop; `robots.txt` `Host` is a host name (F13).
   Still to confirm: `CODE_OF_CONDUCT.md` contact as a GitHub profile URL.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round2/meta-fix

pnpm add -D yaml                                                    # yaml 2.9.1 (js-yaml was transitive only)
pnpm registry:validate                                              # Registry is valid (after registry:lib, title, prompt-input strings)
pnpm exec vitest run --project unit tests/unit/{registry,workflows,ssr,tooling,test-setup,site}.test.ts   # ×3: 132 passed
pnpm exec vitest run --project unit                                 # 8 files, 296 passed
pnpm exec vitest run --project browser                              # 23 files: 847 passed, 2 failed (context.test.tsx timeouts, not mine) > $S/browser-full.log
pnpm exec vitest run --project browser tests/browser/a11y-helper.test.tsx   # setup file loads in the browser: 11 passed
pnpm exec vitest run --project browser tests/browser/zz-guard-probe.test.tsx   # temporary guard probe (A/B2/C fail as designed, B/D pass); file deleted
pnpm exec tsc --noEmit                                              # exit 0
pnpm lint                                                           # clean, 144 files
pnpm format:check                                                   # clean
pnpm exec prettier --write <my files>; pnpm exec biome check <my files>
(cd scratchpad/actionlint-probe && node lint.mjs .github/workflows/ci.yml .github/workflows/upstream-diff.yml)   # 0 problems each
$S/mutate.sh "<label>" <file> <test file> 'OLD|||NEW'               # 22 mutations, all caught, all restored (cmp)
# F1 proof: child Vitest from a symlinked cwd without public/
(cd $S/../ci-probe.*; CI=true node …/vitest.mjs run --config …/vitest.config.ts --project unit tests/unit/registry.test.ts -t "built output")   # before: 22 skipped; after: 2 failed with the message
# F2 experiment: scratch cacheDir, old vs new include list, partial run then a file gaining react-dom/server
PROBE_CACHE_DIR=$S/cache-old PROBE_DROP=react-dom/server DEBUG=vite:deps pnpm exec vitest run --config $S/vitest.cache.config.ts --project browser <file>   # no mid-run re-bundle either way
# e2e against the running production server (reuseExistingServer; no server started or stopped)
pnpm exec playwright test e2e/registry.spec.ts e2e/chat-keyboard.spec.ts --project=chromium   # 6 passed
pnpm exec playwright test e2e/previews.spec.ts e2e/chat-keyboard.spec.ts --project=chromium-mobile -g "chat|model-selector|reasoning|keyboard"   # 5 passed, model-selector ×2 blocked as intended
```
