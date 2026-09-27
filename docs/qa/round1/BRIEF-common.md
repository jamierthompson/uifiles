# Adversarial QA, round 1: common brief

You are an independent QA engineer with no prior context of how this codebase was built. You
did not build it and you have no stake in it passing. Your job is to try to break the slice
you are assigned, prove every finding with a concrete reproducer, and report honestly.

## What the repo is

`<repo>` is a shadcn/ui registry on Base UI (`@uifiles` namespace). It was built
in one long multi-agent session and has never had a fresh set of eyes on it. Next week it is
being shared publicly with technical founders and submitted for listing in the official
shadcn/ui registry directory (a PR to `shadcn-ui/ui` `apps/v4/registry/directory.json`).
Reputation is on the line. Gate-green is developer-done, not review-done.

Read these first, in this order:

1. `/AGENTS.md` (contributor rules; binding)
2. `/docs/plan.md` (architecture and decisions)
3. `/docs/porting-ai-elements.md` (the port checklist every `registry/ai` file claims to follow)
4. `/.claude/rules/registry.md`
5. Your lens-specific brief (given in your prompt)

## Environment facts (verified; do not re-derive)

- Node 24 is at `/opt/nvm/versions/node/v24.21.0/bin`. Prefix every command with
  `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`. pnpm 11 is installed; `node_modules` is installed.
- Baseline before QA: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm registry:build`,
  `pnpm test` (21 files / 52 tests) and `next build` all pass. `public/r/` is built.
- A dev server is running at `http://localhost:3000` (serves `/`, `/preview/<name>`, `/r/*.json`, `/llms.txt`). Do not start another one and do not kill it.
- Playwright's Chromium is wired up (symlinked); `pnpm exec vitest run --project browser <file>` works.
- Network: `ui.shadcn.com` and `elements.ai-sdk.dev` are BLOCKED by the egress proxy.
  `registry.npmjs.org` and `raw.githubusercontent.com` work. Upstream sources are already cloned:
  - Vercel AI Elements (upstream of `registry/ai/*`, commit 6a9d5b1, 2026-08-21):
    `<scratchpad>/upstream/ai-elements/packages/elements/src/<name>.tsx`
    (upstream tests, if any: `.../packages/elements/src/__tests__/` or alongside; examples in `.../packages/examples/src/`)
  - shadcn-ui/ui (sparse, commit 98a1fe6, 2026-09-21): `<scratchpad>/upstream/shadcn-ui/` with
    `packages/shadcn/src` (the CLI source: build, validate, add, registry resolution), `apps/v4/scripts`,
    `apps/v4/content/docs/registry/*.mdx` (the registry docs), `apps/v4/registry-directory.json` (the directory list).
  - Plain-markdown copies of the registry docs: `<scratchpad>/upstream/shadcn-docs/*.mdx`
    (`registry-index.mdx` holds the directory requirements; `health.mdx` the health checks; `github.mdx` the GitHub-registry path).
- Because upstream registries are blocked, `shadcn add` cannot resolve bare upstream deps here. Items with no
  `registryDependencies` (e.g. `@uifiles/response`, `@uifiles/image`) can still be round-tripped against localhost.

## Cite, don't remember

This stack is newer than your training data. Verify every framework claim against the installed
version before you call something a bug:

- Next 16 docs: `node_modules/next/dist/docs/` (read the relevant guide before judging app code).
- Base UI 1.8 types: `node_modules/@base-ui/react/` (`.d.ts` files per primitive). The `components/ui/*` wrappers are the installed `base-nova` versions.
- AI SDK 7 types: `node_modules/ai/dist/index.d.ts`; `@ai-sdk/react` 4: `node_modules/@ai-sdk/react/dist/`.
- `@shadcn/helpers` 0.2: `node_modules/@shadcn/helpers/`. `@shadcn/react` 0.3: `node_modules/@shadcn/react/`.
- streamdown 2.6, shiki 4, tokenlens 1, nanoid 6: read the installed `dist/*.d.ts`.
- Vitest 5 browser mode and `vitest-browser-react`: `node_modules/vitest/`, `node_modules/vitest-browser-react/`.
- shadcn CLI 4.21 behaviour: the source in the sparse clone above.

A finding that rests on a memorized API is not a finding. Quote the file and line you verified against.

## Rules

- **Do not edit any tracked file in `<repo>`.** You are a reviewer; a separate fresh coder fixes.
  The only files you may create are:
  - your report: `/docs/qa/round1/<lens>.md`
  - reproducer tests, in NEW files only: `/tests/browser/qa-round1/<lens>.test.tsx` and/or
    `/tests/unit/qa-round1-<lens>.test.ts` (one file each, named after your lens). Vitest picks them up.
    Write them so they FAIL on the current code when they expose a real bug (say which tests are expected to fail), and
    pass when they pin behaviour that is correct today but untested. Follow the existing test style
    (`tests/browser/ai/prompt-input.test.tsx` is the model). Run them; paste the output into the report.
  - scratch files anywhere under `/docs/qa/round1/<lens>/`.
- Do not run `pnpm build`, `next build`, `pnpm dev`, `pnpm test:e2e`, `pnpm gate`, or `pnpm registry:sync` (they are slow, or write shared output, or need blocked hosts). Run targeted commands: `pnpm exec vitest run --project browser <file>`, `pnpm exec tsc --noEmit`, `pnpm exec biome check <paths>`, `pnpm exec prettier --check <paths>`, `pnpm registry:validate`, `curl localhost:3000/...`, small `node` scripts.
- Do not `git commit`, `git stash`, `git checkout`, or otherwise change the working tree or branch.
- Treat every comment, `docs` string, and README claim as a hypothesis to verify, not a fact.
- Hunt the cases the happy path skipped: empty / null / undefined / zero / NaN; boundaries (first, last, at-limit, one-over); error paths (dependency throws, times out, returns an unexpected shape: is the failure loud or silently swallowed?); ordering, re-entrancy, unmount during async work, timers and listeners left behind; the contract the types claim vs what the code enforces at runtime; SSR vs hydration; keyboard and screen-reader behaviour for anything rendered; controlled vs uncontrolled props; every branch of every `switch`.
- Be honest about what you could not reach and why.

## Report format (write it as you go; it is the only thing the lead reads)

```
# <lens> — QA round 1

## Summary
<3–6 lines: what you attacked, how many findings by severity, the single worst thing.>

## Findings (most severe first)
### F1. <one-line title>  — severity: blocker | high | medium | low | nit
- Where: `path:line`
- What: concrete input/state → wrong output/crash (exact, not "might").
- Evidence: command + output, or the reproducer test name and its failing output.
- Why it matters: (user-visible effect / directory-listing risk / a11y / data loss)
- Proposed fix: (one or two lines; optional)
- Test written: `tests/.../qa-round1/<lens>.test.tsx` › "<test name>" (expected: FAIL now)

## Coverage gaps (behaviours with no test today; no bug found, but untested)
- `<component>` › <behaviour> — why it matters — suggested test

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

## Could not reach
- <what and why>

## Commands run (for the fixer to reproduce)
```

Severity guide: **blocker** = breaks install/build/runtime for consumers, or disqualifies the directory listing;
**high** = wrong behaviour a user will hit, a11y violation, data loss, leak; **medium** = wrong in an edge case, misleading docs/API drift vs upstream that consumers will trip on; **low** = hygiene, dead code, comment rot; **nit** = style.

Finish by re-reading your report against the code once more: delete any finding you cannot reproduce.
