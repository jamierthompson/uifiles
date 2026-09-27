# Adversarial QA, round 2: common brief

You are an independent QA engineer with no prior context of this codebase. You did not build it, you
did not review it in round 1, and you did not fix it. Round 1 found ~120 defects across nine lenses;
ten fixer agents then changed almost every file and grew the suite from 52 to 991 tests. Your job is
to (a) verify each round-1 finding in your lens is really fixed, (b) judge whether the new tests
are load-bearing, and (c) attack the changed code again with fresh eyes, because fixes introduce
bugs. Gate-green is developer-done, not review-done.

## What the repo is

`<repo>` is a shadcn/ui registry on Base UI (`@uifiles`): 18 AI chat/agent components
ported from Vercel AI Elements, a `chat` block, a `registry:base` token item, and the Next 16 docs
site that hosts `/r/*.json`. It is about to be shared publicly and submitted to the official shadcn
registry directory. Read first: `AGENTS.md`, `docs/architecture.md`, `docs/porting-ai-elements.md`,
`.claude/rules/registry.md`, then the reports named in your prompt.

## Round-1 material (read the ones your prompt names, in full)

- QA reports: `/docs/qa/round1/<lens>.md`
  (`prompt-input`, `code-context-model-citation`, `disclosure-agent`, `chat-block-and-leaves`,
  `test-quality`, `app-tooling-oss`, `registry-contract`, `rendered-surface`, `tokens-css`).
- Fix reports: same directory, `fix-<lens>.md` (`fix-prompt-input`, `fix-code-block-context`,
  `fix-model-selector-inline-citation`, `fix-chat-block`, `fix-leaves`, `fix-reasoning-tool-task-plan`,
  `fix-cot-queue-checkpoint-confirmation`, `fix-tokens-css`, `fix-app-docs-oss`, `fix-tooling`,
  `fix-registry-manifest`, `fix-docs-integration`). Each lists what was fixed, what was not, the
  tests added, mutation checks, and "requests for other owners". Treat every claim in them as a
  hypothesis to verify.
- The code as it was before the fixes: `git show 86bbd82:<path>` (the pre-QA baseline commit).

## Environment facts (verified; do not re-derive)

- Prefix commands with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH` (Node 24, pnpm 11; deps installed; `public/r` built).
- A PRODUCTION server (`pnpm start` of the current build) runs at `http://localhost:3000`. Do not start or stop servers.
- `pnpm exec vitest run --project browser <file>` and `--project unit` work. The browser project has a fail-on-console guard (`tests/setup.ts`; `allowConsole()` opts a test out) and shared helpers in `tests/a11y.ts` (`expectNoViolations`, `runAxe`, `settle`, `withDark`, `AXE_TAGS`).
- Network: `ui.shadcn.com`, `elements.ai-sdk.dev`, `models.dev`, `cdn.playwright.dev` are BLOCKED. `registry.npmjs.org`, `raw.githubusercontent.com` work.
- Upstream sources: AI Elements at `<scratchpad>/upstream/ai-elements/packages/elements/{src,__tests__}/`; shadcn-ui/ui (CLI source, registry docs) at `.../scratchpad/upstream/shadcn-ui/`; registry docs as markdown at `.../scratchpad/upstream/shadcn-docs/`.
- Cite, don't remember: verify framework claims against `node_modules` (Next 16 docs in `node_modules/next/dist/docs/`, Base UI `.d.ts`, `ai` v7 `index.d.ts`, Vitest 5). Vitest browser facts: `locators.exact` defaults true, viewport 414×896, `unmount()` returns a promise, `toHaveTextContent` is exact.

## Rules

- Do not edit any tracked file. You may create only: your report
  `/docs/qa/round2/<lens>.md`,
  reproducer tests in NEW files `tests/browser/qa-round2/<lens>.test.tsx` and/or `tests/unit/qa-round2-<lens>.test.ts`
  (fail on a real bug; pass when pinning correct-but-untested behaviour; say which), and scratch files under
  `.../scratchpad/qa/round2/<lens>/`.
- Mutation-test the NEW tests for real: for at least six behaviours per lens (pick the most important), copy the
  component file to your scratch dir, patch the behaviour out, run only the relevant test file, restore the file
  byte-identically (`git diff --stat` must be empty for it), and record caught/survived. A survived mutation is a finding.
- Judge test quality: names that describe behaviour (no `BUG`, `QA`, round/reviewer words, no "pins"), fixtures in
  `<main>`, shared helpers used, no disabled axe rules, no `test.skip`, no vacuous assertions, no timing sleeps where a
  poll would do, and no flakiness (run each file you review three times).
- Do not run `pnpm build`, `next build`, `pnpm dev`, `pnpm start`, `pnpm test:e2e`, `pnpm gate`, `pnpm registry:sync`,
  `pnpm registry:build`, `pnpm format`. Targeted commands only.
- No `git commit/stash/checkout` of tracked files. Restore anything you mutate.

## Report format

```
# <lens> — QA round 2

## Summary (what you attacked; findings by severity; the single worst thing; overall verdict: ship / not yet)

## Fix verification
| round-1 finding | claimed fix | verified? (yes / partial / no) | evidence |

## Findings (most severe first; same shape as round 1: Where / What / Evidence / Why it matters / Proposed fix / Test written)

## Mutation log
| behaviour | mutation | test file | caught? |

## Test-quality issues (file › test name → problem)

## Verified OK

## Could not reach

## Commands run
```

Severity: blocker (breaks install/build/runtime or the directory listing), high (user-visible wrong behaviour, a11y violation, data loss, leak), medium (edge case, misleading docs/API), low (hygiene), nit.
Finish by re-reading your report against the code; delete anything you cannot reproduce.
