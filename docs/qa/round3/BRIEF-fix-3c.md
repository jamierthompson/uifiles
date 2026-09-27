# Fix round 3c (polish): common brief

Read `/docs/qa/round3/BRIEF-fix-3b.md` first (it chains to every earlier fix brief; all rules apply: file ownership, no commits, no build/dev/e2e/server commands, a test that failed first for every behaviour change, mutation-check, three runs, console guard, report format). No verifier is running while you work, but the OTHER 3c coder is; do not touch its files.

Round 3c exists because the completeness critic (`.../qa/round3/critic.md`, verdict "ship") listed low findings that are cheap to close now: its fresh-look items N15 and N16 in `prompt-input`, and the test/tooling gaps N1, N4, N5, N6, N7, N9, N10, N11, N13. Everything else on its list stays as documented residue.

## Group `prompt-input-polish` (Opus coder)
Owns: `registry/ai/prompt-input.tsx`, `tests/browser/ai/prompt-input.test.tsx`, `registry/ai/inline-citation.tsx`, `tests/browser/ai/inline-citation.test.tsx`, the `prompt-input` and `inline-citation` entries of `registry/ai/registry.json` (docs strings only), `CHANGELOG.md` lines for these two items.

## Group `tests-polish` (Opus coder)
Owns: `tests/unit/registry.test.ts`, `tests/browser/ai/code-block.test.tsx`, `tests/unit/test-setup.test.ts`, `tests/unit/site.test.ts`, `tests/unit/tooling.test.ts`, `e2e/previews.spec.ts`, `e2e/origin.ts`, `tests/browser/blocks/chat.test.tsx`, `tests/browser/ai/suggestion.test.tsx`, `AGENTS.md` and `docs/architecture.md` sentences that describe those checks.

## Reports
`/docs/qa/round3/fix-<group>.md`, standard format.
