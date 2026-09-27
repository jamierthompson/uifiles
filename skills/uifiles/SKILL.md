---
name: uifiles
description: Build product UI with the uifiles design system, a shadcn/ui registry on Base UI with AI chat and agent components. Use when a project has @uifiles in components.json, when asked to use uifiles, or when composing chat, agent, dashboard, or form UI in a Base UI shadcn project.
user-invocable: false
allowed-tools: Bash(pnpm dlx shadcn@latest *), Bash(npx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# uifiles

uifiles is a shadcn registry. Components are copied into the project as source; there is no
package to import from. The namespace is `@uifiles`. This skill defers to the `shadcn` skill
for CLI mechanics and only adds what is specific to uifiles. Examples use `pnpm dlx`;
substitute `npx` or `bunx --bun` to match the project's package manager.

## Set up a project

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json   # config, tokens, fonts
```

This installs the `base` item: `base-nova` style (Base UI), neutral base color, lucide
icons, Geist type, and the uifiles tokens. Check the result with `pnpm dlx shadcn@latest info`.

## Find and add components

1. Search before building: `pnpm dlx shadcn@latest search @uifiles -q "<thing>"`.
2. Read the real API before using it: `pnpm dlx shadcn@latest view @uifiles/<name>` for a
   uifiles item and `pnpm dlx shadcn@latest docs <name>` for an upstream primitive.
3. Add: `pnpm dlx shadcn@latest add @uifiles/<name>`. Use `--dry-run` first in an existing
   project to see what will change.

`@uifiles/<primitive>` (button, dialog, …) resolves to upstream shadcn/ui unless uifiles has
forked it; either way the file lands in `components/ui/`. AI components land in
`components/ai/`; the `chat` block lands in `components/blocks/`, `lib/` and `app/chat/`.

What uifiles adds beyond shadcn/ui: `prompt-input`, `response`, `reasoning`, `tool`,
`sources`, `code-block`, `task`, `plan`, `chain-of-thought`, `queue`, `checkpoint`,
`context`, `model-selector`, `suggestion`, `inline-citation`, `confirmation`, `image`,
`branch`, and the `chat` block. Read each item's `docs` in `view` output: it lists the API
differences from Vercel AI Elements and post-install steps. Items that render markdown
(`response`, `reasoning`, `chat`) install `@import "streamdown/styles.css"`,
`@import "katex/dist/katex.min.css"` and a `.katex-display` scroll rule into the project's
CSS through the `response` item's `css` field; the project still adds
`@source "../node_modules/streamdown/dist/*.js"` by hand, because that path is relative to
its own CSS file (without it Tailwind emits none of Streamdown's classes).

## Rules

- **Base UI.** Composition uses `render`, never `asChild`. Menus use `onClick`, not `onSelect`.
  Open state is `data-open`/`data-closed`, not `data-[state=…]`.
- **Semantic tokens only.** `bg-primary`, `text-muted-foreground`; never palette classes or
  literal colors, and no alpha-faded text for content that carries information. `className`
  is for layout, not restyling.
- **Chat UI** is built from shadcn's `message-scroller` + `message` + `bubble` + `attachment` +
  `marker`, with uifiles `prompt-input`, `response`, `reasoning`, `tool`, `sources` on top, or
  start from the `chat` block, which wires all of them to AI SDK `useChat`. Do not reach for
  the `ai-elements` registry for those; uifiles already resolved the overlap.
- **Forms** use `field` + `input-group` + `button-group`. `input-group` fades the whole group
  when any descendant is disabled, so do not disable a submit button to gate empty input.
  **Confirmation** for tool approval, `questionnaire` for multi-step questions, `alert-dialog`
  for destructive actions.
