# Architecture

uifiles is a shadcn/ui registry on Base UI. A consumer runs
`pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json` once, then adds `@uifiles/<name>`
items; the shadcn CLI copies source files into the consumer's project. This document records
the decisions that shape the repository and why they hold. The contributor rules are in
`AGENTS.md`; the port checklist is in `docs/porting-ai-elements.md`.

## 1. Decisions

| Decision       | Choice                                                                                                                                        | Why                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base library   | Base UI (`base-nova`), one build, no per-base variants                                                                                        | shadcn's default base since 2026. Composition is `render`, never `asChild`. Variants for Radix or React Aria consumers would triple the port surface for no current consumer.                                                                                              |
| Style baseline | Nova (`shadcn init --preset nova -b base`)                                                                                                    | The base-nova wrappers in `components/ui/` are what every alias resolves to. Note: the CLI rejects `--preset base-nova`; the pair is `nova` plus `-b base`.                                                                                                                |
| Class merging  | The `cn` package (`import { cn } from "cn"`)                                                                                                  | shadcn's standard; the consumer's `lib/utils.ts` re-exports it, and the CLI does not rewrite `@/lib/utils` in registry sources.                                                                                                                                            |
| Icons          | lucide                                                                                                                                        | shadcn's default and what AI Elements uses.                                                                                                                                                                                                                                |
| Distribution   | Hosted registry (the Next app on Vercel serves `/r/{name}.json` and `/r/registry.json`) plus the GitHub-registry path (`owner/repo/item#ref`) | Hosting is required for the MCP server and the shadcn directory. The GitHub path gives pinning by tag or SHA with no infrastructure, for items with no `@uifiles/*` dependency until the directory lists the namespace.                                                    |
| Repo shape     | One Next 16 app: docs site, previews, registry host, `registry/` sources                                                                      | What every registry in the directory does. A workspace only becomes worth it when a second package moves in.                                                                                                                                                               |
| Versioning     | Git tags and `CHANGELOG.md`; the registry itself is unversioned                                                                               | Registries are copied at install time. Consumers pin with `#v0.1.0` on the GitHub path or use `add --diff` on the hosted one.                                                                                                                                              |
| Licensing      | MIT for the repository; Apache-2.0 kept on files derived from AI Elements, with `NOTICE` and a header comment on each                         | Apache-2.0 requires a copy of the license (`licenses/APACHE-2.0-ai-elements.txt`), the notice, and marking modified files. The copy lives outside the root because GitHub's license detector scans every root `LICENSE*` file and reports "Other" when two licenses match. |

Rejected: vendoring all of shadcn/ui (every primitive becomes a diff job against a fast-moving
upstream, for no benefit until one diverges); consuming `@ai-elements/*` upstream (Radix-only
and stale, see §3); an npm package (the registry model puts source in the consumer's repo,
which is what the shadcn skill, MCP `view` and v0 assume).

## 2. Registry model

`registry.json` at the root holds only `name`, `homepage` and an `include` list; the items live
in one `registry.json` per directory under `registry/`. `pnpm registry:build` regenerates the
base item's tokens, validates every file with `shadcn registry validate`, and runs
`shadcn build` into `public/r/` (gitignored, built on Vercel and in CI).

- **`@uifiles/base`** (`registry:base`, `registry/base/`). The one-command setup: `config`
  (style `base-nova`, lucide, neutral base color, menu settings), `cssVars` (generated from
  `app/globals.css` by `scripts/sync-tokens.ts`, so the site and the item cannot drift),
  `css` (the stylesheet's `@layer base` defaults and reduced-motion guard, kept by hand;
  `tests/unit/tokens.test.ts` checks the guard against the stylesheet), and
  `registryDependencies` on `utils` and the Geist font items. It has no files of its own; it
  is not an alias.
- **`@uifiles/<ui>`** × 63 (`registry:ui`, `registry/ui/`). Zero-file entries whose only
  `registryDependencies` entry is the bare upstream name, generated by
  `scripts/generate-aliases.ts` from shadcn's index. `@uifiles/button` installs upstream
  `button` resolved against the consumer's style, so all 63 primitives exist under one
  namespace at zero maintenance. Any one becomes a fork the moment its entry gains `files`;
  forks survive regeneration. Bare names in `registryDependencies` always mean upstream
  shadcn, so once a primitive is forked every uifiles item that needs the fork must say
  `@uifiles/<name>`; `tests/unit/registry.test.ts` enforces it.
- **`@uifiles/<ai>`** × 18 (`registry:component`, `registry/ai/`). AI Elements components
  ported from Radix UI to Base UI, targeting `components/ai/<name>.tsx` in the consumer.
  Intra-registry dependencies are `@uifiles/<name>` (upstream uses absolute URLs to Vercel's
  host). npm dependencies that upstream leaves unpinned are pinned to a major or minor range
  (`streamdown@^2.6`, `shiki@^4`, `ai@^7`) because consumers otherwise get newer majors than
  upstream tests against.
- **`@uifiles/chat`** (`registry:block`, `registry/blocks/chat/`). A full AI SDK `useChat`
  chat composed from shadcn's chat primitives and the uifiles AI components, with a scripted
  demo transport from `@shadcn/helpers` so it runs without an API key. Block sources nest as
  `registry/blocks/<block>/{components,lib}/…` so the CLI's import rewrite lands them where
  their targets say.
- `registry/components`, `hooks` and `lib` exist for uifiles' own composites, hooks and
  utilities and are empty today.

Every item carries a `description` written for retrieval, because the shadcn MCP server and
`shadcn search` rank on it, and `docs` for post-install notes and API divergences from
upstream.

## 3. AI Elements: what is ported and what is not

AI Elements is Radix-only (33 `asChild` uses across 16 components, Radix-only HoverCard
delay props and `onSelect`, six direct `@radix-ui/react-use-controllable-state` imports). Its
Base UI pull request (#450) has been open since July 2026 with no maintainer response, and
the last npm release predates that. Vendoring and porting is justified on staleness alone;
the Apache-2.0 license permits it with attribution.

shadcn favors its own components when both exist. shadcn added a chat layer in 2026
(`message`, `bubble`, `attachment`, `message-scroller`, `marker`, `questionnaire`, `spinner`,
the `shimmer` utility), so the overlapping AI Elements items are dropped and only their unique
parts are ported as new items.

| AI Elements                                                                                                                                                                                                                          | shadcn equivalent               | Resolution                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                                                                                                                                                                                                                            | `message`, `bubble`             | Dropped. Its unique parts are ported as `response` (Streamdown markdown, from `MessageResponse`) and `branch` (from `MessageBranch*`); `MessageActions` is `button-group`. Both are locked against upstream `message.json`. |
| `conversation`                                                                                                                                                                                                                       | `message-scroller`              | Dropped; `ConversationEmptyState` is `empty`.                                                                                                                                                                               |
| `attachments`                                                                                                                                                                                                                        | `attachment`                    | Dropped.                                                                                                                                                                                                                    |
| `shimmer`                                                                                                                                                                                                                            | `shimmer` utility class         | Dropped; no `motion` dependency.                                                                                                                                                                                            |
| `loader`                                                                                                                                                                                                                             | `spinner`                       | Dropped; deprecated upstream.                                                                                                                                                                                               |
| `confirmation`                                                                                                                                                                                                                       | `questionnaire`, `alert-dialog` | Ported; it is tool-approval-specific.                                                                                                                                                                                       |
| `branch`, `chain-of-thought`, `checkpoint`, `code-block`, `confirmation`, `context`, `image`, `inline-citation`, `model-selector`, `plan`, `prompt-input`, `queue`, `reasoning`, `response`, `sources`, `suggestion`, `task`, `tool` | none                            | **Ported** (18 items). The public API (export names, props, defaults) matches upstream; the intentional divergences are listed below and belong in each item's `docs`.                                                      |
| `snippet`, `open-in-chat`, `agent`, `artifact`, `commit`, `environment-variables`, `file-tree`, `jsx-preview`, `package-info`, `sandbox`, `schema-display`, `stack-trace`, `terminal`, `test-results`, `web-preview`                 | none                            | Not ported yet (code and agent surfaces).                                                                                                                                                                                   |
| `question`                                                                                                                                                                                                                           | `questionnaire`                 | Not ported yet: a structured single/multiple-choice prompt with free text; shadcn's `questionnaire` covers the common case, so it waits for a consumer need.                                                                |
| `canvas`, `node`, `edge`, `connection`, `controls`, `panel`, `toolbar` (`@xyflow/react`); `audio-player`, `mic-selector`, `speech-input`, `transcription`, `voice-selector`, `persona` (Rive)                                        | none                            | Not ported; heavy dependencies, undecided.                                                                                                                                                                                  |

The per-file port recipe (what replaces `asChild`, `onSelect`, `data-state`, `forceMount`,
the controllable-state hook, `@/lib/utils`) is in `docs/porting-ai-elements.md`.
`registry/ai/upstream.lock.json` records, per shipped item, the upstream source URL and the
sha256 of the content each port was made from; an item cut from a differently named upstream
file names it in `upstream` (`branch` and `response` both come from `message`), so drift can
be detected (§5).

### Intentional divergences from AI Elements

The public API is upstream's; these are behavior changes made on purpose, one line per item,
because the registry owns the consumer contract now. Each belongs in the item's `docs` too.

- `code-block`: `aria-label` on `CodeBlock` names the scroll container, not the wrapper; a
  block whose code overflows becomes a focusable `role="group"` (not a landmark, so several
  blocks on one page pass axe; default name "<Language> code" from shiki's display name,
  "Code" for plain text); `CodeBlockLanguageSelector` is generic over its value, so
  `onValueChange` receives `Value | null`; an unknown or empty `language` renders as plain
  text (checked as an own key of shiki's bundled languages, so `constructor` is unknown too);
  `undefined` code renders as empty; the token cache is keyed on the language and the code;
  every block shares one Shiki highlighter, created with both themes on first use, and each
  grammar loads the first time its language appears (a failed start or grammar load is retried
  by the next block), where upstream created a highlighter per language string, so a
  transcript in ten languages loaded the themes ten times and tripped Shiki's warning about
  ten or more instances.
- `context`: the usage rows are partitioned so they add up: Input is
  `inputTokens − cacheReadTokens` at the input rate, Cache is the cache reads at the
  cache-read rate, Output is `outputTokens − reasoningTokens` and Reasoning is
  `reasoningTokens`, both at the output rate; each row is rounded to cents and the footer is
  the sum of the rows (upstream's inclusive counts could not sum); a `usedTokens` or
  `maxTokens` that is zero, undefined, NaN, infinite or negative renders 0% and 0 in the
  header counts, never NaN or ∞.
- `image`: `alt` is required (`""` for a decorative image); a missing `mediaType` falls back to
  `image/png`; no `base64` renders nothing.
- `reasoning`: auto-open fires only on the not-streaming → streaming transition (upstream
  re-opened the panel on every render while streaming, so it could not be closed); a manual
  toggle takes the panel out of the auto-open/auto-close cycle until the next stream; each new
  stream auto-opens and auto-closes once; the measured duration is at least 1 s, so a stream
  that starts and ends in the same millisecond does not read "Thinking..." forever;
  `ReasoningContent` renders its text through `MessageResponse` (`@uifiles/response`,
  installed with it) instead of upstream's bare Streamdown, so reasoning gets the same
  plugins, shiki pair, named scroll regions, link-safety dialog and stylesheet lines as
  `response`. Open decision: upstream never auto-closed a second stream in the same instance;
  parity would mean not resetting `autoCloseSpentRef` when a stream starts.
- `branch`: the current index is clamped into range, so an out-of-range `defaultBranch` or a
  shrinking list never shows an empty page and `MessageBranchPage` reads "0 of 0" with no
  content; a controlled `branch` prop is accepted next to `onBranchChange`, which is called
  once (under StrictMode too) with the clamped index when clamping moves it; the branch count
  is derived from the children while rendering, so the selector and page count are in server
  HTML, also when `MessageBranchContent` is wrapped in `memo` or `forwardRef` or handed over
  by a Server Component as a client reference (a reference whose module is still loading
  suspends `MessageBranch` until it loads); content a custom component renders registers after
  mount; `MessageBranchPage` is `ButtonGroupText` (a div with `render`); null and boolean
  children are ignored.
- `response`: code-block bodies, tables (inline, and in the fullscreen view Streamdown portals
  to `document.body`) and display formulas that overflow become focusable `role="group"`
  scroll containers named "Code", "Table" and "Math" on the client (a formula only sideways,
  and only once the `.katex-display` rule below lets it scroll), and are released when the
  content fits. Streamdown's link-safety modal (a `role="button"` backdrop around the dialog's
  buttons, which fails axe `nested-interactive` and never takes focus) is replaced through
  `linkSafety.renderModal` by a native modal `<dialog>` named "Open external link?": it makes
  the page inert, takes focus, shows the whole URL, copies it, closes on Escape, its close
  button or a backdrop click, and gives focus back to the link;
  `linkSafety={{ enabled: false }}` and a consumer's `renderModal` or `onLinkCheck` still win.
  The item's `css` field ships `@import "streamdown/styles.css"`,
  `@import "katex/dist/katex.min.css"` and
  `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em } }` (KaTeX
  gives a display formula no overflow container, so a wide one would widen the page on a
  phone, WCAG 1.4.10); the CLI writes each `@import` after the consumer's last one (or at the
  top) and skips one that is already there, and `reasoning` and the `chat` block get all three
  through their dependency on `@uifiles/response`. The fourth line,
  `@source "../node_modules/streamdown/dist/*.js"`, stays a manual step (the item's `docs` say
  so) because its path is relative to the consumer's CSS file.
- `tool`: `ToolInput` shows "No input yet" while `input` is `undefined` (the shape on
  `tool-input-start`) and stringifies BigInt; `ToolOutput` renders falsy outputs (`0`, `false`,
  `""`); an unknown `state` renders its raw name with a neutral icon; the "Parameters",
  "Result" and "Error" labels are `<div>`s, not `<h4>`s.
- `chat` block: `error` and `onRetry` props and a `ChatErrorMarker` row with Retry; Enter, the
  submit button, a programmatic submit and suggestion clicks are ignored while a response is
  generating and the draft and attachments are kept (`ChatComposer` returns `false` to
  `PromptInput`); `onSubmit` is called with `void` and the page does not return
  `sendMessage`'s promise, so sent attachments clear on send; the error row also renders for
  `status: "error"` without an `error` (generic text) and a rejected `onRetry` goes to
  `console.error`; a tool call with no input yet shows the Tool item's "No input yet"; only
  the last message receives the chat `status`, so parts of earlier answers render settled and
  a call interrupted by Stop reads Pending; whitespace-only text renders nothing; every part
  sits in an error boundary that renders an inline alert instead of unmounting the chat;
  after an error the composer shows a plain Submit.
- `prompt-input`: `onError` gains the code `screenshot` (capture failures other than a denied
  or canceled picker); `PromptInputTextarea` has `aria-label="Message"` by default; `accept`
  understands `.ext`, `type/*` and `*/*` and reports partial rejections; `PromptInputSubmit` is a Stop button only when `onStop` is passed (without it a press submits, so while generating it keeps the Submit name and type and never shows the square: the spinner while submitted, the return glyph while streaming; upstream names it Stop and shows the square either way); Enter submits only
  through an enabled `button[type="submit"]`, so it does nothing while Stop is shown; a submit clears the text as it starts, also the provider's (upstream clears provider text only after `onSubmit` succeeds); a throwing or rejecting `onSubmit` restores the typed text unless the user typed since (so does one that returns `false`;
  a controlled textarea is left to its owner); an accepted submit clears only the attachments
  and sources it carried; in provider mode `maxFiles` holds across several `add()` calls in
  one handler; tooltips open immediately and mirror their text into an `aria-describedby`
  description unless it repeats the label or the visible text, and an empty tooltip renders
  neither; the toolbar wraps so it never overlaps the submit button; header/footer clicks
  move focus to the textarea only from inert surface, never from a focusable control.
- `queue`: indicator dots use a full-alpha `border-muted-foreground` (filled when completed)
  instead of upstream's 50% and 20% borders; completed text keeps full alpha; row actions are
  revealed on keyboard focus as well as hover, and always on coarse pointers; titles clamp at
  two lines (upstream one); `QueueItemContent` and the `QueueItemFile` chip copy string
  children into a `title` attribute (a consumer's `title` wins, composed children get none),
  so a title clamped under WCAG 1.4.12 text spacing or a truncated file name stays readable on
  hover.
- `confirmation`: `output-error` counts as a responded state (`approval.approved` stays `true`
  on an approved call that then failed), so the accepted outcome renders; a responded state
  without a decision renders nothing instead of an empty alert; `ConfirmationRejected` wraps
  its children in a `text-destructive` span so the rejected outcome reads differently from
  the accepted one.
- `checkpoint`: `CheckpointTrigger` mirrors its tooltip into a visually hidden
  `aria-describedby` description (Base UI tooltips carry no ARIA) unless it repeats the
  button's name.
- `sources`: the trigger pluralizes ("Used 1 source") and, with each row, is a 24 px target;
  `Source` without `href` renders a `<span>`; absolute URLs open in a new tab with
  `rel="noreferrer noopener"`, relative ones in the same tab; a missing or empty `title` falls
  back to the hostname (or the href) and empty `children` to the icon and title; `Sources`
  types Base UI's `open`, `defaultOpen`, `onOpenChange`, `disabled`.
- `suggestion`: a chip scrolls itself fully into view on focus, so Tab onto one cut off at the
  row's edge reveals it (browsers only do that for a fully hidden target).
- `inline-citation`: the trigger badge is a `<button>` (in the Tab order; focus opens the
  card); a press (click, tap, Enter, Space) opens and pins the card, moves focus into it and
  reports `trigger-press` to `onOpenChange`; with a controlled `open` the pin holds only if `onOpenChange` opens the card in the same update, and a closed card is never pinned; Tab cycles through the card's controls and Escape
  closes it and returns focus to the badge, a pinned card ignoring the hover close (upstream's
  Radix HoverCard has no press or touch path); a source that is not an absolute URL is shown
  as given; Prev/Next are `aria-disabled`, not `disabled`, at the ends unless `opts.loop`, so
  an arrow that pages to the last slide keeps focus, and have 24 px hit areas; the badge
  carries `aria-expanded` (and `aria-controls` while open) and a pinned card is a
  `role="dialog"` named by its badge; `InlineCitationSource` and `InlineCitationQuote` render
  nothing when empty (whitespace, empty arrays and null children included); a consumer
  `setApi` is called alongside the internal one.
- `model-selector`: whole-term filtering by default (`filter` and `shouldFilter` pass
  through, `keywords` on items); the empty state renders in a polite live region after the
  listbox and separators are `aria-hidden`, because a listbox may not own either;
  `ModelSelectorLogo` is decorative (`alt=""`) unless `alt` is given, hides itself when the
  image fails to load, and takes `src` in place of the models.dev URL (the docs preview
  passes inline placeholder logos so it makes no third-party request).
- `chain-of-thought`: one Collapsible root (upstream's split roots left `aria-controls`
  dangling); an unknown `status` falls back to the neutral style; an empty
  `ChainOfThoughtSearchResults` renders nothing; the header is a 24 px target.
- `task`: the trigger is the Collapsible's native `<button>` (custom children must be phrasing
  content) and a 24 px target. `plan`: `PlanContent` takes `CardContent` props, so
  `keepMounted` is not forwarded (as upstream's `forceMount` was not).
- Tokens: the contrast-driven departures from Nova are in §4.

## 4. Tokens

The tokens are shadcn Nova neutral, in oklch, defined once in `app/globals.css` under `:root`
and `.dark` and mapped in `@theme inline`. Dark mode is class-based (`.dark` on `<html>`,
set by next-themes; the docs site's only theme control is a visible toggle, with no
character-key shortcut, per WCAG 2.1.4). `scripts/sync-tokens.ts` copies the two blocks and
the radius scale into the base item's `cssVars` on every `pnpm registry:build`; the
regenerated `registry/base/registry.json` is committed.

Departures from Nova, each made for WCAG AA contrast and measured with axe-core:

- Light `--muted-foreground`: `oklch(0.53 0 0)` instead of Nova's `oklch(0.556 0 0)`, which
  gives 4.34:1 for muted text on `bg-muted`, `bg-secondary` and `bg-accent` (below 4.5:1).
- `queue` completed rows drop upstream's `/50` and `/40` alpha on their text; `code-block`
  uses shiki's `github-light-high-contrast` and `github-dark-high-contrast` themes because
  GitHub's default light theme renders some tokens at 3.48:1.
- `--destructive` and light `--ring` depart from Nova for AA. Light `--destructive`
  `oklch(0.577 0.245 27.325)` → `oklch(0.45 0.245 27.325)` (`#b80000`), set by the tightest
  pair, `text-destructive` on the light hover tint `bg-destructive/20` (button hover, badge
  link hover, interactive bubble hover): 3.31:1 → 4.69:1 (L ≤ 0.465 clears 4.5:1; 0.45 leaves
  margin for Chromium's painting). The rest follow: on `bg-destructive/10` (button, badge,
  bubble, dropdown item, attachment media) 3.99:1 → 5.74:1, on white 4.76:1 → 6.91:1,
  `text-destructive/80` (attachment error description) 4.12:1 → 5.35:1, `/90` (alert
  description) 4.49:1 → 6.21:1. Forking `@uifiles/button` was rejected: the same `/20` hover
  pair is in the vendored badge and bubble too, and one token fixes all three. Dark
  `--destructive` `oklch(0.704 0.191 22.216)` → `oklch(0.74 0.191 22.216)`: `/80` on card
  4.37:1 → 4.66:1, `hover:bg-destructive/30` 4.36:1 → 4.55:1 (Chromium paints the tint at
  4.43:1). Light `--ring` `oklch(0.708 0 0)` →
  `oklch(0.64 0 0)`: the 1px `focus-visible:border-ring` 2.59:1 → 3.36:1 on white and 3.08:1 on
  `bg-muted` (WCAG 1.4.11); the `ring-ring/50` halo stays decoration. `--input`/`--border`
  (1.26:1 light, 1.47:1 dark) are unchanged pending a design decision; `oklch(0.66 0 0)` and
  `oklch(1 0 0 / 35%)` are the lightest values that reach 3:1.

Registry sources use semantic tokens only (`bg-primary`, `text-muted-foreground`), never
palette classes, and never alpha-faded text for information-bearing content.

## 5. Quality: tests, gate, CI, drift

- **Unit** (`tests/unit/`, Vitest, Node): the registry invariants (unique names, descriptions, the `@uifiles/` fork rule, one alias per primitive, `dependencies` that match the imports of every item that ships files, in both directions, with a `css` `@import` or `@plugin` key counting as a use, and no `css` rule repeated from an `@uifiles/*` dependency, whether or not an `@layer` wraps either copy), the site's contracts (`baseUrl()`,
  the alias badge, `/llms.txt`, license and doc accuracy) and the test tooling (the console
  guard, a Vitest pre-bundle list that names every bare specifier a browser test can reach,
  following local imports into the `app/` pages the tests render, and the Playwright origin
  helpers).
- **Browser** (`tests/browser/`, Vitest browser mode on Chromium with `vitest-browser-react`):
  one file per item, ported from upstream's test suite and extended to every prop and state,
  with accessibility asserted through `tests/a11y.ts` (`expectNoViolations`: WCAG 2.0/2.1/2.2
  AA plus best-practice rules, `target-size` on, animations settled; `withDark` for the dark
  theme). Fixtures sit inside `<main>` so axe's landmark rule applies for real. `tests/setup.ts`
  fails any test that logs through `console.error` or `console.warn` unless it opted in with
  `allowConsole()`, including calls a console spy's mock implementation swallowed (the
  global `console` is the guard's proxy, so it knows every spy installed through it).
- **End to end** (`e2e/`, Playwright): axe over every `/preview/<name>` page and the home, in
  light and dark and at desktop and 375 px phone width, as served by Next (server rendering
  and hydration, which the browser tests do not exercise), with console errors and warnings asserted empty, each preview's `<title>` starting with its item's registry title and no preview scrolling sideways (`<html>` `scrollWidth` at most its `clientWidth`, at desktop and at 375 px), plus
  the served HTML of `/preview/branch` (its branch selector and count), `/preview/response` at
  375 px in light and dark (its wide formula scrolls without widening the page, console
  clean), the registry endpoints,
  `/llms.txt` and a keyboard walk of the chat preview. `e2e/helpers.ts` aborts every request
  to a host other than localhost, so the network can neither slow a run nor decide it (a
  preview that needs a third party fails the same way everywhere), and waits for hydration
  (React's fiber key on `<main>`) rather than `networkidle`. It runs against the site the
  Playwright config starts: `pnpm start` in CI, `pnpm registry:build && pnpm dev` locally.
- **Gate** (`pnpm gate`): `format:check → lint → typecheck → registry:validate → test → build`.
  CI (`.github/workflows/ci.yml`) runs the same steps with `pnpm registry:build` before the
  tests, so the built-output checks run, and the tests under coverage (`pnpm test:coverage`,
  per-file thresholds of 80% lines, 80% functions, 70% branches over `registry/**` and
  `lib/**`), checks that the generated registry files are committed
  (`git diff --exit-code -- registry`), runs `pnpm test:e2e` against the production build, and
  `pnpm audit` last (a hard failure that cannot mask a test result), all with
  `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` and cached Playwright browsers.
- **Strict compilation.** Registry files are copied into projects with unknown compiler
  settings, so `tsconfig.json` compiles the repository under `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess` and `noUnusedLocals`.
- **Upstream drift.** `scripts/sync-upstream.ts` hashes each `upstream.lock.json` source
  against what `elements.ai-sdk.dev` serves today, and each forked `registry/ui` file against
  `ui.shadcn.com`. It exits 0 when nothing changed, 1 when a source changed, 2 when nothing
  changed but a source could not be checked. The weekly `upstream-diff` workflow runs it and,
  on exit 1, comments on the open GitHub issue labeled `upstream` or files one (creating the
  label if needed); a maintainer re-ports per `docs/porting-ai-elements.md` and updates the
  lock.

## 6. Agent surface

- `AGENTS.md` is the single source for agents working in the repo; `CLAUDE.md` imports it.
  `.claude/rules/registry.md` loads for files under `registry/`. The shadcn MCP server is in
  `.mcp.json`; the `shadcn`, `migrate-radix-to-base`, `ai-elements` and `ai-sdk` skills are
  installed under `.claude/skills/` from `skills-lock.json` and attributed in `NOTICE`.
- For agents building with the system: `/r/registry.json` with retrieval-quality descriptions
  makes the MCP `list`/`search`/`view`/`add` tools work with no extra code; `/llms.txt` indexes
  every item with its URL; `skills/uifiles/SKILL.md` (`pnpm dlx skills add jamiethompsondesign/uifiles`)
  gives the workflow and the rules (search first, read the real API, semantic tokens, Base UI
  composition).
- The repository's own `components.json` maps `@uifiles` to `http://localhost:3000/r/{name}.json`
  so an item can be round-tripped through the real CLI from a scratch project against
  `pnpm dev`.

## Appendix: facts the design rests on

- shadcn 4.21: `init` takes `-b base|radix|aria` and `--preset`; `registry:base` items carry
  `config`, `cssVars` and `css`; `registry.json` supports `include`; `shadcn build` writes
  `public/r/<item>.json` and `registry.json`; GitHub registries resolve `owner/repo/item#ref`;
  the MCP server ships in the CLI (`shadcn mcp`).
- A `registry:ui` item with `files: []` and `registryDependencies: ["button"]` installs
  upstream `button` under the namespace, resolved against the consumer's style (verified with
  `add --dry-run` from a scratch consumer); `init <base.json>` applies `config`, `cssVars` and
  the font item to a consumer (`--no-reinstall` for a non-interactive re-init).
- The CLI resolves a namespaced dependency (`@uifiles/code-block`) only through the consumer's
  `components.json` `registries` or the shadcn directory, so the GitHub path cannot install
  `tool`, `reasoning` or `chat` until `@uifiles` is listed.
- AI Elements: 49 components (`packages/elements/src/*.tsx`), Apache-2.0, unpinned npm
  dependencies, 24 shadcn primitives as `registryDependencies`; Base UI PR #450 open since
  2026-07-17.
- Next 16 prerenders `/`, `/llms.txt` and every preview at build time (no request-time API is
  used, `cacheComponents` is off), so the `node:fs` reads in `lib/registry.ts` and the preview
  index run only during `next build`, and the public origin is fixed then (`baseUrl()`).
