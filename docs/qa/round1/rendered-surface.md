# rendered-surface — QA round 1

Scratch dir (scripts, JSON dumps, HTML captures, screenshots): `/docs/qa/round1/rendered-surface/`.
All `shots/...` paths below are relative to that directory. Everything was driven with Playwright 1.63 (Chromium) and axe-core 4.13 (`@axe-core/playwright`) against the running dev server; nothing in the repo was modified and no test files were written.

## Summary

Attacked every rendered surface (`/`, `/preview`, 19 previews, two 404s, `/r/*.json`, `/llms.txt`) in light and dark at 1280×800 and 375×812: console/hydration capture on load and after interaction, axe (wcag2a/aa, 2.1, 2.2, best-practice, violations + incomplete), CLS over 3 s, horizontal overflow, tap-target measurement, full Tab sweeps with computed focus-ring checks, every popup/collapsible/select/menu/carousel/copy/download interaction by mouse and keyboard, reduced-motion emulation, and the chat demo end to end (auto-start, reasoning, tool, copy, follow-up turns, fallback, stop, paste, drop, attachment submit, mobile).
23 findings: 5 high, 6 medium, 9 low, 3 nit. No blocker for install/build, but two things will embarrass the launch: the chat block corrupts its transcript (40 phantom messages, thousands of duplicate-key errors) the moment a user presses Enter while a reply is still streaming, and the `response`/`reasoning` math renders every formula twice because the KaTeX stylesheet is never loaded. Four of the high findings are keyboard/a11y failures the desktop-only e2e suite structurally cannot see (three only appear at mobile width; one is a focusable-but-invisible control).

## Findings (most severe first)

### F1. Chat block: submitting while a reply is in flight corrupts the transcript — severity: high
- Where: `registry/blocks/chat/components/blocks/chat.tsx` `ChatComposer.handleSubmit` (guards only empty text; no status guard) and `ChatMessagePart`; preview `app/preview/chat/page.tsx`.
- What: on `/preview/chat`, type any text and press Enter while the first scripted reply is streaming (Stop button showing). Result (3/3 runs): the transcript grows to **40 messages** with ids alternating `demo-message-2` / `demo-message-4`, React logs **3335 × "Encountered two children with the same key, `demo-message-2`"**, and the "reply" rendered is turn 1 again. Pressing Enter while status is `submitted` (thinking marker visible, before the first chunk) instead reorders the transcript to `[user1, user2, assistant(turn-1 text)]` and the second question is never answered (2/2 runs, no console errors). Sequential use (wait for `ready`) works: `[demo-message-1, demo-message-2, <user>, demo-message-4]`, then the fallback (`chat5.mjs` happy path, `chat2.mjs` run 2, `chat3.mjs` variant D).
- Evidence: `node chat5.mjs` → `S2: Enter while status=streaming {"after":{"n":40,"ids":["demo-message-1","demo-message-2","9VZLXi6YDXB1JTuj","demo-message-2","demo-message-4","demo-message-2",...]},"dupKeyErrors":3335}` and `S1: Enter while status=submitted {"after":{"n":3,"roles":["u","u","a"],"lastText":"Add the token in three places..."}}`. Screenshots `shots/chat-22-enter-during-streaming.png`, `shots/chat-21-enter-during-submitted.png`, `shots/chat-16-duplication.png`. Root cause verified in `node_modules/ai/dist/index.js:22561-22646` (`makeRequest` creates a second `activeResponse` without aborting the first; only `activeResumeRequest` is aborted at :22572), so two streams write alternately and every chunk pushes a new message because the last message id keeps flipping. Upstream AI Elements examples guard this themselves (`upstream/ai-elements/packages/examples/src/chatbot.tsx:581`, `demo-claude.tsx:816` disable submit while streaming; `queue-prompt-input.tsx:283` queues).
- Why it matters: Enter-while-streaming is the most common thing a user does in a chat UI; the block is the registry's showcase and the demo transport is what founders will click on first.
- Proposed fix: in `ChatComposer.handleSubmit`, when `status` is `submitted`/`streaming` either return (swallow, consistent with the empty-submit rule in AGENTS.md), or call `onStop()` and then send, or queue. Do not `disabled` the button (input-group fades).
- Test written: none (scratch scripts only, per lens brief). Repro: `chat5.mjs` S1/S2.

### F2. KaTeX stylesheet is never loaded: every formula renders twice (`response`, `reasoning`) — severity: high
- Where: `app/globals.css` (imports `streamdown/styles.css` but not `katex/dist/katex.min.css`); `registry/ai/response.tsx:16` and `registry/ai/reasoning.tsx:219` (both pass the `@streamdown/math` plugin); registry `docs`/`dependencies` for `response`, `reasoning`, `chat` do not mention the KaTeX CSS.
- What: `/preview/response` shows the rendered `$$c_eff = h·c_hit + (1−h)·c_miss$$` and, directly under it, the plain-text MathML fallback `ceff = h · chit + (1 − h) · cmiss`, in both themes. Screen readers get both too.
- Evidence: built CSS has 0 `katex` rules (`grep -c katex built.css` → 0); `.katex-mathml` computed `position: static`, `clip: auto`, bounding box 702×15 (`interact.mjs`: `FAIL: KaTeX MathML fallback hidden ... "katexCssLoaded":false`). Streamdown's own README (`node_modules/streamdown/README.md:117`) says `import "katex/dist/katex.min.css"`. `katex` is only present transitively at `node_modules/.pnpm/katex@0.16.47/...`. Screenshots `shots/preview_response--light-desktop.png`, `shots/preview_response--dark-desktop.png`, `shots/int-response-katex.png`.
- Why it matters: any assistant answer containing math is visibly broken; consumers who install `@uifiles/response` hit the same unless `docs` tells them.
- Proposed fix: add `katex` as a direct dependency and `@import "katex/dist/katex.min.css"` next to `streamdown/styles.css` in `app/globals.css`; add the same instruction (or a `css` entry) to the `response`/`reasoning`/`chat` registry items.

### F3. Scrollable code regions are not keyboard reachable (axe `scrollable-region-focusable`, serious) — severity: high
- Where: `registry/ai/code-block.tsx:429` (`<div className="relative overflow-auto">`, no `tabIndex`); `app/page.tsx` install `<pre class="overflow-x-auto">`; `registry/ai/response.tsx:29-37` only marks `[data-streamdown="code-block-body"]`, not Streamdown's table wrapper (`div.border-collapse.overflow-x-auto`).
- What: at 375 px the code-block preview's two blocks overflow (scrollWidth 592 / 352 vs clientWidth 341) and cannot be scrolled by keyboard; same for the home install snippet and the response table. axe flags all three pages at mobile width; the desktop-only e2e suite (`playwright.config.ts` uses Desktop Chrome) never sees it.
- Evidence: sweep.json → `/preview/code-block light-mobile`: `scrollable-region-focusable serious ×2` (`div[data-language="typescript"] > .overflow-auto.relative`, `div[data-language="json"] > ...`); `/ light-mobile`: `pre`; `/preview/response light-mobile`: `.border-collapse`. `interact.mjs` `code-block@375`: `[{"tabindex":null,"scrollW":592,"clientW":341},{"tabindex":null,"scrollW":352,"clientW":341}]`. Screenshot `shots/int-code-block-375.png`.
- Why it matters: WCAG 2.1.1 failure on the two most-used components (code-block is also what `tool` renders).
- Proposed fix: give `CodeBlockContent`'s scroller `tabIndex={0}` (+ `role="region"`/`aria-label`) when it overflows, the way `response.tsx` does for Streamdown code; extend the response marker to the table wrapper; add `tabIndex={0}` to the home `pre`. Run the e2e axe job at 375 px too.

### F4. `queue` item actions are focusable but invisible when focused — severity: high
- Where: `registry/ai/queue.tsx:131` (`opacity-0 transition-opacity group-hover:opacity-100`, no `focus-visible:`/`group-focus-within:` variant; carried over from upstream `queue.tsx:129`).
- What: Tabbing through `/preview/queue` lands on 10 buttons ("Mark complete", "Remove task", "Send now", "Remove message") that stay at `opacity: 0` while focused (`:focus-visible` true). The focus ring is invisible too because the whole button is transparent.
- Evidence: `keyboard.mjs` → `/preview/queue: 12 stops ... offscreen/invisible=10`; `focus.mjs` → `"invisible":["BUTTON:Mark complete","BUTTON:Remove task",...]`; `interact.mjs` → `FAIL: actions visible when focused via keyboard {"opacity":"0"}`. Screenshots `shots/int-queue-focused-invisible-action.png`, `shots/focus-preview_queue--light-1.png` … `-11.png`.
- Why it matters: WCAG 2.4.7 (focus visible) / 2.4.11; keyboard users operate controls they cannot see.
- Proposed fix: add `focus-visible:opacity-100 group-focus-within:opacity-100` (and consider `group-has-[:focus-visible]:opacity-100` on the row).

### F5. `inline-citation` cards cannot be opened by keyboard — severity: high
- Where: `registry/ai/inline-citation.tsx:64-91` (`HoverCardTrigger render={<Badge .../>}` → renders a `<span>` with no `tabindex`); wrapper `components/ui/hover-card.tsx` (Base UI `PreviewCard.Trigger`, which opens on focus but does not add `tabIndex` to a non-focusable render element).
- What: `/preview/inline-citation` has zero tab stops; `element.focus()` on the badge does nothing; hover opens the card fine. Upstream has the same flaw (`asChild` + Badge), so this is inherited, not introduced.
- Evidence: `keyboard.mjs` → `/preview/inline-citation: 0 stops`; `interact.mjs` → `trigger elements [{"tag":"SPAN","tabindex":null,...}]`, `FAIL: programmatic focus opens card`. Screenshot `shots/int-inline-citation-open.png` (mouse only).
- Why it matters: WCAG 2.1.1; citations are the only way to reach sources in a response.
- Proposed fix: render the trigger as a button (`render={<Badge render={<button type="button" />} />}`) or add `tabIndex={0}`; Base UI Preview Card already opens on focus (verified on `context`, whose triggers are buttons).

### F6. `response` self-inflicts a hydration mismatch at narrow widths — severity: medium
- Where: `registry/ai/response.tsx:29-52` (`markScrollableCodeBlocks` runs in `useEffect` and sets `tabindex="0"` on DOM that Streamdown still owns inside a not-yet-hydrated `<Suspense>` boundary).
- What: at 375 px (code overflows) React logs "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties … `- tabindex="0"`" pointing at `div[data-streamdown="code-block-body"]`; at 768/1280 px (no overflow) it does not. 2/2 runs at 375, 0/2 at 768 and 1280 (`hydration.mjs`). Server HTML contains no `tabindex` (`grep -c 'tabindex="0"' html/preview_response.html` → 0), so the attribute the boundary sees was added by the effect.
- Evidence: sweep.json `/preview/response light-mobile` and `dark-mobile` console; full stack in `hydration.mjs` output. Also reproduced by `interact.mjs` `response@375`.
- Why it matters: every consumer of `@uifiles/response` who renders code on a phone gets a red hydration error in dev; the fix comment in the file claims to have solved the scrollable-region problem, but it trades it for this.
- Proposed fix: run the marker only after the boundary has hydrated (e.g. from the `MutationObserver` callback / after `requestAnimationFrame` post-hydration), or render the tabindex through React (wrap Streamdown's code block via `components` prop) instead of touching server DOM.

### F7. `branch` logs a missing-key warning on every render when children come from a Server Component — severity: medium
- Where: `registry/ai/branch.tsx:119-127` (`key={branch.key}` at :125 on the wrapper `div`); `app/preview/branch/page.tsx` is a Server Component.
- What: `/preview/branch` logs `Each child in a list should have a unique "key" prop … It was passed a child from MessageBranchContent` on every load (4/4 sweep contexts, 1/1 dedicated run). The children arrive through RSC as `Symbol(react.lazy)` objects (`keys: ["$$typeof","_payload","_init","_debugInfo","_store"]`, no `key`), so `branch.key` is `undefined` even though the resolved child does carry `key="concise"` (`branchkeys3.mjs`: `wrapperChildKey: "concise"`, wrapper fiber key `null`).
- Evidence: `branchkeys2.mjs` / `interact.mjs` output (`children objects [{"typeof":"Symbol(react.lazy)",...}]`, `CONSOLE-AFTER-INTERACTION: Each child in a list should have a unique "key"`).
- Why it matters: any App Router consumer rendering `MessageBranch` from a server page gets permanent console noise; identity falls back to index (works today, fragile).
- Proposed fix: `key={branch.key ?? index}` (or `Children.toArray(children)`), and note RSC usage in `docs`.

### F8. `prompt-input` toolbar overflows at phone width: the Submit button sits on top of the model select — severity: medium
- Where: `registry/ai/prompt-input.tsx:1102-1110` (`PromptInputTools` = `flex min-w-0 items-center gap-1`, overflow visible; identical to upstream) and `PromptInputFooter` (`justify-between`); preview `app/preview/prompt-input/page.tsx` uses four tools.
- What: at 375 px the tools row is 285 px wide with scrollWidth 322; the "Model" select trigger spans x 196–349 and the Submit button x 316–348, so the select's right third is covered by Submit (a tap there submits instead of opening the select). axe reports the buttons as "partially obscured" (incomplete). The chat block's composer (one tool) is fine.
- Evidence: `toolbar.mjs` → `"tools":{"w":285,"scrollW":322,"overflow":"visible"}, "overlapsWithSubmit":["Model"]` (light and dark). Screenshots `shots/toolbar-prompt-input--dark-375.png`, `shots/preview_prompt-input--dark-mobile.png`.
- Why it matters: this is the realistic toolbar (attach, mic, search, model) on the most common phone width.
- Proposed fix: `flex-wrap` on `PromptInputTools`, or `overflow-x-auto` + `shrink-0` on the submit button; or document that consumers must limit tools at small widths.

### F9. Chat block: after Stop mid-reasoning the trigger shows "Thinking…" forever — severity: medium
- Where: `registry/blocks/chat/components/blocks/chat.tsx` `ChatMessagePart` reasoning case (`isStreaming={part.state === "streaming"}`); the part's `state` stays `"streaming"` after `stop()` aborts the request.
- What: click Stop while the reasoning is streaming → status returns to `ready` (Submit button), but the reasoning header keeps the shimmering "Thinking…" label and the panel stays open indefinitely (checked at +3 s and later).
- Evidence: `chat3.mjs` → `FAIL: C: after Stop mid-reasoning (+3s) the reasoning trigger settles {"trigger":"Thinking...","expanded":"true","shimmer":true,"submit":"Submit"}`. Screenshots `shots/chat-17-stopped-stuck-thinking.png`, `shots/chat-09-stopped.png`.
- Why it matters: a stuck loading indicator after the user explicitly stopped.
- Proposed fix: pass chat `status` into `ChatMessagePart` and use `isStreaming={part.state === "streaming" && status === "streaming"}` (same for the tool header "Running" badge, see `shots/chat-18-stopped-during-tool.png`, which shows `readFile Running` after a stop).

### F10. `llms.txt` and the home install command are frozen to `http://localhost:3000` unless a build-time env var is set — severity: medium
- Where: `lib/registry.ts:72-76` (`NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"`), `app/llms.txt/route.ts` (`dynamic = "force-static"`, so the value is baked at build), `app/page.tsx` (`pnpm dlx shadcn@latest init ${origin}/r/base.json`).
- What: current output has 85 `localhost` occurrences in `/llms.txt` and the home page prints `init http://localhost:3000/r/base.json`. Nothing fails the build when the variable is missing; `.env.example` documents it, but the directory reviewers will fetch `/llms.txt` from the production host.
- Evidence: `curl -s localhost:3000/llms.txt | grep -c localhost` → 85; `sweep.json` `/` axe node html shows the localhost command.
- Why it matters: launch-day embarrassment / broken agent instructions if the deploy forgets the env var. (Cannot be verified here: the server cannot be restarted.)
- Proposed fix: throw in `baseUrl()` when `NODE_ENV === "production"` and the var is unset, or derive from the request host for the route.

### F11. Sub-24 px targets on collapsible triggers and links — severity: medium
- Where: `registry/ai/reasoning.tsx:191` / `chain-of-thought.tsx:101` / `task.tsx:62` (trigger rows are 20 px tall), `registry/ai/sources.tsx:34` (`SourcesTrigger` 117×16), Streamdown table copy button (22×22), `/preview` index links (18 px), home links (16 px).
- What: WCAG 2.2 2.5.8 wants ≥ 24×24 CSS px unless the spacing/inline exceptions apply. The full-width 20 px triggers mostly qualify for the spacing exception, but `SourcesTrigger` (16 px) and the two home links (16 px, 4 px apart) do not, and in the chat transcript the 20 px reasoning trigger sits 11 px above the 44 px tool header.
- Evidence: sweep.json `smalls` per page (e.g. `/preview/sources`: `{"tag":"BUTTON","text":"Used 3 sources","w":117,"h":16}`; `/`: two `A` 16 px).
- Proposed fix: `min-h-6` (or `py-0.5`) on the triggers; `inline-block py-1` on doc links.

### F12. No `prefers-reduced-motion` handling for collapsible/enter animations, chevron transitions and the spinner — severity: low
- Where: `app/globals.css` (imports `tw-animate-css`; no `motion-reduce:` variants anywhere in the built CSS); `registry/ai/*` use `data-open:animate-in … slide-in-from-top-2`, `transition-transform`, `animate-spin`.
- What: with `emulateMedia({ reducedMotion: "reduce" })` opening a `task` still runs `enter` (150 ms) and two CSS transitions; the thinking spinner still spins. The shadcn `shimmer` does respect it (the only `prefers-reduced-motion` rule in the CSS).
- Evidence: `interact2.mjs` → `reduced-motion=reduce … animations right after opening a task [{"name":"CSSTransition",...},{"name":"enter","duration":150,...}]`; `grep -c prefers-reduced-motion built.css` → 1 (shimmer only).
- Proposed fix: `motion-reduce:transition-none motion-reduce:animate-none` on the animated classes, or a global `@media (prefers-reduced-motion: reduce)` override for `.animate-in/.animate-out/.animate-spin`.

### F13. `model-selector` fetches provider logos from `https://models.dev` at runtime — severity: low
- Where: `registry/ai/model-selector.tsx:183-191` (`src={\`https://models.dev/logos/${provider}.svg\`}`, `dark:invert`, no `onError` fallback; upstream design).
- What: every render issues third-party requests; when blocked (this sandbox, corporate networks, offline) the trigger and every option show broken-image glyphs and the console logs `Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` ×3.
- Evidence: sweep.json `/preview/model-selector` (`failed: models.dev/logos/{openai,anthropic,google}.svg`). Screenshots `shots/preview_model-selector--light-desktop.png`, `shots/dark-model-selector.png`.
- Proposed fix: document the external dependency in `docs`, add an `onError` fallback (hide or initials), or let consumers pass a `src`.

### F14. 404 pages have no landmark, no theme, no way back — severity: low
- Where: `app/` has no `not-found.tsx`; Next's default 404 renders.
- What: `/nope` and `/preview/nope` → axe `landmark-one-main` + `region` (moderate ×2), body background `rgb(0,0,0)` in dark (Next's own styles, not the tokens), no link to `/`.
- Evidence: sweep.json `/nope`, `/preview/nope`; `shots/nope--dark-desktop.png`.
- Proposed fix: add `app/not-found.tsx` inside the site shell with a `<main>` and a link home.

### F15. `Take screenshot` rethrows unsupported-capture errors as an unhandled rejection — severity: low
- Where: `registry/ai/prompt-input.tsx:453-472` (`PromptInputActionAddScreenshot.handleClick` swallows only `NotAllowedError`/`AbortError` and rethrows the rest at :472; `captureScreenshot` lets `getDisplayMedia` errors propagate).
- What: clicking "Take screenshot" where display capture is unsupported (headless Chromium here: `pageerror: Not supported`; also browsers/iframes without `display-capture` permission policy → `NotSupportedError`/`SecurityError`) produces an unhandled promise rejection, i.e. the Next dev overlay.
- Evidence: `interact.mjs` → `'Add screenshot' clicked … {"errors":["Not supported"]}`, `CONSOLE-AFTER-INTERACTION: ["pageerror: Not supported"]`.
- Proposed fix: catch `NotSupportedError`/`SecurityError`/`InvalidStateError` too (or all `DOMException`s) and surface via an `onError` prop.

### F16. Streamed `reasoning` preview shifts layout heavily on mobile (CLS 0.114) — severity: low
- Where: `app/preview/reasoning/page.tsx` (simulated stream) + `registry/ai/reasoning.tsx` auto-open/auto-close.
- What: CLS over the first 3 s is 0.114 at 375 px (0.033 at 1280): the streaming section grows and then collapses, pushing the two sections below. Inherent to a streaming demo, but it is the only page over the 0.1 "good" threshold.
- Evidence: sweep.json `/preview/reasoning light-mobile cls 0.1141` (all entries on `SECTION.flex.flex-col.gap-3`).
- Proposed fix: put the streaming demo last on the page, or reserve height.

### F17. `code-block`/`tool` pages shift when code blocks leave `content-visibility: auto` placeholders — severity: low
- Where: `registry/ai/code-block.tsx:316-317` (`containIntrinsicSize: "auto 200px"`, `contentVisibility: "auto"`; upstream design).
- What: blocks below the fold are laid out at the 200 px placeholder and snap to their real 94–174 px height when scrolled into view (CLS 0.010/0.025 on `/preview/tool`, 0.004/0.009 on `/preview/code-block`). Side effect: Playwright `fullPage` screenshots render such blocks as empty boxes (see `shots/tool-blank-light.png`, `shots/int-tool-all-open.png`), which will make the planned Playwright screenshots (docs/porting-ai-elements.md §3) misleading. Verified they render normally when actually in view (`cv.mjs`: all six blocks have text; `shots/tool-block-in-view.png`).
- Proposed fix: a smaller intrinsic size (e.g. `auto 6rem`) or drop `content-visibility` for short blocks.

### F18. `queue` item titles are hard-truncated at phone width with no way to read them — severity: low
- Where: `registry/ai/queue.tsx:80` (`line-clamp-1 grow break-words`).
- What: at 375 px "Add the theme column migration" becomes "Add the theme column…" although the card has room to wrap; no `title` attribute.
- Evidence: `shots/preview_queue--dark-mobile.png`, `shots/preview_queue--light-mobile.png`.
- Proposed fix: `line-clamp-2` or add `title`.

### F19. `prompt-input` preview silently keeps a chosen file — severity: low
- Where: `app/preview/prompt-input/page.tsx` (no attachment list is rendered, unlike the chat block).
- What: choose a file via "Add photos or files", nothing appears; the next submit reports "Submitted … with 1 file(s)". The preview also submits empty text (`Submitted: “” with 0 file(s)`), which the block explicitly swallows.
- Evidence: `interact.mjs` prompt-input section.
- Proposed fix: render `usePromptInputAttachments()` in the preview (or reuse `ChatComposerAttachments`).

### F20. `inline-citation` carousel has no end state — severity: nit
- Where: `registry/ai/inline-citation.tsx` Next/Prev (`api.scrollNext()`, no `canScrollNext` / `disabled`; upstream identical).
- What: at 2/2 "Next" does nothing and is not disabled; no wrap-around.
- Evidence: `interact.mjs` → `next x3 {"seq":["2/2","2/2","2/2"],"nextDisabled":false}`.

### F21. `model-selector` search is fuzzy over the provider-prefixed id — severity: nit
- What: typing `opus` lists both "Claude Opus 4" and "Claude Sonnet 4" (cmdk fuzzy-matches `anthr-o-p-ic/cla-u-de-s-onnet`). `interact2.mjs` output. Consider `keywords`/`value={name}` or a custom `filter`.

### F22. The `d` theme hotkey fires while a Base UI Select/combobox trigger is focused — severity: nit
- Where: `components/theme-provider.tsx:24-35` (`isTypingTarget` only exempts INPUT/TEXTAREA/SELECT/contentEditable).
- What: with focus on the code-block language select, pressing `d` toggles the theme (`before:false → after:true`). Docs-site only.

### F23. Base UI tooltips carry no `role="tooltip"` / `aria-describedby` — severity: nit (upstream wrapper)
- Where: `components/ui/tooltip.tsx` → `@base-ui/react/tooltip`. Rendered DOM (`focus.mjs`): popup carries only `data-open`/`data-side`, the trigger only `id`/`data-popup-open`; `[role=tooltip]` count is 0.
- What: `Checkpoint` and `PromptInputButton` tooltips open on hover and on keyboard focus (600 ms), but `getByRole("tooltip")` finds nothing and the trigger only gets `data-popup-open`. Triggers have their own visible/aria labels, so no failure; noted so nobody writes a test on `role=tooltip`.

## Coverage gaps (no bug found, but untested today)
- `chat` block › submit while `submitted`/`streaming` — the F1 scenario; suggested test: render `Chat` with a slow transport, press Enter twice, assert message count and no duplicate keys (spy on console.error).
- `chat` block › Stop mid-reasoning / mid-tool → header labels settle (F9).
- `chat` block › paste image / drop file / remove / submit-with-attachment-only — works today (`chat2.mjs` run 3) but only the scratch script covers it.
- `chat` block › scroller follows the stream and the "Scroll to end" button appears after scrolling up — works (`chat2.mjs` 1b/1c).
- `response` › KaTeX CSS present (assert `.katex-mathml` is clipped) and code/table scroll regions focusable at 375 px.
- `code-block` › keyboard reachability of the scroller at narrow width; copy button clipboard round-trip (works: `interact.mjs`).
- `queue` › focused action visible; `inline-citation` › trigger focusable and card opens on focus; `branch` › no key warning when children come from RSC (needs an RSC-style lazy child or `key`-less child).
- `prompt-input` › menu opens with Enter/Space/ArrowDown and returns focus on Escape (works); toolbar at 375 px does not overlap Submit (F8).
- e2e › run the preview axe job at 375×812 as well as Desktop Chrome, and fail on any `console.error` (F6, F7 would have been caught).
- `theme-provider` › no flash: html has no class at `commit`, `dark` by `domcontentloaded`, script precedes `<main>` in the HTML (byte 2697 vs 2869).

## Verified OK
- Initial HTML: every page server-renders its component markup (spot-checked strings for all 19 previews: chat empty state + suggestion, citations, models, context "40%", queue todos, image data URL, response table, branches, confirmation, sources); code in `code-block`/`tool` ships un-highlighted (`color:inherit`) and colours pop in client-side with no layout shift; response code blocks are inside Streamdown Suspense and highlight after hydration.
- Theme: next-themes inline script sits before `<main>`; with system=dark the html carries `dark` and `color-scheme: dark` by `domcontentloaded` (`chat3.mjs`); no white flash observed; body background is the token colour on every page in both themes; no repo source under `registry/`, `app/`, `components/`, `lib/` uses `bg-white`/`text-white`/`border-white` (grep); the built CSS contains one vendor `bg-white` token and one `text-white` token from imported package styles.
- Dark mode visuals: all 19 previews, hover/preview cards, menus, selects, dialog, tooltips render with readable text and visible borders (`shots/preview_*--dark-*.png`, `shots/dark-*.png`); shiki uses the high-contrast dark theme.
- Mobile: no page has horizontal document overflow at 375 px (light or dark); chat composer stays inside the viewport; bubbles cap at 266 px.
- Focus: every tab stop on every page shows a visible focus indicator (outline on Base UI collapsible/Streamdown buttons, 3 px ring on shadcn buttons, group ring on the textarea) — `focus.mjs`, all pages, after correcting for Tailwind's transparent default `box-shadow`. No focus lands on off-screen elements; nothing traps focus; the Next dev portal is the only extra stop.
- Keyboard semantics: Enter/Space toggle every collapsible (chain-of-thought, plan, task, tool, reasoning, sources, queue); Enter/Space/ArrowDown open the attachment menu and focus the first item; Escape closes menu, select, dialog and preview card and returns focus to the trigger; Base UI Select opens with Enter/Space and selects with arrows+Enter; model-selector dialog focuses the search input, filters, selects with Enter, shows the empty state, returns focus to the trigger; `d` in the cmdk input or textarea does not toggle the theme.
- Popups are positioned inside the viewport (listbox, menu, dialog, context card, citation card).
- Copy buttons write the right code to the clipboard and flip to a check for 2 s (`code-block`, Streamdown); Streamdown download produces `file.ts`; table fullscreen opens a dialog and Escape closes it.
- `image`: only `alt`, `class`, `src` reach the `<img>` (`providerMetadata`/`uint8Array` stripped, unlike upstream); both images decode (640×360).
- `context` cards open on hover and on keyboard focus, close on leave/Escape, values sum correctly ($0.33 / $0.78).
- `confirmation` approve/reject/reset flow; `branch` wraps both directions; `suggestion` scrolls the focused chip into view; `sources` links have `target=_blank rel=noreferrer`.
- Chat demo happy path: auto-start, thinking marker, reasoning auto-open then auto-close ("Thought for 1 seconds"), tool card expands with input/output, code block copy, second turn → scripted reply, third → fallback, whitespace/empty Enter swallowed, no upward scroll jumps during streaming (129 samples at 40 ms), scroll-to-end button appears after scrolling up and works, Stop mid-stream keeps the partial text and the next send works, paste/drop/remove/submit-with-attachment renders the attachment in the user message with the image decoded, Stop during `submitted` returns to a usable state (`stop.mjs`).
- Registry responses: `/r/registry.json`, `/r/tool.json`, `/r/base.json`, `/r/chat.json` → 200, `Content-Type: application/json; charset=UTF-8`, `Cache-Control: public, max-age=0` (dev static), ETag/Last-Modified present, all parse (83 items; `tool` 1 file; `chat` 3 files); `/r/nope.json` → 404 HTML; `/llms.txt` → 200 `text/plain; charset=utf-8`, 104 lines, one entry per item.
- `reasoning` page console: the "Can't perform a React state update on a component that hasn't mounted yet" error was seen once (sweep, light-desktop) and did not reproduce in 16 further loads; treated as flaky, not a finding.

## Could not reach
- `NEXT_PUBLIC_BASE_URL` behaviour in production (`llms.txt` is force-static; server cannot be restarted or rebuilt here).
- Real `getDisplayMedia` (headless has no display capture) — F15 is based on the rethrow path, verified in code.
- A screen reader; ARIA wiring was inspected in the DOM only.
- Real network for `models.dev` (blocked by the egress proxy) — F13 describes the blocked case, which is also the offline case.
- Safari/Firefox rendering (Chromium only).

## Commands run (for the fixer to reproduce)
All from the scratch dir with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`; dev server already on :3000.
- `node sweep.mjs` → `sweep.json`, `shots/<page>--<theme>-<viewport>.png` (console, axe, CLS, overflow, tap targets, all pages × light/dark × desktop/mobile).
- `node keyboard.mjs light` → `keyboard-light.json`, `shots/kb-*.png`; `node focus.mjs light` (focus-ring verification, `shots/focus-*.png`).
- `node interact.mjs`, `node interact2.mjs` → per-preview interactions (`interact.log`, `shots/int-*.png`), tooltip/menu/model-selector/plan retests, reduced motion.
- `node chat.mjs` (partial), `node chat2.mjs`, `node chat3.mjs`, `node chat4.mjs`, `node chat5.mjs`, `node stop.mjs` → chat demo end to end and the F1/F9 reproductions (`shots/chat-*.png`, `chat-messages-{before,after}.json`).
- `node hydration.mjs` (F6), `node branchkeys{,2,3}.mjs` (F7), `node toolbar.mjs` (F8), `node toolblank{,2}.mjs`, `node cv.mjs` (F17 + dark popups), `node warnings.mjs`.
- `curl -s http://localhost:3000/<page> > html/<slug>.html` for every page; `curl -sI` for `/r/*.json`, `/llms.txt`; `grep` over `built.css` (fetched from the page's `_next/static/.../*.css` link).

## Per-page matrix
Console = errors/warnings/pageerrors across the four load contexts (external `models.dev` image failures listed separately). axe = violations (mobile-only ones marked), "incomplete" = needs-review items (all were colour-contrast on gradients/SVG text, none confirmed as failures). Tab order/focus from the desktop light sweep. CLS = max of desktop/mobile over the first 3 s.

| Page | Console | axe light (viol.) | axe dark (viol.) | Mobile overflow | Tab order | Focus visible | CLS (max desktop/mobile) |
|---|---|---|---|---|---|---|---|
| `/` | clean | scrollable-region-focusable (mobile only) | scrollable-region-focusable (mobile only) | ok | 2 stops, ok | yes | 0.000 |
| `/preview` | clean | 0 | 0 | ok | 19 stops, ok | yes | 0.000 |
| `/preview/branch` | NOISY (key warning, F7) | 0 | 0 | ok | 2 stops, ok | yes | 0.000 |
| `/preview/chain-of-thought` | clean | 0 / 1 incomplete (SVG text) | 0 | ok | 1 stop, ok | yes | 0.000 |
| `/preview/chat` | clean on load (F1/F9 after interaction) | 0 | 0 | ok | 9 stops, ok | yes | 0.014 |
| `/preview/checkpoint` | clean | 0 | 0 | ok | 2 stops, ok | yes | 0.000 |
| `/preview/code-block` | clean | scrollable-region-focusable ×2 (mobile only) | same | ok | 2 stops, ok (scroller unreachable, F3) | yes | 0.009 |
| `/preview/confirmation` | clean | 0 | 0 | ok | 2 stops, ok | yes | 0.000 |
| `/preview/context` | clean | 0 | 0 | ok | 2 stops, ok | yes | 0.000 |
| `/preview/image` | clean | 0 | 0 | ok | 0 stops (none expected) | n/a | 0.000 |
| `/preview/inline-citation` | clean | 0 | 0 | ok | 0 stops — trigger not focusable (F5) | n/a | 0.000 |
| `/preview/model-selector` | clean + 3 external image failures (F13) | 0 | 0 | ok | 1 stop, ok | yes | 0.000 |
| `/preview/plan` | clean | 0 / 1 incomplete (shimmer gradient) | 0 | ok | 4 stops, ok | yes | 0.000 |
| `/preview/prompt-input` | clean (pageerror only after "Take screenshot", F15) | 0 / 1 incomplete (obscured buttons, F8) | 0 | ok (but toolbar overlap, F8) | 15 stops, ok | yes | 0.000 |
| `/preview/queue` | clean | 0 | 0 | ok | 12 stops, order ok, 10 invisible (F4) | ring present but element invisible | 0.000 |
| `/preview/reasoning` | 1 flaky error in 1/17 loads | 0 | 0 | ok | 4 stops, ok | yes | 0.114 (F16) |
| `/preview/response` | NOISY at 375 px (hydration, F6) | scrollable-region-focusable (mobile only) / 6 incomplete (MathML glyphs) | same | ok | 5 stops, ok | yes | 0.010 |
| `/preview/sources` | clean | 0 | 0 | ok | 1 stop, ok | yes | 0.000 |
| `/preview/suggestion` | clean | 0 | 0 | ok | 8 stops, ok | yes | 0.000 |
| `/preview/task` | clean | 0 | 0 | ok | 2 stops, ok | yes | 0.000 |
| `/preview/tool` | clean | 0 | 0 | ok | 5 stops, ok | yes | 0.025 (F17) |
| `/nope` | 404 only | landmark-one-main, region ×2 (F14) | same | ok | – | – | 0.000 |
| `/preview/nope` | 404 only | landmark-one-main, region ×2 (F14) | same | ok | – | – | 0.000 |

## Screenshots index
All under `shots/` in the scratch dir.
- Full-page sweep, every page × `light|dark` × `desktop|mobile`: `home--*.png`, `preview--*.png`, `preview_<name>--*.png`, `nope--*.png`, `preview_nope--*.png` (92 files).
- Keyboard: `kb-<page>--light-first-focus.png` (first tab stop focused, 21 files); `focus-preview_queue--light-<n>.png` (invisible focused queue actions, F4).
- Interactions: `int-branch.png`, `int-chain-of-thought.png`, `int-checkpoint-tooltip.png`, `int-checkpoint-hover-2s.png`, `int-checkpoint-focus.png`, `int-checkpoint-tooltip-focus.png`, `int-code-block-select-open.png`, `int-code-block-copied.png`, `int-code-block-375.png` (F3), `int-confirmation.png`, `int-context-hover.png`, `int-context-95.png`, `int-inline-citation-open.png`, `int-inline-citation-paged.png`, `int-model-selector-open.png`, `int-model-selector-reopened.png`, `int-plan-collapsed.png`, `int-prompt-input-menu.png`, `int-prompt-input-menu-{Enter,Space,ArrowDown}.png`, `int-prompt-input-voice-hover.png`, `int-prompt-input-end.png`, `int-queue-focused-invisible-action.png` (F4), `int-reasoning-restart.png`, `int-response-katex.png` (F2), `int-response-table-expanded.png`, `int-sources-open.png`, `int-suggestion-last-focused.png`, `int-task.png`, `int-tool-all-open.png` (F17 artefact).
- Dark popups: `dark-context-card.png`, `dark-inline-citation-card.png`, `dark-model-selector.png` (F13 glyphs), `dark-prompt-input-menu.png`, `dark-prompt-input-select.png`, `dark-checkpoint-tooltip.png`, `dark-code-block-select.png`.
- Mobile toolbar: `toolbar-prompt-input--dark-375.png`, `toolbar-prompt-input--light-375.png` (F8), `toolbar-chat--light-375.png`.
- Chat demo: `chat-00-load.png` (empty state + suggestion), `chat-01-thinking.png`, `chat-02-reasoning.png`, `chat-03-streaming.png`, `chat-04-done.png`, `chat-05-tool-open.png`, `chat-06-second-submitted.png`, `chat-07-second-done.png`, `chat-08-fallback.png`, `chat-08b-scrolled-up.png`, `chat-09-stopped.png`, `chat-10-pasted.png`, `chat-11-dropped.png`, `chat-12-attachment-sent.png`, `chat-13-attachment-answered.png`, `chat-14-mobile-streaming.png`, `chat-15-mobile-done.png`, `chat-16-duplication.png`, `chat-17-stopped-stuck-thinking.png` (F9), `chat-18-stopped-during-tool.png`, `chat-19-second-turn-result.png`, `chat-20-happy-path.png`, `chat-21-enter-during-submitted.png` (F1), `chat-22-enter-during-streaming.png` (F1), `chat-23-stop-during-submitted-stuck.png` (verified not stuck).
- Misc: `theme-early-dark.png`, `tool-blank-light.png`, `tool-block-in-view.png`, `tool-output-error-section.png`.
