# uifiles

A shadcn/ui registry on Base UI. Every shadcn/ui primitive under the `@uifiles` namespace,
AI chat and agent components ported from Vercel AI Elements, blocks, and a `registry:base`
item carrying the design tokens. Components are files copied into your project by the shadcn
CLI, not a dependency you import.

## Use it

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json
pnpm dlx shadcn@latest add @uifiles/button @uifiles/prompt-input
```

Or straight from GitHub, pinned to a tag, with no hosting involved:

```bash
pnpm dlx shadcn@latest add jamierthompson/uifiles/prompt-input#v1.0.0
```

For coding agents: `pnpm dlx skills add jamierthompson/uifiles` installs the skill, the
registry index at `/r/registry.json` works with the shadcn MCP server as is, and `/llms.txt`
indexes everything.

## Develop it

Node 24 (`.nvmrc`), pnpm 11.

```bash
pnpm install
pnpm registry:build   # tokens → validate → public/r
pnpm dev              # docs + registry on http://localhost:3000
pnpm gate             # everything CI runs
```

`AGENTS.md` is the contributor guide (for people and agents). `docs/plan.md` explains the
architecture and the decisions behind it.

## Layout

| Path                                            | What                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `registry/base`                                 | The design system item: config, tokens (generated from `app/globals.css`), fonts |
| `registry/ui`                                   | 63 shadcn/ui primitives; aliases until forked                                    |
| `registry/ai`                                   | AI Elements ports (Base UI)                                                      |
| `registry/components`, `blocks`, `hooks`, `lib` | Our own                                                                          |
| `app`                                           | Docs site and `llms.txt`                                                         |
| `skills/uifiles`                                | Agent skill                                                                      |

## Licenses

MIT. Forked shadcn/ui components stay MIT (c) shadcn. Components derived from Vercel AI
Elements are Apache-2.0 (c) Vercel, Inc.; see `LICENSE-ai-elements` and `NOTICE`.
