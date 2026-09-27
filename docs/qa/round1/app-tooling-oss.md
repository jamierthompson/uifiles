# app-tooling-oss — QA round 1

## Summary

Attacked everything outside the registry components: the Next 16 app shell and its production behaviour on Vercel, the docs home and `/llms.txt`, the theme hotkey, every preview page's structure, the three scripts, Biome/Prettier/TS config, both GitHub workflows, licensing, and the open-source hygiene a first-time maintainer is judged on. 17 findings: 0 blocker, 3 high, 9 medium, 5 low/nit. The single worst thing is a pair: the production docs site and `/llms.txt` will print `http://localhost:3000` in every install command and item URL unless someone remembers to set `NEXT_PUBLIC_BASE_URL` on Vercel (nothing derives it, nothing fails the build), and GitHub already shows the repo's license as **"Other"** instead of MIT because a paragraph was appended to `LICENSE`. Both are the first things a founder or the shadcn team will see. Close behind: the weekly upstream-drift workflow can never open an issue because `| tee` masks the script's exit code (verified against GitHub's docs and reproduced locally), and the `upstream` label it references does not exist.

Reproducer files (11 of 16 unit tests fail on purpose; 2 browser tests pass and pin behaviour):

- `/tests/unit/qa-round1-app-tooling-oss.test.ts`
- `/tests/browser/qa-round1/app-tooling-oss.test.tsx`

## Findings (most severe first)

### F1. Production `/` and `/llms.txt` bake `http://localhost:3000` into every install command and item URL — severity: high

- Where: `lib/registry.ts:72-77` (`baseUrl()`), `app/page.tsx:21`, `app/llms.txt/route.ts:15-16,24`, `.env.example:2`
- What: `baseUrl()` is `process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"`. Both routes are prerendered once at build (`.next/prerender-manifest.json`: `/` and `/llms.txt` have `initialRevalidateSeconds: false`), so whatever the env holds at `next build` is frozen into the HTML and the text file. A fresh Vercel project has no `NEXT_PUBLIC_BASE_URL`; nothing derives the origin from Vercel's system env, nothing fails the build. Result: the landing page's install block reads `pnpm dlx shadcn@latest init http://localhost:3000/r/base.json` and every one of the 85 URLs in `/llms.txt` points at localhost. Any agent that reads `/llms.txt` (the stated purpose) gets unusable URLs.
- Evidence: `curl -s localhost:3000/llms.txt | grep -c localhost` → `85`; `curl -s localhost:3000/ | grep -o 'pnpm dlx shadcn@latest init [^<]*'` → `pnpm dlx shadcn@latest init http://localhost:3000/r/base.json`. Vercel docs (via the Vercel docs tool): `VERCEL_PROJECT_PRODUCTION_URL` = "The production domain name of the project, set even in preview deployments"; `VERCEL_URL` = deployment domain, no scheme.
- Why it matters: user-visible on the two pages the directory reviewers and every agent will open first.
- Proposed fix: `baseUrl()` fallback chain: `NEXT_PUBLIC_BASE_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` → `https://${VERCEL_URL}` → `http://localhost:3000`; additionally `throw` when `VERCEL_ENV === "production"` and the result is localhost so the build fails loudly. Update `.env.example` accordingly.
- Test written: `tests/unit/qa-round1-app-tooling-oss.test.ts` › "baseUrl() derives the origin from Vercel when NEXT_PUBLIC_BASE_URL is unset" (expected: FAIL now; got `'http://localhost:3000'`).

### F2. GitHub detects the repository license as "Other", not MIT — severity: high

- Where: `LICENSE:23-28` (a `---` separator and a third-party paragraph appended after the MIT text)
- What: GitHub's license detection needs the license file to be the license text. The appended paragraph drops the match below the detection threshold.
- Evidence: GitHub API for `jamierthompson/uifiles` (public): `"license":{"key":"other","name":"Other","spdx_id":"NOASSERTION"}`. The repo header will show "View license" rather than "MIT license", and `img.shields.io/github/license/...` badges will read "Other".
- Why it matters: the first signal a founder or the shadcn team gets about licensing is wrong; it reads as "custom terms".
- Proposed fix: make `LICENSE` the unmodified MIT text (lines 1-21). The third-party paragraph already lives in `NOTICE`; extend NOTICE per F9.
- Test written: › "LICENSE is the unmodified MIT text so GitHub detects it as MIT" (expected: FAIL now).

### F3. The weekly upstream-drift workflow can never open an issue (exit code masked by `| tee`), the label it uses does not exist, and it has no dedupe — severity: high

- Where: `.github/workflows/upstream-diff.yml:18-21, 28`
- What: `run: node scripts/sync-upstream.ts | tee diff.txt` with no `shell:` key. GitHub's default `run` shell is `bash -e {0}`; `-o pipefail` is added only when `shell: bash` is explicit. The pipeline's status is `tee`'s (0), so `steps.diff.outcome` is always `success` and the `github-script` step never runs. Even after that is fixed: `labels: ['upstream']` names a label that does not exist in the repo, and a fresh "Upstream drift: <date>" issue would be created every Monday the diff is non-empty. Separately, a network failure in `fetch` throws a `TypeError` and would also count as "drift".
- Evidence: fetched GitHub docs (`workflow-syntax.md`, line 963): "By default, fail-fast behavior is enforced using `set -e` for both `sh` and `bash`. When `shell: bash` is specified, `-o pipefail` is also applied". Local repro (network blocked here, so the script exits 1): `node scripts/sync-upstream.ts` → `direct exit=1`; `bash -e -c 'node scripts/sync-upstream.ts | tee diff.txt'` → `pipeline exit=0`; `bash -eo pipefail -c '...'` → `pipefail exit=1`. GitHub API `get_label upstream` → `label 'upstream' not found in jamierthompson/uifiles`.
- Why it matters: `docs/plan.md` §4.1 and §6 sell this workflow as the drift mechanism; it is dead on arrival.
- Proposed fix: see the corrected workflow in the checklist (explicit `shell: bash`, capture `$?` without a pipe, search open issues with the label and comment instead of create, `gh label create upstream` once, separate "missing" from "changed").
- Test written: › "upstream-diff.yml cannot mask sync-upstream's exit code behind `| tee`" and › "upstream-diff.yml searches for an existing open drift issue before creating another" (expected: FAIL now).

### F4. Home page labels `@uifiles/base` "alias → shadcn/ui" — severity: medium

- Where: `app/page.tsx:50` (`item.files?.length ? null : <badge>`)
- What: the badge predicate is "has no files", but `base` (`registry:base`) legitimately has `files: []` and is the one item that is entirely ours. The landing page therefore says the design system is an alias of shadcn/ui.
- Evidence: dev server HTML: `@uifiles/ base | alias → shadcn/ui | The uifiles design system…`; 128 badges rendered for 64 items (HTML + RSC payload) = 63 aliases + base.
- Proposed fix: `item.type === "registry:ui" && !item.files?.length`.
- Test written: › "does not label @uifiles/base (registry:base, files: []) as an alias to shadcn/ui" (expected: FAIL now; the received `<li>` contains the badge).

### F5. README tells consumers to pin `#v1.0.0`; no tag or release exists — severity: medium

- Where: `README.md:18` (`jamierthompson/uifiles/prompt-input#v1.0.0`), `docs/plan.md` Phase 1 ("Tag `v0.1.0`"), Phase 3 ("Tag `v1.0.0`")
- What: the GitHub-registry install path with a ref that does not exist fails for anyone who copies the README.
- Evidence: `git tag` → empty; GitHub API `list_tags` → `[]`, `list_releases` → `[]`.
- Proposed fix: tag `v0.1.0` now (matches `package.json` `0.0.1` → bump to `0.1.0`), change the README example to the real tag, add `CHANGELOG.md`.

### F6. `upstream.lock.json` tracks `conversation` and `shimmer`, which are on the do-not-port list — severity: medium

- Where: `registry/ai/upstream.lock.json` (keys `conversation`, `shimmer`), `scripts/sync-upstream.ts:22-31`
- What: the drift script hashes every lock entry against upstream. Two entries are for files this registry deliberately does not ship (`docs/porting-ai-elements.md` "Do not port"), so upstream edits to them would be reported as drift and (after F3 is fixed) open issues asking to "re-port" items that do not exist. `message` is legitimately in the lock (source of `branch` and `response`).
- Evidence: unit test diff shows `+ "conversation"`, `+ "shimmer"` beyond the set of `Derived from … <name>.tsx` headers.
- Proposed fix: delete the two entries.
- Test written: › "upstream.lock.json tracks exactly the upstream sources of shipped items" (expected: FAIL now).

### F7. `docs/porting-ai-elements.md` §4 tail, §5 heading and the verify commands render as one code block — severity: medium

- Where: `docs/porting-ai-elements.md:124` (`` ````ts `` opens a 4-backtick fence), `:131` (`` ``` If the component needs … `` is not a closing fence: 3 < 4 and it has trailing text), `:136-141`
- What: per CommonMark a closing fence must use the same character and be at least as long as the opener. Everything from line 125 to the `` ```` `` on line 141 is one code block: the sentence about `userEvent`, the `## 5. Verify` heading and the bash block are not rendered as prose/heading/bash. This is the checklist every `registry/ai` file claims to follow.
- Evidence: unit test fence tracker reports `## 5. Verify` inside an open fence.
- Proposed fix: line 124 → `` ```ts ``; line 131 → `` ``` `` then a blank line then the sentence; line 141 → `` ``` ``. (Prettier preserved the malformed structure; it will not fix it.)
- Test written: › "docs/porting-ai-elements.md: '## 5. Verify' is a heading, not text inside a code fence" (expected: FAIL now).

### F8. `skills/uifiles/SKILL.md` sends agents to a `references/` directory that does not exist — severity: medium

- Where: `skills/uifiles/SKILL.md:44`; also `docs/plan.md` §3.1 (`skills/uifiles/references/*.md`, `scripts/build-references.ts`), §4.2 table row "`references/*.md` generated from source"
- What: `ls skills/uifiles/` → `SKILL.md` only. An installed skill telling the agent "Check `references/` in this skill" costs a failed lookup on every use.
- Proposed fix: delete line 44 until the references exist, or ship them.
- Test written: › "skills/uifiles/SKILL.md does not point agents at a references/ directory that does not exist" (expected: FAIL now).

### F9. Third-party attribution names the wrong directories — severity: medium

- Where: `NOTICE:11-12`, `LICENSE:25-26`, `README.md:52`
- What: all three attribute shadcn/ui to "components under `registry/ui` that are forks". There are zero forks (`registry/ui/registry.json`: 63 items, 0 with files). The vendored shadcn output actually lives in `components/ui/` (27 `.tsx` files, MIT (c) shadcn) and is not mentioned anywhere. Separately, `.claude/skills/` is tracked in git (155 files) and contains, verbatim, `skills/shadcn` and `skills/migrate-radix-to-base` from shadcn-ui/ui (MIT), `skills/use-ai-sdk` from vercel/ai (Apache-2.0) and `skills/ai-elements` from vercel/ai-elements (Apache-2.0, including 130 `scripts/*.tsx` source files and two PNG logos); none carry attribution and NOTICE does not list them. `skills-lock.json` says they are restorable (`pnpm dlx skills experimental_install`), so tracking them is optional.
- Evidence: `ls components/ui | wc -l` → 27; `git ls-files .claude/skills | wc -l` → 155; `grep -rl -i "apache\|copyright\|license" .claude/skills/ai-elements` → nothing.
- Proposed fix: NOTICE: "Files under `components/ui/` are the shadcn/ui base-nova components, Copyright (c) 2023 shadcn, MIT" and a paragraph for `.claude/skills/*` naming source repo + license; or untrack `.claude/skills/` (add to `.gitignore`, keep `skills-lock.json`). Also note `LICENSE-ai-elements` is only the 12-line Apache boilerplate (it mirrors upstream's own `LICENSE`, which is the same 12 lines, so acceptable; including the full Apache-2.0 text is the conservative choice).
- Test written: › "third-party attribution names the directory that actually holds vendored shadcn/ui files" (expected: FAIL now).

### F10. CI hardening gaps — severity: medium (collectively)

- Where: `.github/workflows/ci.yml`, `playwright.config.ts:12`
- What (each verified by reading the files):
  1. No top-level `permissions:` (default token permissions), no `concurrency` (every push to a PR queues a full ~10 min run), no `timeout-minutes` (default 6 h).
  2. Actions pinned to floating majors (`checkout@v5`, `setup-node@v5`, `pnpm/action-setup@v4`, `upload-artifact@v4`, `github-script@v7`), not SHAs.
  3. `pnpm build` runs `scripts/sync-tokens.ts`, which rewrites the tracked `registry/base/registry.json`; there is no `git diff --exit-code` afterwards, so a PR whose committed `cssVars` drift from `app/globals.css` still passes (the tree is dirty at the end of the job and nobody sees it). `.claude/rules/registry.md:10` says cssVars are generated; CI does not enforce that they were regenerated.
  4. `pnpm test:e2e` runs against `pnpm dev` (`playwright.config.ts:12` `command: "pnpm registry:build && pnpm dev"`), not the production build that `pnpm build` just produced two steps earlier, so the e2e axe/hydration checks never see production output, and `registry:build` runs twice.
  5. Playwright browser download is not cached.
  6. Artifacts uploaded only on failure (fine) but `test-results/` (traces) are not included.
- Proposed fix: the corrected `ci.yml` in the checklist.
- Test written: › "ci.yml declares least-privilege token permissions and a timeout" (expected: FAIL now).

### F11. `docs/plan.md` is a private consulting memo shipped as the public architecture doc — severity: medium

- Where: `docs/plan.md` (linked from `AGENTS.md` as "the reasoning behind the shape" and from `README.md:36`)
- What: second person throughout ("Your repos", "your two existing projects", "the memory said otherwise" in §8), §9 is a naming exercise recommending **Quoin** for a repo that is already called uifiles, §3.1's tree lists files that do not exist (`registry/agents/registry.json`, `scripts/build-references.ts`, `skills/uifiles/references/*.md`) and says AI ports target `components/ai/uifiles.tsx`, §4.1 gives the gate order as `… → build → test → e2e` while `package.json` runs `… → test → build` and never runs e2e, §7 Phase 1 says "Tag `v0.1.0`" (not done), §2 says "Git tags + CHANGELOG" (neither exists). A reader from the shadcn team will read "Quoin" and the name table before anything else.
- Proposed fix: either rewrite as `docs/architecture.md` in third person with only decisions that hold, or move the memo to a private location and keep a short decisions list. At minimum delete §9 and fix the tree/gate/phase lines (see Docs accuracy table).

### F12. `ThemeHotkey`: a global, undiscoverable `d` key flips the theme — product question, severity: low

- Where: `components/theme-provider.tsx:37-69`
- What: any bare `d`/`D` keydown outside `<input>/<textarea>/<select>/contenteditable` toggles the theme. There is no visible control, no hint, no `aria-live` announcement; the site has no other way to change theme. `resolvedTheme` is defined on the first client render (next-themes computes it in state), so the "undefined → light" concern does not reproduce. Base UI listbox typeahead is protected because Base UI calls `preventDefault()` and the hook checks `event.defaultPrevented` (verified, see browser test). Remaining surprise: pressing `d` with focus on a button, link, the `<body>`, or inside a Base UI Menu item toggles the theme.
- Also: `next-themes` is not in `vitest.config.ts` `optimizeDeps.include`, so the first browser-mode run of anything importing `ThemeProvider` re-optimizes mid-run and fails with "Invalid hook call" (exactly the failure mode the config comment describes). Observed on the first run of my browser test; the second run passed.
- Recommendation: replace with a visible theme toggle (`button` with `aria-pressed`), keep the hotkey only if a hint is rendered; add `"next-themes"` to `optimizeDeps.include`.
- Test written: `tests/browser/qa-round1/app-tooling-oss.test.tsx` › "pressing d with a plain button focused toggles the theme (current behaviour)" and › "pressing d inside an open Base UI Select listbox is typeahead, not a theme toggle" (both PASS; pin behaviour).

### F13. README: "`pnpm gate` # everything CI runs" is false — severity: low

- Where: `README.md:33`; `package.json:20`; `.github/workflows/ci.yml:26`
- What: CI additionally runs `pnpm test:e2e`. A contributor who runs `gate` green can still fail CI on the e2e job.
- Test written: › "README: `pnpm gate` really runs everything CI runs" (expected: FAIL now; `gate is missing "test:e2e"`).

### F14. `.env.example` describes a feature that does not exist — severity: low

- Where: `.env.example:1` ("Used for Open-in-v0 links and llms.txt")
- Evidence: `grep -rn -i v0 app lib` → nothing.
- Fix: "Public origin of the deployed site; baked into `/` and `/llms.txt` at build time."

### F15. App-shell metadata and error surfaces are the `create-next-app` defaults — severity: low

- Where: `app/layout.tsx:15-19`, `app/` (no `not-found.tsx`, `robots.ts`, `sitemap.ts`, `opengraph-image`)
- What: `metadata` has `title` and `description` only: no `metadataBase` (`generate-metadata.md:391-428`: relative URL fields would be a build error if added later), no `openGraph`/`twitter` (link previews when the repo is shared will be bare), no `title.template` so every preview page is titled "uifiles". No `app/not-found.tsx` (`not-found.md` documents `not-found.js` and `global-not-found.js`); the 404 is Next's default page. `/preview` (the index) is not linked from `/`.
- Fix: `metadataBase: new URL(baseUrl())`, `title: { default: "uifiles", template: "%s · uifiles" }`, `openGraph`, an `app/not-found.tsx` wrapped in `<main>`, `robots.ts`, and a link to `/preview` from the home header.

### F16. Tooling nits — severity: nit

- `package.json`: no `description`, `repository`, `license`, `homepage`, `author` (visible in every tool that reads it; `license` should say `MIT`). `shadcn` sits in `dependencies` although it is only a build-time CLI. `version` is `0.0.1` while the README implies v1.
- `engines.node >=24` is advisory: pnpm's `engineStrict` defaults to `false` (pnpm docs `settings/cli.md`), there is no `.npmrc`, and `packageManager` pins only pnpm. `node scripts/*.ts` relies on Node ≥ 22.18 type stripping; a contributor on Node 20 gets a syntax error from `pnpm registry:build`. Add `.npmrc` with `engine-strict=true`.
- `pnpm-workspace.yaml` `packages: []` is fine: pnpm ≥ 10.26 reads `allowBuilds` from this file (pnpm docs `settings/build.md:197-199`), and `msw: false` is legitimate (transitive via `@vitest/browser` / `@vitest/mocker`, lockfile lines 1464-1475).
- `.mcp.json` runs `shadcn@latest` unpinned; `pnpm dlx` will fetch a new major without warning.
- `tsconfig.json` `target: ES2017` is the template default and is ignored by Next's compiler; `lib` already says `esnext`. Harmless.
- Four `.gitkeep`s: `components/.gitkeep`, `lib/.gitkeep`, `public/.gitkeep` sit beside real files (delete); `hooks/.gitkeep` keeps an empty dir alive only because `components.json` aliases `@/hooks` (keep or drop the alias).
- `.prettierignore` skips `skills-lock.json` because the `skills` CLI rewrites it in its own formatting; fine, but a one-line comment would stop the next reader asking.
- `biome.json`: `noUnusedImports` is disabled only for `components/ui/**` (vendored); `registry/**` keeps full a11y rules. Good. `assist.organizeImports` is enforced by `biome check` in CI. Good.

### F17. `image.tsx` and `model-selector.tsx` lack `"use client"` while every other port has it — severity: nit (for the component lens)

- Where: `registry/ai/image.tsx:3` (blank), `registry/ai/model-selector.tsx:3` (`import { cn }`)
- What: `docs/porting-ai-elements.md` §1 says keep the directive "if upstream has it". Upstream `image.tsx` and `model-selector.tsx` have no directive either (checked in the ai-elements clone), so this is consistent with the checklist; `model-selector` composes `command`/`dialog` which are client wrappers, so it works because they carry their own directive. Noted for the component reviewer; no action from this lens.

## Coverage gaps (behaviours with no test today; no bug found, but untested)

- `lib/registry.ts` › `loadRegistry()` with a missing `include` file or malformed JSON — the home page and llms.txt would throw at build with a raw `ENOENT`; a unit test asserting a readable error would document the contract.
- `lib/registry.ts` › `groupByType()` for a type absent from `TYPE_LABELS` — sorts to index −1 (before everything); a test would pin "unknown types sort last" once the fixer chooses.
- `app/llms.txt/route.ts` › item ordering and `title ?? name` fallback — untested; my test only checks origin handling.
- `scripts/sync-tokens.ts` › the `block()` regex stops at the first `}` — a nested `@media` inside `:root` would silently truncate the token block; untested (the current CSS has none).
- `scripts/sync-upstream.ts` › network error path (`fetch` rejects) — crashes with a stack trace instead of listing the item as missing; untested.
- `scripts/generate-aliases.ts` › the documented failure mode (throws on a missing description, asks to edit `EXTRA`) is not mentioned in `AGENTS.md`.
- `app/preview/page.tsx` › index lists directories without checking for `page.tsx`; pinned by my unit test.
- `components/theme-provider.tsx` › Base UI Menu typeahead (dropdown-menu inside prompt-input) with the `d` hotkey — not covered; Select is.
- `e2e/registry.spec.ts` › nothing asserts `/llms.txt` or `/` contain the deployed origin rather than localhost; add `expect(text).not.toContain("localhost")` when `NEXT_PUBLIC_BASE_URL` is set in CI.

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- Build-time file reads are safe today: `.next/prerender-manifest.json` lists `/`, `/llms.txt`, `/preview` and all 19 preview routes with `initialRevalidateSeconds: false` and `dynamicRoutes: []`; `required-server-files.json` shows `cacheComponents: false`, `ppr: false`. `readFileSync`/`readdirSync` therefore run only during `next build`, never in a Vercel function. Docs: `caching-without-cache-components.md:97` (`'auto'` default prerenders when nothing dynamic is used), `version-15.md:515-518` (GET route handlers need `force-static`, which `app/llms.txt/route.ts:3` sets).
- Latent risk, documented not present: enabling `cacheComponents` removes `dynamic`/`revalidate` (`route-segment-config/index.md` v16.0.0 row) and makes GET handlers follow the page model (`migrating-to-cache-components.md:785-787`); as long as no request-time API or `use cache` with a lifetime is added, routes stay prerendered. If anyone adds `revalidate`, the fs reads would run at request time where `registry.json` is absent; `outputFileTracingIncludes` (`output.md:80-124`) is the escape hatch, or write `public/llms.txt` from a build script. Suggest `export const dynamic = "error"` on `app/page.tsx` and `app/preview/page.tsx` in the current model to make any accidental dynamic opt-in a build failure.
- `pnpm/action-setup@v4` without `version` reads `packageManager` from `package.json` (action README: "Optional when there is a packageManager field").
- `pnpm audit --audit-level=high` → "No known vulnerabilities found"; lockfile committed; no `postinstall`/`preinstall` in `package.json`; no secrets in `git log -p` (pattern search over source, excluding lockfile and vendored skills); single author identity `Jamie Thompson <jamieraethompson@gmail.com>` across all 45 commits; every commit message is Conventional Commits (filter for non-`type(scope):` subjects returns nothing); none mention AI tooling beyond "Claude rules" (which names the real `.claude/rules` directory); largest tracked files are `pnpm-lock.yaml` (256 K), two skill `.tsx` (140 K) and `favicon.ico` (28 K).
- Every `registry/ai/*.tsx` carries the two-line Apache header verbatim; every `registry/ai` item has `app/preview/<name>/page.tsx` and `tests/browser/ai/<name>.test.tsx` that calls `axe.run` (unit test passes).
- Every preview route renders exactly one `<main>` (from `app/preview/layout.tsx`) and one `<h1>`; `app/preview/chat/page.tsx` imports the `Chat` component, not the block page, so there is no nested `main`; every `app/preview/*` directory has a `page.tsx` (unit test passes).
- `<html lang="en">` present; `suppressHydrationWarning` on `<html>` is justified by next-themes' class injection (`preventing-flash-before-hydration.md:109-116` describes the same DOM-wins semantics).
- Fonts: `next/font/google` self-hosts Geist at build (`13-fonts.md:96`), consistent with the `base` item's `font-geist`/`font-heading-geist` registry deps (both Geist). `--font-heading: var(--font-sans)` in `@theme inline` resolves to the next/font variable set on `<html>`; `sync-tokens.ts:27` deliberately skips `var(` font entries so consumers do not receive a self-referencing theme var. No registry source uses `font-heading`, so consumers lose nothing.
- `skills/uifiles/SKILL.md` frontmatter (`user-invocable: false`, `allowed-tools: Bash(pnpm dlx shadcn@latest *) …`) matches the upstream shadcn skill exactly; `skills/<name>/SKILL.md` at repo root is the layout `skills-lock.json` records for vercel/ai-elements and shadcn-ui/ui, so `pnpm dlx skills add jamierthompson/uifiles` will find it.
- `AGENTS.md` claims that hold: 63 `registry:ui` alias items (0 forks); gate order matches `package.json`; Vitest 5 browser mode + Playwright; `registry:sync` regenerates both tokens and aliases; `tests/unit/registry.test.ts` enforces the `@uifiles/` rule.
- `.gitignore` excludes `public/r`, `.env*` (keeps `.env.example`), `.vitest`, reports.
- `d` hotkey does not fire inside an open Base UI Select (typeahead calls `preventDefault`; browser test passes); `Shift+D` also toggles (pinned).
- `/llms.txt` with `NEXT_PUBLIC_BASE_URL=https://uifiles.dev/` contains no `localhost` and no `//r/` double slash (unit test passes).
- Repo is public with a description set (GitHub API).

## Could not reach

- `https://uifiles.dev` liveness: the egress proxy answers `403` to the CONNECT; README, `registry.json` `homepage`, `skills/uifiles/SKILL.md:17` and `/llms.txt` all depend on it. Unverified.
- Whether `NEXT_PUBLIC_BASE_URL` is set in the Vercel project: not knowable from the repo; F1 assumes the default (unset).
- GitHub REST behaviour when `issues.create` receives a non-existent label (docs.github.com not fetched): moot, since the label is verified absent and must be created anyway.
- Whether `font-heading-geist` is a real upstream item: `ui.shadcn.com` is blocked and the sparse shadcn-ui clone has no match. Unverified.
- `.claude/launch.json` schema (`"version": "0.0.1"`) and whether `.claude/rules/registry.md`'s `paths:` frontmatter loads as described: no offline reference.
- Repo topics: not returned by the search API call used; set them in the GitHub UI (`shadcn`, `shadcn-ui`, `base-ui`, `registry`, `ai-elements`, `nextjs`, `tailwindcss`).

## Commands run (for the fixer to reproduce)

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# F1
curl -s localhost:3000/llms.txt | grep -c localhost                     # 85
curl -s localhost:3000/ | grep -o 'pnpm dlx shadcn@latest init [^<]*'   # http://localhost:3000/r/base.json
node -e 'const m=require("./.next/prerender-manifest.json");for(const [k,v] of Object.entries(m.routes))console.log(k,v.initialRevalidateSeconds)'

# F2 / F5 / F3 label (GitHub MCP)
#   search_repositories repo:jamierthompson/uifiles  -> license.spdx_id NOASSERTION
#   list_tags / list_releases -> []
#   get_label upstream -> not found

# F3
node scripts/sync-upstream.ts; echo $?                                    # 1 (network blocked here)
bash -e -c 'node scripts/sync-upstream.ts | tee /dev/null'; echo $?      # 0  <- what GitHub runs
bash -eo pipefail -c 'node scripts/sync-upstream.ts | tee /dev/null'; echo $?  # 1
curl -sS https://raw.githubusercontent.com/github/docs/main/content/actions/reference/workflows-and-actions/workflow-syntax.md | grep -n pipefail

# F4
curl -s localhost:3000/ | tr '\n' ' ' | grep -o '@uifiles/<!-- -->base</span>.\{0,160\}' | sed 's/<[^>]*>/|/g'

# F9
ls components/ui | wc -l; git ls-files .claude/skills | wc -l
node -e 'const u=require("./registry/ui/registry.json").items;console.log(u.length,u.filter(i=>i.files&&i.files.length).length)'

# security / history
pnpm audit --audit-level=high
git log --all --format='%an <%ae>' | sort -u
git log --format='%h %s' | head -60
git ls-files | xargs -I{} du -k {} | sort -n | tail

# reproducer tests
pnpm exec vitest run --project unit tests/unit/qa-round1-app-tooling-oss.test.ts
pnpm exec vitest run --project browser tests/browser/qa-round1/app-tooling-oss.test.tsx
pnpm exec biome check tests/unit/qa-round1-app-tooling-oss.test.ts tests/browser/qa-round1/app-tooling-oss.test.tsx
pnpm exec prettier --check tests/unit/qa-round1-app-tooling-oss.test.ts tests/browser/qa-round1/app-tooling-oss.test.tsx
pnpm exec tsc --noEmit   # exit 0 with the new files
```

Unit test output (final run):

```
 ❯ tests/unit/qa-round1-app-tooling-oss.test.ts (16 tests | 11 failed)
   ✓ registry/ai provenance > ships at least the 18 Tier 1 items
   ✓ registry/ai provenance > every registry/ai source carries the two-line Apache header verbatim
   ✓ registry/ai provenance > every registry/ai item has a preview page and a browser test with axe
   × registry/ai provenance > upstream.lock.json tracks exactly the upstream sources of shipped items
   ✓ preview routes > every app/preview/<name> directory has a page.tsx
   ✓ public origin > llms.txt has no localhost URL when NEXT_PUBLIC_BASE_URL is set
   × public origin > baseUrl() derives the origin from Vercel when NEXT_PUBLIC_BASE_URL is unset
       AssertionError: expected 'http://localhost:3000' to be 'https://uifiles.dev'
   × home page catalog > does not label @uifiles/base (registry:base, files: []) as an alias to shadcn/ui
       Received: …<span class="font-mono text-xs">@uifiles/base</span><span class="text-xs text-muted-foreground">alias → shadcn/ui</span>…
   × docs accuracy > docs/porting-ai-elements.md: '## 5. Verify' is a heading, not text inside a code fence
   × docs accuracy > README: `pnpm gate` really runs everything CI runs
       AssertionError: gate is missing "test:e2e"
   × docs accuracy > skills/uifiles/SKILL.md does not point agents at a references/ directory that does not exist
   × licensing > LICENSE is the unmodified MIT text so GitHub detects it as MIT
   × licensing > third-party attribution names the directory that actually holds vendored shadcn/ui files
       AssertionError: expected 'uifiles\nCopyright (c) 2026 Jamie Tho…' to contain 'components/ui'
   × CI workflows > upstream-diff.yml cannot mask sync-upstream's exit code behind `| tee`
   × CI workflows > upstream-diff.yml searches for an existing open drift issue before creating another
   × CI workflows > ci.yml declares least-privilege token permissions and a timeout
 Test Files  1 failed (1)
      Tests  11 failed | 5 passed (16)
```

Browser test output (second run; the first failed with "Invalid hook call" because `next-themes` was not pre-bundled, see F12):

```
 ✓ |browser (chromium)| tests/browser/qa-round1/app-tooling-oss.test.tsx (2 tests) 
   ✓ pressing d with a plain button focused toggles the theme (current behaviour)
   ✓ pressing d inside an open Base UI Select listbox is typeahead, not a theme toggle
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

Biome: `Checked 2 files … No fixes applied.` Prettier: clean after `--write` on the unit file (my file). `tsc --noEmit`: exit 0.

## Docs accuracy table

| Claim | Where | True? | Fix |
| --- | --- | --- | --- |
| `pnpm gate` = "everything CI runs" | `README.md:33` | False: CI also runs `test:e2e` | Say "everything CI runs except e2e" or add `pnpm test:e2e` to `gate` |
| Pin with `jamierthompson/uifiles/prompt-input#v1.0.0` | `README.md:18`, `docs/plan.md` §3.3 | False: no tags/releases | Tag `v0.1.0`; use the real tag in the example |
| `init https://uifiles.dev/r/base.json` | `README.md:11`, `skills/uifiles/SKILL.md:17`, `registry.json:4` | Unverified (host blocked here) | Confirm the domain resolves before the launch; otherwise use the `*.vercel.app` URL |
| "Forked shadcn/ui components stay MIT (c) shadcn" under `registry/ui` | `README.md:52`, `LICENSE:25`, `NOTICE:11` | Misleading: 0 forks; vendored files are in `components/ui/` (27) | Attribute `components/ui/` (and `.claude/skills/*`) in NOTICE; keep LICENSE pristine |
| "Used for Open-in-v0 links and llms.txt" | `.env.example:1` | False: no v0 code | Reword |
| Registry `base` cssVars "generated from app/globals.css" | `registry/base/registry.json:119`, `AGENTS.md`, `.claude/rules/registry.md:10` | True today (tree is clean after build) but unenforced in CI | Add `git diff --exit-code registry/base/registry.json` after `pnpm build` in CI |
| "63 `registry:ui` items … Zero-file entries are aliases" | `AGENTS.md` Layout | True | — |
| Gate order `format:check → lint → typecheck → registry:validate → test → build` | `AGENTS.md` Commands | True | — |
| Gate order `… → registry validate → build → test → e2e` | `docs/plan.md` §4.1 | False (order and e2e) | Align with `package.json` |
| Tree lists `registry/agents/registry.json`, `scripts/build-references.ts`, `skills/uifiles/references/*.md` | `docs/plan.md` §3.1 | False: none exist | Mark as planned or delete |
| "ported AI Elements, registry:component, target components/ai/uifiles.tsx" | `docs/plan.md` §3.1 | False: target is `components/ai/<name>.tsx` | Fix |
| "Versioning: Git tags + CHANGELOG" | `docs/plan.md` §2 | False: neither exists | Tag + add `CHANGELOG.md` |
| "Phase 1 … Tag `v0.1.0`" | `docs/plan.md` §7 | Not done | Tag |
| `references/` "when they exist" | `skills/uifiles/SKILL.md:44`, `docs/plan.md` §4.2 | Directory absent | Remove line or ship references |
| "§4 … `## 5. Verify`" is a section | `docs/porting-ai-elements.md:124-141` | Rendered inside a code block | Fix fences |
| `upstream.lock.json` "records the sha256 of the source each port was made from" | `docs/porting-ai-elements.md:11` | Partly: also records `conversation`, `shimmer` (never ported) | Remove the two entries |
| Weekly workflow "opens a PR"/"opens an issue" listing drift | `docs/plan.md` §4.1, §6, `scripts/sync-upstream.ts:2-3` | False today (F3); and the script says PR, the workflow opens an issue | Fix workflow; align wording |
| "Installed via `skills-lock.json` into `.claude/skills/`… Restore with `pnpm dlx skills experimental_install`" | `AGENTS.md` | True, but the directory is also committed (155 files) | Decide: track or ignore |
| `.claude/rules/registry.md` loads when files under `registry/` are touched | `AGENTS.md` | Unverifiable offline (frontmatter `paths:` present) | — |
| "The Playwright suite runs axe over every preview page" | `AGENTS.md` | True (`e2e/previews.spec.ts`) | — |
| `NEXT_PUBLIC_BASE_URL` "Public origin of the deployed registry" | `.env.example` | True, but unset ⇒ localhost in production | Derive from Vercel env (F1) |
| Alias badge "alias → shadcn/ui" on `@uifiles/base` | `/` (rendered) | False | F4 |

## OSS release checklist

Ordered by "what a reviewer sees first". Effort S < 1 h, M ≈ half a day, L ≈ a day.

1. **Fix `LICENSE` so GitHub says MIT** — why: F2, the repo currently reads "Other". Effort S. File: `LICENSE` = lines 1-21 only. Move lines 25-28 into `NOTICE` (item 2).
2. **Correct `NOTICE`** — why: F9. Effort S. Replace `NOTICE` with:

   ```text
   uifiles
   Copyright (c) 2026 Jamie Thompson

   This product includes software developed by Vercel, Inc. as part of
   AI Elements (https://github.com/vercel/ai-elements), licensed under the
   Apache License, Version 2.0 (see LICENSE-ai-elements). Files derived from
   AI Elements live under registry/ai/ and carry a header comment naming the
   upstream file and the modifications made (ported from Radix UI to Base UI,
   dependencies re-pointed at the uifiles registry).

   Files under components/ui/ are shadcn/ui components (base-nova style)
   installed by the shadcn CLI, Copyright (c) 2023 shadcn, MIT License
   (https://github.com/shadcn-ui/ui). Any registry/ui item that gains files is
   a fork of the same and keeps that notice.

   Files under .claude/skills/ are agent skills installed verbatim from:
   - shadcn-ui/ui (skills/shadcn, skills/migrate-radix-to-base), MIT, (c) shadcn
   - vercel/ai (skills/use-ai-sdk), Apache-2.0, (c) Vercel, Inc.
   - vercel/ai-elements (skills/ai-elements), Apache-2.0, (c) Vercel, Inc.
   They are recorded in skills-lock.json and are not part of the uifiles registry.
   ```

   Optionally replace `LICENSE-ai-elements` with the full Apache-2.0 text (upstream ships only the 12-line boilerplate, so this is conservative, not required).
3. **Derive the public origin on Vercel and fail the build otherwise** — why: F1. Effort S. File: `lib/registry.ts`:

   ```ts
   export function baseUrl() {
     const explicit = process.env.NEXT_PUBLIC_BASE_URL
     const vercel =
       process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
     const origin =
       explicit ?? (vercel ? `https://${vercel}` : "http://localhost:3000")
     if (process.env.VERCEL_ENV === "production" && origin.includes("localhost")) {
       throw new Error("Set NEXT_PUBLIC_BASE_URL for the production build")
     }
     return origin.replace(/\/$/, "")
   }
   ```

   Update `.env.example` (F14). Add `expect(text).not.toContain("localhost")` to `e2e/registry.spec.ts` when `NEXT_PUBLIC_BASE_URL` is set.
4. **Tag `v0.1.0`, bump `package.json` to `0.1.0`, fix the README pin, add `CHANGELOG.md`** — why: F5. Effort S. `CHANGELOG.md`:

   ```md
   # Changelog

   ## v0.1.0 — 2026-09-xx

   - `@uifiles/base` design-system item (tokens generated from `app/globals.css`).
   - 63 shadcn/ui primitives aliased under `@uifiles/*`.
   - 18 AI Elements components ported to Base UI: branch, chain-of-thought, checkpoint,
     code-block, confirmation, context, image, inline-citation, model-selector, plan,
     prompt-input, queue, reasoning, response, sources, suggestion, task, tool.
   - `chat` block on `message-scroller` + `@shadcn/helpers`.
   - `/llms.txt`, docs home, `skills/uifiles`.
   ```

5. **Fix the home-page alias badge** — why: F4. Effort S. `app/page.tsx:50`: `item.type === "registry:ui" && !item.files?.length`.
6. **Fix `upstream-diff.yml`, create the `upstream` label, drop the two stale lock entries** — why: F3, F6. Effort S–M. Replace the workflow with:

   ```yaml
   name: Upstream diff

   on:
     schedule:
       - cron: "0 9 * * 1" # Mondays 09:00 UTC
     workflow_dispatch:

   permissions:
     contents: read
     issues: write

   concurrency:
     group: upstream-diff
     cancel-in-progress: true

   jobs:
     diff:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: actions/checkout@v5
         - uses: actions/setup-node@v5
           with:
             node-version-file: .nvmrc
         - id: diff
           shell: bash
           run: |
             set +e
             node scripts/sync-upstream.ts > diff.txt 2>&1
             echo "code=$?" >> "$GITHUB_OUTPUT"
             cat diff.txt
         - if: steps.diff.outputs.code != '0'
           uses: actions/github-script@v7
           with:
             script: |
               const fs = require('fs')
               const diff = fs.readFileSync('diff.txt', 'utf8')
               const body = '```\n' + diff.replace(/```/g, '` ` `') + '```\n\nRe-port the changed items per docs/porting-ai-elements.md and update registry/ai/upstream.lock.json.'
               const { data: open } = await github.rest.issues.listForRepo({
                 owner: context.repo.owner, repo: context.repo.repo,
                 state: 'open', labels: 'upstream', per_page: 1,
               })
               if (open.length) {
                 await github.rest.issues.createComment({
                   owner: context.repo.owner, repo: context.repo.repo,
                   issue_number: open[0].number, body,
                 })
               } else {
                 await github.rest.issues.create({
                   owner: context.repo.owner, repo: context.repo.repo,
                   title: 'Upstream drift: ' + new Date().toISOString().slice(0, 10),
                   body, labels: ['upstream'],
                 })
               }
   ```

   Run once: `gh label create upstream --description "Upstream shadcn/ui or AI Elements changed" --color 0E8A16`. In `scripts/sync-upstream.ts`, wrap `fetch` in `try/catch` and push network errors to `missing` (and consider exit code 2 for "missing only" so transient outages do not read as drift). Delete `conversation` and `shimmer` from `registry/ai/upstream.lock.json`.
7. **Harden `ci.yml`** — why: F10. Effort S. Replace with:

   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   permissions:
     contents: read

   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: true

   env:
     NEXT_PUBLIC_BASE_URL: https://uifiles.dev

   jobs:
     gate:
       runs-on: ubuntu-latest
       timeout-minutes: 20
       steps:
         - uses: actions/checkout@v5
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v5
           with:
             node-version-file: .nvmrc
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm format:check
         - run: pnpm lint
         - run: pnpm typecheck
         - run: pnpm registry:validate
         - name: Cache Playwright browsers
           uses: actions/cache@v4
           with:
             path: ~/.cache/ms-playwright
             key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
         - run: pnpm exec playwright install --with-deps chromium
         - run: pnpm test
         - run: pnpm build
         - name: Generated registry files are committed
           run: git diff --exit-code -- registry/base/registry.json registry/ui/registry.json
         - run: pnpm test:e2e
           env:
             CI: "true"
         - uses: actions/upload-artifact@v4
           if: failure()
           with:
             name: playwright-report
             path: |
               playwright-report
               test-results
   ```

   Pin each `uses:` to a commit SHA with a `# vN` comment once Dependabot (item 9) is in place to keep them fresh. In `playwright.config.ts`, use `command: process.env.CI ? "pnpm start" : "pnpm registry:build && pnpm dev"` so CI's e2e runs against the production build it just made.
8. **`CONTRIBUTING.md`** — why: the shadcn team and founders will look for it; it also carries the rules `AGENTS.md` already states for agents. Effort S.

   ```md
   # Contributing

   Thanks for helping. uifiles is a shadcn/ui registry on Base UI; the contributor rules live in
   [`AGENTS.md`](./AGENTS.md) and apply to people and agents alike. This file covers the workflow.

   ## Setup

   Node 24 (`.nvmrc`) and pnpm 11 (`packageManager`).

   ```bash
   pnpm install
   pnpm registry:build   # tokens → validate → public/r
   pnpm dev              # http://localhost:3000
   ```

   ## Making a change

   - Registry items: read `AGENTS.md` "Rules for registry work" and, for AI Elements ports,
     `docs/porting-ai-elements.md`. Every new item needs a registry entry with a retrieval-quality
     `description`, a preview page under `app/preview/<name>/`, and a browser test with axe under
     `tests/browser/`.
   - Tokens: edit `app/globals.css`; `registry/base` `cssVars` are generated. Never edit `public/r`.
   - Do not port `message`, `conversation`, `attachments`, `shimmer`, `loader` (shadcn ships them).

   ## Before opening a PR

   ```bash
   pnpm gate        # format → lint → typecheck → registry validate → tests → build
   pnpm test:e2e    # Playwright + axe over every preview (CI runs this too)
   ```

   Use Conventional Commits (`feat(ai): port sources`, `fix(preview): …`). One item per PR when porting.

   ## Reporting bugs and requesting components

   Use the issue templates. For a component request, say whether shadcn/ui or AI Elements already
   ships it; the overlap policy is in `docs/plan.md` §5.

   ## Licensing

   MIT for the repo. Ports from AI Elements keep the Apache-2.0 header; see `NOTICE`.
   ```

9. **`.github/dependabot.yml`** — why: 40 direct deps, floating action majors, no update process. Effort S.

   ```yaml
   version: 2
   updates:
     - package-ecosystem: github-actions
       directory: /
       schedule:
         interval: weekly
     - package-ecosystem: npm
       directory: /
       schedule:
         interval: weekly
       open-pull-requests-limit: 5
       groups:
         next:
           patterns: ["next", "react", "react-dom", "@types/react*"]
         shadcn:
           patterns: ["shadcn", "@shadcn/*", "@base-ui/*", "cn"]
         ai:
           patterns: ["ai", "@ai-sdk/*", "streamdown", "@streamdown/*", "shiki", "tokenlens"]
         tooling:
           patterns: ["@biomejs/*", "prettier*", "typescript", "vitest*", "@vitest/*", "playwright", "@playwright/*", "axe-core", "@axe-core/*"]
   ```

10. **`SECURITY.md`** — why: GitHub's community profile flags its absence; the shadcn repo has one. Effort S.

    ```md
    # Security policy

    uifiles is a component registry: the code it distributes runs in your application, not on a
    server we operate. Please report anything that could let a registry item execute unexpected
    code, exfiltrate data, or break out of the shadcn CLI's install step.

    Use GitHub's private vulnerability reporting:
    https://github.com/jamierthompson/uifiles/security/advisories/new

    You will get an acknowledgement within 7 days. Please do not open a public issue for
    security reports. Only the latest tagged release is supported.
    ```

    Enable "Private vulnerability reporting" in the repo's Security settings so the link works.
11. **`CODE_OF_CONDUCT.md`** — Effort S. Adopt the Contributor Covenant 2.1 verbatim (`https://www.contributor-covenant.org/version/2/1/code_of_conduct/`) with the contact set to the maintainer's email.
12. **Issue templates** — Effort S. `.github/ISSUE_TEMPLATE/bug.yml`:

    ```yaml
    name: Bug report
    description: Something installs wrong, renders wrong, or fails axe
    labels: [bug]
    body:
      - type: input
        id: item
        attributes:
          label: Registry item
          placeholder: "@uifiles/prompt-input"
        validations:
          required: true
      - type: textarea
        id: repro
        attributes:
          label: Steps to reproduce
          description: The shadcn CLI command you ran, or the JSX you rendered
        validations:
          required: true
      - type: textarea
        id: expected
        attributes:
          label: Expected vs actual
      - type: input
        id: versions
        attributes:
          label: Versions
          placeholder: "shadcn 4.21, next 16.3, @base-ui/react 1.8, browser"
    ```

    `.github/ISSUE_TEMPLATE/component.yml`:

    ```yaml
    name: Component request
    description: Ask for a new item or a fork of an upstream primitive
    labels: [component]
    body:
      - type: input
        id: name
        attributes:
          label: Item name
          placeholder: "agent, file-tree, a fork of button"
        validations:
          required: true
      - type: dropdown
        id: source
        attributes:
          label: Does shadcn/ui or AI Elements already ship it?
          options: [shadcn/ui, AI Elements, Neither]
        validations:
          required: true
      - type: textarea
        id: why
        attributes:
          label: What does it need to do that the upstream item does not?
    ```

    `.github/ISSUE_TEMPLATE/config.yml`: `blank_issues_enabled: false`.
13. **`.github/PULL_REQUEST_TEMPLATE.md`** — Effort S.

    ```md
    ## What

    ## Checklist

    - [ ] `pnpm gate` and `pnpm test:e2e` pass locally
    - [ ] New item: registry entry with a retrieval-quality description, preview page, browser test with axe
    - [ ] AI Elements port: Apache header, `registry/ai/upstream.lock.json` updated, API changes in `docs`
    - [ ] Tokens changed in `app/globals.css`, not in `registry/base/registry.json`
    - [ ] Conventional commit title
    ```

14. **Fix `docs/porting-ai-elements.md` fences and remove the `references/` line from the skill** — F7, F8. Effort S.
15. **Rewrite or de-scope `docs/plan.md`** — F11. Effort M. Minimum: delete §9, fix §3.1 tree/targets, §4.1 gate order, §7 phase status, and change "your"/"I verified" to third person.
16. **`package.json` fields and `.npmrc`** — F16. Effort S. Add `"description"`, `"license": "MIT"`, `"repository": "github:jamierthompson/uifiles"`, `"homepage": "https://uifiles.dev"`, `"author"`; move `shadcn` to `devDependencies`; add `.npmrc` with `engine-strict=true`.
17. **App shell polish** — F15. Effort S–M. `metadataBase`, `title.template`, `openGraph`, `app/not-found.tsx` (inside `<main>`), `app/robots.ts`, link `/preview` from the home header, `export const dynamic = "error"` on the two fs-reading pages, add `next-themes` to `optimizeDeps.include`, decide on the theme hotkey (F12).
18. **Delete the three stray `.gitkeep`s** (`components/`, `lib/`, `public/`) — Effort S.
19. **Repo settings (UI)** — Effort S: topics, enable private vulnerability reporting, branch protection on `main` requiring the `gate` job, Discussions optional.
20. **Decide whether `.claude/skills/` stays tracked** — Effort S. If yes, NOTICE (item 2) covers attribution; if no, add `/.claude/skills/` to `.gitignore` and keep `skills-lock.json` + the restore command in `AGENTS.md`.
