# uifiles

A shadcn/ui registry on Base UI. Every shadcn/ui primitive under the `@uifiles` namespace,
AI chat and agent components ported from Vercel AI Elements, a `chat` block, and a
`registry:base` item carrying the design tokens. Components are files copied into your
project by the shadcn CLI, not a dependency you import.

## Use it

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json
pnpm dlx shadcn@latest add @uifiles/button @uifiles/prompt-input
```

Items can also be installed straight from GitHub, with no hosting involved, pinned to a tag
or branch:

```bash
pnpm dlx shadcn@latest add jamiethompsondesign/uifiles/response#v0.1.0
```

Until the shadcn registry directory lists `@uifiles`, the GitHub path works for items that
have no `@uifiles/*` dependency of their own (every AI component except `reasoning` and
`tool`; not the `chat` block), because the CLI resolves namespaced dependencies through the
directory or a `components.json` entry. The hosted path has no such limit.

For coding agents: `pnpm dlx skills add jamiethompsondesign/uifiles` installs the skill, the
registry index at `/r/registry.json` works with the shadcn MCP server as is, and `/llms.txt`
indexes everything.

Items that render markdown (`response`, `reasoning`, the `chat` block) need Streamdown's
`@source` line in your `globals.css`, which you add yourself; the CLI adds the Streamdown and
KaTeX stylesheet imports and a `.katex-display` overflow rule when it installs them. The
post-install notes are in the `docs` of
[`@uifiles/response`](https://uifiles.dev/r/response.json).

## Develop it

Node 24 (`.nvmrc`), pnpm 11.

```bash
pnpm install
pnpm registry:build   # tokens → validate → public/r
pnpm dev              # docs + registry on http://localhost:3000
pnpm gate             # the CI checks: format, lint, spelling, typecheck, registry validate, tests, build
pnpm test:e2e         # Playwright + axe over every preview page at desktop and phone width; locally it builds the registry and starts the dev server (or reuses one), in CI it runs against `pnpm start`
```

CI (`.github/workflows/ci.yml`) runs the same steps as `pnpm gate`, with `pnpm registry:build`
before the unit and browser tests under coverage (`pnpm test:coverage`), then checks that the
generated registry files are committed, runs `pnpm test:e2e` against the production build,
and `pnpm audit` last. Run `pnpm gate` and `pnpm test:e2e` before opening a PR.

Hosting it yourself: set `NEXT_PUBLIC_BASE_URL` to the site's origin before `pnpm build`. The
install commands on `/` and every link in `/llms.txt` are baked in at build time; on Vercel
the origin is derived from the project domain, and a production build that would still
advertise localhost fails there and warns everywhere else (`.env.example`).

`AGENTS.md` is the contributor guide (for people and agents), `CONTRIBUTING.md` the
workflow, and `docs/architecture.md` the decisions behind the shape. `docs/qa/` is the QA
log: the unedited briefs, reports and verdicts from the adversarial QA rounds that ran before
the first release.

## Layout

| Path                                  | What                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `registry/base`                       | The design system item: config, tokens (generated from `app/globals.css`), fonts |
| `registry/ui`                         | 63 shadcn/ui primitives; aliases until forked                                    |
| `registry/ai`                         | 18 AI Elements components ported to Base UI                                      |
| `registry/blocks`                     | The `chat` block                                                                 |
| `registry/components`, `hooks`, `lib` | Our own (empty today)                                                            |
| `app`                                 | Docs site: home, `/preview` index, `/preview/<item>` pages, `llms.txt`           |
| `tests`, `e2e`                        | Vitest unit and browser tests (axe), Playwright over every preview               |
| `skills/uifiles`                      | Agent skill                                                                      |

## Licenses

MIT (see `LICENSE`). Files under `components/ui/` are the shadcn/ui base-nova components,
MIT (c) shadcn. Files under `registry/ai/` are derived from Vercel AI Elements and stay
Apache-2.0 (c) Vercel, Inc.; the full license text is in
`licenses/APACHE-2.0-ai-elements.txt`. `NOTICE` lists every third-party component,
including the vendored agent skills.
