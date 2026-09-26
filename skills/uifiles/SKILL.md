---
name: uifiles
description: Build product UI with the uifiles design system, a shadcn/ui registry on Base UI with AI chat and agent components. Use when a project has @uifiles in components.json, when asked to use uifiles, or when composing chat, agent, dashboard, or form UI in a Base UI shadcn project.
user-invocable: false
allowed-tools: Bash(pnpm dlx shadcn@latest *), Bash(npx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# uifiles

uifiles is a shadcn registry. Components are copied into the project as source; there is no
package to import from. The namespace is `@uifiles`. This skill defers to the `shadcn` skill
for CLI mechanics and only adds what is specific to uifiles.

## Set up a project

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json   # config, tokens, fonts
```

This installs the `base` item: `base-nova` style (Base UI), neutral base color, lucide
icons, Geist type, and the uifiles tokens. Check with `pnpm dlx shadcn@latest info`.

## Find and add components

1. Search before building: `pnpm dlx shadcn@latest search @uifiles -q "<thing>"`.
2. Read the real API before using it: `pnpm dlx shadcn@latest view @uifiles/<name>` and
   `pnpm dlx shadcn@latest docs <name>` for upstream primitives.
3. Add: `pnpm dlx shadcn@latest add @uifiles/<name>`. Use `--dry-run` first in an existing
   project to see what will change.

`@uifiles/<primitive>` (button, dialog, …) resolves to upstream shadcn/ui unless uifiles has
forked it; either way the file lands in `components/ui/`. AI components land in `components/ai/`.

## Rules

- **Base UI.** Composition uses `render`, never `asChild`. Menus use `onClick`, not `onSelect`.
- **Semantic tokens only.** `bg-primary`, `text-muted-foreground`; never palette classes or
  literal colors. `className` is for layout, not restyling.
- **Chat UI** is built from shadcn's `message-scroller` + `message` + `bubble` + `attachment` +
  `marker`, with uifiles `prompt-input`, `response`, `reasoning`, `tool`, `sources` on top.
  Do not reach for the `ai-elements` registry for those; uifiles already resolved the overlap.
- **Forms** use `field` + `input-group` + `button-group`. **Confirmation** for tool approval,
  `questionnaire` for multi-step questions, `alert-dialog` for destructive actions.
- Check `references/` in this skill for per-component notes when they exist.
