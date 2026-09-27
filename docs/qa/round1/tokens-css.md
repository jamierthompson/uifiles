# tokens-css — QA round 1

## Summary

Attacked the token layer (`app/globals.css`, `registry/base`, `scripts/sync-tokens.ts`), the Tailwind v4 / CLI CSS plumbing, and every colour class in `registry/**` and `components/ui/**`, with a measured WCAG 2.x pass (own oklch→sRGB script, alpha composited in gamma sRGB as browsers and axe do; axe-core 4.13 corroborated every number to ±0.01) over both themes. 10 findings: 1 high, 4 medium, 3 low, 2 nit. The tokens are byte-identical to upstream Nova neutral except light `--muted-foreground` (verified against `apps/v4/registry/themes.ts@98a1fe6`), so the design system inherits Nova's contrast debts wholesale while the plan advertises AA rigor. Worst: every destructive variant in the wrappers (`button`, `badge`, `bubble`, `dropdown-menu` item, `attachment` media) renders `text-destructive` on `bg-destructive/10` at **3.99:1** in light mode (3.31:1 on hover); `button.test.tsx` only ever rendered the default variant, so no test saw it. Second: `sync-tokens.ts` silently drops tokens on benign CSS edits (a trailing `/* comment */` loses `--ring`; a nested at-rule loses 19 of 31 dark tokens) and still exits 0, so the published base item can drift from the site with no signal.

`git status` note: the lead committed the qa-round1 files as `2f7e6e6` while this lens was running, so my two reproducer files show as tracked and clean; the other `M`/`??` entries under `tests/**/qa-round1*` belong to other lenses.

## Findings (most severe first)

### F1. Destructive variants fail AA in the light theme (3.99:1 at rest, 3.31:1 on hover) — severity: high
- Where: `components/ui/button.tsx:18`, `components/ui/badge.tsx:15`, `components/ui/bubble.tsx:35`, `components/ui/dropdown-menu.tsx:93` (`data-[variant=destructive]:focus:bg-destructive/10`), `components/ui/attachment.tsx:50` (`group-data-[state=error]/attachment:bg-destructive/10 … text-destructive`). Tokens: `app/globals.css:74` (`--destructive: oklch(0.577 0.245 27.325)`).
- What: `text-destructive` (#e7000b) over `bg-destructive/10` composited on white = #fde6e7 → **3.99:1** (14px/500 button text, 12px badge text; both need 4.5:1). Hover `bg-destructive/20` → **3.31:1**. Dark is 5.30:1 at rest but hover `bg-destructive/30` is **4.36:1**. These wrappers are what `@uifiles/button`, `@uifiles/badge`, `@uifiles/bubble`, `@uifiles/dropdown-menu`, `@uifiles/attachment` resolve to for consumers (zero-file aliases → upstream base-nova), and the docs site ships them.
- Evidence: `node contrast2.mjs` (scratch) rows "button.tsx:18 + badge.tsx:15 destructive (light)" 3.99; axe in the browser test: `Element has insufficient color contrast of 4 (foreground color: #e7000b, background color: #fde6e7, font size: 10.5pt (14px)…)` on `<button data-slot="button">` and the same on `<span data-slot="badge" data-variant="destructive">`.
- Why it matters: WCAG 1.4.3 failure on the most common danger affordance, in the default theme, on every consumer install; the plan (§5, `docs/plan.md:224`) says the light palette was tuned for AA, and `tool.tsx` docs say the error container was changed "to meet WCAG AA contrast with the light-mode destructive token", so the repo already knows this token is marginal and left the wrappers on it.
- Proposed fix: token-level, light only: `--destructive: oklch(0.53 0.245 27.325)` gives 5.46 on white, 4.55 on the `/10` tint (hover `/20` is still 3.76; to clear hover too, fork the destructive variants to `bg-destructive/5 hover:bg-destructive/10`, or L=0.50 → 4.95 / 4.08). Dark: hover `/30` → `/25` (or accept 4.36 as a transient state). Add `variant="destructive"` to `tests/browser/button.test.tsx`.
- Test written: `tests/unit/qa-round1-tokens-css.test.ts` › "text-destructive meets AA on bg-destructive/10 in light (destructive button)" (expected: FAIL now, 3.987…); `tests/browser/qa-round1/tokens-css.test.tsx` › "tokens-css: light theme › wrapper variants pass axe colour contrast" (expected: FAIL now; also catches F3's Alert row).

### F2. `sync-tokens.ts` silently drops tokens on ordinary CSS edits and never checks itself — severity: medium
- Where: `scripts/sync-tokens.ts:9-19` (`block()`: `${selector}\s*\{([^}]*)\}` + per-line `/^\s*--([\w-]+):\s*(.+?);\s*$/`), `:34-35` (writes whatever it got, no parity/count assertion).
- What (each run against a copy of today's `globals.css` with one edit; the script exits 0 in every case except 5):
  1. `/* page } bg */` comment inside `:root` → **0 light tokens** written (`"light": {}`), `shadcn registry validate` accepts it (run against that output: "Registry is valid"; `light` is optional in `registryItemCssVarsSchema`, `packages/shadcn/src/registry/schema.ts:126-130`).
  2. `@media (forced-colors: active) { --ring: Highlight; }` nested in `.dark` → **12 of 31 dark tokens**; `sidebar-*`, `chart-*`, `border`, `input`, `ring` vanish.
  3. A second `.dark { --background: … }` override block → first block wins, cascade result ignored.
  4. `@layer base { :root { --tw-x: 1 } }` placed before the token block → **1 light token**.
  5. `:root,\n.light {` selector list → throws `No :root block` (loud; fine).
  6. Multi-line value (`--font-stack: ui-sans-serif,\n system-ui;`) → dropped.
  7. `--ring: oklch(0.556 0 0); /* focus */` → **`--ring` dropped from dark** (prints "30 dark", exits 0).
- Evidence: `scratchpad/qa/round1/tokens-css/synctest/` runs (script copy with the prettier step removed, cwd-relative paths as in the original); output pasted under "Commands run". On the clean tree the script is a no-op (`git diff --stat registry/base/registry.json` empty after `node scripts/sync-tokens.ts`; verified).
- Why it matters: this is the only bridge between the site's stylesheet and what `shadcn init @uifiles/base` installs; the failure mode is a base item missing tokens while the docs site (which does not use the JSON) looks fine, i.e. exactly the drift the script exists to prevent, discovered by a consumer.
- Proposed fix: parse with a brace-aware walk after stripping comments (the unit test has a 15-line one), or `postcss` which is already in `node_modules` via shadcn; assert light/dark key parity (minus `radius`) and a minimum count, and fail the build on mismatch.
- Test written: `tests/unit/qa-round1-tokens-css.test.ts` › "scripts/sync-tokens.ts robustness › keeps a token whose line ends with a comment" (expected: FAIL now) and › "does not drop tokens after a nested at-rule in .dark" (expected: FAIL now). Both run the real script in a temp cwd.

### F3. Alpha-faded destructive text: `AttachmentDescription` error state 4.11:1 / 4.36:1, `Alert` destructive description 4.49:1 — severity: medium
- Where: `components/ui/attachment.tsx:120` (`group-data-[state=error]/attachment:text-destructive/80`, 12px), `components/ui/alert.tsx:12` (`*:data-[slot=alert-description]:text-destructive/90`, 14px). `Alert` is composed by `registry/ai/confirmation.tsx:76`.
- What: `text-destructive/80` on `bg-card`: **4.11:1 light, 4.36:1 dark**. `text-destructive/90` on white: 4.52 by my script, **4.49 by axe** (rounding lands on the wrong side of 4.5; axe reports it as a violation).
- Evidence: browser test, both themes: `insufficient color contrast of 4.11 (foreground color: #ec333c, background color: #ffffff, font size: 9.0pt (12px))` and `4.36 (foreground color: #d15457, background color: #171717)` on `<span data-slot="attachment-description">`; light theme `4.49 (foreground color: #ea1a23, background color: #ffffff)` on `<div data-slot="alert-description">`.
- Why it matters: `attachment` is the component AGENTS.md tells the port to favour over AI Elements' `attachments`, and the error state is where the text matters most. Nothing in the repo renders `<Alert variant="destructive">` (`Confirmation` uses the default variant), but `@uifiles/alert` aliases this wrapper, so a consumer running axe on a destructive `Alert` gets a violation.
- Proposed fix: drop the alpha (`text-destructive`) in both; the F1 token change fixes the Alert row on its own.
- Test written: `tests/browser/qa-round1/tokens-css.test.tsx` › "light theme › attachment error description passes axe colour contrast" and › "dark theme › attachment error description passes axe colour contrast" (expected: FAIL now).

### F4. Focus indicator and input boundary contrast below 3:1 (WCAG 1.4.11) in the shipped tokens — severity: medium
- Where: `app/globals.css:75-77` (`--border`, `--input` 0.922; `--ring` 0.708), `:110-112` (dark `oklch(1 0 0 / 10%)`, `/ 15%`, ring 0.556). Used by `focus-visible:border-ring focus-visible:ring-ring/50` (`button.tsx:6`, `input.tsx:11`, `textarea.tsx:9`, `select.tsx:43`, `badge.tsx:7`, `input-group.tsx:17`) and `border-input` on every field.
- What: light `--ring` on background **2.59:1** (the 1px focus border), `ring-ring/50` halo **1.54:1** (dark 1.87); `border-input` **1.26:1** light, **1.47:1** dark (`oklch(1 0 0/15%)` over #0a0a0a = #2f2f2f); outline button `border-border` 1.26:1. Dark `--ring` 0.556 passes (4.18).
- Evidence: `node contrast.mjs` rows `ring/background`, `input/background`; `node contrast2.mjs` rows "button.tsx:6 focus ring/border", "input.tsx:11 border". Values are identical to upstream Nova neutral (diff below), so this is inherited.
- Why it matters: keyboard users get a 2.59:1 focus border plus a 1.5:1 halo on white; unfocused fields are outlined at 1.26:1. 1.4.11 (AA) asks 3:1 for both; this is the kind of thing a "design system judged on colour rigor" gets called on first. The plan departed from Nova once for `muted-foreground` and stopped.
- Proposed fix: light `--ring: oklch(0.64 0 0)` (3.36:1) and keep the `/50` halo as decoration, or switch the wrappers to `focus-visible:ring-ring` (solid) for the halo; input boundary needs `--input` ≤ `oklch(0.66 0 0)` (≥3:1), which is a visible design change, so decide deliberately and document it in `docs/plan.md` §5 like the `muted-foreground` departure. Dark `--input: oklch(1 0 0 / 35%)` ≈ 3:1.
- Test written: `tests/unit/qa-round1-tokens-css.test.ts` › "focus ring and input border meet 3:1 (WCAG 1.4.11)" (expected: FAIL now, first assertion 2.593…).

### F5. `code-block` line numbers at 2.04:1 / 2.67:1 (`before:text-muted-foreground/50`), invisible to axe — severity: medium
- Where: `registry/ai/code-block.tsx:88` (`LINE_NUMBER_CLASSES`).
- What: `muted-foreground/50` over the card: **2.04:1 light, 2.67:1 dark**. The numbers are generated with `before:content-[counter(line)]`, so axe's `color-contrast` (text nodes only) never samples them; the existing `code-block.test.tsx` passes with them at 2:1.
- Evidence: `node contrast2.mjs` row "registry/ai/code-block.tsx:88 line numbers". Same pattern the port removed elsewhere for AA: `chain-of-thought.tsx:120-127` comment ("upstream dims pending steps with `text-muted-foreground/50`, which fails WCAG AA"), `queue.tsx:82/103`.
- Why it matters: inconsistent with the port's own stated rule; line numbers are information (error messages reference them).
- Proposed fix: `before:text-muted-foreground` (5.28:1 light on white, 6.91:1 dark on card); if a lighter look is wanted, `opacity` on a decorative-only element, not text.
- Test written: `tests/unit/qa-round1-tokens-css.test.ts` › "class hygiene › never fades text with an alpha suffix" (expected: FAIL now; hits `registry/ai/code-block.tsx:88` and, via the same regex, the chain-of-thought comment line `:128`, which is prose, so the fixer may narrow the regex to class strings).

### F6. `queue` item `docs` claims an AA defect the code does not have — severity: low
- Where: `registry/ai/registry.json` (queue › `docs`: "Note: completed items keep upstream's text-muted-foreground/50 and /40, which do not meet AA contrast."); `registry/ai/queue.tsx:82,103` ship `text-muted-foreground line-through`; `docs/plan.md:226` says "Completed queue rows drop upstream's `/50` alpha".
- What: the consumer-facing post-install note (also in `public/r/queue.json`) contradicts both the source and the plan. Upstream `queue.tsx:80,101` did have `/50` and `/40`; the port fixed it and the note was not updated.
- Evidence: `grep -n "muted-foreground/" registry/ai/queue.tsx` → only `border-muted-foreground/50|/20`, `bg-muted-foreground/10`.
- Proposed fix: replace the sentence with the truth (alpha dropped for AA); consider whether the indicator dots (`border-muted-foreground/50` pending 2.04:1, `/20` completed 1.30:1, `queue.tsx:61-62`) are the only pending/completed cue besides `line-through` (they are not, so 1.4.11 is not triggered; but the pending dot is near-invisible on white).
- Test written: `tests/unit/qa-round1-tokens-css.test.ts` › "queue docs describe the classes it ships" (expected: FAIL now).

### F7. Chart palette is a five-step grey ramp with adjacent steps at 1.33–1.65:1; `sidebar-primary` is the only chromatic token and only in dark — severity: low
- Where: `app/globals.css:78-82`, `:113-117` (`--chart-1..5`), `:120` (`--sidebar-primary: oklch(0.488 0.243 264.376)` dark vs neutral 0.205 light).
- What: light `chart-1` on background 1.48:1; dark `chart-3/4/5` on background 2.54 / 1.91 / 1.31:1; every adjacent pair except 1–2 is < 3:1 in both themes. Nothing in `registry/**` or `app/**` uses `chart-*` or `sidebar-*` (grep: 0 hits), yet the base item ships them as the design system's chart and sidebar tokens (inherited verbatim from Nova neutral).
- Why it matters: a consumer who installs `@uifiles/base` and then `@uifiles/chart` gets series that cannot be told apart; the dark blue `sidebar-primary` flips theme character between modes.
- Proposed fix: either own a categorical ramp (the `dataviz` skill's validator is in this repo's skill set) or drop `chart-*`/`sidebar-*` from the base item and say so in `docs`.

### F8. Base item dependency and CSS-setup hygiene — severity: low
- Where: `registry/base/registry.json:16-27`, `registry/ai/registry.json` (response › `docs`), `app/globals.css:8-12`.
- What: (a) `next-themes` is a hard `dependency` of a framework-agnostic `registry:base`; the CLI supports non-Next consumers (`update-fonts.ts:50-60` fontsource branch). (b) `shadcn` as a `devDependency` of the base item while the repo's own `package.json` lists `shadcn` and `tw-animate-css` under `dependencies`; pick one story. (c) Four `@source` lines for `@streamdown/{code,math,mermaid,cjk}/dist/*.js` are dead: those dists contain no Tailwind class strings (grep: 0), only `streamdown/dist/*.js` does, so the `response` `docs` line (one `@source`) is sufficient, not incomplete. (d) `docs` calls `streamdown/styles.css` optional; without it `[data-sd-animate]` keyframes (`node_modules/streamdown/styles.css:1-33`) are missing, so streamed blocks pop instead of fading; say what it does. (e) No item can ship `@source` through `css` (the schema allows arbitrary at-rules, `schema.ts:133-141`, and `update-css.ts:441-442` would append it, but relative paths are resolved from the consumer's stylesheet, so a registry-provided `@source "../node_modules/…"` is only correct for `app/globals.css`-shaped projects); keeping it in `docs` is the right call, just make it precise.

### F9. Enter/exit animations on every popup and panel ignore `prefers-reduced-motion` — severity: low
- Where: `components/ui/{tooltip,dropdown-menu,hover-card,select,dialog}.tsx` (`data-open:animate-in … data-closed:animate-out`), `registry/ai/{tool,task,sources,reasoning,chain-of-thought}.tsx` panels (`slide-in-from-top-2`/`slide-out-to-top-2`).
- What: `tw-animate-css` ships no reduced-motion guard (grep of `node_modules/tw-animate-css/dist/tw-animate.css`: 0) and neither `app/globals.css` nor any component uses `motion-reduce:`. `shimmer` is fine: `node_modules/shadcn/dist/tailwind.css:623-629` disables it under `prefers-reduced-motion: reduce`.
- Proposed fix: one global rule in `@layer base` (`@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; … } }`) or `motion-reduce:animate-none` on the panels.

### F10. Palette/literal leftovers and a dead Radix selector — severity: nit
- `components/ui/dialog.tsx:33` `bg-black/10` overlay: the only palette class under `components/ui`; upstream base-nova file, but it lands on the docs site and AGENTS.md forbids palette classes.
- `components/ui/tooltip.tsx:52` `data-[state=delayed-open]:animate-in|fade-in-0|zoom-in-95`: Radix state that Base UI never sets (Base UI tooltip uses `data-open`/`data-instant`); three dead rules in the served CSS (`grep -c delayed-open served.css` = 3). Upstream base-nova leftover.
- `@source "../node_modules/streamdown/dist/*.js"` pulls streamdown's own `bg-red-100 text-red-800` (its mermaid error box) into the site CSS (`.text-red-800` present in `served.css`); the docs site therefore ships palette classes it did not write. Harmless; note for the "no palette classes" claim.
- `registry/ai/code-block.tsx:63,273` `dark:!bg-[var(--shiki-dark-bg)]` and `button.tsx:14`/`bubble.tsx:25-29` `color-mix(...)`/`oklch(from var(--primary) …)` are token-derived arbitrary values, acceptable.

## Contrast table

Method: oklch → OKLab → linear sRGB (Björn Ottosson matrices) → gamut clamp → gamma sRGB; alpha (`/NN` and the dark `oklch(1 0 0 / 10%)` tokens) composited in gamma sRGB over the named surface stack (page background first), then relative luminance and (L1+0.05)/(L2+0.05). This matches axe-core's blending; axe's numbers in the browser test agree to ±0.01. Text threshold 4.5:1, UI/border 3:1. Sanity: Nova's light `muted-foreground 0.556` on `muted 0.97` = 4.339:1, matching the plan's "4.34".

Token-pair table (`node contrast.mjs md`):

| mode | fg | bg | fg sRGB | bg sRGB | ratio | need | verdict | used by |
|---|---|---|---|---|---|---|---|---|
| light | `foreground` | `background` | #0a0a0a | #ffffff | 19.79:1 | 4.5:1 | pass | body text |
| light | `card-foreground` | `card` | #0a0a0a | #ffffff | 19.79:1 | 4.5:1 | pass |  |
| light | `popover-foreground` | `popover` | #0a0a0a | #ffffff | 19.79:1 | 4.5:1 | pass |  |
| light | `primary-foreground` | `primary` | #fafafa | #171717 | 17.16:1 | 4.5:1 | pass | button default |
| light | `secondary-foreground` | `secondary` | #171717 | #f5f5f5 | 16.42:1 | 4.5:1 | pass | button secondary |
| light | `muted-foreground` | `muted` | #6c6c6c | #f5f5f5 | 4.84:1 | 4.5:1 | pass | kbd, muted panels |
| light | `muted-foreground` | `background` | #6c6c6c | #ffffff | 5.28:1 | 4.5:1 | pass | descriptions |
| light | `muted-foreground` | `card` | #6c6c6c | #ffffff | 5.28:1 | 4.5:1 | pass |  |
| light | `muted-foreground` | `secondary` | #6c6c6c | #f5f5f5 | 4.84:1 | 4.5:1 | pass |  |
| light | `muted-foreground` | `accent` | #6c6c6c | #f5f5f5 | 4.84:1 | 4.5:1 | pass |  |
| light | `muted-foreground` | `popover` | #6c6c6c | #ffffff | 5.28:1 | 4.5:1 | pass | menu labels |
| light | `accent-foreground` | `accent` | #171717 | #f5f5f5 | 16.42:1 | 4.5:1 | pass | menu item focus |
| light | `primary` | `background` | #171717 | #ffffff | 17.91:1 | 4.5:1 | pass | link variant, tool icons |
| light | `primary` | `muted` | #171717 | #f5f5f5 | 16.42:1 | 4.5:1 | pass |  |
| light | `destructive` | `background` | #e7000b | #ffffff | 4.76:1 | 4.5:1 | pass | text-destructive (tool icons, alert) |
| light | `destructive` | `card` | #e7000b | #ffffff | 4.76:1 | 4.5:1 | pass | alert destructive title |
| light | `destructive` | `muted` | #e7000b | #f5f5f5 | 4.37:1 | 4.5:1 | **FAIL** |  |
| light | `white` | `destructive` | #ffffff | #e7000b | 4.76:1 | 4.5:1 | pass | NOT USED: no solid bg-destructive + text-white in repo |
| light | `muted-foreground` | `primary` | #6c6c6c | #171717 | 3.39:1 | 4.5:1 | **FAIL** | NOT USED in repo (informational) |
| light | `border` | `background` | #e5e5e5 | #ffffff | 1.26:1 | 3:1 | **FAIL** | non-interactive borders (no WCAG requirement) |
| light | `border` | `card` | #e5e5e5 | #ffffff | 1.26:1 | 3:1 | **FAIL** |  |
| light | `border` | `muted` | #e5e5e5 | #f5f5f5 | 1.15:1 | 3:1 | **FAIL** |  |
| light | `input` | `background` | #e5e5e5 | #ffffff | 1.26:1 | 3:1 | **FAIL** | input/textarea/select border (1.4.11) |
| light | `input` | `card` | #e5e5e5 | #ffffff | 1.26:1 | 3:1 | **FAIL** |  |
| light | `ring` | `background` | #a1a1a1 | #ffffff | 2.59:1 | 3:1 | **FAIL** | focus-visible:border-ring |
| light | `ring` | `card` | #a1a1a1 | #ffffff | 2.59:1 | 3:1 | **FAIL** |  |
| light | `sidebar-foreground` | `sidebar` | #0a0a0a | #fafafa | 18.96:1 | 4.5:1 | pass |  |
| light | `sidebar-primary-foreground` | `sidebar-primary` | #fafafa | #171717 | 17.16:1 | 4.5:1 | pass |  |
| light | `sidebar-accent-foreground` | `sidebar-accent` | #171717 | #f5f5f5 | 16.42:1 | 4.5:1 | pass |  |
| light | `sidebar-border` | `sidebar` | #e5e5e5 | #fafafa | 1.21:1 | 3:1 | **FAIL** |  |
| light | `sidebar-ring` | `sidebar` | #a1a1a1 | #fafafa | 2.48:1 | 3:1 | **FAIL** |  |
| light | `muted-foreground` | `sidebar` | #6c6c6c | #fafafa | 5.06:1 | 4.5:1 | pass |  |
| light | `muted-foreground` | `sidebar-accent` | #6c6c6c | #f5f5f5 | 4.84:1 | 4.5:1 | pass |  |
| light | `chart-1` | `background` | #d4d4d4 | #ffffff | 1.48:1 | 3:1 | **FAIL** | chart tokens unused in repo |
| light | `chart-2` | `background` | #737373 | #ffffff | 4.73:1 | 3:1 | pass |  |
| light | `chart-3` | `background` | #525252 | #ffffff | 7.80:1 | 3:1 | pass |  |
| light | `chart-4` | `background` | #404040 | #ffffff | 10.39:1 | 3:1 | pass |  |
| light | `chart-5` | `background` | #262626 | #ffffff | 15.12:1 | 3:1 | pass |  |
| light | `chart-1` | `chart-2` | #d4d4d4 | #737373 | 3.19:1 | 3:1 | pass | adjacent series |
| light | `chart-2` | `chart-3` | #737373 | #525252 | 1.65:1 | 3:1 | **FAIL** |  |
| light | `chart-3` | `chart-4` | #525252 | #404040 | 1.33:1 | 3:1 | **FAIL** |  |
| light | `chart-4` | `chart-5` | #404040 | #262626 | 1.45:1 | 3:1 | **FAIL** |  |
| dark | `foreground` | `background` | #fafafa | #0a0a0a | 18.96:1 | 4.5:1 | pass | body text |
| dark | `card-foreground` | `card` | #fafafa | #171717 | 17.16:1 | 4.5:1 | pass |  |
| dark | `popover-foreground` | `popover` | #fafafa | #171717 | 17.16:1 | 4.5:1 | pass |  |
| dark | `primary-foreground` | `primary` | #171717 | #e5e5e5 | 14.22:1 | 4.5:1 | pass | button default |
| dark | `secondary-foreground` | `secondary` | #fafafa | #262626 | 14.48:1 | 4.5:1 | pass | button secondary |
| dark | `muted-foreground` | `muted` | #a1a1a1 | #262626 | 5.83:1 | 4.5:1 | pass | kbd, muted panels |
| dark | `muted-foreground` | `background` | #a1a1a1 | #0a0a0a | 7.63:1 | 4.5:1 | pass | descriptions |
| dark | `muted-foreground` | `card` | #a1a1a1 | #171717 | 6.91:1 | 4.5:1 | pass |  |
| dark | `muted-foreground` | `secondary` | #a1a1a1 | #262626 | 5.83:1 | 4.5:1 | pass |  |
| dark | `muted-foreground` | `accent` | #a1a1a1 | #262626 | 5.83:1 | 4.5:1 | pass |  |
| dark | `muted-foreground` | `popover` | #a1a1a1 | #171717 | 6.91:1 | 4.5:1 | pass | menu labels |
| dark | `accent-foreground` | `accent` | #fafafa | #262626 | 14.48:1 | 4.5:1 | pass | menu item focus |
| dark | `primary` | `background` | #e5e5e5 | #0a0a0a | 15.72:1 | 4.5:1 | pass | link variant, tool icons |
| dark | `primary` | `muted` | #e5e5e5 | #262626 | 12.00:1 | 4.5:1 | pass |  |
| dark | `destructive` | `background` | #ff6467 | #0a0a0a | 6.84:1 | 4.5:1 | pass | text-destructive (tool icons, alert) |
| dark | `destructive` | `card` | #ff6467 | #171717 | 6.19:1 | 4.5:1 | pass | alert destructive title |
| dark | `destructive` | `muted` | #ff6467 | #262626 | 5.23:1 | 4.5:1 | pass |  |
| dark | `white` | `destructive` | #ffffff | #ff6467 | 2.89:1 | 4.5:1 | **FAIL** | NOT USED: no solid bg-destructive + text-white in repo |
| dark | `muted-foreground` | `primary` | #a1a1a1 | #e5e5e5 | 2.06:1 | 4.5:1 | **FAIL** | NOT USED in repo (informational) |
| dark | `border` | `background` | #232323 | #0a0a0a | 1.25:1 | 3:1 | **FAIL** | non-interactive borders (no WCAG requirement) |
| dark | `border` | `card` | #2e2e2e | #171717 | 1.32:1 | 3:1 | **FAIL** |  |
| dark | `border` | `muted` | #3c3c3c | #262626 | 1.37:1 | 3:1 | **FAIL** |  |
| dark | `input` | `background` | #2f2f2f | #0a0a0a | 1.47:1 | 3:1 | **FAIL** | input/textarea/select border (1.4.11) |
| dark | `input` | `card` | #3a3a3a | #171717 | 1.57:1 | 3:1 | **FAIL** |  |
| dark | `ring` | `background` | #737373 | #0a0a0a | 4.18:1 | 3:1 | pass | focus-visible:border-ring |
| dark | `ring` | `card` | #737373 | #171717 | 3.79:1 | 3:1 | pass |  |
| dark | `sidebar-foreground` | `sidebar` | #fafafa | #171717 | 17.16:1 | 4.5:1 | pass |  |
| dark | `sidebar-primary-foreground` | `sidebar-primary` | #fafafa | #1447e6 | 6.54:1 | 4.5:1 | pass |  |
| dark | `sidebar-accent-foreground` | `sidebar-accent` | #fafafa | #262626 | 14.48:1 | 4.5:1 | pass |  |
| dark | `sidebar-border` | `sidebar` | #2e2e2e | #171717 | 1.32:1 | 3:1 | **FAIL** |  |
| dark | `sidebar-ring` | `sidebar` | #737373 | #171717 | 3.79:1 | 3:1 | pass |  |
| dark | `muted-foreground` | `sidebar` | #a1a1a1 | #171717 | 6.91:1 | 4.5:1 | pass |  |
| dark | `muted-foreground` | `sidebar-accent` | #a1a1a1 | #262626 | 5.83:1 | 4.5:1 | pass |  |
| dark | `chart-1` | `background` | #d4d4d4 | #0a0a0a | 13.36:1 | 3:1 | pass | chart tokens unused in repo |
| dark | `chart-2` | `background` | #737373 | #0a0a0a | 4.18:1 | 3:1 | pass |  |
| dark | `chart-3` | `background` | #525252 | #0a0a0a | 2.54:1 | 3:1 | **FAIL** |  |
| dark | `chart-4` | `background` | #404040 | #0a0a0a | 1.91:1 | 3:1 | **FAIL** |  |
| dark | `chart-5` | `background` | #262626 | #0a0a0a | 1.31:1 | 3:1 | **FAIL** |  |
| dark | `chart-1` | `chart-2` | #d4d4d4 | #737373 | 3.19:1 | 3:1 | pass | adjacent series |
| dark | `chart-2` | `chart-3` | #737373 | #525252 | 1.65:1 | 3:1 | **FAIL** |  |
| dark | `chart-3` | `chart-4` | #525252 | #404040 | 1.33:1 | 3:1 | **FAIL** |  |
| dark | `chart-4` | `chart-5` | #404040 | #262626 | 1.45:1 | 3:1 | **FAIL** |  |

Component-combination table, the classes actually in the code (`node contrast2.mjs md`):

| mode | ratio | need | fg sRGB | bg sRGB | verdict | where / classes |
|---|---|---|---|---|---|---|
| light | 3.99:1 | 4.5:1 | #e7000b | #fde5e7 | **FAIL** | components/ui/button.tsx:18 + badge.tsx:15 destructive (light): text-destructive on bg-destructive/10 |
| light | 3.31:1 | 4.5:1 | #e7000b | #faccce | **FAIL** | button destructive hover (light): text-destructive on bg-destructive/20 |
| dark | 5.30:1 | 4.5:1 | #ff6467 | #3b1c1d | pass | button/badge destructive (dark): text-destructive on bg-destructive/20 |
| dark | 4.36:1 | 4.5:1 | #ff6467 | #542526 | **FAIL** | button destructive hover (dark): text-destructive on bg-destructive/30 |
| light | 3.99:1 | 4.5:1 | #e7000b | #fde5e7 | **FAIL** | dropdown-menu.tsx:93 destructive item focus (light): on bg-destructive/10 over popover |
| dark | 4.63:1 | 4.5:1 | #ff6467 | #452627 | pass | dropdown-menu.tsx:93 destructive item focus (dark): on bg-destructive/20 over popover |
| light | 3.99:1 | 4.5:1 | #e7000b | #fde5e7 | **FAIL** | bubble.tsx:35 destructive bubble: text-destructive on bg-destructive/10 (light) /20 (dark) |
| dark | 5.30:1 | 4.5:1 | #ff6467 | #3b1c1d | pass | bubble.tsx:35 destructive bubble (dark) |
| light | 4.52:1 | 4.5:1 | #ea1923 | #ffffff | pass | alert.tsx:12 destructive description: text-destructive/90 on bg-card |
| dark | 5.22:1 | 4.5:1 | #e85c5f | #171717 | pass | alert.tsx:12 destructive description: text-destructive/90 on bg-card |
| light | 4.12:1 | 4.5:1 | #ec333c | #ffffff | **FAIL** | attachment.tsx:120 error name: text-destructive/80 on bg-card |
| dark | 4.37:1 | 4.5:1 | #d15457 | #171717 | **FAIL** | attachment.tsx:120 error name: text-destructive/80 on bg-card |
| light | 3.99:1 | 4.5:1 | #e7000b | #fde5e7 | **FAIL** | attachment.tsx:50 error icon: text-destructive on bg-destructive/10 over card |
| dark | 5.46:1 | 4.5:1 | #ff6467 | #2e1f1f | pass | attachment.tsx:50 error icon: text-destructive on bg-destructive/10 over card |
| light | 2.04:1 | 4.5:1 | #b5b5b5 | #ffffff | **FAIL** | registry/ai/code-block.tsx:88 line numbers: text-muted-foreground/50 on bg-card |
| dark | 2.67:1 | 4.5:1 | #5c5c5c | #171717 | **FAIL** | registry/ai/code-block.tsx:88 line numbers: text-muted-foreground/50 on bg-card |
| light | 2.04:1 | 3:1 | #b5b5b5 | #ffffff | **FAIL** | registry/ai/queue.tsx:62 pending indicator border: border-muted-foreground/50 (UI, 3:1) |
| dark | 2.67:1 | 3:1 | #555555 | #0a0a0a | **FAIL** | registry/ai/queue.tsx:62 pending indicator border: border-muted-foreground/50 (UI, 3:1) |
| light | 1.30:1 | 3:1 | #e2e2e2 | #ffffff | **FAIL** | registry/ai/queue.tsx:61 completed indicator border: border-muted-foreground/20 (UI, 3:1) |
| dark | 1.35:1 | 3:1 | #282828 | #0a0a0a | **FAIL** | registry/ai/queue.tsx:61 completed indicator border: border-muted-foreground/20 (UI, 3:1) |
| light | 4.76:1 | 4.5:1 | #e7000b | #ffffff | pass | registry/ai/tool.tsx:165 error output: text-destructive on bg-card |
| dark | 6.19:1 | 4.5:1 | #ff6467 | #171717 | pass | registry/ai/tool.tsx:165 error output: text-destructive on bg-card |
| light | 18.96:1 | 4.5:1 | #0a0a0a | #fafafa | pass | registry/ai/tool.tsx:165 output: text-foreground on bg-muted/50 over card |
| dark | 15.86:1 | 4.5:1 | #fafafa | #1f1f1f | pass | registry/ai/tool.tsx:165 output: text-foreground on bg-muted/50 over card |
| light | 5.06:1 | 4.5:1 | #6c6c6c | #fafafa | pass | registry/ai/code-block.tsx header: text-muted-foreground on bg-muted/50 over card |
| dark | 6.39:1 | 4.5:1 | #a1a1a1 | #1f1f1f | pass | registry/ai/code-block.tsx header: text-muted-foreground on bg-muted/50 over card |
| light | 4.84:1 | 4.5:1 | #6c6c6c | #f5f5f5 | pass | kbd.tsx:8: text-muted-foreground on bg-muted |
| dark | 5.83:1 | 4.5:1 | #a1a1a1 | #262626 | pass | kbd.tsx:8: text-muted-foreground on bg-muted |
| light | 11.20:1 | 4.5:1 | #ffffff | #3b3b3b | pass | kbd in tooltip (light): text-background on bg-background/20 over foreground |
| dark | 15.28:1 | 4.5:1 | #0a0a0a | #e2e2e2 | pass | kbd in tooltip (dark): text-background on bg-background/10 over foreground |
| light | 19.79:1 | 4.5:1 | #ffffff | #0a0a0a | pass | tooltip.tsx:52: text-background on bg-foreground |
| dark | 18.96:1 | 4.5:1 | #0a0a0a | #fafafa | pass | tooltip.tsx:52: text-background on bg-foreground |
| light | 5.28:1 | 4.5:1 | #6c6c6c | #ffffff | pass | input.tsx:11 placeholder (light): muted-foreground on bg-transparent over background |
| dark | 7.04:1 | 4.5:1 | #a1a1a1 | #151515 | pass | input.tsx:11 placeholder (dark): muted-foreground on bg-input/30 over background |
| light | 1.26:1 | 3:1 | #e5e5e5 | #ffffff | **FAIL** | input.tsx:11 border (light): border-input on background (1.4.11 UI boundary, 3:1) |
| dark | 1.56:1 | 3:1 | #383838 | #151515 | **FAIL** | input.tsx:11 border (dark): border-input on bg-input/30 over background |
| light | 1.54:1 | 3:1 | #d0d0d0 | #ffffff | **FAIL** | button.tsx:6 focus ring: ring-ring/50 on background (focus indicator, 3:1) |
| dark | 1.87:1 | 3:1 | #3f3f3f | #0a0a0a | **FAIL** | button.tsx:6 focus ring: ring-ring/50 on background (focus indicator, 3:1) |
| light | 2.59:1 | 3:1 | #a1a1a1 | #ffffff | **FAIL** | button.tsx:6 focus border: border-ring on background (3:1) |
| dark | 4.18:1 | 3:1 | #737373 | #0a0a0a | pass | button.tsx:6 focus border: border-ring on background (3:1) |
| light | 1.24:1 | 3:1 | #e7e7e7 | #ffffff | **FAIL** | card.tsx:14 ring: ring-foreground/10 on background (decorative) |
| dark | 1.24:1 | 3:1 | #222222 | #0a0a0a | **FAIL** | card.tsx:14 ring: ring-foreground/10 on background (decorative) |
| light | 1.26:1 | 3:1 | #e5e5e5 | #ffffff | **FAIL** | button.tsx:12 outline border (light): border-border on background |
| dark | 1.56:1 | 3:1 | #383838 | #151515 | **FAIL** | button.tsx:12 outline border (dark): border-input on bg-input/30 |
| light | 9.12:1 | 4.5:1 | #fafafa | #454545 | pass | button.tsx:10 default HOVER: text-primary-foreground on bg-primary/80 over background |
| dark | 9.15:1 | 4.5:1 | #171717 | #b9b9b9 | pass | button.tsx:10 default HOVER: text-primary-foreground on bg-primary/80 over background |
| light | 9.12:1 | 4.5:1 | #fafafa | #454545 | pass | badge.tsx:11 default [a]:hover: text-primary-foreground on bg-primary/80 over card |
| dark | 9.42:1 | 4.5:1 | #171717 | #bcbcbc | pass | badge.tsx:11 default [a]:hover: text-primary-foreground on bg-primary/80 over card |
| light | 9.12:1 | 4.5:1 | #fafafa | #454545 | pass | bubble.tsx:23 primary bubble hover: bg-primary/80 |
| dark | 9.15:1 | 4.5:1 | #171717 | #b9b9b9 | pass | bubble.tsx:23 primary bubble hover: bg-primary/80 |
| light | 16.72:1 | 4.5:1 | #171717 | #f7f7f7 | pass | badge.tsx:13 secondary [a]:hover: secondary-fg on bg-secondary/80 |
| dark | 15.52:1 | 4.5:1 | #fafafa | #202020 | pass | badge.tsx:13 secondary [a]:hover: secondary-fg on bg-secondary/80 |
| light | 17.16:1 | 4.5:1 | #fafafa | #171717 | pass | button.tsx:6 disabled: primary-fg on primary at opacity-50 (exempt: inactive control) |
| dark | 14.22:1 | 4.5:1 | #171717 | #e5e5e5 | pass | button.tsx:6 disabled: primary-fg on primary at opacity-50 (exempt: inactive control) |
| dark | 1.25:1 | 3:1 | #232323 | #0a0a0a | **FAIL** | dark border token: oklch(1 0 0 / 10%) over background |
| dark | 1.32:1 | 3:1 | #2e2e2e | #171717 | **FAIL** | dark border token over card |
| dark | 1.47:1 | 3:1 | #2f2f2f | #0a0a0a | **FAIL** | dark input token: oklch(1 0 0 / 15%) over background |
| dark | 1.32:1 | 3:1 | #2e2e2e | #171717 | **FAIL** | dark sidebar-border over sidebar |

Token diff vs upstream Nova neutral (`apps/v4/registry/themes.ts@98a1fe6`, fetched via raw.githubusercontent.com): light differs only in `muted-foreground` (nova `oklch(0.556 0 0)` → ours `oklch(0.53 0 0)`), 31/32 identical; dark 31/31 identical. The plan's departure note is exact; everything else above is inherited.

## Palette/literal colour hits

Scan: `registry/**/*.{ts,tsx}` and `components/ui/*.tsx` for `(bg|text|border|ring|fill|stroke|divide|outline|shadow|from|to|via|decoration|accent|caret|placeholder)-(white|black|<palette>-NNN)`, `#hex`, `rgb(`, `oklch(`, `[color:`/`[background:`, and `*-[…]` arbitrary values.

| file:line | class / literal | verdict |
|---|---|---|
| `components/ui/dialog.tsx:33` | `bg-black/10` | palette class (upstream wrapper) |
| `components/ui/tooltip.tsx:52` | `data-[state=delayed-open]:…` ×3 | dead Radix selector (upstream wrapper) |
| `components/ui/button.tsx:14`, `bubble.tsx:25,27` | `hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]` | token-derived, OK |
| `components/ui/bubble.tsx:29` | `bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)]` (+3 siblings) | token-derived relative colour, OK |
| `components/ui/card.tsx:14` | `ring-foreground/10`, `[--card-spacing:--spacing(4)]` | token alpha, OK |
| `registry/ai/code-block.tsx:63,273` | `dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]` | shiki vars, OK |
| `registry/ai/reasoning.tsx:171` | `[--shimmer-duration:1s]` | OK |
| `registry/blocks/chat/lib/demo-conversation.ts:32,36` | `oklch(0.72 0.19 150)` inside demo markdown text | prose, not a class |
| `registry/**` | `bg-transparent` ×3, `border-transparent` ×0 | not palette |
| served CSS via `@source` | `.bg-red-100`, `.text-red-800` (streamdown's mermaid error box) | third-party, lands on the site |

Registry sources (`registry/ai`, `registry/blocks`, `registry/base`) contain **no** palette classes or literal colours; the unit test "uses no palette classes or literal colours (AGENTS.md)" passes and pins it.

## Coverage gaps (behaviours with no test today; no bug found, but untested)

- Dark theme: nothing in `tests/` toggled `.dark` before this round (`grep -rn "dark" tests/` → 0). The new browser test pins that the wrapper variants and `reasoning` + `code-block` pass axe under `.dark`; extend to every preview fixture.
- Non-default `Button`/`Badge` variants under axe: `tests/browser/button.test.tsx` renders only `<Button>Save</Button>`; F1 hid behind that. Suggested: render all six variants in both themes.
- Hover/focus-visible states: axe samples rest state only; `hover:bg-destructive/20` (3.31:1) and `focus-visible:border-ring` (2.59:1) need a `userEvent.hover`/`tab` step plus a computed-style contrast assertion. The unit test covers the token math; a browser test should cover the rendered state.
- Pseudo-element text (`before:content-[counter(line)]`): axe cannot see it; assert `getComputedStyle(el, "::before").color` against the surface in `code-block.test.tsx`.
- `scripts/sync-tokens.ts` had no test at all; the two new robustness tests cover the two most likely edits (comment, nested at-rule). Add parity and count assertions to the script itself.
- `registry:base` round trip (`shadcn init @uifiles/base` on a scratch project): blocked here (upstream `index`/`utils`/fonts unreachable); worth a CI job with network.
- `@source` coverage for streamdown: verified by hand (`.list-disc`, `.my-4`, `.border-collapse`, `.bg-sidebar` present in `served.css`); no test asserts the built CSS contains a streamdown-only class.

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- `node scripts/sync-tokens.ts` on the clean tree is a no-op (`git diff --stat registry/base/registry.json` empty); unit test "registry/base cssVars equal app/globals.css" passes.
- Token parity: every `:root` token exists in `.dark` and vice versa (only `--radius` is light-only); every `--color-*` in `@theme inline` maps to a defined token; unit tests pass.
- Plan §5 arithmetic: light `muted-foreground 0.53` on `muted/secondary/accent 0.97` = 4.84:1, on white 5.28:1; Nova's 0.556 = 4.34:1 (fails). Dark `muted-foreground 0.708` on `muted 0.269` = 5.83:1; dark `primary 0.922` on `background` = 15.72:1, `primary-foreground` on `primary` = 14.22:1.
- `sync-tokens.ts:23-28` drops `--font-*` `var()` references on purpose; consumers get `--font-sans`/`--font-heading` from `registryDependencies: ["font-geist", "font-heading-geist"]`: both exist upstream (`apps/v4/registry/fonts.ts@98a1fe6:8-17` generates `font-<name>` with `--font-sans` and `font-heading-<name>` with `--font-heading`; `apps/v4/lib/font-definitions.ts:17-23` defines `geist`), and `update-fonts.ts:22-49` writes `cssVars.theme["--font-heading"] = "var(--font-heading)"` for Next and a fontsource import otherwise. `font-heading` is used by `card.tsx:40`, `dialog.tsx:123`, `empty.tsx:62` and resolves (`served.css:2703 .font-heading { font-family: var(--font-sans) }`; `--font-sans` on `<html>` comes from the unlayered `next/font` class, which beats `@layer theme`'s `:root { --font-sans: var(--font-sans) }`).
- `utils` still exists upstream as `registry:lib` with `dependencies: ["cn"]` (`apps/v4/registry/bases/base/lib/_registry.ts@98a1fe6:5-10`).
- `registry:base` schema: `cssVars` accepts only `theme|light|dark` (`schema.ts:126-130`, non-strict, extra keys are stripped not rejected); `css` is a recursive record allowing `"@apply …": {}` (`:133-141`); `config` is what `init` merges (`init.ts:757-760`, `presets.ts:261-262`).
- CSS updater: `"@layer base": { "*": { "@apply border-border outline-ring/50": {} } }` is the supported shape (`update-css.ts:441-447` → `processAtRule` → `processRule`), and an existing `@apply` in the same selector is merged with `twMerge`, not duplicated (`update-css.ts:561-574`).
- `shadcn init @uifiles/base` also installs upstream's style `index` because `installStyleIndex = item?.extends !== "none"` (`presets.ts:274`) and `@uifiles/base` has no `extends`; `@uifiles/base` `cssVars` then overwrite (`add-components.ts:448` treats `registry:base` as overwrite). The CLI itself never writes `@import "shadcn/tailwind.css"` (only `eject.ts` reads it), so it comes from `index`; see "Could not reach".
- Tailwind v4 wiring: `@import "tailwindcss"` first; `@custom-variant dark (&:is(.dark *))` compiles to `:is(.dark *)` and matches next-themes `attribute="class"` (`components/theme-provider.tsx:12`); `@source "../node_modules/…"` is relative to `app/globals.css` and follows the pnpm symlink (streamdown classes present in `served.css`); `postcss.config.mjs` is exactly what `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md:46-60` prescribes for Next 16 (PostCSS plugin, no Vite plugin); `.prettierrc` `tailwindStylesheet: "app/globals.css"`; Biome 2.5.14 schema has `css.parser.tailwindDirectives` and `biome check app/globals.css` passes.
- `shadcn/tailwind.css` provides `shimmer` (`node_modules/shadcn/dist/tailwind.css:571-620`, with a reduced-motion guard at `:623`), and `data-open`/`data-closed` variants that match both `[data-state=open]` and Base UI's `[data-open]` (`:25-38`); all `shimmer`, `data-open:` uses in `registry/ai` and `components/ui` compile (`served.css` has `.shimmer` ×6, `.data-open\:animate-in`).
- Base UI `Collapsible.Panel` detects CSS keyframe animations and defers `hidden` until they finish (`node_modules/@base-ui/react/collapsible/panel/useCollapsiblePanel.js:41-134`, `getAnimationType`, `'css-animation'`), so `data-closed:animate-out slide-out-to-top-2` on the five AI panels does run.
- No Radix `data-[state=open|closed]` selectors remain in `registry/**`; `components/ui/attachment.tsx` `data-[state=…]` is shadcn's own attribute (set at `:40`), not Radix.
- `components.json` and `registry/base` `config` agree: `base-nova`, `baseColor: neutral`, `menuColor: default`, `menuAccent: subtle`, `iconLibrary: lucide`.
- `disabled:opacity-50` stacking: `input-group.tsx:17` `has-disabled:opacity-50` × `button.tsx:6` `disabled:opacity-50` = 25% for a disabled submit inside a group; AGENTS.md already documents the rule (do not disable `PromptInputSubmit`), and the chat block follows it. Disabled controls are exempt from 1.4.3.
- Every wrapper that removes the outline has a replacement focus style on itself or its group: `button`/`input`/`textarea`/`select`/`badge` carry `focus-visible:border-ring focus-visible:ring-3`; `command.tsx:75` input is inside `InputGroup` (`has-[[data-slot=input-group-control]:focus-visible]:border-ring`), `command.tsx:155` items use `data-selected:bg-muted`, `attachment.tsx:173` trigger relies on the root's `focus-within:ring-1` (`:10`); `dialog`/`dropdown-menu`/`hover-card` popups and the five AI panels are containers, focus lands on children.

## Could not reach

- Upstream `styles/base-nova/index.json` (what `init` installs alongside `@uifiles/base`): `ui.shadcn.com` is blocked and the item is generated by `apps/v4/scripts` (no literal in the sparse clone, `grep -rn "shadcn/tailwind.css" apps/v4/scripts` → 0). So whether a fresh consumer ends up with `@import "shadcn/tailwind.css"` and `tw-animate-css` could not be confirmed here; the code path (`presets.ts:274`, `init.ts:660-661`) says `index` is installed.
- A real `shadcn init @uifiles/base` / `add @uifiles/button --dry-run` round trip (needs upstream for `index`, `utils`, `font-geist`).
- Hover/focus-state rendering under axe (computed, not rendered, in this round; see coverage gaps).
- `git grep` in the sparse clone hangs (blobless checkout); used raw.githubusercontent.com for `themes.ts`, `fonts.ts`, `font-definitions.ts`, `bases.ts`, `bases/base/lib/_registry.ts`, `config.ts`, `base-colors.ts` at `98a1fe6`.

## Commands run (for the fixer to reproduce)

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
S=/docs/qa/round1/tokens-css

# contrast tables (wcag.mjs = shared oklch/composite/luminance helpers)
node $S/contrast.mjs        # token pairs, light+dark;  `md` for the table
node $S/contrast2.mjs       # class combinations found in the code
#   sanity 0.556 on 0.97 (plan says 4.34): 4.339

# sync-tokens is a no-op on the clean tree
cd <repo> && node scripts/sync-tokens.ts && git diff --stat registry/base/registry.json
#   sync-tokens: 32 light, 31 dark, 7 theme vars   (no diff)

# sync-tokens regex attacks (script copy with the prettier call removed; cwd-relative paths as in the original)
#   == 1. /* } */ comment inside :root ==            sync-tokens: 0 light, 31 dark, 7 theme vars
#   == 2. nested @media inside .dark ==               sync-tokens: 32 light, 12 dark, 7 theme vars   (sidebar-ring missing)
#   == 3. second .dark block appended ==              dark.background captured: oklch(0.145 0 0) (cascade would give oklch(0.1 0 0))
#   == 4. :root inside @layer base before tokens ==   sync-tokens: 1 light, 31 dark, 7 theme vars
#   == 5. selector list ':root,\n.light {' ==         throws "No :root block"
#   == 6. multi-line value ==                         light.font-stack captured: undefined
#   == 7. trailing comment on --ring line ==          sync-tokens: 32 light, 30 dark; dark.ring captured: undefined

# served CSS
curl -s http://localhost:3000/ | grep -o 'href="[^"]*\.css[^"]*"'
curl -s 'http://localhost:3000/_next/static/chunks/%5Broot-of-the-server%5D__035ejkg._.css' -o $S/served.css
grep -n -A3 '^  \.font-heading {' $S/served.css     # 2703: font-family: var(--font-sans)
grep -c -E '\.list-disc\b|\.bg-sidebar\b|\.shimmer\b|delayed-open|\.text-red-800' $S/served.css

# Nova neutral diff
curl -s -f https://raw.githubusercontent.com/shadcn-ui/ui/98a1fe6/apps/v4/registry/themes.ts -o $S/themes.up
#   light: DIFF muted-foreground | nova: oklch(0.556 0 0) | ours: oklch(0.53 0 0); identical: 31 — dark: identical: 31

# reproducer tests
pnpm exec vitest run --project unit tests/unit/qa-round1-tokens-css.test.ts --reporter=verbose
pnpm exec vitest run --project browser tests/browser/qa-round1/tokens-css.test.tsx --reporter=verbose
pnpm exec prettier --check tests/unit/qa-round1-tokens-css.test.ts tests/browser/qa-round1/tokens-css.test.tsx   # clean
pnpm exec biome check tests/unit/qa-round1-tokens-css.test.ts tests/browser/qa-round1/tokens-css.test.tsx        # clean
```

Unit run (6 expected failures, 6 passes):

```
 ✓ token layer > defines every light token in dark (except --radius) and vice versa
 ✓ token layer > maps every @theme inline --color-* to a defined token
 ✓ token layer > registry/base cssVars equal app/globals.css (sync-tokens is a no-op)
 × scripts/sync-tokens.ts robustness > keeps a token whose line ends with a comment
   → expected undefined to be 'oklch(0.556 0 0)'
 × scripts/sync-tokens.ts robustness > does not drop tokens after a nested at-rule in .dark
   → expected undefined to be defined
 ✓ contrast > light muted-foreground meets AA on muted/secondary/accent (plan §5 claim)
 ✓ contrast > dark muted-foreground and primary meet AA on their surfaces
 × contrast > text-destructive meets AA on bg-destructive/10 in light (destructive button)
   → expected 3.9874705031933018 to be greater than or equal to 4.5
 × contrast > focus ring and input border meet 3:1 (WCAG 1.4.11)
   → expected 2.593265484156047 to be greater than or equal to 3
 ✓ class hygiene > uses no palette classes or literal colours (AGENTS.md)
 × class hygiene > never fades text with an alpha suffix
   → expected [ …(2) ] to deeply equal []        (registry/ai/code-block.tsx:88, chain-of-thought.tsx:128 comment)
 × class hygiene > queue docs describe the classes it ships
   → docs mention text-muted-foreground/50: expected '// Derived from Vercel AI Elements qu…' to contain 'text-muted-foreground/50'
 Tests  6 failed | 6 passed (12)
```

Browser run (3 expected failures, 3 passes):

```
 × light theme > wrapper variants pass axe colour contrast
   insufficient color contrast of 4 (foreground color: #e7000b, background color: #fde6e7, font size: 10.5pt (14px)) <button data-slot="button">
   insufficient color contrast of 4 (foreground color: #e7000b, background color: #fde6e7, font size: 9.0pt (12px))  <span data-slot="badge" data-variant="destructive">
   insufficient color contrast of 4.49 (foreground color: #ea1a23, background color: #ffffff, font size: 10.5pt (14px)) <div data-slot="alert-description">
 × light theme > attachment error description passes axe colour contrast
   insufficient color contrast of 4.11 (foreground color: #ec333c, background color: #ffffff, font size: 9.0pt (12px)) <span data-slot="attachment-description">
 ✓ dark theme > applies the dark tokens through the class variant
 ✓ dark theme > wrapper variants pass axe colour contrast
 × dark theme > attachment error description passes axe colour contrast
   insufficient color contrast of 4.36 (foreground color: #d15457, background color: #171717, font size: 9.0pt (12px)) <span data-slot="attachment-description">
 ✓ dark theme > reasoning and code-block pass axe under .dark
 Tests  3 failed | 3 passed (6)
```
