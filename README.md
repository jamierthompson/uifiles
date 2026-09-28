# uifiles

A shadcn/ui registry on Base UI. Every shadcn/ui primitive under the `@uifiles` namespace,
AI chat and agent components ported from Vercel AI Elements, a `chat` block, and a
`registry:base` item carrying the design tokens. Components are files copied into your
project by the shadcn CLI, not a dependency you import.

## Getting started

Three commands in a Next.js project, or any React project on Tailwind CSS v4:

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json   # config, tokens, fonts
pnpm dlx uifiles@latest init                                    # registers @uifiles in components.json
pnpm dlx shadcn@latest add @uifiles/button @uifiles/prompt-input
```

The first command creates `components.json` on Base UI (`base-nova`) and writes the tokens
and fonts into your `globals.css`. The second adds the `@uifiles` registry to
`components.json`; without it the shadcn CLI stops at `Unknown registry "@uifiles"`, because
it resolves a namespace through `components.json` or the shadcn registry directory, and the
directory does not list `uifiles` yet. The third copies items into your project;
`pnpm dlx shadcn@latest search @uifiles` lists them all.

`uifiles init` takes `--cwd <dir>` when `components.json` lives elsewhere, `--url <origin>`
for a self-hosted registry, and `--force` to replace an entry that points elsewhere. It is
the `uifiles` package on npm, built from `packages/uifiles` here, with no dependencies.

Items that render markdown (`response`, `reasoning`, the `chat` block) need Streamdown's
`@source` line in your `globals.css`, which you add yourself; the CLI adds the Streamdown and
KaTeX stylesheet imports and a `.katex-display` overflow rule when it installs them. The
post-install notes are in the `docs` of
[`@uifiles/response`](https://uifiles.dev/r/response.json).

For coding agents: `pnpm dlx skills add jamiethompsondesign/uifiles` installs the skill, the
registry index at `/r/registry.json` works with the shadcn MCP server as is, and `/llms.txt`
indexes everything.

## Develop it

Node 24 (`.nvmrc`), pnpm 11.

```bash
pnpm install
pnpm registry:build   # tokens → validate → public/r
pnpm dev              # docs + registry on http://localhost:3000
pnpm gate             # the CI checks: format, lint, spelling, typecheck, registry validate, tests, build
pnpm test:e2e         # Playwright + axe over every preview page at desktop and phone width; locally it builds the registry and starts the dev server (or reuses one), in CI it runs against `pnpm start`
```

The `uifiles` CLI is a workspace package: `pnpm cli:build` compiles `packages/uifiles/src`
into its gitignored `dist/`, and `pnpm --filter uifiles publish` builds and publishes it.

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
| `packages/uifiles`                    | The `uifiles` CLI on npm (`uifiles init`)                                        |

## Licenses

MIT (see `LICENSE`). Files under `components/ui/` are the shadcn/ui base-nova components,
MIT (c) shadcn. Files under `registry/ai/` are derived from Vercel AI Elements and stay
Apache-2.0 (c) Vercel, Inc.; the full license text is in
`licenses/APACHE-2.0-ai-elements.txt`. `NOTICE` lists every third-party component,
including the vendored agent skills.
