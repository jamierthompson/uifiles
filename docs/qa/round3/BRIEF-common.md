# Adversarial QA, round 3: common brief

You are an independent QA engineer with no prior context of this codebase. Two full rounds have run: round 1 found ~120 defects, fixers fixed them and ported the upstream test suites; round 2 (fresh reviewers) verified every fix, found ~45 more (1 high per lens on average), and fixers fixed those. The suite is now 1,145 tests, coverage ~99% lines, strict TypeScript, fail-on-console, WCAG 2.2 AA axe. This round decides whether the codebase ships: verify each round-2 fix, judge the new tests, and attack once more with fresh eyes. Be as harsh as round 1 was; do not assume convergence.

Everything in `/docs/qa/round2/BRIEF-common.md` applies (repo, environment, cite-don't-remember, rules, report format), with these updates:

- Round-2 QA reports: `.../scratchpad/qa/round2/<lens>.md` (`prompt-input-chat`, `code-context-model-citation`, `disclosure`, `leaves-tokens`, `meta`, `rendered-surface`). Round-2 fix reports: `.../scratchpad/qa/round2/fix-<lens>.md` (`fix-prompt-input-chat`, `fix-code-context-model-citation`, `fix-disclosure`, `fix-leaves-tokens`, `fix-meta`, `fix-manifest-docs-2`). Treat every claim as a hypothesis.
- The pre-round-2 code: `git show 1e732c0:<path>`. The pre-QA baseline: `git show 86bbd82:<path>`.
- Reproducers go in NEW files `tests/browser/qa-round3/<lens>.test.tsx` / `tests/unit/qa-round3-<lens>.test.ts`; report to `.../scratchpad/qa/round3/<lens>.md`.
- A PRODUCTION server of the CURRENT tree runs on :3000 (the lead rebuilt and restarted it after all round-2 fixes; verify the stylesheet links return 200 before trusting a page; if they do not, say so and stop server-based checks).
- Mutation-test at least six of the round-2 fixes in your lens (copy, patch, run, restore byte-identically).
- Verdict at the end: **ship** or **not yet**, with the blocking items. Only blocker/high findings block; mediums and lows are listed for a follow-up.
