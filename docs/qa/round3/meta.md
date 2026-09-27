# meta — QA round 3

Scratch: `/docs/qa/round3/meta/`
(logs named below are relative to it). Tree at `9857827`, clean at start; the production server
on :3000 serves the current build (`BUILD_ID 8rHfk02_cIu5NBIzviWb2`, 01:23:54; both stylesheets
200, 153 544 and 3 701 bytes; `public/r/registry.json` 01:23:44, after the last manifest edit at
01:16:41). Reproducers: `tests/unit/qa-round3-meta.test.ts` (6 tests: 3 fail on real defects, 3 pin
correct behaviour; identical 3/3 runs; Prettier, Biome and `tsc` clean).

## Summary

Attacked everything that is not a component: the two workflows and Dependabot (parsed and
mutated), `vitest.config.ts` and the console guard (unit-level and with a throwaway browser probe),
the Playwright config, helpers and specs (a full 88-test run on both projects against the
production server, a `CI=1` simulation with and without the public origin, and a probe of what a
blocked request looks like), the built output through the CLI's zod schemas and byte-for-byte
against the source tree, the CLI's placement and import-rewrite code for the `registry:lib` file,
every doc claim against the code, the licence files, and 20 in-place mutations.

Findings: 0 blocker, 0 high, 2 medium, 4 low, 3 nits. Every round-2 meta finding is fixed except
two partials: the console guard's spy detection (F5) is real for a live spy but is bypassed by
`afterEach(() => vi.restoreAllMocks())`, which 16 of the 23 browser test files register, and by an
explicit `mockRestore()`; and 5 of 19 preview pages (the client ones) still have no title. The
single worst thing: **the guard's documented guarantee ("`mockImplementation` is not an opt-out")
is false in most of the suite**, because Vitest runs `afterEach` hooks in reverse registration
order and the guard's hook (from the setup file) therefore runs after the file's own restore.
Second: **the first Dependabot bump of any pinned action will turn CI red**, because Dependabot
rewrites `# v5` to the most specific tag (`# v5.0.1`) and `workflows.test.ts` only accepts
`# v<major>`. Neither touches consumers, the build, or the directory listing.

Everything a consumer or the directory sees is clean: index and 83 items pass `registrySchema` /
`registryItemSchema`, `public/r` content is byte-identical to the source files (the only
difference is key order inside `base.config`), every description is under 900 characters, every
`docs` is one paragraph with balanced quotes and backticks, `tsc`/Biome/Prettier/`pnpm audit` are
clean, the unit project is 296/296, and the e2e suite is 88/88 in 1.2 min with no retry.

Verdict: **ship** from this lens; the two mediums go in the first follow-up PR (see Verdict).

## Fix verification

| round-2 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| F1 built-output checks skipped in CI | `pnpm registry:build` before `test:coverage`; `skipIf(!built && !inCI)` + `expectBuilt()` | yes | `ci.yml:52-55`; `registry.test.ts:445-509`; `tooling.test.ts` child Vitest without `public/` (`CI=true` → `2 failed` with the message, `CI=""` → skipped) green in 3 runs; mutation M5 (build after tests) caught. `vitest run --coverage` does not rebuild `public/r` (nothing in the config or setup does), and the `git diff --exit-code -- registry` step after `pnpm build`'s second `registry:build` is still meaningful: `sync-tokens` is idempotent, so any regenerated `registry/base/registry.json` shows up there whichever run wrote it (the tree here has it committed: `git status` clean after the lead's 01:23 build) |
| F2 `optimizeDeps.include` gaps and re-bundle | `react-dom/client|server` listed, guard exemption narrowed to `^vitest(\/browser)?$` | yes | independent diff over every quote style, dynamic and CSS imports (`node -e` script in Commands run): `registry` 0 gaps, `components` 0, `tests/browser` only `vitest`, `vitest/browser`; no include entry is unused; `app/**` imports only `next/*` and stylesheets, which no browser test reaches. The wall-clock `toBeLessThan(300)` assertions are gone from `prompt-input.test.tsx` (only a busy-wait helper at :81 remains) |
| F3 `NEXT_PUBLIC_BASE_URL` unguarded | `workflows.test.ts` asserts the parsed env; `e2e/origin.ts` throws in CI | yes | mutations M17 (localhost value) and M13 (throw removed) caught; live: `CI=1` without the variable → `registry.spec.ts` fails 2/5 with "NEXT_PUBLIC_BASE_URL is not set: CI must set it for the whole job" (`e2e-ci-noorigin.log`); with `https://uifiles.dev` the no-localhost assertions are live and fail against the localhost build here (`e2e-ci-origin.log`) |
| F4 / rendered N7 `models.dev` in the gate | `blockExternalRequests` aborts non-loopback hosts; preview hermetic with `src` data URIs | yes | probe (`e2e-probe.log`): `<img src="https://models.dev/...">` → `console.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector`, `fetch("https://example.com/")` rejects and logs the same, a same-origin `/logos/does-not-exist.svg` → `404 (Not Found)` error, a `data:` image loads; `app/preview/model-selector/logos.ts` inline SVG data URIs; full run: `preview/model-selector` passes in all four project×scheme cells |
| F5 guard charges unmount output to the next test; spy detection | `cleanup()` inside the guard's `afterEach`; `stop()` recovers `mock.calls` | **partial** | cleanup order right (`console-guard.ts:137-149`, unit test); a live swallowing spy is caught in the browser (probe A1: "swallowed by a mock implementation"); **but** with the file's `afterEach(() => vi.restoreAllMocks())` (probe B1) or an explicit `spy.mockRestore()` (B2) the same test passes and the component's `console.error` is never reported → new F1 |
| F6 stale `docs/plan.md` reference | scan extended to app/components/e2e/lib/scripts/tests | yes | `grep -rn plan.md` over the tree: only `site.test.ts` (asserts absence) |
| F7 `waitForIdle` fixed sleep | poll on `aria-busy` then on expanded "Thought for" buttons | yes | `e2e/helpers.ts:97-107`; probe: 33 ms on `/` (never busy), 4 349 ms on `/preview/chat` (`aria-expanded="false"` afterwards); a permanently busy region fails deterministically at the 30 s `toHaveCount(0)` |
| F8 / rendered N9 preview titles | owners add `metadata` | **partial** | served titles: 14/19 carry "<Name> · uifiles"; `chain-of-thought`, `chat`, `confirmation`, `prompt-input`, `reasoning` still `<title>uifiles</title>` (all five are `"use client"` pages) → F3 below |
| F9 `pnpm audit` first | last, still hard | yes | `ci.yml:61-63`; M19 (`continue-on-error`) caught; `pnpm audit --prod --audit-level=high` clean here |
| F10 YAML asserted by text layout | parsed with `yaml` | yes, with a new gap | M4 (comment + blank line inside `permissions`) is tolerated; M3 (job-level `permissions`), M5, M16, M17, M19 caught; the one remaining text regex (the `# vN` comment) rejects `# v5.0.1` → F2 below |
| F11 `demo-conversation.ts` typed `registry:component` | `registry:lib` | yes | CLI source (sparse clone): `update-files.ts:386-441` returns the explicit `target` before `resolveFileTargetDirectory`; `add-components.ts:228-240` groups by `getTargetAliasKey(target)` (null for `lib/…`) then `FILE_TYPE_TO_CONFIG_KEY["registry:lib"] = "lib"`, the same config outside a monorepo; `transform-import.ts` rewrites `@/registry/(.+)/lib` → `config.aliases.lib`, so `@/registry/blocks/chat/lib/demo-conversation` → `@/lib/demo-conversation`; built `chat.json` shows `lib/demo-conversation.ts [registry:lib] -> lib/demo-conversation.ts`; M6 caught |
| F12 appendix count / `question` row | 49; row added | yes | `ls upstream/ai-elements/packages/elements/src/*.tsx | wc -l` = 49; `docs/architecture.md:88` |
| F13 `robots.txt` Host is an origin | `new URL(baseUrl()).host` | yes | M7 caught; served `/robots.txt` 200 |
| F14 README e2e sentence | rewritten | yes | `README.md:45` |
| F15 `next` exempt everywhere in the import scanner | page-only | yes | `registry.test.ts:73-95` and its synthetic test |
| rendered N1 home `<pre>` scroll region; mobile project | `whitespace-pre-wrap break-words`; `chromium-mobile` 375×812 | yes | M8 caught; M10 (390 px) caught; e2e mobile axe passes on `/` and `/preview/response` (`e2e-full.log`) |
| rendered N8 localhost warning off Vercel | `console.warn` once when `NODE_ENV=production`, local origin, no `VERCEL` | yes, test partly vacuous | M14 caught; M1 (warn on Vercel too) **survived** → F4 below |
| Requests for other owners (round-2 fix reports) | | honoured except two | prompt-input-chat: architecture wording and manifest strings present (`docs/architecture.md` §3, `registry/ai/registry.json` › prompt-input (9), `registry/blocks/registry.json` › chat). ccmc: §3 context/model-selector/inline-citation wording, code-block preview split, route block, `role="group"` in response docs: done. disclosure: guard "replaced" branch done; registry strings (queue/reasoning/checkpoint/confirmation/tool) present; chat "Pending" pin and `tooltip.tsx` prop are the owners' calls. leaves-tokens: suggestion split done; `ssr.test.ts` branch assertion not added (a `tests/unit/branch.test.ts` exists instead); `components/ui/button.tsx` destructive focus border still an open owner decision. meta: model-selector hermetic (done); `context.test.tsx` timeouts not reproduced in the lead's green suite |

## Findings

### F1. The console guard is bypassed by the cleanup idiom most browser test files use — severity: medium

- Where: `tests/console-guard.ts` `registerConsoleGuard` (`:137-149`) and `stop()` (`:80-123`); `tests/setup.ts:38-41`; 16 of 23 browser test files register `afterEach(() => vi.restoreAllMocks())` at module level (`grep -l restoreAllMocks tests/browser/**/*.tsx`); `AGENTS.md` › Tests › "Console must be clean" ("`vi.spyOn(console, "error").mockImplementation(() => {})` is not an opt-out"); `CHANGELOG.md` ("a fail-on-console guard that mock implementations cannot bypass").
- What: Vitest's default `sequence.hooks` is `"stack"` (`node_modules/vitest/dist/chunks/index.C-uw7tH9.js:14600`: `resolved.sequence.hooks ??= "stack"`): `afterEach` hooks run in reverse registration order. The guard's `afterEach` is registered by the setup file, before anything in the test file, so it runs last. A test file's `afterEach(() => vi.restoreAllMocks())` therefore runs first, puts the guard's wrapper back, and the swallowed calls leave with the spy; `stop()` then sees `current === wrappers[level]`, recovers nothing and passes. An explicit `spy.mockRestore()` at the end of a test does the same.
- Evidence: browser probe (`guard-probe.log`, file deleted): A1 swallowing spy without restore → **fails** as designed with "console.error (swallowed by a mock implementation): effect noise from a component"; B1 the same spy plus `afterEach(vi.restoreAllMocks)` → **passes**, nothing reported; B2 `spy.mockRestore()` at the end → **passes**; B3/C1 controls (plain `console.error`, React's missing-key warning) → fail as designed. Unit reproducer models the hook order exactly and fails: `qa-round3-meta.test.ts` › "still charges the calls a swallowing spy hid when the test file restores mocks in its own afterEach".
- What it is not: no browser test does this today (every `spyOn(console, …)` in `tests/browser` is a pass-through spy, and every `mockImplementation` is on `video`, `document` or `navigator`), so the current suite hides nothing. It is the documented guarantee and the round-2 fix (F5 "spy detection") that are hollow for 16 files.
- Why it matters: the "logs nothing" rule is what caught the hydration and key warnings in round 1; the next contributor who follows the ubiquitous `afterEach(restoreAllMocks)` pattern can silence React errors with one line, and the doc tells them they cannot.
- Proposed fix (pick one, then correct the two sentences): (a) a static check in `tests/unit/test-setup.test.ts` that fails on `spyOn(console, "error"|"warn")` followed by `.mockImplementation` anywhere under `tests/browser/**` (the fixer's own alternative; exact, cheap, catches the bypass at review time); (b) `sequence.hooks: "list"` in `vitest.config.ts` so the setup file's `afterEach` runs first (trade-off: output logged by a file's own `afterEach` then escapes); (c) a guard-side fix that survives a restore (keep a `Set` of every wrapper the guard has installed and, in `stop()`, walk `target[level]`'s spy chain before the file's hooks can run — not possible from `afterEach` alone). Whatever is chosen, reword AGENTS.md and the CHANGELOG line: the guard sees a mock implementation only while the spy is still installed when the test ends.
- Test written: the unit reproducer above (FAIL now); `qa-round3-meta.test.ts` also pins the runner-independent facts the guard relies on.

### F2. The first Dependabot bump of a pinned action fails `workflows.test.ts` — severity: medium

- Where: `tests/unit/workflows.test.ts:56-73` `expectPinnedActions`: `new RegExp(\`uses: ${ref} # v\\d+\\s*$\`, "m")` (its comment says "Dependabot keeps the comment in step with the SHA"); `.github/dependabot.yml` (`github-actions`, weekly); the six `uses:` lines carry `# v4`/`# v5`/`# v8`.
- What: Dependabot rewrites the version comment to the most specific tag of the new SHA. `dependabot-core` `VersionCommenter#updated_comment` (`dependabot-version_commenter.rb:21-27`): `new_version_tag = git_checker.most_specific_version_tag_for_sha(new_ref)`; `GitCommitChecker#local_tags_matching_sha` sorts the tags by version and `most_specific_version_tag_for_sha` returns the last (`dependabot-git_commit_checker.rb:306-311, 433-436`); `GithubActions::Version` strips the `v` (`version.rb:27`), so for a SHA tagged both `v5` and `v5.0.1` the comment `# v5` becomes `# v5.0.1` (`comment.gsub("5", "5.0.1")`). `workflows.test.ts` rejects that line, so the Dependabot PR is red until someone hand-edits the comment back to `# v5`, which the next bump undoes again.
- Evidence: mutation M20 (`# v5` → `# v5.0.1` on the checkout line): "pins every action to a full commit SHA with its version in a comment" fails. Reproducer runs `workflows.test.ts -t "pins every action"` in a mirrored repo with that one edit and expects exit 0: `qa-round3-meta.test.ts` › "accepts a full-version comment such as `# v5.0.1` next to a pinned SHA" (FAIL now).
- Why it matters: the repo advertises Dependabot-maintained SHA pins in `CHANGELOG.md`, `AGENTS.md` and `docs/architecture.md` §5; the first weekly action update contradicts it in CI.
- Proposed fix: `# v\\d+(?:\\.\\d+){0,2}\\s*$` (a tag, not only a major), and say so in the helper's comment. Optionally assert the comment's major equals the tag the SHA resolves to — that needs the network, so leave it to the review.

### F3. Five preview pages still have no document title (round-2 F8/N9 carried over) — severity: low

- Where: `app/preview/{chain-of-thought,chat,confirmation,prompt-input,reasoning}/page.tsx` (`"use client"`, no sibling `layout.tsx`); `app/layout.tsx` title template `%s · uifiles`.
- Evidence: served `<title>` per page (`curl`): 14 read "<Name> · uifiles", these five read "uifiles". Reproducer: `qa-round3-meta.test.ts` › "every preview route sets a title: the page exports metadata, or a layout beside a client page does" (FAIL now).
- Proposed fix: either split them as `code-block`/`suggestion`/`model-selector` were, or add `app/preview/<name>/layout.tsx` with `export const metadata = { title: "<Name>" }` and `children` pass-through (a server layout may export metadata beside a client page). While there, unify casing: `Inline citation` and `Model selector` next to `Code Block`.

### F4. `site.test.ts`'s "stays silent on a Vercel preview build" cannot fail — severity: low (test quality)

- Where: `lib/registry.ts:120` module-level `warnedLocalProductionBuild`; `tests/unit/site.test.ts` › "warns once, without throwing…" (trips the flag) followed by › "stays silent for a production build with a public origin, and on a Vercel preview build".
- What: after the first test has warned, the flag is `true` for the rest of the file, so the second test's `expect(warn).not.toHaveBeenCalled()` holds whatever the condition says; the `!env.VERCEL` guard is untested.
- Evidence: mutation M1 (drop `!env.VERCEL &&`): `site.test.ts` 40/40 passed. Pin written with a fresh module per call: `qa-round3-meta.test.ts` › "stays silent for a Vercel preview build that advertises localhost, and warns off Vercel" (PASS; catches M1).
- Proposed fix: import `lib/registry` freshly in those two tests (`vi.resetModules()` + dynamic import), or move the flag into a small exported reset for tests.

### F5. Exporting the `.env.example` value in the shell makes local e2e fail against a correct build — severity: low

- Where: `e2e/origin.ts:31-33` `expectsPublicOrigin` (true whenever `NEXT_PUBLIC_BASE_URL` is set, even to localhost); `e2e/registry.spec.ts:49,114`; `.env.example` sets `NEXT_PUBLIC_BASE_URL=http://localhost:3000`.
- What: `.env.local` is read by `next` only, so copying the example is harmless; but `NEXT_PUBLIC_BASE_URL=http://localhost:3000 pnpm test:e2e` (or an exported shell variable) turns on `not.toContainText("localhost")` against a page that correctly prints localhost. `tooling.test.ts` even pins `expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: "http://localhost:3000" }) === true`.
- Proposed fix: `expectsPublicOrigin` = CI, or the variable set to a non-loopback origin (reuse `isLocalRequest`); adjust the pin.

### F6. Nothing outside Playwright asserted that `gotoHydrated` installs the route block — severity: low (test gap, now pinned)

- Evidence: mutation M9 (drop `await blockExternalRequests(page)` from `gotoHydrated`): `tooling.test.ts` + `site.test.ts` 57/57 passed; the e2e suite would also pass wherever `models.dev` is reachable. Pin written with a fake page: `qa-round3-meta.test.ts` › "installs the external-request block before the first navigation, aborting only foreign hosts" (PASS; catches M9). Migrate it into `tooling.test.ts`.

### Nits

- N1 `NOTICE:8-11` wraps mid-sentence ("Files / under registry/ai/ / are derived from AI Elements"): reflow.
- N2 Preview title casing: "Inline citation", "Model selector", "Response" (item title "Message Response") vs "Code Block".
- N3 `AGENTS.md` and `CHANGELOG.md` sentences about the guard (part of F1's fix).

## Mutation log

All in place, restored from a byte copy and `cmp`-verified (`mutate.sh`; `git status` clean after the series).

| # | behaviour | mutation | test file | caught? |
| --- | --- | --- | --- | --- |
| M1 | production warning only off Vercel | `lib/registry.ts` drop `!env.VERCEL &&` | site | **NO** (40 passed) → F4 |
| M2 | route block keeps only loopback | `e2e/origin.ts` `hostname.includes("localhost")` | tooling | yes |
| M3 | least-privilege token | `ci.yml` job-level `permissions: contents: write` | workflows | yes |
| M4 | parsed YAML tolerates reflow | `ci.yml` comment + blank line inside `permissions` | workflows | not caught, as intended (14 passed) |
| M5 | registry built before the tests | `ci.yml` `registry:build` after `test:coverage` | workflows | yes |
| M6 | file type by target | `registry/blocks/registry.json` `registry:component` | registry | yes |
| M7 | robots Host is a host name | `app/robots.ts` `host: baseUrl()` | site | yes |
| M8 | install `<pre>` wraps | `app/page.tsx` `overflow-x-auto` added | site | yes |
| M9 | e2e blocks external requests | `e2e/helpers.ts` `gotoHydrated` without `blockExternalRequests` | tooling + site | **NO** (57 passed) → F6 |
| M10 | phone-width project | `playwright.config.ts` viewport 390 | tooling | yes |
| M11 | drift exit codes | `scripts/sync-upstream.ts` 1↔2 | tooling | yes (3 tests) |
| M12 | swallowed calls recovered | `tests/console-guard.ts` `hidden.slice(0, 0)` | test-setup | yes (2 tests) |
| M13 | CI fails without the origin | `e2e/origin.ts` `if (false)` | tooling | yes |
| M14 | every loopback spelling refused | `lib/registry.ts` drop `0.0.0.0` | site | yes |
| M15 | llms.txt carries descriptions | `app/llms.txt/route.ts` description dropped | site + registry | yes |
| M16 | drift issue only on exit 1 | `upstream-diff.yml` `!= '0'` | workflows | yes |
| M17 | public origin in CI | `ci.yml` `NEXT_PUBLIC_BASE_URL: http://localhost:3000` | workflows | yes |
| M18 | namespaced sibling deps | `registry/ai/registry.json` `tool` → bare `code-block` | registry | yes (2 tests) |
| M19 | audit is a hard failure | `ci.yml` `continue-on-error: true` on audit | workflows | yes |
| M20 | pin comment shape | `ci.yml` `# v5` → `# v5.0.1` | workflows | yes — and should not be → F2 |

`vitest.config.ts` was not mutated in place (another lens was running browser tests; a config
change re-keys the shared Vite cache); the round-2 fixer's `react-dom/server` mutation stands and
the independent specifier diff above covers the same invariant.

## Test-quality issues (file › test name → problem)

- `tests/unit/site.test.ts` › "stays silent for a production build with a public origin, and on a Vercel preview build" → order-dependent and vacuous after "warns once…" (F4).
- `tests/unit/workflows.test.ts` › "pins every action to a full commit SHA with its version in a comment" → rejects the comment Dependabot writes (F2); otherwise load-bearing (M3, M5, M16, M17, M19 caught; M4 reflow tolerated).
- `tests/unit/tooling.test.ts` › "expectsPublicOrigin is true in CI and whenever the origin is set" → pins the localhost footgun (F5).
- `tests/console-guard.ts` + `tests/unit/test-setup.test.ts` → every unit test drives the hooks in the order the guard needs, none in the order Vitest uses (F1); the browser probe is the only place the real order was exercised.
- `tests/unit/registry.test.ts` › `describe("built output")` → correct now; note that with `CI` set and `public/r` present the two checks are only as good as the last `registry:build`, which CI guarantees.
- Names, fixtures, no `skip`/`only`, no sleeps: clean across the six canonical files; each passed 3/3 (`canonical-run{1,2,3}.log`: 132 passed, 4.3–5.2 s). The e2e suite ran 88/88 in 1.2 min with `retries: 0`, no flake (`e2e-full.log`).

## Verified OK

- Built output: `public/r/registry.json` passes `registrySchema`, all 83 `<name>.json` pass `registryItemSchema`, names unique and flat, no extra files, index has no `files[].content`; every built file `content` equals the source file on disk and every metadata field equals the manifest (only `base.config` key order differs); `chat.json` files: `components/blocks/chat.tsx [registry:component]`, `lib/demo-conversation.ts [registry:lib]`, `app/chat/page.tsx [registry:page]` (`validate-built.log`, `built-vs-source.log`).
- Registry strings: longest description 706 (prompt-input); every `docs` is one paragraph with balanced `"` and `` ` ``; every `docs` starts with the Base UI sentence; file references in `docs` are consumer paths (`globals.css`, `katex/dist/katex.min.css`, `app/chat/page.tsx`) or upstream names (`message.tsx`); the `**:data-[slot=input-group]:h-auto!` in model-selector is a Tailwind class, not markdown.
- CI wiring: order install → format → lint → typecheck → registry:validate → Playwright cache → `registry:build` → `test:coverage` → `build` → `git diff --exit-code -- registry` → `test:e2e` → `audit`; `permissions: contents: read` at workflow level only; concurrency per ref; `timeout-minutes: 30`; `env.CI`/`NEXT_PUBLIC_BASE_URL` at workflow scope with no override; upload on failure with `if-no-files-found: ignore`. `upstream-diff.yml`: `set +e` capture, `$GITHUB_OUTPUT`, issue only on `== '1'`, label create-or-comment, `issues: write`. Dependabot: weekly actions and npm, npm minor/patch grouped. Issue forms, PR template, CODEOWNERS present and well-formed.
- `tsc --noEmit` exit 0, `biome check` 146 files clean, `prettier --check` clean, `pnpm audit --prod --audit-level=high` clean, unit project 8 files / 296 tests green (`gate-checks.log`, `unit-run1.log`).
- Console guard (live spy path): a swallowing spy without restore, a plain `console.error`, and React's missing-key warning all fail the test with the right message; `allowConsole` scoping per `start()/stop()` window; `cleanup()` before `stop()` in a `try/finally`.
- e2e helpers: `isLocalRequest` keeps `localhost`, `*.localhost`, `127.0.0.1`, `[::1]` and blocks everything else; `publicOrigin` throws in CI without the variable; the mobile project is `Desktop Chrome` at 375×812 (no touch emulation, so `pointer-coarse` styling is not exercised there; noted, not a defect); `--list` = 88 tests.
- Site shell on the server: `/` 200, `/preview/chat` 200, `/llms.txt` 200 `text/plain`, `/robots.txt` 200, `/r/registry.json` 200 `application/json`, `/nope` 404.
- Docs vs code: README/AGENTS/CONTRIBUTING/architecture agree on commands, the CI order, coverage thresholds (80/80/70 per file over `registry/**` and `lib/**`), the e2e projects, the route block, the lock structure and exit codes; counts 63 ui / 18 ai / 49 upstream match; token values in the CHANGELOG match `registry/base/registry.json` (light `--muted-foreground` 0.53, light `--ring` 0.64, `--destructive` light 0.52 / dark 0.74); CHANGELOG has no internal jargon and its link refs point at `v0.1.0`; `.env.example` describes the real behaviour; `.mcp.json` pins `shadcn@4`; `.gitignore` covers `public/r`, `.env*` (keeps the example), `.vitest`, reports, coverage; `skills/uifiles/SKILL.md` allowed-tools equal the shadcn skill's and it names only existing commands.
- Licensing: `LICENSE` is the SPDX MIT text; `licenses/APACHE-2.0-ai-elements.txt` = copyright/notice header + the full Apache-2.0 text (identical to the canonical text from line 7; round 2's "byte-identical to the `ai` package's LICENSE" was wrong — that file is a 12-line notice — but the repo's copy is the right thing); `NOTICE` names `registry/ai/`, `components/ui/`, `.claude/skills/` and each skill's source and licence; the vendored skills are tracked (157 files) and excluded from Prettier, Biome and tsc.
- Leftover grep (excluding node_modules/.next/public/r/coverage): `qa-round|round 1|round-1|round 2|round-2|fixer|QA|TODO|FIXME|.only(|.skip(|plan.md|LICENSE-ai-elements|#v1.0.0|references/|Streaming input` → only CLI `console.log` calls in `scripts/*` (their output), a `console.log(greeting)` inside a code sample in `code-block.test.tsx`, the `[stub]` logger in `tooling.test.ts`, and `site.test.ts` lines that assert the absence of the retired strings. `localhost:3000` in docs: README/CONTRIBUTING/AGENTS `pnpm dev` lines and the documented `components.json` round-trip mapping only.

## Could not reach

- GitHub Actions itself and Dependabot's live behaviour (reasoned from `dependabot-core` source fetched at `main`); `https://uifiles.dev` (proxy); Vercel.
- A real mid-run Vite re-bundle (the round-2 fixer could not reproduce one either); the specifier diff is the proxy.
- `pnpm build`/`pnpm gate`/`registry:build` (forbidden); the served build is the lead's 01:23 one.
- `sequence.hooks: "list"` as a fix for F1 was not trialled: it needs an in-place `vitest.config.ts` change while another lens was running browser tests.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round3/meta

curl -s -o /dev/null -w "%{http_code} %{content_type}" localhost:3000/{,preview/chat,llms.txt,robots.txt,r/registry.json,nope}; stylesheets from / → 200/200
node $S/../round2/meta/validate-built.mjs > $S/validate-built.log        # index + 83 items PASS, 0 failures
node -e '<built vs source, docs hygiene>' > $S/built-vs-source.log        # 1 key-order mismatch (base.config), no unbalanced quotes
node -e '<bare specifier diff per directory>'                             # registry/components 0 gaps; tests/browser only vitest, vitest/browser
pnpm exec vitest run --project unit > $S/unit-run1.log                    # 8 files, 296 passed
pnpm exec tsc --noEmit; pnpm lint; pnpm format:check; pnpm audit --prod --audit-level=high > $S/gate-checks.log   # all clean
for n in app/preview/*; do curl -s localhost:3000/preview/$n | grep -o '<title>.*</title>'; done   # 14 titled, 5 "uifiles"
pnpm exec vitest run --project browser tests/browser/qa-round3/zz-meta-guard-probe.test.tsx > $S/guard-probe.log   # A1/B3/C1 fail, B1/B2/B4 pass; file deleted
$S/mutate.sh <label> <file> <tests> 'OLD|||NEW'                            # M1–M20 (log above); cmp-verified restores
env -u NEXT_PUBLIC_BASE_URL CI=1 pnpm exec playwright test -c playwright.qa3.config.ts e2e/registry.spec.ts --project=chromium > $S/e2e-ci-noorigin.log   # 2 failed (message), 3 passed; temp config deleted
NEXT_PUBLIC_BASE_URL=https://uifiles.dev CI=1 pnpm exec playwright test -c playwright.qa3.config.ts e2e/registry.spec.ts --project=chromium > $S/e2e-ci-origin.log   # 2 failed on localhost (assertions live)
pnpm exec playwright test e2e/zz-qa3-meta-probe.spec.ts --project=chromium > $S/e2e-probe.log   # blocked/404/data: results, waitForIdle timings; file deleted
pnpm exec playwright test --workers=2 --reporter=list > $S/e2e-full.log   # 88 passed (1.2m), no retries
curl raw.githubusercontent.com/dependabot/dependabot-core/main/{github_actions/.../file_updater.rb,.../workflow_updater.rb,.../version_commenter.rb,common/lib/dependabot/git_commit_checker.rb,github_actions/.../version.rb}
pnpm exec prettier --write tests/unit/qa-round3-meta.test.ts; pnpm exec biome check tests/unit/qa-round3-meta.test.ts; pnpm exec tsc --noEmit
for i in 1 2 3; do pnpm exec vitest run --project unit tests/unit/qa-round3-meta.test.ts; done   # 3 failed | 3 passed ×3 ($S/repro-run{1,2,3}.log)
for i in 1 2 3; do pnpm exec vitest run --project unit tests/unit/{registry,workflows,ssr,tooling,test-setup,site}.test.ts; done   # 132 passed ×3
```

Reproducer output (identical 3/3):

```
 × still charges the calls a swallowing spy hid when the test file restores mocks in its own afterEach   (F1)
 × accepts a full-version comment such as `# v5.0.1` next to a pinned SHA                                 (F2)
 × every preview route sets a title: the page exports metadata, or a layout beside a client page does     (F3)
 ✓ installs the external-request block before the first navigation, aborting only foreign hosts           (pin, catches M9)
 ✓ stays silent for a Vercel preview build that advertises localhost, and warns off Vercel               (pin, catches M1)
 ✓ keeps every description under 900 characters and every docs string single-line with balanced quotes   (pin)
 Test Files  1 failed (1)   Tests  3 failed | 3 passed (6)
```

## Release checklist

1. **Follow-up PR (not blocking)**: F2 (relax the pin-comment regex to a tag: `# v\d+(\.\d+){0,2}`), F1 (static check forbidding `spyOn(console, …).mockImplementation` under `tests/browser/**`, or `sequence.hooks: "list"`, plus the AGENTS/CHANGELOG wording), F3 (titles for the five client previews via a sibling `layout.tsx`), F4/F5/F6 test tweaks; migrate the three pins from `tests/unit/qa-round3-meta.test.ts` into `tooling.test.ts`/`site.test.ts`/`registry.test.ts` and delete the file.
2. **Tag `v0.1.0`** on the curated commit; README's GitHub-path example, CHANGELOG's link refs and SECURITY's "latest tag" point at it. CHANGELOG dates it 2026-09-26.
3. **Vercel project**: set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev`; do not set `NODE_ENV=production` as a project variable (the build runs `shadcn` and `prettier` from devDependencies). After the first deploy: `curl -sI https://uifiles.dev/r/registry.json` → 200 `application/json`; `curl -s https://uifiles.dev/llms.txt | grep -c localhost` → 0; `/robots.txt` prints `Host: uifiles.dev`; five preview tabs will read "uifiles" until F3 lands.
4. **Directory PR** to `shadcn-ui/ui` `apps/v4/registry-directory.json` (entry in `round1/fix-tooling.md`, validated in round 2); prerequisites: public repo, item 3 live.
5. **Repo settings**: private vulnerability reporting on (SECURITY.md and the issue-template contact link point at `security/advisories/new`); branch protection on `main` requiring the `gate` job; topics. Expect the first Dependabot action PR to be red until F2 is merged.
6. **Before opening the PR**: `git status` must show none of the round-3 artefacts (`tests/browser/qa-round3/`, `tests/unit/qa-round3-*.test.ts`; other lenses' in-place edits such as `registry/ai/confirmation.tsx` restored), then `pnpm gate` and `pnpm test:e2e` on a clean clone with a cold `node_modules/.vite`. Stop any `pnpm start` on :3000 before `pnpm gate`/`pnpm build` (round-2 E1).
7. **Judgement calls confirmed**: `pnpm audit` last and hard; e2e at desktop and 375 px with every foreign request aborted; `robots.txt` `Host` is a host name; `CODE_OF_CONDUCT.md` contact is a GitHub profile URL with the maintainer's name. Open owner decision carried from round 2: `components/ui/button.tsx` destructive focus border (vendored).

## Verdict

**Ship.** Nothing in this lens breaks install, build, runtime or the directory listing: the built
registry validates and matches its sources, the CI order and its guards are real (every wiring
mutation but one was caught, the `CI=1` paths fail loudly, the route block is deterministic),
the e2e suite is green on both projects against the production build, and the docs match the
code. The two mediums are maintenance debts that will show up after launch, not defects a
consumer can meet: the first Dependabot action bump will fail `workflows.test.ts` (F2, a one-line
regex), and the console guard's promise about mock implementations is not kept in the 16 test
files that restore mocks in `afterEach` (F1, no current test exploits it). Fix both in the first
follow-up PR together with the five untitled previews (F3).
