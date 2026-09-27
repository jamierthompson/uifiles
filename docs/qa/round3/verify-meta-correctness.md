# verify-meta-correctness (round 3, lens: correctness of the fix)

refuted: false

Verifier with no prior context. Tree at `1f57fb7` (the checkpoint that carries the meta fixes); every
tracked file I read is that commit's version. Scratch: `/docs/qa/round3/verify-meta-correctness/` (logs named below are relative to it).
No tracked file edited; the two in-place mutations were restored byte-identically (`cmp`-verified); the
throwaway browser test was deleted; no build/dev/e2e/server command was run.

Environment note: other lenses were mutating the shared tree in place during this session.
`registry/ai/response.tsx` (not a meta file) flipped between clean and ` M` three times, and
`e2e/origin.ts` was briefly rewritten to the pre-fix `expectsPublicOrigin` on disk at ~03:2x and put
back (the file-change notice in my session; `git diff HEAD -- e2e/origin.ts` is empty now). All my unit
mutation runs therefore used a clean `git archive HEAD` mirror, never the working tree.

## Verdict per finding

| finding | claimed fix | verified | evidence |
| --- | --- | --- | --- |
| rendered-surface R3-1 / R3-7 (bare `d` theme hotkey) | hotkey removed entirely; toggle stays | **yes** | `components/theme-provider.tsx` is 23 lines: provider only, no `useTheme`, no listener. `components/theme-toggle.tsx:33-40`: one `<Button>` with `aria-label`, no `aria-keyshortcuts`, no `<kbd>`, no `THEME_HOTKEY`. Grep over `app components lib e2e tests *.md docs .github` (excluding registry components, which have their own key handling) for `keydown\|aria-keyshortcuts\|<kbd\|hotkey\|THEME_HOTKEY\|ThemeHotkey`: only the assertion in `tests/browser/theme.test.tsx:143` and `components/ui/carousel.tsx` (vendored, unrelated). Callers (`app/page.tsx:25`, `app/preview/layout.tsx:23`) pass no props, so dropping `className` breaks nothing; `tsc` clean. Docs: `AGENTS.md:47,125`, `CHANGELOG.md:37,140-143`, `docs/architecture.md:208-210` updated; `README.md`/`CONTRIBUTING.md` never mentioned the hotkey (grep: no hit), unchanged since `9857827`. Mutations T1 (a bare `d` keydown listener re-added to the provider) and T2 (`aria-keyshortcuts="D"` re-added to the button), in place with `cmp`-verified restore: both → `Tests 1 failed \| 2 passed (3)`, "has no single-key shortcut…" (`mut/t1.log`, `mut/t2.log`). |
| meta F1 (console guard bypassed by `afterEach(vi.restoreAllMocks)` / `mockRestore()`) | guard robust via a proxy over `console` that remembers every spy; static check | **yes** (design deviation noted below) | Throwaway `tests/browser/zz-verify-guard.test.tsx` (deleted afterwards): file-level `afterEach(() => vi.restoreAllMocks())`, A) React's missing-key `console.error` swallowed by `vi.spyOn(console, "error").mockImplementation(() => {})`, B) a component effect's `console.error` swallowed, spy restored by a describe-level `afterEach`, C) a component effect's `console.warn` swallowed then `spy.mockRestore()` in the test, D) silent control. Result: exit 1, `Tests 3 failed \| 1 passed (4)`; each failure is the guard: `console.error (swallowed by a mock implementation): Each child in a list should have a unique "key" prop…`, `…: B: effect noise hidden by a describe-level restore`, `console.warn (swallowed by a mock implementation): C: effect noise hidden then mockRestore()` (`guard-probe.log`). `git status` after: no untracked file. Mechanism checked against `@vitest/spy@5.0.2` (`node_modules/.pnpm/@vitest+spy@5.0.2/…/dist/index.js`): `spyOn` installs and restores with `Object.defineProperty` (:265,:273), which hits the proxy's `defineProperty` trap (`tests/console-guard.ts:118-121`); `mockClear()` swaps `state.calls = []` (:165) so the array the guard kept still holds the earlier calls; `restoreAllMocks()` only calls each `restore()` (:528-533); `mock.results` gets an `incomplete` entry before the implementation runs (:329-335), which is what the wrapper's reached-marking (`:104`) relies on. Static check `tests/unit/tooling.test.ts:517-607` covers chained, `vi.mocked`, and named spies; mutation S1 (add `vi.spyOn(console, "error").mockImplementation(() => {})` to `theme.test.tsx`) → "no browser test silences…" fails (`mut/s1.log`). Guard mutations G1 (`array.slice(array.length)`) → 10 guard tests fail; G2 (`defineProperty` trap no longer remembers) → "knows a spy from the moment it is installed…" fails (`mut/g1.log`, `mut/g2.log`). Wording in `AGENTS.md:146-151`, `CHANGELOG.md:39-41`, `docs/architecture.md:247-249`, `tests/setup.ts:6-9` matches what the probe showed. Full browser project with the proxied `console`: `Test Files 23 passed (23) Tests 890 passed (890)` (`browser-full.log`). |
| meta F2 (pin comment `# v5.0.1`) | regex `# v\d+(?:\.\d+){0,2}\s*$` | **yes** | `tests/unit/workflows.test.ts:58-70`; direct synthetic tests at :77-102 accept `v5`, `v5.0`, `v5.0.1`, `v12.3.45` and reject `@v5`, no comment, `# 5`, `# v5.0.1.2`, `# latest`, a 7-char SHA. Mutation W1 (old `# v\d+\s*$`) → "accepts the tag comment Dependabot writes…" fails (`mut/w1.log`). `.github/dependabot.yml` unchanged since `c581685` (nothing needed there). |
| meta F3 / R3-4 (five untitled client previews, 404 title) | sibling `layout.tsx` × 5; `not-found.tsx` metadata | **yes** | `app/preview/{chain-of-thought,chat,confirmation,prompt-input,reasoning}/layout.tsx`: `export const metadata: Metadata = { title }` with the registry title, `Layout({ children })` returns `children` (Next 16 `layout.md:56-58`: a layout must accept and use `children`; no `"use client"`, so the export is legal per `generate-metadata.md`). `app/not-found.tsx:4` `metadata = { title: "Page not found" }` matches its `<h1>`; the root template `%s · uifiles` (`app/layout.tsx:21`) gives "Page not found · uifiles". That `not-found.tsx` metadata is honoured for a 404 render is in the installed source, not only the coder's citation: `server/app-render/app-render.js:1178-1181` (`errorType: is404 && !hasGlobalNotFound ? 'not-found' : undefined`, "retrieve the metadata from the not-found.js boundary") and `lib/metadata/resolve-metadata.js:438-444, 529-532` (the leaf's error item replaces the page item). No `app/preview/not-found.tsx` or `global-not-found.tsx` exists, so `/preview/nope` uses the root one. Unit: `tests/unit/site.test.ts:344-391`; mutations L1 (delete `chat/layout.tsx`) → "every preview route sets a title…", L2 (title `"chat"`) and L3 (`return null`) → "names a preview in its layout after the registry item…", N1 (`metadata = {}` in not-found) → "titles the 404 page after its heading" (`mut/l1,l2,l3,n1.log`). e2e: `e2e/previews.spec.ts:33` and `e2e/registry.spec.ts:120-132` typecheck (`tsc` exit 0; tsconfig includes `**/*.ts`) and parse: `playwright test --list` → `Total: 92 tests in 3 files` (the two 404 tests listed per project). Not run: forbidden, and :3000 serves the pre-change build. |
| meta F4 (vacuous Vercel-warning test) | fresh module per test, ending in a call that must warn | **yes** | `tests/unit/site.test.ts:179-238`. Mutation M1 (drop `!env.VERCEL &&` in `lib/registry.ts`, mirror) → "stays silent for a Vercel preview build that advertises localhost" fails (`mut/m1.log`); before the fix the QA report showed it survived. |
| meta F5 (`expectsPublicOrigin` true for a localhost value) | CI, else a non-loopback explicit origin | **yes** | `e2e/origin.ts:33-37` reuses `isLocalRequest`. `tests/unit/tooling.test.ts:123-148` covers `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, blank, and CI + localhost → true. Mutation O1 (old body) → that test fails (`mut/o1.log`). |
| meta F6 (`gotoHydrated` installs the route block) | unit test with a fake page | **yes** | `tests/unit/tooling.test.ts:170-201`: asserts `route` before `goto`, matcher blocks `models.dev` and keeps localhost, handler aborts with `blockedbyclient`. Mutation H1 (drop `await blockExternalRequests(page)` in `e2e/helpers.ts`) → fails (`mut/h1.log`). |
| nits N1 (NOTICE wrap), N3 (guard wording), registry-strings pin | | **yes** | `NOTICE:7-14` reflowed, no mid-sentence break. `tests/unit/registry.test.ts:128-144` (description ≤ 900, title present, docs one paragraph, balanced quotes/backticks). |
| `tests/unit/qa-round3-meta.test.ts` migrated and deleted | | **yes** | file absent; `tests/browser/qa-round3/` absent; the six behaviours are in `test-setup` (F1), `workflows` (F2), `site` (F3, F4), `tooling` (F6), `registry` (strings). Unit project: `8 files / 323 tests`. |

## Runs (all green, three times where asked)

- `pnpm exec vitest run --project unit` ×3: `Test Files 8 passed (8) / Tests 323 passed (323)` ×3 (`unit-run{1,2,3}.log`, 6.8–7.1 s).
- `pnpm exec vitest run --project browser tests/browser/theme.test.tsx tests/browser/a11y-helper.test.tsx` ×3: `Test Files 2 passed (2) / Tests 14 passed (14)` ×3 (`browser-run{1,2,3}.log`).
- `pnpm exec vitest run --project browser` (whole project, once, to exercise the proxied global `console` in all 23 files): `23 passed / 890 passed`, 41.8 s (`browser-full.log`).
- `pnpm exec tsc --noEmit` exit 0; `pnpm lint` (Biome, 151 files) exit 0; `pnpm format:check` exit 0 (`gate.txt`, `tsc.log`, `lint.log`, `format.log`).
- `pnpm exec playwright test --list`: 92 tests in 3 files (no server started).

## Mutation log

Mirror runs (`mirror.sh`: `git archive HEAD` into scratch, `node_modules` and `public` symlinked, one file
patched, one unit file run; the working tree untouched). Control (no mutation): `test-setup` 26/26.

| # | file | mutation | test that failed |
| --- | --- | --- | --- |
| G1 | tests/console-guard.ts | `array.slice(from)` → `array.slice(array.length)` | 10 guard tests |
| G2 | tests/console-guard.ts | `defineProperty` trap stops remembering | "knows a spy from the moment it is installed…" |
| W1 | tests/unit/workflows.test.ts | pin regex back to `# v\d+\s*$` | "accepts the tag comment Dependabot writes…" |
| O1 | e2e/origin.ts | `expectsPublicOrigin` without `!isLocalRequest` | "expectsPublicOrigin is true in CI and locally once the origin is a public host" |
| H1 | e2e/helpers.ts | `gotoHydrated` without the route block | "installs the external-request block before the first navigation…" |
| L1 | app/preview/chat/layout.tsx | deleted | "every preview route sets a title…" |
| L2 | app/preview/chat/layout.tsx | title `"chat"` | "names a preview in its layout after the registry item…" |
| L3 | app/preview/chat/layout.tsx | `return null` | same |
| N1 | app/not-found.tsx | `metadata = {}` | "titles the 404 page after its heading" |
| M1 | lib/registry.ts | drop `!env.VERCEL &&` | "stays silent for a Vercel preview build that advertises localhost" |
| S1 | tests/browser/theme.test.tsx | add `vi.spyOn(console, "error").mockImplementation(() => {})` | "no browser test silences console.error or console.warn…" |
| T1 | components/theme-provider.tsx (in place, restored) | bare `d` keydown listener re-added | theme "has no single-key shortcut…" |
| T2 | components/theme-toggle.tsx (in place, restored) | `aria-keyshortcuts="D"` re-added | same |

All 13 caught (`mut/summary.txt`, `mut/theme-summary.txt`, `mut/*.log`).

## Problems found (none refuting)

1. **Deviation from the prescribed fix, justified.** `vitest.config.ts` was not given `sequence: { hooks: "list" }`; the coder's reason checks out in the installed runner: `node_modules/vitest/dist/chunks/run.C5UmxDPh.js:3544-3547` (`getSuiteHooks` reverses only for `"stack"`) and `:3575-3592` (`callSuiteHook` runs a describe's own `afterEach` hooks and only then its parent's, for every `sequence` value), so `list` alone would still miss a describe-level `afterEach(() => vi.restoreAllMocks())` (probe case B). The guard-level fix covers stack and list orders (child-runner tests in `tests/unit/test-setup.test.ts:419-475`, and my browser probe under the real default). The lead asked for the setting; it is a one-line, harmless addition if still wanted, but it is not needed for correctness.
2. Nit, `e2e/origin.ts:36`: `expectsPublicOrigin` now calls `new URL(explicit)`, so a scheme-less `NEXT_PUBLIC_BASE_URL` (e.g. `uifiles.dev`) throws `TypeError: Invalid URL` inside the two spec bodies (`e2e/registry.spec.ts:50,115`) instead of returning a boolean. Such a value already fails `baseUrl()` at build time ("must be an absolute URL"), so it cannot reach a real run; a `try/catch` would only make the message friendlier.
3. Not verifiable here: the e2e title/404 assertions are unrun (server serves the pre-change build; e2e forbidden). They typecheck, parse and enumerate; the metadata path is confirmed from the Next source (above). The lead's rebuild plus `pnpm test:e2e` is still required before the claim "92 e2e pass" can be made.
4. Pre-existing, not a bypass: `tests/browser/theme.test.tsx:18-35` replaces `console.error` with a plain function inside `beforeAll` (outside any guard window), restores it in `finally`, and asserts the one message it captured. Unchanged by this round (the diff does not touch it); listed so the static check's silence on plain replacements is understood: at runtime a plain replacement inside a test is reported as "replaced during the test" (`console-guard.ts:150-163`, unit-tested at `test-setup.test.ts:258-274`).

## Tree state at the end

`git status --short` at my last check → ` M app/globals.css` (the `.katex-display` rule removed) and
` M registry/ai/response.tsx` (the `renderModal` line removed): both are other lenses' in-place mutation
runs on files outside the meta list (`response.tsx` flipped between clean and modified three times during
this session, once mid-way through my full browser run, which still passed 890/890). None of it is the
meta coder's or mine. Every meta file equals `HEAD`; `components/theme-provider.tsx` and
`components/theme-toggle.tsx` `cmp` byte-identical to the copies taken before T1/T2 and `git diff --quiet
HEAD -- components/` clean; `tests/browser/zz-verify-guard.test.tsx` gone.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round3/verify-meta-correctness
git status --short; git log --oneline -5; git show --stat HEAD; git diff ca6f2fd HEAD -- <meta files>
for i in 1 2 3; do pnpm exec vitest run --project unit > $S/unit-run$i.log; done                       # 323 passed x3
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/theme.test.tsx tests/browser/a11y-helper.test.tsx > $S/browser-run$i.log; done   # 14 passed x3
pnpm exec tsc --noEmit; pnpm lint; pnpm format:check                                                       # exit 0, 0, 0
# throwaway guard probe (written, run, deleted; git status clean of it)
pnpm exec vitest run --project browser tests/browser/zz-verify-guard.test.tsx > $S/guard-probe.log      # exit 1: 3 failed | 1 passed, guard messages
$S/mirror.sh <label> <file> <testfile> specs/<label>.py [-t filter]                                       # control, G1, G2, W1, O1, H1, L1, L2, L3, N1, M1, S1
$S/inplace-theme-mutations.sh                                                                             # T1, T2; cmp-verified restore
pnpm exec vitest run --project browser > $S/browser-full.log                                              # 23 files, 890 passed
pnpm exec playwright test --list | tail                                                                   # 92 tests in 3 files
grep -rn -i "keydown\|aria-keyshortcuts\|<kbd\|hotkey\|THEME_HOTKEY\|ThemeHotkey" …                      # no theme-hotkey remnant
sed -n … node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{layout,not-found}.md; node_modules/next/dist/server/app-render/app-render.js:1172-1184; node_modules/next/dist/lib/metadata/resolve-metadata.js:415-446,529-532
sed -n … node_modules/.pnpm/@vitest+spy@5.0.2/node_modules/@vitest/spy/dist/index.js; node_modules/vitest/dist/chunks/run.C5UmxDPh.js:3540-3600
```
