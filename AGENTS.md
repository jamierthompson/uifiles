<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# uifiles

A shadcn/ui registry on Base UI. This repo is the source of the `@uifiles` namespace: every
shadcn/ui primitive aliased under it, AI chat and agent components ported from Vercel AI
Elements, blocks, and a `registry:base` item carrying the tokens. The Next.js app is only the
docs site and the host for `/r/*.json`. Read `docs/plan.md` for the reasoning behind the shape.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 7 · Tailwind CSS v4 · shadcn 4 on **Base UI**
(`base-nova`) · `cn` package · Biome (lint only) · Prettier (format) · Vitest 5 (unit + browser
mode) · Playwright · pnpm · Node 24 (`.nvmrc`).

Use `pnpm` for everything (`pnpm add`, `pnpm dlx shadcn@latest ...`). Never `npm install` or
`npx`. Formatting is Prettier's job; never hand-format.

## Commands

| Command                       | What it does                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                    | Docs site on :3000. `/r/*.json` is served from `public/r`, so run `pnpm registry:build` first.                   |
| `pnpm registry:sync`          | Regenerates `registry/base` tokens from `app/globals.css` and the 63 alias items in `registry/ui` from upstream. |
| `pnpm registry:validate`      | `shadcn registry validate` over `registry.json` and every included file.                                         |
| `pnpm registry:build`         | sync tokens → validate → `shadcn build` into `public/r/` (gitignored).                                           |
| `pnpm test` / `pnpm test:e2e` | Vitest (unit + browser/axe) / Playwright against the dev server.                                                 |
| `pnpm gate`                   | format:check → lint → typecheck → registry:validate → test → build. Run before every PR.                         |

## Layout

| Path                                                | Contents                                                                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.json`                                     | Root catalog: `name`, `homepage`, `include` list. No items here.                                                                                                                                                                        |
| `registry/base/`                                    | `base` (`registry:base`): config, tokens, fonts, base CSS. `cssVars` are **generated** from `app/globals.css`; edit the CSS, not the JSON.                                                                                              |
| `registry/ui/`                                      | 63 `registry:ui` items. Zero-file entries are aliases (`registryDependencies: ["button"]`) that resolve upstream shadcn/ui against the consumer's style. **Generated**; a fork is an entry with `files`, preserved across regeneration. |
| `registry/ai/`                                      | Components ported from Vercel AI Elements (Apache-2.0; keep the header comment and `LICENSE-ai-elements`). Target `components/ai/<name>.tsx`.                                                                                           |
| `registry/components/`, `blocks/`, `hooks/`, `lib/` | Our own composites, full-page blocks, hooks, utilities.                                                                                                                                                                                 |
| `app/`                                              | Docs home (`page.tsx` reads the source registry via `lib/registry.ts`), `llms.txt` route.                                                                                                                                               |
| `public/r/`                                         | Build output. Never edit; never commit.                                                                                                                                                                                                 |
| `skills/uifiles/`                                   | The skill consumers install with `pnpm dlx skills add jamierthompson/uifiles`.                                                                                                                                                          |
| `docs/plan.md`                                      | Architecture, decisions, phases, overlap policy for AI Elements vs shadcn.                                                                                                                                                              |

## Rules for registry work

- **Base UI, not Radix.** Composition is `render={<a />}`, never `asChild`. HoverCard delay
  props and DropdownMenu `onSelect` are Radix-only; see the `migrate-radix-to-base` skill.
- **Bare names mean upstream shadcn.** In `registryDependencies`, `"button"` is shadcn's
  button. Once `@uifiles/button` is forked (has `files`), every item that needs _our_ button
  must say `"@uifiles/button"`. `tests/unit/registry.test.ts` enforces this.
- **Favor shadcn when both exist.** shadcn now ships `message`, `bubble`, `attachment`,
  `message-scroller`, `marker`, `questionnaire`, spinner, and the shimmer util. Do not port
  the AI Elements equivalents (`message`, `conversation`, `attachments`, `shimmer`, `loader`);
  port their unique parts as new items (`response`, `branch`). The full table is in `docs/plan.md` §5.
- **Sources import with `@/registry/...` or `@/components/ui/...`** and `cn` from `"cn"`; the
  CLI rewrites aliases on install. Never import from `@/lib/utils` in registry sources.
- **Pin npm `dependencies` on ported items** (`"streamdown@^2.6"`), because upstream leaves
  them unpinned and consumers get newer majors than upstream tests against.
- **Every item needs a `description` written for retrieval** (what it is, when to use it).
  The MCP server and `shadcn search` rank on it. Add `docs` for post-install notes.
- **Before writing or using a component**, run `pnpm dlx shadcn@latest docs <name>` or use the
  shadcn MCP tools. Do not recall APIs from memory. `pnpm dlx shadcn@latest view @uifiles/<name>`
  (with `pnpm dev` running) shows what a consumer would get.
- **Round-trip through the real CLI.** `components.json` maps `@uifiles` to
  `http://localhost:3000/r/{name}.json`; after `pnpm registry:build` and `pnpm dev`, test an
  item with `pnpm dlx shadcn@latest add @uifiles/<name> --dry-run` from a scratch project.
- **Each new component ships with** a registry entry, a browser test with axe
  (`tests/browser`), and a description. Blocks also get a Playwright screenshot.

## Tailwind CSS v4

- No `tailwind.config.js`. Configuration lives in `app/globals.css` via `@theme inline`.
- Color values are `oklch()`. Add a token under both `:root` and `.dark`, map it in
  `@theme inline` as `--color-name: var(--name)`, then `pnpm registry:sync` picks it up.
- Dark mode is class-based (`.dark` on `<html>`, set by next-themes).
- Use semantic tokens (`bg-primary`, `text-muted-foreground`), never palette classes.

## Skills and MCP in this repo

Installed via `skills-lock.json` into `.claude/skills/`: `shadcn`, `migrate-radix-to-base`,
`ai-elements` (for the port), `ai-sdk`. Restore with `pnpm dlx skills experimental_install`.
The shadcn MCP server is configured in `.mcp.json`. `.claude/rules/registry.md` loads when
files under `registry/` are touched.

## Git

`main` only for now. Conventional commit messages (`feat(ai): port prompt-input`). Run
`pnpm gate` before pushing. Do not commit `public/r/` or `.env*` (only `.env.example`).
