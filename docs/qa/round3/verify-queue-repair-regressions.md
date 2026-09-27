# verify-queue-repair-regressions

Lens: regressions and side effects on neighbours. Checkpoint: `82f6e83`. Evidence logs:
`/docs/qa/round3/verify-queue-repair/`
(`chat-queue-run1.log`, `queue-run{2,3}.log`, `response-run1.log`, `unit.log`, `unit2.log`, `tsc.log`, `biome.log`, `prettier.log`, `registry-validate.log`, `title-probe.log`).

refuted: false

## Problems

None that refute. Two side effects to know about, neither a regression in anything a consumer or test relied on:

1. `registry/ai/queue.tsx:91` — every `QueueItemContent` with string children now carries a `title`, so the accessibility tree exposes the item text a second time. Measured with vitest's jest-dom matchers (dom-accessibility-api) on a clamped item inside a full `Queue`: accessible name = "Also update the README with the new setting" and accessible description = the same string; before this repair a bare span had neither. This is exactly the shape the pre-existing `QueueItemFile` chip already has (`registry/ai/queue.tsx:191`; probe: chip name = description = "settings-mockup-final-approved-v2.png"), the `li` stays unnamed (name "" / description ""), and axe passes in light and dark on that fixture. Chromium's own tree could not be inspected from inside Vitest (no CDP), and it typically uses a generic's `title` as name only, so the real-world exposure is one extra announcement at most. Noted, not refuting: same accepted pattern, no axe rule fires.
2. The tooltip helps pointer users only; keyboard and touch users still see the two-line clamp. That is the scope the lead set for this finding (clamp half = title mirror), not a regression.

## Hunk accounting (`git diff 82f6e83 -- <file>`)

- `registry/ai/queue.tsx` (2 hunks, both the fix): line 74 destructures `children`; lines 89-95 add the comment, `title={typeof children === "string" ? children : undefined}` placed BEFORE `{...props}` (consumer `title` wins), and render `{children}` explicitly. Nothing else changed; the `line-clamp-2 grow break-words` classes and `QueueItemFile` are byte-identical to the checkpoint.
- `tests/browser/ai/queue.test.tsx` (2 hunks): lines 163-185 add `TEXT_SPACING`, `SPACED_TITLE` and the `SpacedTitles` fixture (in `<main>`); lines 381-410 add the one new test (47 -> 48). No `allowConsole`, no console spies, no new imports.
- `tests/browser/ai/response.test.tsx` (2 hunks): line 9 adds `settle` to the `@/tests/a11y` import; line 706 adds `await settle()` before the first `page.screenshot` in "leaves formulas that fit unmarked and clips none of their tall parts". `settle()` (`tests/a11y.ts:13-24`) only awaits finite document-timeline animations; it cannot change what the test asserts.
- `registry/ai/registry.json`: for this group only the `queue` entry's `docs` (line 213) changed; `description` unchanged. The other hunks in that file (code-block, reasoning, response) belong to the markdown-surfaces group and were not assessed here.

## Consumers of `QueueItemContent` / `QueueItemFile`

- `registry/blocks/chat/**`: no reference to queue at all (`grep -rni queue registry/blocks` -> none), so the chat block's rendering cannot change. It was still run with queue: `pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/queue.test.tsx` -> `Test Files 2 passed (2)`, `Tests 115 passed (115)`, 34.73s, exit 0.
- `app/preview/queue/page.tsx:79-81` (`{todo.title}`, `QueueTodo.title: string`) and `:117` (`{message.text}`, string literals): both now get `title` equal to their text; neither passes a `title` of its own nor non-string children. `:130` `QueueItemFile` with a string: unchanged behaviour.
- `tests/unit/ssr.test.ts:313` renders `QueueItemContent` with a string through `renderToString`; the attribute is computed identically on server and client (`typeof children`), no hydration divergence possible. `tests/unit/ssr.test.ts` passed.
- Existing tests in `tests/browser/ai/queue.test.tsx` (`:309-379`, `:556-590`, `:813-926`) all pass string children and none asserts the absence of `title`; no test in `tests/browser/` uses `getByTitle`. `tests/browser/qa-round3/*`, `tests/unit/qa-round3-*` and `e2e/` contain no queue reference.
- `.claude/skills/ai-elements/scripts/queue.tsx` is the vendored upstream example, not a consumer.

## Runs

- queue three times: combined run above (48 in the 115), then `queue-run2.log` `48 passed (48)` 4.23s exit 0, `queue-run3.log` `48 passed (48)` 4.16s exit 0.
- `tests/browser/ai/response.test.tsx` once after the `settle()` addition: `31 passed (31)`, 7.84s, exit 0.
- Throwaway `tests/browser/verify-queue-title-probe.test.tsx` (created and deleted in one command): a deliberately failing probe printing the computed name/description values listed above, two hypothesis tests (both failed, which is how the name AND description result was established), and "axe passes on a clamped, titled queue in light and dark" -> passed. Its failure screenshot directory under `.vitest/attachments/failure-screenshots/` was removed; `.vitest/` is gitignored; `git status --short` shows no untracked or added files. No tracked file was edited by this verification.

## Docs

- `queue` docs: 0 newlines (one paragraph), starts with the Base UI sentence ("Built for the Base UI styles (base-nova): it composes the Base UI wrappers ..."), and the tail describes `queue.tsx:83`, `:91` and `:190-195` accurately: "QueueItemContent clamps titles to two lines (upstream one) ...; the clamp cuts whole lines. QueueItemFile truncates the file name at 100px. Both the chip and the item title mirror the whole text in a title attribute when their children are a string (your own title wins), so a truncated file name, or a title that WCAG 1.4.12 text spacing pushes onto a third line, stays readable on hover."
- `pnpm exec vitest run --project unit tests/unit/registry.test.ts tests/unit/ssr.test.ts tests/unit/site.test.ts` -> `Test Files 3 passed (3)`, `Tests 92 passed (92)`.
- Neighbouring docs owned by the docs group already match the code: `docs/architecture.md:189-195` ("`QueueItemContent` and the `QueueItemFile` chip copy string children into a `title` attribute (a consumer's `title` wins, composed children get none) ...") and `CHANGELOG.md:89-92` ("item titles and file chips carry their whole text in a `title` attribute ...").

## Static

- `pnpm exec tsc --noEmit`: exit 0, no output (strict flags from `tsconfig.json`).
- `pnpm exec biome check registry/ai/queue.tsx tests/browser/ai/queue.test.tsx tests/browser/ai/response.test.tsx registry/ai/registry.json`: "Checked 4 files in 26ms. No fixes applied."
- `pnpm exec prettier --check` on the same four: "All matched files use Prettier code style!"
- `pnpm registry:validate`: "√ Registry is valid. √ Checked 8 registry files and 83 items."
- `pnpm exec vitest run --project unit tests/unit/tooling.test.ts tests/unit/test-setup.test.ts` (the tests that police `tests/browser/` for console spies and bare specifiers): `46 passed (46)`.
- No static check failed in any file, inside or outside this group, so no re-run was needed.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
git diff 82f6e83 -- registry/ai/queue.tsx tests/browser/ai/queue.test.tsx tests/browser/ai/response.test.tsx registry/ai/registry.json
git diff 82f6e83 --stat
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/queue.test.tsx
pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx   # x2
pnpm exec vitest run --project browser tests/browser/ai/response.test.tsx
pnpm exec vitest run --project browser tests/browser/verify-queue-title-probe.test.tsx && rm that file
pnpm exec vitest run --project unit tests/unit/registry.test.ts tests/unit/ssr.test.ts tests/unit/site.test.ts
pnpm exec vitest run --project unit tests/unit/tooling.test.ts tests/unit/test-setup.test.ts
pnpm exec tsc --noEmit
pnpm exec biome check <four files>
pnpm exec prettier --check <four files>
pnpm registry:validate
```
