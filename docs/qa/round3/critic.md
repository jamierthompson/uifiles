# Completeness critic — round 3 close-out

Tree: `<repo>` at HEAD `9019bdf`, `git status --porcelain` empty before and after every command below. No tracked file edited. One throwaway probe (`tests/browser/zz-critic-probe.test.tsx`) was written, run once and deleted; its failure screenshot under `.vitest/` and the `coverage/` directory my coverage run created were removed. Scratch: `qa/round3/critic/` (`gate-*.log`, `gate-summary.txt`, `coverage.log`, `probe-provider-double-submit.log`).

Inputs read in full: the three round-3 briefs; the four round-3 QA reports; the eight fix reports (`fix-citation-chat`, `fix-response-branch-disclosure`, `fix-meta`, `fix-manifest`, `fix-markdown-surfaces`, `fix-docs-previews-pins`, `fix-queue-repair`, `fix-extras`); all fifteen verifier verdicts; `round1/registry-contract.md`; the blocker/high headings and summaries of every round-1 and round-2 QA report.

## Verdict

**Ship.** No defect rated medium or above is open in the code. What is missing is the release work that cannot be done or verified from this container (rebuild, e2e against the new build, the real CLI round trip, the `v0.1.0` tag the README and CHANGELOG already cite, the Vercel origin, the directory entry). Those are the blocking list; they are steps, not fixes.

### Blocking (must happen before sharing; none is a code defect)

1. **Tag `v0.1.0` on the curated commit.** `git tag` is empty; `README.md:19` (`add jamierthompson/uifiles/response#v0.1.0`), `CHANGELOG.md:9,183-184` and the GitHub-path caveat all cite it. Until it exists the README's second install command fails exactly as round-1 registry-contract F2 described.
2. **`pnpm build` (stop the stale `:3000` server first) then `pnpm test:e2e`; expect 96 tests** (`playwright test --list` = 96 in 3 files, both projects). Every reviewer of round 3/3b could not run e2e; the new assertions (per-route title, no sideways scroll at desktop and 375 px, `/preview/branch` served HTML, `/preview/response` formula at 375 px, `/preview/reasoning` fence+table+formula under axe, `Page not found · uifiles`) have only been type-checked and listed.
3. **Real CLI round trip after `pnpm registry:build && pnpm dev`:** `pnpm dlx shadcn@latest view @uifiles/response` must show the `css` field with the two `@import` keys and the `.katex-display` rule; `add @uifiles/reasoning --dry-run` and `add @uifiles/chat --dry-run` from a scratch project must report the `globals.css` update; `add @uifiles/tool --dry-run` (the `@uifiles/code-block` dependency) must resolve. Every round reasoned this from the CLI's dist code because `ui.shadcn.com` is blocked here.
4. **Vercel:** set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev`; do not set `NODE_ENV=production` as a project variable (`registry:build` runs `shadcn` and `prettier` from devDependencies). After deploy: `/r/registry.json` 200 `application/json`, `/llms.txt` with zero `localhost`, `/robots.txt` `Host: uifiles.dev`.
5. **Directory PR** to `shadcn-ui/ui` with the entry drafted in `round1/registry-contract.md` (replace the placeholder logo and author); prerequisites: public repo, item 4 live.

### Non-blocking (low/nit, listed for a follow-up)

Numbered N1–N16 in §2 and §8 below. The two new ones from my fresh look: provider-mode double submit re-sends the draft text (N15); `PromptInputSubmit` is named "Stop" while generating even without `onStop` yet stays a submit button (N16).

---

## 1. Blocker/high findings from every round: verifiably fixed at HEAD

Method: grep the current source for the fix each report claims, plus the gate runs in §5 (every canonical test that pins these is green).

| round / finding | fix in the tree (file:line) |
| --- | --- |
| R1 app-tooling F1 / registry-contract F3: localhost baked into `/`, `/llms.txt` | `lib/registry.ts:134-159`: `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → localhost; `VERCEL_ENV === "production"` throws (`:146-147`), non-Vercel production warns once (`:153-157`) |
| R1 app-tooling F2: LICENSE detected as "Other" | `LICENSE` is the 21-line MIT text; Apache copy at `licenses/APACHE-2.0-ai-elements.txt`; `LICENSE-ai-elements` deleted in `git diff 86bbd82` |
| R1 app-tooling F3: `upstream-diff.yml` masked exit code, no label, no dedupe | `.github/workflows/upstream-diff.yml:32-37` `set +e` + `$GITHUB_OUTPUT`, `:48` `code == '1'`, `:81,98` label create-or-comment; `scripts/sync-upstream.ts:93` exit 0/1/2 |
| R1 chat F1 / disclosure F1: tool crashes on `input: undefined` | `registry/ai/tool.tsx:148` "No input yet"; chat passes `part.input` through (`chat.tsx:531` per round 3) |
| R1 chat F2 / rendered F1: Enter mid-stream duplicates | `registry/blocks/chat/components/blocks/chat.tsx:713-720` `if (busy) return false`; `:153-159` suggestion path |
| R1 chat F3: no error state | `chat.tsx:244,634-649` `ChatErrorMarker`, generic text for `status: "error"` |
| R1 chat F4: `className` overrides branch visibility | `registry/ai/branch.tsx:195,225-228,253-255` `cn(..., className)` after the visibility classes |
| R1 ccmc F1: stale code on middle edit; ccmc 5 colon collision | `code-block.tsx:186` key `${language}\0${code}`, `:329` |
| R1 ccmc F2 / rendered F3: code scroller not keyboard reachable; rendered N5 landmark collision | `code-block.tsx:621-622` `role: "group"`, `tabIndex: 0` |
| R1 ccmc F3: citation throws on relative URL | `inline-citation.tsx:240-241` `safeHostname` try/catch, no `canParse` |
| R1 prompt-input F1: addon clicks steal focus | `prompt-input.tsx:1202-1252` `INTERACTIVE_SELECTOR` + `useAddonClick` |
| R1 rendered F2: KaTeX stylesheet missing (formulas twice) | `app/globals.css:5`; `response › css` ships it to consumers |
| R1 rendered F4: queue actions invisible on focus | `queue.tsx:143` `focus-visible:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100` |
| R1 rendered F5 / R2 ccmc 1: citation not openable by keyboard/tap | `inline-citation.tsx:72,189-201` `press()` pins and opens |
| R1 test-quality F1/F2: upstream suites dropped; vacuous asserts | 903 browser tests in 23 files, 335 unit (gate below); mutation tables in every fix report |
| R1 tokens F1: destructive fails AA | `app/globals.css:71` light `--destructive` 0.52, `:106` dark 0.74; `:74` `--ring` 0.64; `:68` muted 0.53 |
| R2 leaves-tokens F1 / rendered N1: table scroller unreachable | `response.tsx:37,81` `TABLE`, `:40,82` fullscreen; home `<pre>` wraps (site test) |
| R2 prompt-input-chat F1: attachments linger / wiped | `chat.tsx:102-115,725` `submitInBackground`, no returned promise; `prompt-input.tsx:922-948` per-submit ids |
| R3 components-a F1 / rendered R3-2: focus lost at carousel end | `inline-citation.tsx:567,596` `aria-disabled`, `:176-179` widened Escape restore |
| R3 components-b F1: display math widens the page | `app/globals.css:139-142`, `response.tsx:43` `MATH_DISPLAY` scroller; `response › css` |
| R3 rendered R3-1: bare `d` hotkey (WCAG 2.1.4) | `components/theme-provider.tsx`, `theme-toggle.tsx`: grep for `keydown|hotkey|aria-keyshortcuts` empty |
| R3b verify-rb-regressions P1: reasoning math unreachable | `reasoning.tsx:250` `<MessageResponse>{children}</MessageResponse>` (HEAD, not the R3 mutant) |
| R3b verify-ms-tests P1: shiki pair unpinned in reasoning | `tests/browser/ai/reasoning.test.tsx:848` fence test (extras) |

## 2. Requests for other owners and verifier Problems/Observations (round 3 + 3b)

**Applied** (verified in the tree): context ring pin (`context.test.tsx:317`); shared Shiki highlighter (`code-block.tsx:161-260`) + alias cases; three manifest docs strings; chat/suggestion/tokens snippets (`chat.test.tsx:1348,1368`, `suggestion.test.tsx:214`, `tokens.test.ts:591-660`); reasoning through `MessageResponse`; e2e branch-HTML and response-375 tests (`e2e/previews.spec.ts:57-90`); architecture §3 `.katex-display`/dialog/queue/reasoning/code-block/branch/inline-citation, §5 e2e and unit bullets (the lead's last edit `5f37284→HEAD` added the "every item that ships files" qualifier, closing verify-extras-regressions note 2); preview titles/`<h1>` = registry title on all 19 pages; `tests/unit/site.test.ts` tightened; `docs/porting-ai-elements.md:107-112` and `skills/uifiles/SKILL.md:40-45` reworded; `.claude/rules/registry.md:15-27`; temp-dir leak (`rmSync` in `finally`, 0 `/tmp/uifiles-*` left); `ssr.test.ts` hoisted imports; `settle()` before the pixel screenshot (`response.test.tsx:706`); queue `QueueItemContent` title mirror (`queue.tsx:91`); order-independent code-block start-up test (`coldCodeBlock`); reasoning link test fails fast; reverse dependency + repeated-css invariants (`registry.test.ts:458,542`); NOTICE reflow; `workflows.test.ts` tag regex; `expectsPublicOrigin`; guard proxy; 404 title; the reasoning preview surfaces.

**Deliberately declined, reason stated:** `sequence.hooks: "list"` (fix-meta, confirmed by three verifiers against the installed runner: `list` cannot reorder a describe-level `afterEach`); CHANGELOG "hotkey removed" folded into the Added line (no release ever had it); `sync-tokens` `!important` ranking and `pointer-coarse` vs `any-pointer-coarse` (components-b N2/N3, "no action"); round-2 F17 `contentVisibility: "auto"` CLS 0.032 (`code-block.tsx:454`, under 0.1, owner decision); R3-5 clamp resolved with a hover-only `title` mirror (verify-qr-correctness 1: keyboard/touch users still lose the third line under 1.4.12 spacing; documented as "on hover" in the queue docs and architecture §3); inline-citation "Sources" fallback never shows (Base UI always ids the trigger).

**Dropped silently** (no fix, no stated reason), with severity:

| # | item | evidence | severity |
| --- | --- | --- | --- |
| N1 | `e2e/origin.ts` `isLocalRequest` calls `new URL(url)` with no try/catch, so a scheme-less `NEXT_PUBLIC_BASE_URL` throws inside two spec bodies (verify-meta-correctness 2) | `e2e/origin.ts:40-41` | nit (such a value already fails `baseUrl()` at build) |
| N2 | `components/ui/kbd.tsx` unused since the hotkey hint was removed (verify-meta-regressions 2) | grep `components/ui/kbd|<Kbd` over app/components/registry/tests: no hit | nit (vendored) |
| N3 | `tests/unit/site.test.ts:194,211,223` `vi.spyOn(console,"warn").mockImplementation(() => {})` (verify-meta-tests) | letter of the AGENTS rule, which is scoped to `tests/browser/`; unit project has no guard | nit |
| N4 | nothing pins that `baseUrl()` stays silent when `NODE_ENV !== "production"` (verify-meta-tests) | `site.test.ts:190-218` only passes `NODE_ENV: "production"` | nit |
| N5 | the two new e2e tests do not loop `COLOR_SCHEMES` or attach `collectPageProblems` (verify-dpp-regressions 1) | `e2e/previews.spec.ts:57-90` | low (the phone-width response test navigates a page with no console assertion) |
| N6 | `chat.test.tsx:1368` and `suggestion.test.tsx:214` run no axe (verify-dpp-tests 1) | no `expectNoViolations` in either test body | nit |
| N7 | `repeatedCssRules` is key-path exact: a dependent shipping `.katex-display` outside `@layer base` is not reported (verify-extras-tests 1) | `tests/unit/registry.test.ts:117-160` | low (test gap) |
| N8 | twelve-language test pins language strings, not grammars (verify-extras-tests 2) | `code-block.test.tsx:239-241` | nit |
| N9 | `code-block.tsx` failure path: dropping `subscribers.delete(tokensCacheKey)` from the `.catch` survives all 54 tests (verify-extras-tests 5) | `registry/ai/code-block.tsx:358-361` | low (stale-subscriber leak would be unpinned) |
| N10 | `cssImportedPackages` counts only `@import` keys; a future `@plugin "<pkg>"` key would be reported stale (verify-extras-regressions 1) | `registry.test.ts:80-89` | low (future false positive) |
| N11 | `test-setup.test.ts` bare-specifier scan covers `registry`, `components`, `tests/browser` but not `app/**`, which browser tests import (`reasoning.test.tsx:6`, `response.test.tsx:7`, `model-selector.test.tsx:5`) (verify-extras-regressions 5) | `tests/unit/test-setup.test.ts:519` | low (a preview page's future bare import could trigger a mid-run re-bundle) |
| N12 | each `coldCodeBlock()` copy creates a real highlighter (3 per file; ~7 more cold tests would trip Shiki's warn) (verify-extras-regressions 4) | `code-block.test.tsx:141-150` | nit (informational) |
| N13 | controlled `InlineCitationCard`: a press the parent refuses leaves `pinned` true, so a later parent-driven open is pinned (dialog role, focus moved, hover close ignored) (fix-citation-chat "not in scope, noted") | `inline-citation.tsx:189-201` sets `pinned` before `setOpen`; nothing resets it on a refused open | low, undocumented |
| N14 | `tests/unit/branch.test.ts` Flight round trip is coupled to `next/dist/compiled/react-server-dom-webpack/{server,client}.node` (verify-rb-tests 2) | `branch.test.ts:232-337` | low (maintenance on a Next upgrade) |

Round-2 carry-overs still open: `components/ui/button.tsx:18` destructive `focus-visible:border-destructive/40` (~2.2:1; vendored, owner decision, excluded from the ring assertion); `tooltip.tsx` description prop idea ("not required").

## 3. Leftover artefacts

- `git status --porcelain`: empty at start, after the gate, after coverage, after the probe.
- `tests/browser/qa-round2/` **exists as an empty untracked directory** (`ls -la` → only `.`/`..`; `git ls-files` → 0). Harmless (Vitest ignores it, git does not see it) but the brief says none may remain: `rmdir tests/browser/qa-round2`. No `tests/browser/qa-round3`, no `tests/unit/qa-round*`, no `zz-*`/`_verify*` test files, no `__screenshots__`, no `.bak/.orig/.before/.pristine` under `tests/`, `e2e/`, `app/`, `registry/`.
- `git diff 86bbd82 --stat`: 142 files, +30776/−3117, all under `app/`, `registry/`, `tests/`, `e2e/`, `docs/`, `components/`, `lib/`, `scripts/`, `.github/`, `skills/`, `.claude/rules/`, `licenses/` and the root config/docs (`AGENTS.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`, `NOTICE`, `README.md`, `SECURITY.md`, `.env.example`, `.mcp.json`, `.npmrc`, `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `tsconfig.json`, `vitest.config.ts`). Deleted on purpose: `docs/plan.md` (site test asserts absence), `LICENSE-ai-elements` (moved), three `.gitkeep`s. Nothing unexpected.
- Ignored on disk: `.next/` (the OLD build the :3000 server serves), `.vitest/`, `test-results/`, `public/r`, `tsconfig.tsbuildinfo`, `next-env.d.ts`. `/tmp/uifiles-*`: 0 (the 868 stale dirs are gone).

## 4. Docs claims checked against the code (32; none contradicted)

| # | file | claim | check |
| --- | --- | --- | --- |
| 1 | README:39 | Node 24, pnpm 11 | `.nvmrc` = 24; `packageManager: pnpm@11.18.0` |
| 2 | README:67-68 | 63 ui primitives, 18 AI components | `registry/ui` 63 items (0 with files); `registry/ai` 18 |
| 3 | README:22-25 | GitHub path works except `reasoning`, `tool`, `chat` | only those three have `@uifiles/*` registryDependencies |
| 4 | README:31-35 | CLI adds two imports + `.katex-display`; `@source` manual | `response › css` keys: `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"`, `@layer base`; no `@source` key |
| 5 | README:49-52 | CI order: registry:build → test:coverage → build → diff check → e2e → audit | `ci.yml:54-63` |
| 6 | README:54-57 | Vercel origin derived; localhost build fails there, warns elsewhere | `lib/registry.ts:134-157` |
| 7 | AGENTS stack | Next 16, React 19, TS 7, Tailwind 4, shadcn 4, Vitest 5, Playwright, Base UI | package.json: 16.3.6, 19.3.0, ^7.0.2, ^4, ^4.21.0, ^5.0.2, ^1.63.0, @base-ui/react ^1.8.0 |
| 8 | AGENTS:33 | e2e row: titles, no sideways scroll, branch HTML, response formula | `e2e/previews.spec.ts:44-56,57-90` |
| 9 | AGENTS:34 / CONTRIBUTING:41 | `gate` = format:check → lint → typecheck → registry:validate → test → build | `package.json` `gate` script |
| 10 | AGENTS layout | `lib/registry.ts` `baseUrl()` order and failure modes | `lib/registry.ts:124-159` |
| 11 | AGENTS layout | five client previews titled by a sibling `layout.tsx` | `app/preview/{chain-of-thought,chat,confirmation,prompt-input,reasoning}/layout.tsx` |
| 12 | AGENTS layout | browser tests: one per item plus `blocks/chat`, `theme`, `tokens`, `button`, `a11y-helper` | `ls tests/browser` matches exactly |
| 13 | AGENTS rules | upstream lock keys equal the 18 shipped items; `branch`/`response` name `upstream: message` | node check: 18 = 18, `branch<-message`, `response<-message` |
| 14 | AGENTS rules | `--radius` light-only; reduced-motion guard mirrored in base `css` | base `cssVars.dark` has no `radius`; base `css["@layer base"]` has `@media (prefers-reduced-motion: reduce)`; `globals.css:145` |
| 15 | AGENTS rules | `input-group` fades on any disabled descendant | `components/ui/input-group.tsx` has `has-disabled:opacity-50` |
| 16 | AGENTS tests | viewport 414×896, 15 s timeout | Vitest 5: `testTimeout ??= resolved.browser.enabled ? 15e3 : 5e3`; browser default viewport 414×896 (not overridden in `vitest.config.ts`) |
| 17 | AGENTS tests | coverage thresholds 80/80/70 per file over `registry/**`, `lib/**`, preview pages excluded | `vitest.config.ts:59-64` |
| 18 | AGENTS tests | two Playwright projects, 375×812 mobile, CI `retries: 1`, `workers: 2`, trace on first retry | `playwright.config.ts:9-31` |
| 19 | AGENTS CI facts | Playwright browsers cached at `~/.cache/ms-playwright` keyed by version; every action SHA-pinned | `ci.yml:38-53`; `uses:` lines carry SHA `# vN` |
| 20 | AGENTS | `.mcp.json` pins `shadcn@4`; skills `shadcn`, `migrate-radix-to-base`, `ai-elements`, `ai-sdk` from `skills-lock.json` | `.mcp.json`; `ls .claude/skills` |
| 21 | CONTRIBUTING:52-54 | typecheck with the three strict flags | `tsconfig.json:8-10` |
| 22 | CHANGELOG:60-65 | token values 0.53 / 0.52 / 0.74 / 0.64 | `globals.css:68,71,106,74` |
| 23 | CHANGELOG:34-35 | `CodeBlockLanguageSelector` generic; `ModelSelectorLogo` `src` | `code-block.tsx:720-724`; model-selector `src` (round 3 verified) |
| 24 | CHANGELOG:85-87 | reasoning renders through `MessageResponse`, depends on `@uifiles/response` | `reasoning.tsx:23,250`; manifest `registryDependencies` |
| 25 | architecture §2 | base `css` hand-kept, `cssVars` generated | `sync-tokens.ts` writes only `cssVars`; base `css` keys `*`, `body`, `html`, `@media` |
| 26 | architecture §3 | AI Elements: 33 `asChild` uses across 16 components, 6 controllable-state imports; 49 components | upstream clone: 35 grep hits − 2 `hasChildren` false positives = 33 across 16 files; 6 files; 49 `src/*.tsx` |
| 27 | architecture §3 branch | lazy/memo/forwardRef resolved; clamp reported once under StrictMode | `branch.tsx:70-90,142-152` (verified by rb/dpp verifiers) |
| 28 | architecture §5 | drift script exits 0/1/2 | `scripts/sync-upstream.ts:93` |
| 29 | architecture §5 | unit invariants "in both directions" for items that ship files; no repeated css rule | `registry.test.ts:458-460,542` |
| 30 | porting §0 | lock entry `{ source, sha256, fetchedAt, upstream? }`, source host `elements.ai-sdk.dev/api/registry/` | node check of `branch` and `tool` entries |
| 31 | porting §1 | every `registry/ai/*.tsx` starts with the two-line Apache header | loop over 18 files: none missing |
| 32 | SKILL.md:36-45 | targets `components/ai/`, `components/blocks/`, `lib/`, `app/chat/`; css via `response`; `questionnaire`, `alert-dialog`, `field`, `input-group`, `button-group` exist | manifest targets; `registry/ui` contains all five |

Wording notes, not contradictions: architecture §2 and porting §2 say `shiki@^4` where the manifest pins `shiki@^4.4`; the base item's description says `shadcn init @uifiles/base` while README uses `init https://uifiles.dev/r/base.json` (both valid once listed). The `AGENTS.md` copy injected into this session at launch was stale (old "Markdown needs CSS" wording); HEAD's file is byte-identical to `5f37284` (md5 `fecc1735…`) and carries the round-3b wording, so no action.

## 5. Gate on HEAD `9019bdf` (`critic/gate-summary.txt`)

```
format:check exit=0   lint exit=0   typecheck exit=0   registry:validate exit=0
unit    exit=0   Test Files 8 passed (8)    Tests 335 passed (335)
browser exit=0   Test Files 23 passed (23)  Tests 903 passed (903)
playwright test --list: Total: 96 tests in 3 files
git status after: 0 lines
```

Additionally (CI's real test step, which no round ran after the round-3 code growth): `pnpm test:coverage` exit 0, `31 files / 1238 tests`, per-file thresholds hold; lines 98.86 %, functions 97.03 %, branches 93.34 %. Lowest branch figures among the files round 3 grew: `code-block.tsx` 87.25, `registry.ts` 88.09, `response.tsx` 91.11, `prompt-input.tsx` 92.19. `pnpm audit --prod --audit-level=high`: "No known vulnerabilities found". No failure to report verbatim.

## 6. shadcn directory requirements (reasoned from source and scripts; build forbidden)

- Root `registry.json`: `name: "uifiles"`, `homepage: https://uifiles.dev`, `$schema`, `include` of 7 files; the three empty ones (`components`, `hooks`, `lib`) are valid `{ items: [] }`. `shadcn registry validate` passes (exit 0, "8 registry files and 83 items" per the fixers; my run exit 0).
- 83 items = 1 base + 63 ui + 18 ai + 1 block; names flat and unique (unit test); every item has `title`, `description` (≤ 900 chars, pinned), `categories`; every file has `path`/`type`/`target`; the block's `registry:page` and `registry:lib` files have explicit targets; `response › css` validated by `registryItemSchema`.
- Requirement 4 (index must carry no `files[].content`): satisfied by `shadcn build` itself (round 1 F0, re-verified on the built output in rounds 2 and 3); `registry:build` = sync-tokens → validate → build, run by `pnpm build` on Vercel and in CI.
- Health monitor dry-runs with `radix-vega`; the AI items are Base-UI-only, which every `docs` string states first ("Built for the Base UI styles (base-nova)…"). That is a consumer caveat, not a validation failure.
- Nothing in the source registry or `scripts/` would fail `registry validate` or the directory's rules. What remains is environmental: the public repo, `https://uifiles.dev/r/*.json` served as `application/json`, and the entry JSON (validated in round 1 against `registryDirectoryEntrySchema`; placeholder `logo`/`author` to replace).

## 7. Maintainer checklist (what no reviewer could reach)

1. Stop the stale `pnpm start` on :3000; `pnpm gate` and `pnpm test:e2e` on a clean clone with a cold `node_modules/.vite` (96 e2e expected; see Blocking 2).
2. Real CLI round trip after `registry:build` + `dev` (Blocking 3); also `pnpm dlx shadcn@latest add @uifiles/<name> --dry-run` for a sampled ui alias and for `chat` from a scratch Next project.
3. Tag `v0.1.0` (Blocking 1); CHANGELOG dates it 2026-09-26.
4. Vercel env and post-deploy curls (Blocking 4); the build-time `baseUrl()` warning is only visible in the `next build` log.
5. Directory PR (Blocking 5).
6. `pnpm registry:sync` once with network to confirm the 9 newer `registry:ui` names (`attachment bubble combobox direction marker message message-scroller questionnaire toast`) against the live shadcn index, and `node scripts/sync-upstream.ts` to confirm the lock hashes against `elements.ai-sdk.dev` (both hosts blocked here).
7. Repo settings: private vulnerability reporting (SECURITY.md links `security/advisories/new`), branch protection requiring `gate`; expect the first Dependabot action bump to pass now that `workflows.test.ts` accepts `# v5.0.1`.
8. Manual checks nobody could do: a screen reader over the pinned citation dialog, the checkpoint description and the response "Code/Table/Math" groups; Safari/Firefox (`URL.canParse` avoided, `<dialog>`/`showModal()` and `field-sizing-content` are the Safari-sensitive bits); real touch hardware (coarse-pointer queue actions, citation tap); forced-colors mode.
9. `rmdir tests/browser/qa-round2` before the PR (§3).

## 8. Fresh look: `prompt-input`, `queue`, `image` (picked by `shuf`)

- **N15 (low) `prompt-input.tsx`: in provider mode a second submit that lands during the first submit's blob conversion re-sends the draft text.** `handleSubmit` captures `text = controller.textInput.value` (`:909-910`) and clears the provider text only in `commit()` after `onSubmit` resolves (`:945-947`); local mode resets the form immediately (`:918-920`). Probe (`critic/probe-provider-double-submit.log`): local mode gives `[{ files: ["once.txt"], text: "hi" }, { files: [], text: "" }]` (the pinned contract, `prompt-input.test.tsx:866`); provider mode gives `[{ files: ["once.txt"], text: "hi" }, { files: [], text: "hi" }]`. The shipped `chat` block does not use `PromptInputProvider` (grep: no hit), so only consumers composing the provider themselves with attachments hit it; the docs sentence (9) "never sends the same file twice" stays true. Upstream has the same shape. Proposed: snapshot and clear the provider text at submit time (restore it on rejection as the local path does), and add the provider case to the double-submit test.
- **N16 (low, inherited) `prompt-input.tsx:1545-1549`: `PromptInputSubmit` is named "Stop" while `status` is submitted/streaming even when no `onStop` is passed, yet stays `type="submit"`** (test `:2177` pins that it still submits). A screen-reader user hears "Stop", presses it, and sends a message (WCAG 4.1.2 name/value). Proposed: name it "Stop" only when `onStop` is wired (the same condition that flips the `type`).
- `queue.tsx`: nothing beyond the accepted hover-only mirror residual; `QueueSectionLabel` renders `{count} {label}` with a leading space when `count` is undefined (cosmetic; the trigger name is pinned).
- `image.tsx`: nothing (props stripped before spread, `alt` required, `mediaType` fallback, all pinned).

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
critic/gate.sh            # format:check, lint, typecheck, registry:validate, vitest unit, vitest browser, playwright --list
pnpm test:coverage        # 31 files / 1238 tests, thresholds hold; coverage/ removed afterwards
pnpm audit --prod --audit-level=high
git status --porcelain; git diff 86bbd82 --stat; git diff 86bbd82 --name-status -- <special paths>; git diff 5f37284 HEAD --stat
find tests e2e app registry -name 'zz-*' -o -name '_verify*' -o -name '__screenshots__' ...
grep/sed/node one-liners over lib/registry.ts, .github/workflows/*.yml, registry/*/registry.json, registry/ai/*.tsx, components/, app/globals.css, tests/, e2e/, package.json, vitest.config.ts, playwright.config.ts, tsconfig.json, node_modules/vitest (defaults), scratchpad/upstream/ai-elements (counts)
pnpm exec vitest run --project browser tests/browser/zz-critic-probe.test.tsx   # written, run once, deleted; git status clean
```
