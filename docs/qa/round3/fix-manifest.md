# fix-manifest (round 3)

Owned files: `registry/ai/registry.json`, `registry/blocks/registry.json`. Nothing else touched. No commits: while I worked, the lead amended the checkpoint commit and it picked up both manifests. `82f6e83` now has them, and `git show HEAD:registry/ai/registry.json` equals the working copy.

Scratch: `<scratchpad>/manifest/`
- `apply.mjs`: the script that applied every change. Each replacement asserts that its old text appears exactly once.
- `*.registry.before.json`: the manifests before my changes.
- Logs: `prettier.log`, `validate.log`, `unit-run{1,2,3}.log`.
- `*.cur.txt` / `*.new.txt`: word-diff inputs.

Sources: `fix-citation-chat.md` (exact strings taken from `fix-citation-chat/registry-strings.json`), `fix-response-branch-disclosure.md`, `fix-meta.md` ("Registry entry changes: None").

## Per item

8 items changed: 7 in `registry/ai`, plus `chat`. Descriptions are unchanged, because no report proposed one. I re-read each description against the source and all are still accurate. The longest is 706 characters (prompt-input), under the 900 limit. Every `docs` still starts with the "Built for the Base UI styles…" sentence. Items are still sorted by name. Key order is unchanged, except that the new `css` key goes between `files` and `docs`, as in `registry/base`.

| Item | Change | Source |
| --- | --- | --- |
| inline-citation | `docs` replaced verbatim | fix-citation-chat |
| prompt-input | `docs` replaced, one clause corrected (C1) | fix-citation-chat |
| chat (blocks) | `docs` replaced verbatim | fix-citation-chat |
| response | new `css` field; `docs` replaced, two clauses corrected (C2, C3) | fix-response-branch-disclosure |
| reasoning | new `css` field (same object); `docs` appended, plus one clause and one sentence (C4) | fix-response-branch-disclosure |
| branch | two sentence replacements in `docs`, the first reworded (C5) | fix-response-branch-disclosure |
| checkpoint | clause replacement in `docs`, corrected (C6) | fix-response-branch-disclosure |
| queue | `docs` appended verbatim | fix-response-branch-disclosure |

The `css` value is `{ "@layer base": { ".katex-display": { "overflow": "auto hidden", "padding-block": "0.25em" } } }`. I adopted the field, so response's docs keep the wording "this item adds … to your globals.css"; the fallback wording in the fix report is not needed. Checks:
- `registryItemSchema` from `shadcn/schema` accepts the field on a `registry:component`.
- `pnpm registry:validate` passes.
- shadcn's `add-components.ts` merges `tree.css` from every resolved item into `updateCss`, so installing `@uifiles/chat` (which depends on response and reasoning) writes the rule too.

## Claims verified and corrected

I checked every sentence of the new text against the current source, and also the unchanged sentences around it:
- inline-citation: aria-expanded/aria-controls (`inline-citation.tsx:270-276`); consumer body id followed via `setPopupIdOverride`.
- pinned-only `role="dialog"` with `aria-labelledby` = badge id. Base UI's `PreviewCardTrigger` always gives the badge an id through `useBaseUiId`, so the "Sources" fallback never shows in practice.
- Escape restores focus to the badge also when focus fell to body in a pinned card; `focus-visible` ring on the popup; `aria-disabled` Prev/Next with `aria-disabled:opacity-50`, and consumer props spread last.
- prompt-input: `currentFiles()` / provider `attachmentsRef`; `inFlightFileIdsRef`; `submitTurnRef` ordering; `toKeyShortcuts` output for all four examples; consumer `aria-keyshortcuts` spread last.
- chat: `submitInBackground` returns `false` on a synchronous throw, and ChatComposer then returns `false`; the suggestion path goes through the same helper.
- response: `LinkSafetyDialog` via `renderModal` with `...linkSafety` spread last; Streamdown's default `openExternalLink` is "Open external link?".
- Streamdown renders `renderModal`'s output as a sibling of the link `<button>`, so inside the paragraph (`streamdown/dist/chunk-YOKDWASO.js`), and renders a plain `<a>` when `enabled: false`.
- branch: `componentOf` unwraps memo, forwardRef and lazy and throws a promise that is still loading; `reportedClampRef`.
- checkpoint: `textOf` and `normalize`.
- queue: `title` before the spread; `max-w-[100px] truncate`; `line-clamp-2`.

Corrections (the code wins):

- **C1 prompt-input (13):** the proposal said "elements with a non-negative `tabindex`". It now says "elements with a `tabindex` other than -1". `INTERACTIVE_SELECTOR` (`prompt-input.tsx:1211`) is `[tabindex]:not([tabindex="-1"])`, which also matches other negative values.
- **C2 response, Math marker:** "formulas sideways only)" became "formulas sideways only, and only once the `.katex-display` rule below lets them scroll)". `MATH.overflows` (`response.tsx:58-66`) marks a formula only when its computed `overflow-x` is `auto` or `scroll`, so without the rule no formula is marked. The proposal suggested every overflowing formula becomes a tab stop.
- **C3 response, padding:** "keeps limits, braces and accents from being clipped" became "keeps its tall parts (limits, over- and underbraces) from being clipped". The pixel test ("clips none of their tall parts") covers limits, braces, matrices, roots, cases and boxed formulas, but no accents. The `app/globals.css` comment also says "limits, underbraces".
- **C4 reasoning:** the proposed append is applied. I added ", so the formula scrolls sideways in its own box" (as response says), and one sentence: "ReasoningContent renders Streamdown directly, so unlike @uifiles/response it does not make overflowing code blocks, tables or formulas keyboard tab stops and it shows Streamdown's own link-safety modal."
  - Why: `reasoning.tsx:257` renders `<Streamdown>` directly, with no scroller marking and no `renderModal`. With the new rule, a reader of both docs would otherwise assume the two items behave the same.
  - This goes beyond the proposal. **Drop it when the reasoning owner moves ReasoningContent to MessageResponse** (requested in fix-response-branch-disclosure).
- **C5 branch:** the proposal said "it looks through fragments and plain elements among its own children, through memo/forwardRef wrappers, and through the client references…". That reads as if MessageBranch also searches inside memo or forwardRef components. `countBranches` only recurses into fragments and host elements. `componentOf` unwraps memo, forwardRef and lazy only to recognise MessageBranchContent itself.
  - New text: "it finds the content among its own children and inside fragments and plain elements, also when the content is wrapped in memo or forwardRef or is a client reference a Server Component hands over in the App Router (a reference whose module is still loading suspends MessageBranch until it is in)".
  - The rest of the sentence, and the StrictMode clause, are as proposed.
- **C6 checkpoint:** the proposal said "the description stays when a child component renders part of the name". In the code, any component child makes `textOf` return undefined, so the description stays even when that component renders no text, such as an icon (`checkpoint.tsx:53-73, 100-104`). Children are read only when there is no non-empty aria-label.
  - New text: "…so `Checkpoint {index}` counts). The description stays when there is no aria-label and a child is a component (an icon included), since a component's output cannot be read while rendering, and whenever aria-labelledby names the button; your own aria-describedby wins."

Applied verbatim, and verified: inline-citation, chat, queue, and the rest of prompt-input, response, branch and checkpoint. I diffed the response base text against the report line; it matches exactly once C2 and C3 are reversed.

## Verification

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
node scratchpad/manifest/apply.mjs                      # applied (every replaceOnce matched exactly once)
pnpm exec prettier --write registry/ai/registry.json registry/blocks/registry.json
  registry/ai/registry.json 41ms / registry/blocks/registry.json 3ms
pnpm exec prettier --check <both>                       # All matched files use Prettier code style!
pnpm exec biome check <both>                            # Checked 2 files in 3ms. No fixes applied.
pnpm registry:validate                                  # √ Registry is valid. √ Checked 8 registry files and 83 items.
pnpm exec vitest run --project unit   (x3)              # Test Files 8 passed (8)  Tests 323 passed (323)  x3
```

The unit run includes `tests/unit/registry.test.ts`, which checks:
- descriptions ≤ 900 characters, titles present, each docs string one paragraph with balanced `"` and backticks;
- the llms.txt route lists every description.

The `public/r` build-output tests still pass against the old build; they compare item names, which are unchanged. Structural check: only `docs` changed (plus `css` on response and reasoning), on exactly the 8 items above; item count 18/1 unchanged; items sorted.

## Not done / for the lead

- Not round-tripped through the real CLI, because build and dev are forbidden. After `pnpm registry:build`:
  - `pnpm dlx shadcn@latest view @uifiles/response` should show `css`;
  - `add @uifiles/response --dry-run` from a scratch project should report the globals.css update.
- `registry/base/registry.json` `css` is maintained by hand (sync-tokens generates only `cssVars`) and does not carry the `.katex-display` rule that `app/globals.css` now has. That is fine, because response and reasoning ship it; mention it only if base is meant to mirror globals.css's `@layer base`.
- Idea, not applied: the `css` field also supports `@import` (shadcn's `update-css.ts` places imports at the top). The Streamdown and KaTeX stylesheet steps in the response, reasoning and chat docs could be shipped the same way instead of as manual steps.
- `docs/architecture.md` §3 should list the new `css` field and the link-safety dialog; that was already requested by fix-response-branch-disclosure.
