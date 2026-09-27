# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Registries are unversioned by
design, so releases are Git tags that consumers can pin on the GitHub install path.

## [Unreleased]

### Changed

- Light `--destructive` darkens from `oklch(0.52 0.245 27.325)` to `oklch(0.45 0.245 27.325)`
  so destructive text meets WCAG AA (4.69:1) on its hover tint in the destructive button,
  the destructive badge as a link and the interactive destructive bubble; it was 3.85:1.

## [0.1.0] - 2026-09-26

### Added

- `@uifiles/base`, the `registry:base` item: shadcn `base-nova` config, Geist type, and the
  uifiles tokens, generated from `app/globals.css`, with a `prefers-reduced-motion` guard in
  `@layer base`.
- 63 `registry:ui` alias items, one per shadcn/ui primitive, resolved upstream against the
  consumer's style.
- 18 AI Elements components ported from Radix UI to Base UI under `registry/ai`: `branch`,
  `chain-of-thought`, `checkpoint`, `code-block`, `confirmation`, `context`, `image`,
  `inline-citation`, `model-selector`, `plan`, `prompt-input`, `queue`, `reasoning`,
  `response`, `sources`, `suggestion`, `task`, `tool`.
- The `chat` block: a complete AI SDK `useChat` chat on shadcn's `message-scroller`,
  `message`, `bubble`, `attachment` and `marker`, with the uifiles `prompt-input`, `response`,
  `reasoning`, `tool` and `suggestion` on top, plus a scripted demo conversation. It takes
  `error` and `onRetry` from `useChat` and renders a failed request as a transcript row with
  a Retry button (`ChatErrorMarker`), blocks submits while a response is generating, and keeps
  the draft.
- `prompt-input`: the `onError` code `screenshot` for capture failures, `accept` patterns of
  the form `.ext`, `type/*` and `*/*` with partial rejections reported, the exported
  `PromptInputError` type, and an `onSubmit` that may return `false` (directly or from its
  promise) to reject a submit and keep the draft, attachments and sources.
- `branch`: a controlled `branch` prop. `sources`: typed `open`, `defaultOpen`, `onOpenChange`
  and `disabled`. `model-selector`: `filter`, `shouldFilter` and item `keywords`.
  `code-block`: `aria-label` for the scroll container and a language selector generic over its
  value. `ModelSelectorLogo`: `alt` and `src` props.
- The docs site with a rendered preview per item (titled and headed with the item's registry
  title), `/r/*.json` hosting, `/llms.txt`, `/robots.txt`, a 404 page, a theme toggle as the
  only theme control (no character-key shortcut, WCAG 2.1.4), and the `uifiles` agent skill.
- `response` ships its stylesheet lines in the item's `css` field, so the CLI writes them into
  your `globals.css`, also when you install `reasoning` or the `chat` block:
  `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"` and a
  `.katex-display` overflow rule. Only `@source "../node_modules/streamdown/dist/*.js"` is
  still added by hand, because its path depends on where your CSS file lives.
- Browser tests with axe for every item (ported from the upstream suites and extended), a
  fail-on-console guard that also charges the calls a console spy's mock implementation
  swallowed, whether or not the spy is restored before the check, coverage thresholds
  (`pnpm test:coverage`: 80% lines and functions, 70% branches per file), Playwright with axe
  over every preview page in light and dark at desktop and phone width with a clean-console
  assertion, a check that the page never scrolls sideways and every third-party request
  blocked, a keyboard walk of the chat preview, unit checks that the `dependencies` of every
  item with files match its imports in both directions (a `css` `@import` counts as a use)
  and that no item repeats a `css` rule an `@uifiles` dependency already ships, and a weekly
  upstream-drift check against shadcn/ui and AI Elements that files or comments on an issue.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates,
  `CODEOWNERS`, Dependabot, and the Apache-2.0 copy for the AI Elements ports under
  `licenses/`.

### Changed

- Light `--muted-foreground` departs from shadcn Nova (`oklch(0.556 0 0)` → `oklch(0.53 0 0)`)
  so muted text meets WCAG AA on `bg-muted`, `bg-secondary` and `bg-accent`.
- `--destructive` (light `oklch(0.577 0.245 27.325)` → `oklch(0.52 0.245 27.325)`, dark
  `oklch(0.704 0.191 22.216)` → `oklch(0.74 0.191 22.216)`) and light `--ring` (`oklch(0.708 0 0)`
  → `oklch(0.64 0 0)`) depart from Nova so destructive text on its tints, the attachment error
  description and the focus border meet WCAG AA (4.68:1, 4.64:1 and 3.36:1 in light).
- `Image` requires `alt` (pass `""` only for a decorative image); a missing `mediaType` falls
  back to `image/png`.
- `context` cost rows are partitioned so they add up: Input excludes cached reads, Output
  excludes reasoning, reasoning is billed at the output rate, and the footer is the sum of the
  rounded rows. A window size or used count that is unknown, NaN, infinite or negative
  renders 0% and 0 in the header, never NaN or ∞.
- `ModelSelectorLogo` is decorative by default (`alt=""`, `aria-hidden`); pass `alt` for an
  accessible image. The model list filters by whole terms instead of cmdk's fuzzy match.
- `inline-citation`'s trigger badge is a button, so it is in the Tab order and focus opens the
  card; a click or tap (or Enter/Space) pins the card and moves focus into it, Tab cycles
  through its controls, and Escape closes it and returns focus to the badge, so the sources
  are reachable on touch and from the keyboard; the carousel's Prev/Next are `aria-disabled`
  at the ends unless `opts.loop` is set, so an arrow keeps focus when it pages to the first or
  last source. The badge exposes `aria-expanded` and `aria-controls`, and a pinned card is a
  dialog named by its badge.
- `Confirmation` treats `output-error` as a responded state, so an approved call that then
  failed shows the accepted outcome; a responded part with no decision renders nothing.
- `reasoning` auto-opens only when streaming starts, respects a manual toggle for the rest of
  that stream, and auto-opens and auto-closes once per stream.
- `reasoning` renders its content through `MessageResponse` and depends on
  `@uifiles/response`, so reasoning text gets the same named scroll regions, link-safety
  dialog and stylesheet lines as `response`.
- `queue` completed rows, indicator dots, `chain-of-thought` pending steps and `code-block`
  line numbers use full-alpha tokens instead of upstream's faded ones; `code-block` uses
  shiki's `github-*-high-contrast` themes.
- `queue` actions are always visible on coarse pointers, where neither hover nor Tab exists,
  and titles clamp at two lines instead of one; item titles and file chips carry their whole
  text in a `title` attribute, so a clamped title or a truncated file name can be read on
  hover.
- `response` marks code blocks, tables (also in Streamdown's fullscreen table view) and
  display formulas that overflow as focusable `role="group"` scroll containers ("Code",
  "Table", "Math"); `code-block`'s scroll container is a `role="group"` named after the
  language ("TypeScript code") rather than a `region` landmark, so several blocks on one page
  pass axe.
- `response` confirms an external link in a native modal `<dialog>` that takes focus, shows
  the whole URL and gives focus back to the link, instead of Streamdown's modal (a
  `role="button"` backdrop that failed axe `nested-interactive` and never took focus); your
  own `linkSafety` settings still win.
- `branch` derives the branch count from its children while rendering, so the selector and
  page count are in server-rendered HTML, and calls `onBranchChange` once with the clamped
  index when clamping moves a controlled `branch`.
- `sources` falls back to the hostname for an empty `title` and to the icon and title for
  empty `children`. `CheckpointTrigger` exposes its tooltip as an accessible description
  unless it repeats the button's name (its `aria-label`, or else the text its children
  render); `ConfirmationRejected` renders in the destructive colour; `Suggestion` scrolls
  itself fully into view on focus.
- `PromptInputTextarea` has `aria-label="Message"` by default; `PromptInputButton` tooltips
  open immediately and are exposed as accessible descriptions unless they repeat the button's
  name, and a tooltip `shortcut` is exposed as `aria-keyshortcuts`. An accepted submit clears
  only the attachments and sources it carried, so a file attached while an async `onSubmit`
  is pending stays in the composer.
- Trigger rows in `reasoning`, `task`, `chain-of-thought`, `sources` and the citation carousel
  controls are 24 px targets (WCAG 2.2). `tool`, `plan` and `inline-citation` labels are no
  longer headings, so a card never breaks the page's heading order.
- The `chat` block passes the live status to the last message only, so parts of earlier
  answers render settled and a call interrupted by Stop reads Pending; after an error the
  composer shows a plain Submit again. The error row also renders for `status: "error"`
  without an `error` object, with a generic message, and sent attachments leave the
  composer as soon as the message is sent rather than when the answer finishes.

### Fixed

- `code-block`: a snippet whose middle changed showed stale text (the token cache was keyed on
  a slice); overflowing blocks were not keyboard reachable; shiki's dual-theme background was
  dropped; a block highlighted up to four times under StrictMode; an unknown language rejected;
  a language named after an `Object.prototype` key (`constructor`) crashed the highlighter; a
  colon in the language could collide two snippets in the token cache; every language string
  created its own Shiki highlighter, so a transcript in ten languages loaded the themes ten
  times and logged Shiki's instance warning (one shared highlighter now loads each grammar
  when it is first needed).
- `tool` crashed on a call whose input had not arrived (`input: undefined`, the AI SDK's
  `tool-input-start` shape) and hid falsy outputs.
- `prompt-input`: Enter while the Stop button was shown submitted anyway; clicking the header
  or footer focused the model select instead of the textarea; a consumer `onClick` on Add
  attachments was ignored; StrictMode reported errors twice and leaked object URLs; a failed
  `onSubmit` lost the typed text; a screenshot capture failure was an unhandled rejection; a
  long toolbar overlapped the submit button at phone width; a rejected submit overwrote a
  controlled textarea; in provider mode two `add()` calls in one handler bypassed `maxFiles`,
  and a slot freed by `remove()` or `clear()` in the same handler stayed taken; a second
  submit while the first was still reading its attachments sent them twice; a tooltip that
  repeated the button's name was read twice; without `onStop`, `PromptInputSubmit` was still
  named Stop while submitted or streaming and showed the stop square while streaming, although
  a press submitted (it is a Stop button only when `onStop` is passed); in provider mode a
  second submit during the first one sent the same text again, and text typed while a submit
  was pending was wiped once it succeeded (the provider's text is now cleared as a submit
  starts and given back if the submit fails, as without a provider).
- `reasoning`: the auto-close timer restarted on every parent re-render and the panel could
  not be closed while streaming; a stream that started and ended in the same millisecond
  measured 0 s and read "Thinking..." forever.
- `branch`: `className` could override branch visibility, null children crashed, and an
  out-of-range index showed an empty page; on an App Router page, where a Server Component
  hands `MessageBranchContent` over as a client reference, the served HTML had no selector
  or page count (content wrapped in `memo` or `forwardRef` was missed the same way); a
  controlled clamp was reported twice under StrictMode.
- `response` left a tab stop on a code block that no longer overflowed and could mismatch on
  hydration; a display formula wider than a phone widened the whole page (WCAG 1.4.10).
- `sources` read "Used 1 sources". `inline-citation` threw on a source that was not an
  absolute URL, kept a stale index when slides were added, lost navigation when a consumer
  passed `setApi`, and, with a controlled `open`, opened as a pinned dialog that took focus
  after a press the parent had refused, or after the parent closed a pinned card through
  `open`.
- `model-selector` rendered its empty state and separators inside the listbox (an axe
  critical violation) and showed a broken-image glyph for an unknown provider.
- `chat` block: a tool part without input unmounted the chat; a second Enter mid-stream sent
  a duplicate; a files-only turn rendered an empty bubble; an empty assistant row appeared
  before the first part; a rejected `onRetry`, or a rejected `onSubmit` from the composer or
  a suggestion, was an unhandled rejection; attachments stayed in the composer until the
  answer finished streaming.
- `queue` actions were invisible on keyboard focus. `confirmation` rendered an empty alert for
  an approved call that then errored. `chain-of-thought`'s trigger pointed `aria-controls` at
  a panel that never existed.
- Site: the public origin fell back to localhost on Vercel, and a production build off
  Vercel said nothing when it still advertised localhost; `robots.txt` carried an origin in
  `Host`; the install commands on the home page scrolled sideways at phone width with no
  keyboard access (they wrap now); `LICENSE` carried an appended paragraph GitHub could not
  detect as MIT; the alias badge showed on `@uifiles/base`.
- Tokens and build: `scripts/sync-tokens.ts` lost tokens to comments and nested rules and
  let a `:root` inside `@layer` override the unlayered one (it now resolves a repeated token
  as the cascade does, unlayered first, and refuses a token split across two layers, a block
  value and an unterminated `url(`);
  `katex`'s stylesheet was missing, so formulas rendered twice; `cn` was undeclared in every
  item's dependencies; the upstream lock listed unported items; `upstream-diff.yml` masked
  the script's exit code behind a pipe; e2e waited on `networkidle`.

[Unreleased]: https://github.com/jamierthompson/uifiles/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jamierthompson/uifiles/releases/tag/v0.1.0
