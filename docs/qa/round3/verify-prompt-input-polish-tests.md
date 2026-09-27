# verify-prompt-input-polish-tests

refuted: false

Lens: test quality and mutation resistance of `tests/browser/ai/prompt-input.test.tsx` (160 → 169) and
`tests/browser/ai/inline-citation.test.tsx` (70 → 71), diffed `9019bdf..5643605`. Scratch:
`/docs/qa/round3/verify-pip-tests/`
(`*.orig` snapshots of the four files, sha256 equal to `git show HEAD:` for both sources; `mutate.py`,
`run-mutations.py`; `mut/<id>.log` + `mut/summary.txt`; `runs/`; `zz-verify-deferred-parent.probe.test.tsx`).

HEAD `5643605` carries the correct `aria-label={canStop ? "Stop" : "Submit"}` at
`registry/ai/prompt-input.tsx:1569` (the coder's "HEAD holds a mutant line" note referred to the earlier
`79858f0`; it is resolved). Working tree clean for the four files before and after every step.

## Every hunk read; judgement

- Names are behavioural (no bug/review names). Fixtures sit in `<main>`: `Composer` (:359), `Bare` (:432),
  the inline `ui()` of the controlled citation test (:314) and the new `ControlledCitation` (:177).
- a11y goes through `@/tests/a11y` only (`expectNoViolations`, `withDark`); no copied `settle`/`axe.run`.
  Axe in the new states: Submit-named button while submitted and while streaming without `onStop`
  (prompt-input :3389-3411, `expectNoViolations()` before the click, ×2), on top of the pre-existing
  per-status sweep with `onStop` (:3879); closed-then-reopened citation peek (inline-citation :390-396,
  popup scanned on its own plus page scan excluding `[data-base-ui-portal]`).
- No fixed sleeps. The double-submit pair (:903-945) gates `window.fetch` on a `deferred()` promise, fires
  `requestSubmit()` twice synchronously, resolves the gate, then `expect.poll(onSubmit).toHaveBeenCalledTimes(2)`,
  `settled(calls, 2)` (poll, then a 100 ms hold sampled every 10 ms for the "no third call" negative;
  pre-existing helper at :79), `expect.poll(count).toBe("0")`, then the textarea value. The pending-typing
  test (:750) and the reject/restore tests use `deferred()` + `expect.poll`/`settled` the same way.
- No `.skip`/`.only`/`retry` (grep only hit the literal "retry me" text). No `allowConsole` added (the four
  present, :1899/:1914/:2479/:2768, predate the round). The single console spy (:2769) has no
  implementation; no `vi.spyOn(console…).mockImplementation` in either file.
- Upstream icon tests: "shows loading icon when submitted" (:3370) keeps upstream's fixture (no `onStop`)
  and its assertion (`.animate-spin`), now on the Submit-named button. "shows stop icon when streaming"
  (:3380) now passes `onStop`; upstream's version (no `onStop`) asserted only that a button rendered,
  and under the new contract the square needs `onStop`, so the fixture had to change to still assert a
  stop icon; it now also asserts `type="button"`. The no-`onStop` streaming case is the table test at :3389.
  Both still assert what upstream's names mean.
- Assertions are strong where it matters: `expect(popup()?.contains(document.activeElement)).toBe(false)`
  fails on a missing popup too; the refused second press ends on `getByRole("dialog").query()` null (:366),
  which my v06 shows is load-bearing.

## Mutation table (all on `registry/ai/*.tsx`, whole test file run, restored from my `.orig` with
`filecmp` and `git diff --stat` asserted empty by the harness)

| id | mutation | result | caught by |
| --- | --- | --- | --- |
| s01 | `aria-label={isGenerating ? "Stop" : "Submit"}` | CAUGHT 5 | no-onStop Enter ×2, "shows loading icon when submitted", no-onStop Submit ×2 |
| s02 | square whenever streaming | CAUGHT 1 | "keeps the Submit name … while streaming without onStop" |
| s03 | `canStop = onStop !== undefined` | CAUGHT 2 | "stays a Submit button while ready/error even with onStop wired" ×2 |
| s04 | `type={isGenerating ? "button" : "submit"}` | CAUGHT 5 | same five as s01 |
| s05 | spinner only with `onStop` | CAUGHT 2 | "shows loading icon when submitted", no-onStop Submit (submitted) |
| p01 | no provider clear at submit start | CAUGHT 5 | provider restore, pending-typing, double submit, reject-then-offer, "keeps the provider text when onSubmit rejects …" |
| p02 | text from render closure, not the ref | CAUGHT 1 | provider double submit (received `"hi"` twice) |
| p03 | provider text never restored | CAUGHT 4 | provider restore, provider reject-then-offer, two existing provider keep tests |
| p04 | restore even when typed since | CAUGHT 1 | provider restore ("new draft" step) |
| p05 | `commit()` clears provider text | CAUGHT 1 | "keeps what the user types while a provider-mode submit is pending …" |
| p06 | `setInput` skips the ref | CAUGHT 6 | six provider tests |
| c01 | no pin reset | CAUGHT 2 | both controlled citation tests |
| c02 | reset pin whenever controlled | CAUGHT 2 | both controlled citation tests |
| v01 (mine) | Stop only while `streaming`: `canStop = status === "streaming" && onStop !== undefined` | CAUGHT 2 | "does not submit or stop on Enter while submitted with a Stop button", "renders Stop as type=button while submitted with onStop" |
| v02 (mine) | `clearInput` skips the ref (old `() => setTextInput("")`) | CAUGHT 5 | provider restore, double submit, reject-then-offer, two existing provider keep tests |
| v03 (mine) | restore gate reads the stale closure `controller.textInput.value === ""` | CAUGHT 4 | provider restore, reject-then-offer, two existing provider keep tests |
| v04 (mine) | provider clear deferred one microtask (`Promise.resolve().then(clear)`): second submit in the same tick carries the old text | CAUGHT 1 | provider double submit |
| v05 (mine) | pin reset only when uncontrolled (`&& !isControlled`) | CAUGHT 2 | both controlled citation tests |
| v06 (mine) | press-close drops `setPinned(false)`: a refused press-close keeps the pin | CAUGHT 1 | "reports a press … leaves a controlled open alone" at the final `dialog` null assertion (`expected <div data-open …> to be null`) |

19/19 caught (13/13 of the coder's reproduced; 6/6 of mine). Candidates I did not run: "pinned reset only on
Escape" and "deferred-parent pin kept" reduce to c01 (the render-time reset makes every close path reset the
pin) or to an effect-based reset that is behaviourally equivalent, so neither is a distinct mutant.

Docs probe: the inline-citation docs claim a parent that defers its answer (`startTransition`) gets the peek
and a second press pins. A temporary untracked test (`zz-verify-deferred-parent.probe.test.tsx`, copied into
`tests/browser/ai/`, run, deleted; `runs/probe-deferred-parent.log`: `Tests 1 passed (1)`) confirms it.

## Three runs each (`runs/*.log`)

```
inline-citation-run1: Tests 71 passed (71)  12.02s    prompt-input-run1: Tests 169 passed (169)  27.17s
inline-citation-run2: Tests 71 passed (71)  12.24s    prompt-input-run2: Tests 169 passed (169)  28.16s
inline-citation-run3: Tests 71 passed (71)  11.80s    prompt-input-run3: Tests 169 passed (169)  27.58s
```

## Problems (none refuting)

1. `tests/browser/ai/prompt-input.test.tsx`: no axe scan renders under `PromptInputProvider` anywhere in
   the file (awk over every `it()` block: none contains both `PromptInputProvider` and `expectNoViolations`);
   the provider double-submit test (:903-945) ends without one. Provider mode changes no DOM, so this is a
   gap in coverage breadth, not a wrong assertion.
2. `tests/browser/ai/prompt-input.test.tsx:3380` "shows stop icon when streaming" no longer runs upstream's
   exact fixture (no `onStop`); the changed contract makes that unavoidable and the no-`onStop` case is
   covered at :3389. Note only.
3. The documented deferred-parent behaviour (`registry/ai/registry.json`, inline-citation docs) has no test
   in the repo; my probe shows it holds today.

Final tree: `git diff --stat` empty and `git status --porcelain` empty for `registry/ai` and
`tests/browser/ai`; sha256 of both sources equal to the snapshots (`a6f9e66d…`, `ede9cd9c…`). Other
verifiers' in-flight edits seen during my runs were in `app/preview/reasoning/page.tsx`,
`registry/blocks/registry.json`, `tests/unit/test-setup.test.ts` only; no run of mine failed.
