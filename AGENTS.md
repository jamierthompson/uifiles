# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# uifiles

A shadcn/ui registry on Base UI. This repo is the source of the `@uifiles` namespace: every
shadcn/ui primitive aliased under it, 18 AI chat and agent components ported from Vercel AI
Elements, a `chat` block, and a `registry:base` item carrying the tokens. The Next.js app is
only the docs site and the host for `/r/*.json`. Read `docs/architecture.md` for the
decisions behind the shape and the list of intentional divergences from AI Elements.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 7 · Tailwind CSS v4 · shadcn 4 on **Base UI**
(`base-nova`) · `cn` package · Biome (lint only) · Prettier (format) · Vitest 5 (unit + browser
mode) · Playwright · pnpm · Node 24 (`.nvmrc`).

Use `pnpm` for everything (`pnpm add`, `pnpm dlx shadcn@latest ...`). Never `npm install` or
`npx`. Formatting is Prettier's job; never hand-format.

## Commands

| Command                            | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                         | Docs site on :3000. `/r/*.json` is served from `public/r`, so run `pnpm registry:build` first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm registry:sync`               | Regenerates `registry/base` tokens from `app/globals.css` and the 63 alias items in `registry/ui` from upstream (needs network access to `ui.shadcn.com`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm registry:validate`           | `shadcn registry validate` over `registry.json` and every included file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm registry:build`              | sync tokens → validate → `shadcn build` into `public/r/` (gitignored). It rewrites `registry/base/registry.json`; commit that file with the token change. `scripts/sync-tokens.ts` exits 1 without writing when `:root` and `.dark` drift.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm test` / `pnpm test:coverage` | Vitest: the `unit` project (`tests/unit`, Node) and the `browser` project (`tests/browser`, Chromium with axe). `test:coverage` adds v8 coverage over `registry/**` and `lib/**` (preview `page.tsx` files excluded) with per-file thresholds of 80% lines, 80% functions and 70% branches; CI runs this one. Run one file with `pnpm exec vitest run --project browser tests/browser/ai/<name>.test.tsx`.                                                                                                                                                                                                                                               |
| `pnpm test:e2e`                    | Playwright: axe and a clean console over every preview page and the home in light and dark, at desktop and 375 px phone width; each preview's `<title>` starts with its registry title and no preview scrolls sideways; the served HTML of `/preview/branch` carries its branch selector and count; the wide formula on `/preview/response` overflows its own box at 375 px; plus the registry endpoints, `/llms.txt`, and a keyboard walk of the chat preview. Requests to any host but localhost are aborted. Locally it starts `pnpm registry:build && pnpm dev` (or reuses a running server); in CI it runs against `pnpm start` after `pnpm build`. |
| `pnpm gate`                        | format:check → lint → typecheck → registry:validate → test → build. It does not run e2e. CI (`.github/workflows/ci.yml`) runs the gate steps with `pnpm registry:build` before `pnpm test:coverage` (in place of `pnpm test`), `pnpm build`, `git diff --exit-code -- registry` (fails when the build had to rewrite a generated registry file), `pnpm test:e2e`, then `pnpm audit --prod --audit-level=high` last. Run both before every PR.                                                                                                                                                                                                            |

## Layout

| Path                                                  | Contents                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.json`                                       | Root catalog: `name`, `homepage`, `include` list. No items here.                                                                                                                                                                                                                                              |
| `registry/base/`                                      | `base` (`registry:base`): config, tokens, fonts, base CSS. `cssVars` are **generated** from `app/globals.css`; edit the CSS, not the JSON.                                                                                                                                                                    |
| `registry/ui/`                                        | 63 `registry:ui` items. Zero-file entries are aliases (`registryDependencies: ["button"]`) that resolve upstream shadcn/ui against the consumer's style. **Generated**; a fork is an entry with `files`, preserved across regeneration.                                                                       |
| `registry/ai/`                                        | 18 components ported from Vercel AI Elements (Apache-2.0; keep the header comment, `licenses/APACHE-2.0-ai-elements.txt` and `NOTICE`). Target `components/ai/<name>.tsx`. `upstream.lock.json` records the upstream source per item (see "Upstream lock" below).                                             |
| `registry/blocks/`                                    | Full-page blocks (`chat`). Sources nest as `registry/blocks/<block>/{components,lib}/…`.                                                                                                                                                                                                                      |
| `registry/components/`, `hooks/`, `lib/`              | Our own composites, hooks, utilities (empty today).                                                                                                                                                                                                                                                           |
| `components/ui/`                                      | The installed shadcn base-nova wrappers (MIT (c) shadcn). Vendored; do not edit by hand, report if a fork is needed.                                                                                                                                                                                          |
| `components/theme-provider.tsx`, `theme-toggle.tsx`   | next-themes provider, and the toggle rendered in the home header and the preview layout: the only theme control (no character-key shortcut, WCAG 2.1.4).                                                                                                                                                      |
| `lib/registry.ts`                                     | Reads the source registry for the docs home and `/llms.txt`; `baseUrl()` resolves the public origin (`NEXT_PUBLIC_BASE_URL` → Vercel env → localhost; a Vercel production build that would advertise localhost fails, a production build anywhere else warns once).                                           |
| `app/`                                                | Docs home (`page.tsx`), `llms.txt` and `robots.txt` routes, `not-found.tsx`, and `preview/<name>/page.tsx` per item under the preview layout (which provides the one `<main>`). A `"use client"` preview page cannot export `metadata`, so a `layout.tsx` beside it sets the title.                           |
| `scripts/`                                            | `sync-tokens.ts` (tokens → base item), `generate-aliases.ts` (`registry/ui` from shadcn's index), `sync-upstream.ts` (drift check). Plain Node 24 type stripping: no enums, namespaces or parameter properties.                                                                                               |
| `tests/a11y.ts`, `tests/axe-tags.ts`                  | The shared axe helpers every accessibility assertion uses: `expectNoViolations`, `runAxe`, `settle`, `withDark`, `AXE_TAGS` (the tag list also feeds the Playwright helper).                                                                                                                                  |
| `tests/setup.ts`, `tests/console-guard.ts`            | Browser-project setup: a test that logs through `console.error` or `console.warn` fails, including calls a console spy's mock implementation swallowed; `allowConsole()` opts one test out. The guard itself is runner-free and unit-tested.                                                                  |
| `tests/unit/`, `tests/browser/`, `e2e/`               | Vitest unit tests; Vitest browser-mode tests (one per item plus `blocks/chat`, `theme`, `tokens`, `button`, `a11y-helper`); Playwright specs with `e2e/helpers.ts` and the runner-free `e2e/origin.ts`.                                                                                                       |
| `.github/workflows/`                                  | `ci.yml` (the gate plus e2e, above) and `upstream-diff.yml` (weekly drift check that files or comments on an `upstream` issue).                                                                                                                                                                               |
| `public/r/`                                           | Build output. Never edit; never commit.                                                                                                                                                                                                                                                                       |
| `skills/uifiles/`                                     | The skill consumers install with `pnpm dlx skills add jamierthompson/uifiles`.                                                                                                                                                                                                                                |
| `LICENSE`, `licenses/`, `NOTICE`                      | MIT for the repository. `licenses/APACHE-2.0-ai-elements.txt` is the Apache-2.0 copy the AI Elements ports require, kept out of the root because GitHub's licence detector scans every root `LICENSE*` file and reports "Other" when two match. `NOTICE` lists every third-party file set and vendored skill. |
| `docs/architecture.md`, `docs/porting-ai-elements.md` | Decisions, the AI Elements resolution table, intentional divergences and token departures; the per-file port checklist.                                                                                                                                                                                       |

## Rules for registry work

- **Base UI, not Radix.** Composition is `render={<a />}`, never `asChild`; `onClick`, never
  `onSelect`; `data-open`/`data-closed`, never `data-[state=...]`; `keepMounted`, never
  `forceMount`. HoverCard delay props are Radix-only (Base UI puts `delay`/`closeDelay` on the
  trigger); see the `migrate-radix-to-base` skill.
- **Bare names mean upstream shadcn.** In `registryDependencies`, `"button"` is shadcn's
  button. Once `@uifiles/button` is forked (has `files`), every item that needs _our_ button
  must say `"@uifiles/button"`. `tests/unit/registry.test.ts` enforces this.
- **Favor shadcn when both exist.** shadcn ships `message`, `bubble`, `attachment`,
  `message-scroller`, `marker`, `questionnaire`, `spinner`, and the `shimmer` util. Do not port
  the AI Elements equivalents (`message`, `conversation`, `attachments`, `shimmer`, `loader`);
  port their unique parts as new items (`response`, `branch`). The full table is in
  `docs/architecture.md` §3.
- **Sources import with `@/registry/...` or `@/components/ui/...`** and `cn` from `"cn"`; the
  CLI rewrites aliases on install. Never import from `@/lib/utils` in registry sources.
- **Declare every bare npm import in the item's `dependencies`** (`cn` included), pinned to
  a major or minor range when upstream leaves it bare (`streamdown@^2.6`, `ai@^7`), because
  consumers otherwise get newer majors than upstream tests against. `tests/unit/registry.test.ts`
  checks the imports against the entry in both directions (for an item that ships files, a
  declared package that none of its files imports and no `@import` or `@plugin` key of its
  `css` loads fails too), that each package is installed here at that major, and that a
  cross-item `@/registry/ai/<x>` import has a matching `@uifiles/<x>` entry.
- **Registry sources must compile under strict flags** because consumers copy them into
  projects with unknown settings. `tsconfig.json` turns on `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess` and `noUnusedLocals`, so `pnpm typecheck` covers it; type
  optional props as `x?: T | undefined` and spread conditionally (`...(v !== undefined && { v })`)
  when forwarding to a wrapper that lacks the `| undefined`.
- **Controlled/uncontrolled props** keep the latest callback in a ref (`onOpenChangeRef`,
  refreshed in an effect) and give the setter `[isControlled]` as its only dependency. Never
  list the callback: a parent that passes an inline handler would change the setter's identity
  on every render and restart every effect that depends on it (the auto-close timer in
  `reasoning`). Snippet in `docs/porting-ai-elements.md` §1.
- **cmdk inside a listbox.** `Command.Empty` and `Command.Separator` may not be children of the
  cmdk listbox (axe `aria-required-children`, critical). Render the empty state in a polite live
  region placed after the list and portal into it (`ModelSelectorList`/`ModelSelectorEmpty` in
  `registry/ai/model-selector.tsx`), and wrap a separator in `aria-hidden="true"`.
- **Markdown needs CSS in the consumer's `globals.css`.** Only `response` renders Streamdown;
  `reasoning` and the `chat` block render markdown through its `MessageResponse` and depend on
  `@uifiles/response`. The `response` item's `css` field ships three pieces, which the CLI
  writes into the consumer's `globals.css` (each `@import` after the file's last one, and not
  at all when an identical one is there) and which items depending on `@uifiles/response`
  inherit, so they do not repeat them (`tests/unit/registry.test.ts` fails on an item that
  repeats a `css` rule an `@uifiles/*` dependency ships, inside or outside an `@layer`: an
  unlayered copy of `.katex-display` would beat the layered one): `@import "streamdown/styles.css"`
  (the `[data-sd-animate]` keyframes), `@import "katex/dist/katex.min.css"` (without it every
  formula renders twice: KaTeX's HTML plus the MathML fallback the stylesheet hides) and
  `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em } }` (a wide
  formula scrolls in its own box instead of widening the page). The fourth,
  `@source "../node_modules/streamdown/dist/*.js"` (Tailwind v4 emits only classes it can see;
  the `@streamdown/*` plugins ship none), stays a manual step because its path is relative to
  the consumer's CSS file. `app/globals.css` has all four; keep the `css` field in step with
  it and say in the item's `docs` which lines the CLI adds and which one is manual.
- **Every item needs a `description` written for retrieval** (what it is, when to use it).
  The MCP server and `shadcn search` rank on it. Add `docs` for post-install notes and every
  intentional divergence from upstream (the current list is `docs/architecture.md` §3).
- **Upstream lock.** `registry/ai/upstream.lock.json` is keyed by shipped item:
  `{ source, sha256, fetchedAt, upstream? }`, where `upstream` names the differently named
  upstream file an item was cut from (`branch` and `response` from `message`; they share one
  source and hash, fetched once). Update the entry when you port or re-port; the unit tests
  require the keys to equal the shipped items. `scripts/sync-upstream.ts` exits 0 unchanged,
  1 when a source changed (the weekly workflow files or comments on an `upstream` issue), 2
  when nothing changed but a source could not be checked (404 or network; logged only).
- **Before writing or using a component**, run `pnpm dlx shadcn@latest docs <name>` or use the
  shadcn MCP tools. Do not recall APIs from memory. `pnpm dlx shadcn@latest view @uifiles/<name>`
  (with `pnpm dev` running) shows what a consumer would get.
- **Round-trip through the real CLI.** `components.json` maps `@uifiles` to
  `http://localhost:3000/r/{name}.json`; after `pnpm registry:build` and `pnpm dev`, test an
  item with `pnpm dlx shadcn@latest add @uifiles/<name> --dry-run` from a scratch project.
- **Each new component ships with** a registry entry, a browser test with axe
  (`tests/browser/ai/<name>.test.tsx`), a preview page under `app/preview/<name>/` with one
  `<h1>` and a title, both the item's registry `title` (`metadata` in the page, or in a
  `layout.tsx` beside a client page), and a description; `tests/unit/registry.test.ts` fails
  without the test and the preview, and `tests/unit/site.test.ts` when the title or the `<h1>`
  is missing or differs from the registry `title`. The Playwright suite runs axe over every
  preview page, which catches page-level rules (landmarks, heading order, focusable scroll
  regions) the component tests cannot.
- **Render it before you call it done.** `pnpm registry:build && pnpm dev`, then open
  `/preview/<name>` in both themes (the toggle in the page header); server
  rendering and hydration are not exercised by the browser tests. Attributes that depend on
  layout (`tabIndex` on an overflowing scroller) go through state set after mount, never the
  first render, or the server HTML and the client disagree.
- **shadcn `input-group` fades the whole group (`has-disabled:opacity-50`) when any
  descendant is disabled**, including a disabled submit button. Do not disable
  `PromptInputSubmit` to gate empty input; swallow empty submits instead (the chat block does).

## Tests

- **Accessibility** goes through `tests/a11y.ts`: `expectNoViolations()` (WCAG 2.0/2.1/2.2 AA
  plus best-practice, `target-size` enabled, animations settled), `runAxe()`, `settle()`, and
  `withDark()` for the dark theme. Do not copy a `settle` or `axe.run` into a test file. Run
  axe in every meaningful state (closed, open, streaming, error) and once under `withDark()`.
- **Fixtures sit in `<main>`**; never disable the `region` or `color-contrast` rules. Scope with
  `exclude` or fix the colour.
- **Console must be clean.** `tests/setup.ts` runs before every browser test; a `console.error`
  or `console.warn` fails the test at its end with the messages (React act, key and hydration
  warnings included). A test that asserts a warning (an error boundary, an unknown-language
  warning) calls `allowConsole("error")` or `allowConsole("warn")` from `@/tests/setup` at its
  top; nothing else opts out. `vi.spyOn(console, "error").mockImplementation(() => {})` is not
  an opt-out: the browser project's global `console` is the guard's proxy, which sees every spy
  installed through it, so the calls a mock implementation swallowed are charged to the test
  even when the spy is restored before the check (by `mockRestore()` or an
  `afterEach(() => vi.restoreAllMocks())`), and `tests/unit/tooling.test.ts` rejects the
  pattern in any file under `tests/browser/`. A spy without an implementation is fine for
  asserting a message (with `allowConsole` for that level). The guard unmounts the test's tree
  before it checks, so output logged on unmount belongs to the test that rendered it. Browser
  `console.log` is not forwarded to the terminal.
- **Port upstream's tests first** (`packages/elements/__tests__/<name>.test.tsx` in AI
  Elements), keep its names where the behaviour maps, skip only tests of APIs the port lacks
  and say which, then cover every prop, every state in every union, controlled and uncontrolled
  modes, keyboard interaction and error paths. Name tests by the behaviour they assert, never by
  a bug or a review. No `test.skip`, no `retry`. A file must pass three runs in a row.
- **Vitest browser facts.** Locators are exact by default (`getByText("Used 1")` does not match
  "Used 1 source"; pass `{ exact: false }` or a RegExp). Viewport 414×896, 15 s test timeout.
  `await screen.unmount()`: it returns a promise, and an un-awaited unmount inside a loop
  produces "overlapping act() calls". `expect.element(x).toHaveTextContent(y)` is an exact,
  whitespace-normalised comparison that stringifies a RegExp; use `toMatchTextContent` or
  `expect.poll(() => el.textContent).toContain(...)` for a substring.
- **Pre-bundling.** Vite bundles `optimizeDeps.include` in `vitest.config.ts` once per cache
  (`node_modules/.vite`). A bare specifier outside the list is only bundled when Vite meets
  it; one it first meets while the suite runs (a file edited mid-run, a subpath such as
  `react-dom/server` reached by one test file) triggers a re-bundle that invalidates the test
  files still importing ("Failed to fetch dynamically imported module", and "Invalid hook
  call" from a second React copy). So every bare specifier browser tests can reach is listed,
  subpaths included (`react-dom/server`, `@base-ui/react/menu`); only `vitest` and
  `vitest/browser` are the runner's own. `tests/unit/test-setup.test.ts` fails on a gap: it
  reads every file under `registry/`, `components/` and `tests/browser/` and follows their
  local imports into the rest of the tree (the `app/preview` pages and demos some tests
  render, the `tests/*.ts` helpers), skipping `import type` statements, which never reach
  the browser. `rm -rf node_modules/.vite` resets a stale cache.
- **Portaled popups** (Base UI menu, select, dialog, hover card) render outside the fixture:
  scan the popup on its own and exclude `[data-base-ui-portal]` from the page scan; an open
  modal Select also renders focus guards that axe's `aria-hidden-focus` flags, so exclude
  `[data-base-ui-focus-guard]` too. Playwright leaves the pointer where the previous test put
  it, which opens delay-0 tooltips and hover cards on the next render: `userEvent.unhover` the
  trigger or park the pointer on inert text first.
- **Timers** use `vi.useFakeTimers()` as upstream does. Fake only what you need (`toFake`)
  and, with timers faked, drive clicks with `element.click()` inside `act` because
  `userEvent` awaits real timers (`tests/browser/ai/reasoning.test.tsx`).
- **Coverage** (`pnpm test:coverage`, run in CI) fails any file under `registry/**` or `lib/**`
  below 80% lines, 80% functions or 70% branches.
- **End to end** (`e2e/`, Playwright) uses `e2e/helpers.ts`: `gotoHydrated` (aborts every
  request to a host other than localhost, then waits for React's fiber key on `<main>`, then
  fonts, animations and two frames; never `networkidle`), `waitForIdle` for pages that stream
  on load (no busy live region, then every Reasoning that streamed has closed itself, then
  settled; no fixed sleep), `collectPageProblems` attached before navigation and asserted `[]`
  (no allow-list: a blocked third-party request is logged as a console error and fails the
  page the same way on every machine, so previews must be hermetic), and
  `expectNoAxeViolations` (same `AXE_TAGS`, `target-size` on). Every spec runs in two
  Chromium projects, desktop and `chromium-mobile` (375 × 812), and every preview and the home
  run in light and dark through `page.emulateMedia` over `COLOR_SCHEMES`, asserting the
  `html.light`/`html.dark` class next-themes sets. Each preview's `<title>` must start with
  its registry item's title (then ` · uifiles`), and the page must not scroll sideways
  (`scrollWidth` of `<html>` at most its `clientWidth`, at desktop and at 375 px: wide code,
  tables and formulas scroll in their own boxes). `/preview/branch` must serve its branch
  selector and count in the HTML, not only after hydration (a raw request: no page, so no
  console and no colour scheme), and at 375 px, in light and dark with a clean console, the
  wide formula on `/preview/response` must overflow its own box while the page does not. A
  `NEXT_PUBLIC_BASE_URL` that is not an absolute URL (`uifiles.dev`) fails the specs that
  read the origin with the message `baseUrl()` gives the build, not a bare `Invalid URL`.
  CI runs it against `pnpm start` with `retries: 1`, `workers: 2`, traces on first retry,
  and uploads `playwright-report`, `test-results` and `.vitest/attachments` on failure.
- **CI facts.** `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` is set for the whole job, so the
  build matches production and the e2e "no localhost" assertions are live; `e2e/origin.ts`
  fails the run when `CI` is set and the variable is not, instead of skipping them.
  `pnpm registry:build` runs before `pnpm test:coverage`, so the built-output checks in
  `tests/unit/registry.test.ts` run there (they fail, not skip, when `CI` is set and `public/r`
  is missing). `pnpm audit` runs last. Playwright browsers are cached at
  `~/.cache/ms-playwright` keyed by the installed Playwright version. Every action is pinned
  to a commit SHA; `tests/unit/workflows.test.ts` asserts the parsed workflows.

## Tailwind CSS v4

- No `tailwind.config.js`. Configuration lives in `app/globals.css` via `@theme inline`.
- Color values are `oklch()`. Add a token under both `:root` and `.dark` (`sync-tokens` exits 1
  on drift; only `--radius` is light-only), map it in `@theme inline` as
  `--color-name: var(--name)`, then `pnpm registry:build` picks it up and the regenerated
  `registry/base/registry.json` is committed.
- Dark mode is class-based (`.dark` on `<html>`, set by next-themes).
- Use semantic tokens (`bg-primary`, `text-muted-foreground`), never palette classes, and no
  alpha-faded text for information-bearing content. The token departures from shadcn Nova and
  the contrast reasons are in `docs/architecture.md` §4.
- Reduced motion is handled once, by the `prefers-reduced-motion` guard in `@layer base`
  (mirrored in the base item's `css`); do not add per-component `motion-reduce:` classes.

## Skills and MCP in this repo

Installed via `skills-lock.json` into `.claude/skills/` (tracked in git, attributed in
`NOTICE`): `shadcn`, `migrate-radix-to-base`, `ai-elements` (for the port), `ai-sdk`. Restore
with `pnpm dlx skills experimental_install`. The shadcn MCP server is configured in
`.mcp.json`. `.claude/rules/registry.md` loads when files under `registry/` are touched.

## Git

`main` only for now. Conventional commit messages (`feat(ai): port prompt-input`). Run
`pnpm gate` and `pnpm test:e2e` before pushing. Do not commit `public/r/` or `.env*` (only
`.env.example`). `CONTRIBUTING.md` has the PR workflow; `CHANGELOG.md` gets a line for every
user-visible change.
