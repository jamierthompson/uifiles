# Fix round 1: common brief for every fixer

You are a fresh coder. You did not build this codebase and you did not review it. Nine independent
QA reviewers attacked it and wrote reports; you own one slice of the fixes. Another fresh reviewer
will attack your work afterwards, so fix root causes and prove every fix with a test.

## What the repo is

`<repo>` is a shadcn/ui registry on Base UI (`@uifiles` namespace): 18 AI chat/agent
components ported from Vercel AI Elements (Radix) to Base UI, a `chat` block, a `registry:base`
token item, and the Next 16 docs site that hosts `/r/*.json`. Next week it is shared with technical
founders and submitted to the official shadcn registry directory. Quality bar: top-notch.

Read first, in this order:

1. `/AGENTS.md` (binding contributor rules)
2. `/docs/porting-ai-elements.md` (the port checklist)
3. `/.claude/rules/registry.md`
4. The QA report(s) named in your prompt, in full: findings, coverage gaps, verified-OK, commands.
5. Your lens-specific brief (in your prompt).

## Environment facts (verified; do not re-derive)

- Prefix every command with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH` (Node 24, pnpm 11; `node_modules` installed; `public/r` built).
- A dev server runs on `http://localhost:3000`. Do not start another, do not kill it.
- `pnpm exec vitest run --project browser <file>` works (Chromium is wired). `--project unit` for `tests/unit`.
- `ui.shadcn.com` and `elements.ai-sdk.dev` are BLOCKED. `registry.npmjs.org` (so `pnpm add` works) and `raw.githubusercontent.com` work.
- Upstream sources are cloned for reference:
  - AI Elements (upstream of `registry/ai/*`): `<scratchpad>/upstream/ai-elements/packages/elements/src/<name>.tsx`,
    upstream tests: `.../packages/elements/__tests__/<name>.test.tsx` (Vitest browser mode + Testing Library), setup: `.../__tests__/setup.ts`.
  - shadcn-ui/ui (sparse): `<scratchpad>/upstream/shadcn-ui/` (`packages/shadcn/src` = CLI source; `apps/v4/content/docs/registry/*.mdx` = registry docs).
- QA reports: `/docs/qa/round1/<lens>.md`. QA reproducer tests live in
  `tests/browser/qa-round1/<lens>.test.tsx` and `tests/unit/qa-round1-<lens>.test.ts` (committed in git; if a file is gone because another fixer already migrated and deleted it, read it with `git show 13c7c90:<path>`).

## Cite, don't remember

This stack is newer than your training data. Verify APIs against the installed version: Next 16 docs `node_modules/next/dist/docs/`; Base UI 1.8 `node_modules/@base-ui/react/**/*.d.ts` (and the wrappers in `components/ui/*.tsx`); AI SDK 7 `node_modules/ai/dist/index.d.ts`; `@ai-sdk/react` 4; `@shadcn/helpers`, `@shadcn/react`; streamdown 2.6, shiki 4, tokenlens 1; Vitest 5 + `vitest-browser-react` 2.3 (`node_modules/vitest/dist/*.d.ts`, `node_modules/vitest-browser-react/dist/`). `vitest/browser` exports `userEvent` and `page`. Vitest browser defaults: `locators.exact` is TRUE (`getByText` is whole-string), viewport 414×896, 15 s test timeout.

## File ownership (hard rule)

Your prompt lists the files you own. Edit nothing else. Other fixers are editing other files at the same
time; `git status` will show their changes. Never revert, reformat, or "clean up" a file you do not own.
Never run `pnpm format` (repo-wide); run `pnpm exec prettier --write <your files>` and
`pnpm exec biome check <your files>` only on your own files.
If a fix needs a change in a file you do not own, write it under `## Requests for other owners` in your
report with the exact change, and make your own side complete and defensive regardless.

Specifically off-limits to component fixers: `registry/ai/registry.json`, `registry/blocks/registry.json`
(report the new `docs`/`description`/`dependencies` text under `## Registry entry changes`, exact
replacement strings), `docs/*.md`, `README.md`, `AGENTS.md` (report doc needs), `package.json`,
`vitest.config.ts`, `tsconfig.json`, `.github/**`, `components/ui/**` (vendored shadcn; report if a
fork is needed), `app/globals.css`.

## Engineering rules

- Keep the upstream AI Elements public API (export names, prop names/types, defaults) unless a fix
  requires a change; every intentional divergence goes into the item's `docs` (report it). Fix
  inherited upstream bugs too: the registry owns the consumer contract now.
- Base UI, never Radix: `render`, not `asChild`; `onClick`, not `onSelect`; `data-open`/`data-closed`,
  never `data-[state=...]`; `keepMounted`, never `forceMount`. `cn` from `"cn"`; `@/components/ui/*` imports.
- **Controlled/uncontrolled pattern (replaces the `useCallback([..., onOpenChange])` version in the porting
  doc, which restarts timers on every parent render):** keep the latest callback in a ref so the setter
  is stable:
  ```tsx
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => { onOpenChangeRef.current = onOpenChange })
  const [uncontrolled, setUncontrolled] = useState(defaultOpen ?? false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : uncontrolled
  const setIsOpen = useCallback((next: boolean) => {
    if (!isControlled) setUncontrolled(next)
    onOpenChangeRef.current?.(next)
  }, [isControlled])
  ```
  Apply it to every component you own that has the pattern.
- Registry files are copied into consumer projects, so they must compile under the strictest common
  flags: run `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`
  and fix every error in files you own (pattern: `x?: T | undefined` on props, or `...(v !== undefined && { v })`).
  Errors in files you do not own: list them, do not touch them.
- No `any`; narrow `unknown`. Semantic tokens only; no palette classes; no alpha-faded text
  (`text-foo/50`) for information-bearing text. Every interactive element needs a visible
  `focus-visible:` state and an accessible name.
- Comments only for a non-obvious why. No "fixed in QA round 1" style notes; git history is the record.

## Test rules

- Use the shared helper `tests/a11y.ts` for every accessibility assertion: `expectNoViolations()`
  (WCAG 2.0/2.1/2.2 AA + best-practice, `target-size` enabled, animations settled), `settle()`,
  `runAxe()`, `withDark()`. Delete per-file `settleAnimations` copies. Do not disable `region`; scope with
  `exclude` or give the fixture a `<main>` landmark (always wrap fixtures in `<main>`). Do not disable
  `color-contrast`; fix the colour.
- **Migrate the QA reproducers** for your components from `tests/browser/qa-round1/<lens>.test.tsx` into the
  canonical `tests/browser/ai/<name>.test.tsx` (or `tests/browser/blocks/chat.test.tsx`). Rename them so
  the name says what it asserts: no `BUG:`, `FAILS TODAY`, `EXPECTED FAIL`, `[BUG]`, `pin`, `QA`, round or
  reviewer words anywhere. Drop reproducers for inputs that cannot occur (keep the invariant, not the exotica).
  When your lens's qa-round1 file is fully migrated, delete it (if another fixer shares the file, the
  prompt says who deletes).
- **Port the upstream tests** from `.../packages/elements/__tests__/<name>.test.tsx` for each component
  you own: adapt `@testing-library/react` (`render`/`screen`/`fireEvent`) to `vitest-browser-react`
  (`render`, locators, `userEvent` from `vitest/browser`, `expect.element`, `expect.poll`), `@/registry/default/ui/*`
  imports to `@/components/ui/*`, Radix expectations (`asChild`, `data-state`, `onSelect`) to Base UI, and keep
  upstream's test names where the behaviour maps. Use `vi.useFakeTimers()` for timer behaviour (upstream does).
  Skip only tests of upstream APIs that do not exist in the port and say which. The goal is exhaustive
  behavioural coverage per export: every prop, every state in every union, every branch, error paths,
  keyboard interaction, controlled and uncontrolled modes, plus an axe pass in each meaningful state and one
  under `withDark`.
- **Prove every fix**: run the reproducer before the fix (paste the failing output), then after (passing).
  Then break your own fix deliberately once and confirm the test fails (mutation check); revert.
- The full test file must pass three times in a row (`pnpm exec vitest run --project browser <file>` ×3)
  to catch flakes. No `test.skip`, no `retry`, no disabling rules.

## Do not

- Do not commit, stash, checkout, rebase or amend. The lead commits.
- Do not run `pnpm build`, `next build`, `pnpm dev`, `pnpm test:e2e`, `pnpm gate`, `pnpm registry:sync`,
  `pnpm registry:build`, or `pnpm format`. `pnpm registry:validate` is fine.
- Do not add dependencies unless your prompt allows it.

## Report (write it to `/docs/qa/round1/fix-<lens>.md`)

```
# fix-<lens>

## Fixed
- <report>:<Fn> — <one line what changed> — `path:line` — test: `<file>` › "<name>" (failed before: <1-line output>; passes after)

## Not fixed and why
- <report>:<Fn> — <reason: out of ownership / not reproducible / needs owner decision> — what you recommend

## Tests
- <file>: N tests before → M after; upstream tests ported: X of Y (skipped: <names + why>)
- Mutation checks performed (fix → test that caught it)
- Three consecutive runs: pass/pass/pass (paste the summary lines)

## Registry entry changes (exact strings for registry.json; the registry owner applies them)
- <item> › docs: "<full new docs string>"
- <item> › description: "<full new description>"
- <item> › dependencies: [...]

## Requests for other owners
- <file>: <exact change and why>

## Strict-flag typecheck
- Errors remaining in files I own: none | list
- Errors in files I do not own: list (path:line)

## Commands run
```
