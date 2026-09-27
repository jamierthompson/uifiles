# QA log

The raw briefs and reports from the adversarial QA that ran on this codebase before its first public release. Every file was written by an agent during the run and is unedited except that sandbox paths were rewritten to repository links; screenshots, logs and scratch scripts the reviewers produced are not included.

## How it ran

1. A baseline gate on the untouched tree (52 tests, green).
2. Round 1: nine reviewers with no prior context, one lens each (registry contract, prompt input, code block + context + model selector + citation, disclosure and agent components, chat block and leaf components, test-suite quality with real mutation testing, app + tooling + OSS hygiene, tokens and CSS, and a real-browser pass over every page). Each wrote reproducer tests that failed on the bugs they found.
3. Fix round 1: ten fresh coders with disjoint file ownership fixed every confirmed finding, ported the upstream AI Elements test suites, migrated the reproducers into the canonical test files, and mutation-checked their own tests. A manifest pass and a docs pass applied the strings the coders were not allowed to touch.
4. Round 2: six fresh reviewers verified each round-1 fix, mutation-tested the new suites, and attacked again; five fresh coders fixed what they found.
5. Round 3: four fresh reviewers repeated that. The fixes ran as three coder groups with disjoint file ownership, each checked by three independent verifiers (one per lens: correctness, test quality with mutation testing, regressions) whose default verdict was refuted, then a manifest pass.
6. Integration round: the requests the round-3 coders left for other owners, plus the two refutations the verifiers produced, became three more coder groups (markdown surfaces, docs/previews/pins, a queue repair) and an extras pass; each was verified the same way, and a completeness critic closed the run.

No agent that found a defect fixed it, and no agent that fixed one verified it. The synthesis of every round is in the pull request that carried these changes.

## Round 1

- [BRIEF-common.md](round1/BRIEF-common.md): brief handed to every QA reviewer
- [BRIEF-fix-common.md](round1/BRIEF-fix-common.md): brief handed to every fixer
- [app-tooling-oss.md](round1/app-tooling-oss.md): QA report: app-tooling-oss
- [chat-block-and-leaves.md](round1/chat-block-and-leaves.md): QA report: chat-block-and-leaves
- [code-context-model-citation.md](round1/code-context-model-citation.md): QA report: code-context-model-citation
- [disclosure-agent.md](round1/disclosure-agent.md): QA report: disclosure-agent
- [fix-app-docs-oss.md](round1/fix-app-docs-oss.md): fixer report: app-docs-oss
- [fix-chat-block.md](round1/fix-chat-block.md): fixer report: chat-block
- [fix-code-block-context.md](round1/fix-code-block-context.md): fixer report: code-block-context
- [fix-cot-queue-checkpoint-confirmation.md](round1/fix-cot-queue-checkpoint-confirmation.md): fixer report: cot-queue-checkpoint-confirmation
- [fix-docs-integration.md](round1/fix-docs-integration.md): fixer report: docs-integration
- [fix-leaves.md](round1/fix-leaves.md): fixer report: leaves
- [fix-model-selector-inline-citation.md](round1/fix-model-selector-inline-citation.md): fixer report: model-selector-inline-citation
- [fix-prompt-input.md](round1/fix-prompt-input.md): fixer report: prompt-input
- [fix-reasoning-tool-task-plan.md](round1/fix-reasoning-tool-task-plan.md): fixer report: reasoning-tool-task-plan
- [fix-registry-manifest.md](round1/fix-registry-manifest.md): fixer report: registry-manifest
- [fix-tokens-css.md](round1/fix-tokens-css.md): fixer report: tokens-css
- [fix-tooling.md](round1/fix-tooling.md): fixer report: tooling
- [prompt-input.md](round1/prompt-input.md): QA report: prompt-input
- [registry-contract.md](round1/registry-contract.md): QA report: registry-contract
- [rendered-surface.md](round1/rendered-surface.md): QA report: rendered-surface
- [test-quality.md](round1/test-quality.md): QA report: test-quality
- [tokens-css.md](round1/tokens-css.md): QA report: tokens-css

## Round 2

- [BRIEF-common.md](round2/BRIEF-common.md): brief handed to every QA reviewer
- [BRIEF-fix-common.md](round2/BRIEF-fix-common.md): brief handed to every fixer
- [code-context-model-citation.md](round2/code-context-model-citation.md): QA report: code-context-model-citation
- [disclosure.md](round2/disclosure.md): QA report: disclosure
- [fix-code-context-model-citation.md](round2/fix-code-context-model-citation.md): fixer report: code-context-model-citation
- [fix-disclosure.md](round2/fix-disclosure.md): fixer report: disclosure
- [fix-leaves-tokens.md](round2/fix-leaves-tokens.md): fixer report: leaves-tokens
- [fix-manifest-docs-2.md](round2/fix-manifest-docs-2.md): fixer report: manifest-docs-2
- [fix-meta.md](round2/fix-meta.md): fixer report: meta
- [fix-prompt-input-chat.md](round2/fix-prompt-input-chat.md): fixer report: prompt-input-chat
- [leaves-tokens.md](round2/leaves-tokens.md): QA report: leaves-tokens
- [meta.md](round2/meta.md): QA report: meta
- [prompt-input-chat.md](round2/prompt-input-chat.md): QA report: prompt-input-chat
- [rendered-surface.md](round2/rendered-surface.md): QA report: rendered-surface

## Round 3

- [BRIEF-common.md](round3/BRIEF-common.md): brief handed to every QA reviewer
- [BRIEF-fix-3b.md](round3/BRIEF-fix-3b.md): brief handed to the integration-round coders
- [BRIEF-fix-3c.md](round3/BRIEF-fix-3c.md): brief handed to the polish-round coders
- [BRIEF-fix-common.md](round3/BRIEF-fix-common.md): brief handed to every fixer
- [components-a.md](round3/components-a.md): QA report: components-a
- [components-b.md](round3/components-b.md): QA report: components-b
- [critic.md](round3/critic.md): completeness critic
- [fix-citation-chat.md](round3/fix-citation-chat.md): fixer report: citation-chat
- [fix-docs-previews-pins.md](round3/fix-docs-previews-pins.md): fixer report: docs-previews-pins
- [fix-extras.md](round3/fix-extras.md): fixer report: extras
- [fix-manifest.md](round3/fix-manifest.md): fixer report: manifest
- [fix-markdown-surfaces.md](round3/fix-markdown-surfaces.md): fixer report: markdown-surfaces
- [fix-meta.md](round3/fix-meta.md): fixer report: meta
- [fix-prompt-input-polish.md](round3/fix-prompt-input-polish.md): fixer report: prompt-input-polish
- [fix-queue-repair.md](round3/fix-queue-repair.md): fixer report: queue-repair
- [fix-repair-3c.md](round3/fix-repair-3c.md): fixer report: repair-3c
- [fix-response-branch-disclosure.md](round3/fix-response-branch-disclosure.md): fixer report: response-branch-disclosure
- [fix-tests-polish.md](round3/fix-tests-polish.md): fixer report: tests-polish
- [meta.md](round3/meta.md): QA report: meta
- [rendered-surface.md](round3/rendered-surface.md): QA report: rendered-surface
- [verify-docs-previews-pins-correctness.md](round3/verify-docs-previews-pins-correctness.md): verifier verdict: docs-previews-pins (correctness)
- [verify-docs-previews-pins-regressions.md](round3/verify-docs-previews-pins-regressions.md): verifier verdict: docs-previews-pins (regressions)
- [verify-docs-previews-pins-tests.md](round3/verify-docs-previews-pins-tests.md): verifier verdict: docs-previews-pins (tests)
- [verify-extras-correctness.md](round3/verify-extras-correctness.md): verifier verdict: extras (correctness)
- [verify-extras-regressions.md](round3/verify-extras-regressions.md): verifier verdict: extras (regressions)
- [verify-extras-tests.md](round3/verify-extras-tests.md): verifier verdict: extras (tests)
- [verify-markdown-surfaces-correctness.md](round3/verify-markdown-surfaces-correctness.md): verifier verdict: markdown-surfaces (correctness)
- [verify-markdown-surfaces-regressions.md](round3/verify-markdown-surfaces-regressions.md): verifier verdict: markdown-surfaces (regressions)
- [verify-markdown-surfaces-tests.md](round3/verify-markdown-surfaces-tests.md): verifier verdict: markdown-surfaces (tests)
- [verify-meta-correctness.md](round3/verify-meta-correctness.md): verifier verdict: meta (correctness)
- [verify-meta-regressions.md](round3/verify-meta-regressions.md): verifier verdict: meta (regressions)
- [verify-meta-tests.md](round3/verify-meta-tests.md): verifier verdict: meta (tests)
- [verify-prompt-input-polish-correctness.md](round3/verify-prompt-input-polish-correctness.md): verifier verdict: prompt-input-polish (correctness)
- [verify-prompt-input-polish-regressions.md](round3/verify-prompt-input-polish-regressions.md): verifier verdict: prompt-input-polish (regressions)
- [verify-prompt-input-polish-tests.md](round3/verify-prompt-input-polish-tests.md): verifier verdict: prompt-input-polish (tests)
- [verify-queue-repair-correctness.md](round3/verify-queue-repair-correctness.md): verifier verdict: queue-repair (correctness)
- [verify-queue-repair-regressions.md](round3/verify-queue-repair-regressions.md): verifier verdict: queue-repair (regressions)
- [verify-queue-repair-tests.md](round3/verify-queue-repair-tests.md): verifier verdict: queue-repair (tests)
- [verify-repair-3c.md](round3/verify-repair-3c.md): verifier verdict: repair (3c)
- [verify-response-branch-disclosure-correctness.md](round3/verify-response-branch-disclosure-correctness.md): verifier verdict: response-branch-disclosure (correctness)
- [verify-response-branch-disclosure-regressions.md](round3/verify-response-branch-disclosure-regressions.md): verifier verdict: response-branch-disclosure (regressions)
- [verify-response-branch-disclosure-tests.md](round3/verify-response-branch-disclosure-tests.md): verifier verdict: response-branch-disclosure (tests)
- [verify-tests-polish-correctness.md](round3/verify-tests-polish-correctness.md): verifier verdict: tests-polish (correctness)
- [verify-tests-polish-regressions.md](round3/verify-tests-polish-regressions.md): verifier verdict: tests-polish (regressions)
- [verify-tests-polish-tests.md](round3/verify-tests-polish-tests.md): verifier verdict: tests-polish (tests)

## Other files

- [workflows/fix-round-3.js](workflows/fix-round-3.js): the round-3 fix workflow (fixers, verifiers, manifest, critic).
- [HANDOFF.md](HANDOFF.md): the state document the lead kept for continuity across context resets.
- [pr-body.md](pr-body.md): the pull request body as opened.
- [RECOMMENDATIONS.md](RECOMMENDATIONS.md): release and bug-catching recommendations written for the maintainer.
