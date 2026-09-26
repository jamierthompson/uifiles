# Design system plan: a shadcn registry that agents can build with

Prepared 2026-09-26. Every version, command, and registry fact below was verified live today
(CLI runs, registry JSON fetches, docs, GitHub API). Items I could not verify are marked
**unverified**. Working name below is `uifiles`; candidates are in §9.

---

## 1. Verdict on the ask

The direction is right: one shadcn-compatible registry, installed with the shadcn CLI, holding
everything from shadcn/ui and AI Elements, with shadcn winning overlaps, plus agent tooling on
both sides. Three things in the ask should change, because the ground moved in 2026:

1. **Do not fork shadcn's 63 primitives up front. Catalog them; own only what diverges.**
   shadcn's own architecture now expresses "a design system" as a `registry:base` item
   (config + tokens + fonts + CSS) whose components resolve against upstream at install
   time. I verified that a registry item with `files: []` and
   `registryDependencies: ["button"]` installs upstream `button` under your namespace,
   resolved against the consumer's style. So `@uifiles/button` … `@uifiles/tooltip` can exist
   for all 63 on day one at zero maintenance, and any one becomes a real fork the moment you
   add a file to it. Forking all 63 now would mean tracking a codebase that shipped, in 2026
   alone: a new `cn` package, React Aria as a third base, six chat components, `data-icon`
   slots, a Base UI toast, RTL rewrites, and eight visual styles. That is a diff job, not a
   design job, and agents and v0 already know the stock APIs.

2. **AI Elements must be vendored and ported, and that is the real work.** It is Radix-only
   (33 `asChild` uses across 16 components, Radix-only HoverCard delay props, Radix-only
   `onSelect`, six direct `@radix-ui/react-use-controllable-state` imports). Your repos are
   Base UI (`base-nova`), which is also shadcn's default since July 2026. The Base UI PR
   upstream (#450) has been open since July with no maintainer response; last npm release
   was March 2026, last commit August. Vendoring is justified on staleness alone, and the
   Apache-2.0 license permits it with attribution. shadcn ships a `migrate-radix-to-base`
   skill for exactly this port, and you already have it installed.

3. **"Favor shadcn" now bites harder than you expected.** shadcn added its own chat layer in
   June–August: `message`, `bubble`, `attachment`, `message-scroller`, `marker`,
   `questionnaire`, Typeset (streaming-safe markdown typography), and `@shadcn/helpers` for
   the AI SDK. Applying your rule, AI Elements' `message`, `conversation`, `attachments`,
   `shimmer`, and the already-deprecated `loader` are superseded. What survives from AI
   Elements is the part shadcn has no answer for: `prompt-input`, `reasoning`, `tool`,
   `sources`, `code-block`, `task`, `plan`, the code/agent surfaces, voice, and workflow.
   The resolution table is in §5.

Alternatives considered and rejected:

- **Full vendoring of both libraries** (the literal ask): highest control, highest drift;
  no benefit over the alias model until a primitive actually diverges.
- **Thin registry only, consuming `@ai-elements/*` upstream**: does not solve Base UI and
  inherits an unmaintained Radix codebase.
- **npm package `@jamiethompson/ui`**: the registry model puts source in the consumer repo,
  which is what the shadcn skill, MCP `view`, and v0 assume. Keep npm for logic
  (`@jamiethompson/oklch`), registry for UI.

---

## 2. Decisions

| Decision       | Choice                                                                                                                                                      | Why                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base library   | **Base UI** (`base-nova` lineage), one build, no per-base variants                                                                                          | Matches your repos and shadcn's default. `render` prop, not `asChild`. Serve `{style}` variants only if you ever publish for Radix/Aria consumers. |
| Style baseline | Nova (`--preset nova --base base`)                                                                                                                          | Your current preset. Note the CLI rejects `--preset base-nova`; the pair is `nova` + `-b base`.                                                    |
| Class merging  | `cn` package (`import { cn } from "cn"`)                                                                                                                    | shadcn's standard since Sept 2026; consumer `lib/utils.ts` is a re-export. Ported AI Elements files switch from `@/lib/utils` to `cn`.             |
| Icons          | lucide                                                                                                                                                      | shadcn default; 32 of 48 AI Elements files use it.                                                                                                 |
| Distribution   | Hosted registry (Next app on Vercel, `/r/{name}.json` + `/r/registry.json`) **and** the GitHub-registry path (`jamierthompson/uifiles/<item>#ref`) for free | Hosted is required for MCP, Open in v0, and the shadcn directory. GitHub path gives pinning by tag or SHA with zero infrastructure.                |
| Repo shape     | Single Next 16 app: docs site, previews, registry host, `registry/` sources                                                                                 | Every registry in the directory does this. Go pnpm-workspace + Turborepo only when a second package (e.g. tokens from oklch) moves in.             |
| Versioning     | Git tags + CHANGELOG; registries are unversioned by design                                                                                                  | Consumers pin with `#v1.2.0` on the GitHub path or use `add --diff` on the hosted one. No Changesets until there is an npm package.                |
| Licensing      | MIT for the repo; `LICENSE-ai-elements` (Apache-2.0) + `NOTICE`; header comment on every ported file                                                        | Apache-2.0 requires marking modified files.                                                                                                        |

---

## 3. Architecture

### 3.1 Repository layout

```
uifiles/
├── AGENTS.md                      # the truth for agents; CLAUDE.md is `@AGENTS.md`
├── CLAUDE.md
├── README.md · LICENSE · LICENSE-ai-elements · NOTICE
├── .nvmrc (24) · package.json (pnpm 11) · tsconfig.json (TS 7)
├── biome.json (lint only) · .prettierrc (+ prettier-plugin-tailwindcss)
├── components.json                # style base-nova; registries: { "@uifiles": ".../r/{name}.json" }
├── registry.json                  # name, homepage, include: [...]
├── registry/
│   ├── base/registry.json         # registry:base `base`, registry:theme `theme-*`, registry:font `font-*`
│   ├── ui/registry.json           # 63 alias items (files: []); becomes a fork when a file is added
│   ├── ai/registry.json           # ported AI Elements, registry:component, target components/ai/uifiles.tsx
│   ├── components/registry.json   # your own composites
│   ├── hooks/ · lib/              # registry:hook, registry:lib
│   ├── blocks/registry.json       # full compositions (chat, agent console), Open-in-v0 targets
│   └── agents/registry.json       # registry:item shipping ~/AGENTS.md fragment and .claude/rules
├── app/                           # docs + previews (one route per item, light+dark), /llms.txt route
├── public/r/                      # `shadcn build` output; built in CI/Vercel, not committed
├── skills/uifiles/SKILL.md         # installable: npx skills add jamierthompson/uifiles
│   └── references/*.md            # per-component API notes (generated from source)
├── scripts/
│   ├── sync-upstream.ts           # diffs registry/ui forks vs ui.shadcn.com base-nova, registry/ai vs elements.ai-sdk.dev
│   └── build-references.ts        # regenerates skills/uifiles/references from registry sources
├── tests/                         # Vitest 5 browser mode + vitest-browser-react + axe-core
├── e2e/                           # Playwright screenshots of preview routes
├── .claude/ rules/registry.md (paths: registry/**) · launch.json · skills/ (installed)
├── .mcp.json                      # shadcn MCP against this repo's components.json
├── skills-lock.json
└── .github/workflows/ ci.yml · upstream-diff.yml (weekly)
```

### 3.2 Registry model

- **`@uifiles/base`** (`registry:base`). Verified today: `shadcn init <base.json>` rewrote
  `components.json` (`baseColor`, `menuAccent`), added `cssVars` to `:root`/`.dark` and
  `@theme inline`, and installed `font-geist`. This is the consumer's one-command setup.
  Carries: `config` (style, iconLibrary, tailwind.baseColor, menu settings), `cssVars`
  (from your oklch studio export), `css` (your `type-*` utilities, layers, keyframes),
  `registryDependencies: ["utils", "font-<x>", "font-heading-<x>"]`.
- **`@uifiles/theme-*`** (`registry:theme`): alternative palettes; `shadcn apply --only theme`.
- **`@uifiles/<ui>`** × 63 (`registry:ui`, `files: []`, `registryDependencies: ["<ui>"]`).
  One namespace for agents; fork on divergence by adding `files` and keeping the name.
  Forked items must be referenced as `@uifiles/<ui>` from your other items, since bare names
  always mean upstream shadcn.
- **`@uifiles/<ai>`** (`registry:component`): ported AI Elements. Intra-registry deps become
  `@uifiles/code-block`, `@uifiles/tool` (upstream uses absolute URLs to Vercel's host; rewrite
  them). Pin npm deps with versions (`streamdown@^2.6`, `shiki@^4.4`) because upstream leaves
  them unpinned and consumers currently get newer majors than upstream tests against.
- **Blocks**: `registry:block` compositions (a full chat, an agent run console, a settings
  page) with `docs` text and Open-in-v0 links. These are what v0 and agents copy.
- **`@uifiles/agent-rules`** (`registry:item`): drops an `AGENTS.md` fragment and a
  `.claude/rules/uifiles.md` into the consumer project (`target: "~/…"`), so a consumer that
  adds your system also gets your usage rules. shadcn's docs name this as a supported use.

### 3.3 Consumer flow

```bash
pnpm dlx shadcn@latest init @uifiles/base                 # or: init https://<host>/r/base.json
pnpm dlx shadcn@latest add @uifiles/prompt-input @uifiles/message-scroller
pnpm dlx shadcn@latest add jamierthompson/uifiles/prompt-input#v1.0.0   # no hosting needed
pnpm dlx skills add jamierthompson/uifiles                 # the skill
```

Once the registry is in shadcn's directory (`apps/v4/registry/directory.json` PR), the
`@uifiles` namespace resolves with no `components.json` entry, and `shadcn search`, the MCP
server, and `shadcn view` all see it.

---

## 4. Agent surface

### 4.1 For agents working inside the repo

- `AGENTS.md` (single source; `CLAUDE.md` is `@AGENTS.md`): stack, commands, the gate
  (`format:check → lint → typecheck → registry validate → build → test → e2e`), how to add an
  item (which `registry.json`, target conventions, `render` not `asChild`, `cn` import),
  what is generated (`public/r`, `skills/uifiles/references`), what is never hand-edited.
- `.claude/rules/registry.md` with `paths: ["registry/**"]` for file-scoped rules.
- Installed skills: `shadcn`, `migrate-radix-to-base` (shadcn-ui/ui), `ai-elements`
  (vercel/ai-elements, for the port), `ai-sdk` (vercel/ai), plus your own
  `skills/uifiles` so the repo eats its own dog food.
- `.mcp.json`: shadcn MCP pointed at this repo, so agents can `view` upstream items while
  porting and `get_audit_checklist` before opening a PR.
- `.claude/launch.json` for the docs server; preview routes at `/preview/<item>` so agents
  can screenshot their own work.
- `scripts/sync-upstream.ts` output is what a weekly workflow turns into a PR listing
  changed upstream files; agents pick those up as scoped tasks.
- The repo's own `components.json` has `"@uifiles": "http://localhost:3000/r/{name}.json"`
  so an agent can round-trip an item through the real CLI locally.

### 4.2 For agents building with the system

| Artifact                                                         | What it gives an agent                                                                                                                                | Cost                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/r/registry.json` index + real `description`s + `docs` per item | shadcn MCP `list/search/view/add` works with zero extra code                                                                                          | Descriptions are the whole integration; write them for retrieval.                            |
| `skills/uifiles/SKILL.md`                                        | Workflow, not a docs copy: search first, `docs`/`view` before use, composition recipes, your rules (type styles, tokens, no raw colors)               | Model on `shadcn-ui/ui/skills/shadcn`; `user-invocable: false`, `allowed-tools` for the CLI. |
| `references/*.md` generated from source                          | Prop-level truth per component without a Storybook manifest                                                                                           | One script.                                                                                  |
| `/llms.txt` route                                                | Index of every doc page + registry URL, per the llmstxt.org shape                                                                                     | Trivial.                                                                                     |
| `@uifiles/agent-rules` item                                      | Consumer repos get your AGENTS.md fragment on install                                                                                                 | One `registry:item`.                                                                         |
| Preset code/URL from `ui.shadcn.com/create`                      | `init --preset <code>` reproduces your tokens without your registry                                                                                   | Free; publish in README.                                                                     |
| Open in v0 on blocks                                             | Only for public items without `cssVars`/`css`/auth; v0 "Design Systems 2.0" now reads the GitHub repo directly, so the registry is not the v0 surface | Buttons on blocks only.                                                                      |
| shadcn directory listing                                         | `@uifiles` resolves everywhere; health score monitored hourly                                                                                         | One PR.                                                                                      |

Skip: Figma Code Connect (plan-gated), a bespoke MCP (stock shadcn MCP covers it), Storybook
now (add later only if agents need its `docs` manifest; `@storybook/addon-mcp` exists).

---

## 5. Component inventory and overlap policy

### 5.1 shadcn/ui: 63 `registry:ui` items, all aliased on day one

accordion · alert · alert-dialog · aspect-ratio · attachment · avatar · badge · breadcrumb ·
bubble · button · button-group · calendar · card · carousel · chart · checkbox · collapsible ·
combobox · command · context-menu · dialog · direction · drawer · dropdown-menu · empty · field
· form · hover-card · input · input-group · input-otp · item · kbd · label · marker · menubar ·
message · message-scroller · native-select · navigation-menu · pagination · popover · progress
· questionnaire · radio-group · resizable · scroll-area · select · separator · sheet · sidebar
· skeleton · slider · sonner · spinner · switch · table · tabs · textarea · toast · toggle ·
toggle-group · tooltip

Plus: `utils` (lib), `use-mobile` (hook), 52 `font-*` items, blocks, Typeset (`typeset.css`
builder), utils `shimmer` and `scroll-fade`. Docs-only: data-table, date-picker, typography.

### 5.2 AI Elements: 48 components, resolved against shadcn

| AI Elements                                                                                                                                                                                   | shadcn equivalent               | Resolution                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                                                                                                                                                                                     | `message` + `bubble`            | **Drop.** Keep shadcn's. Port the unique parts as new items: `response` (Streamdown markdown, from `MessageResponse`) and `branch` (from `MessageBranch*`). `MessageActions` becomes `button-group`. |
| `conversation`                                                                                                                                                                                | `message-scroller`              | **Drop.** shadcn's handles follow-while-following and turn anchoring; `ConversationEmptyState` is `empty`.                                                                                           |
| `attachments`                                                                                                                                                                                 | `attachment`                    | **Drop**, keep shadcn's; add a small `attachment-parts` adapter if you need AI SDK `FileUIPart` mapping.                                                                                             |
| `shimmer`                                                                                                                                                                                     | shimmer util                    | **Drop**; no `motion` dep.                                                                                                                                                                           |
| `loader`                                                                                                                                                                                      | `spinner`                       | Already deprecated upstream.                                                                                                                                                                         |
| `confirmation`                                                                                                                                                                                | `questionnaire`, `alert-dialog` | **Keep**; it is tool-approval-specific. Revisit against `@shadcn/helpers` human-in-the-loop.                                                                                                         |
| `suggestion`, `snippet`, `inline-citation`, `sources`, `context`, `open-in-chat`                                                                                                              | built on shadcn primitives      | Keep; port.                                                                                                                                                                                          |
| `prompt-input` (36 exports), `reasoning`, `tool`, `task`, `plan`, `chain-of-thought`, `queue`, `checkpoint`, `model-selector`, `code-block`, `image`                                          | none                            | **Tier 1: port first.**                                                                                                                                                                              |
| `agent`, `artifact`, `commit`, `environment-variables`, `file-tree`, `jsx-preview`, `package-info`, `sandbox`, `schema-display`, `stack-trace`, `terminal`, `test-results`, `web-preview`     | none                            | **Tier 2** (code/agent surfaces).                                                                                                                                                                    |
| `canvas`, `node`, `edge`, `connection`, `controls`, `panel`, `toolbar` (`@xyflow/react`); `audio-player`, `mic-selector`, `speech-input`, `transcription`, `voice-selector`, `persona` (Rive) | none                            | **Tier 3.** Decide whether to include; heavy deps, no Radix coupling except the controllable-state hook. Could ship first as aliases to `@ai-elements/*`.                                            |

Porting checklist per file (from the bundle scan): `asChild` → `render`; HoverCard
`openDelay`/`closeDelay` → Base UI `delay`/`closeDelay` on `PreviewCard`; DropdownMenu
`onSelect` → `onClick`; `@radix-ui/react-use-controllable-state` → React `useState` +
controlled prop pattern (or Base UI's `useControlled`); `@/lib/utils` → `cn`;
`@/components/ui/*` stays (CLI rewrites); relative `./code-block` → `@uifiles/code-block`
registry dependency. Type-check against `ai@7` (types line up; runtime behaviour on v7 is
**unverified** upstream).

**Token departure (2026-09-26).** Light-mode `--muted-foreground` is `oklch(0.53 0 0)`; shadcn
Nova ships `0.556`, which fails AA (4.34:1) for muted text on `bg-muted`, `bg-secondary` and
`bg-accent`. Completed queue rows drop upstream's `/50` alpha for the same reason, and code highlighting uses shiki's `github-*-high-contrast` themes because GitHub's default light theme renders some tokens at 3.48:1.

### 5.3 Your own components

Start with what your two existing projects already needed and shadcn lacks: the `type-*`
text-style utilities as `css` on the base item, an `icon-button`, page and section shells,
and the oklch studio's theme export as `registry:theme` items.

---

## 6. Tooling

| Concern            | Choice                                                                                                                                                                                            | Version today                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Framework / host   | Next 16 App Router, Vercel                                                                                                                                                                        | next 16.3.6                         |
| Primitives         | Base UI via shadcn `base-nova`                                                                                                                                                                    | @base-ui/react 1.8.0, shadcn 4.21.0 |
| Styling            | Tailwind v4, `cn`, `tw-animate-css`, `shadcn/tailwind.css`                                                                                                                                        | tailwindcss 4.3.3, cn 0.4.0         |
| Language / runtime | TypeScript 7, Node 24 (`.nvmrc`), pnpm 11                                                                                                                                                         | typescript 7.0.2                    |
| Lint / format      | Biome (lint only, next+react domains) + Prettier + tailwind plugin                                                                                                                                | biome 2.5.14                        |
| Component tests    | Vitest 5 browser mode + `vitest-browser-react` + `axe-core` per component                                                                                                                         | vitest 5.x                          |
| Visual             | Playwright `toHaveScreenshot` on `/preview/*` (light+dark); Argos later if you want a hosted diff UI. Lost Pixel is archived; Chromatic needs Storybook.                                          | playwright 1.63                     |
| Registry CI        | `shadcn registry validate` → `shadcn build` → assert `public/r/registry.json` parses and every item `add --dry-run`s into a scratch consumer                                                      |                                     |
| Upstream drift     | weekly workflow: `sync-upstream.ts` diffs `registry/ui` forks vs `ui.shadcn.com/r/styles/base-nova/uifiles.json` and `registry/ai` vs `elements.ai-sdk.dev/api/registry/uifiles.json`; opens a PR |                                     |
| Not now            | Storybook, Turborepo, Changesets, a custom MCP                                                                                                                                                    |                                     |

---

## 7. Phases

**Phase 0, repo bootstrap (half a day).** `shadcn create -t next -n uifiles -b base --preset nova`,
then per your global rules: Prettier + Biome, Vitest + Playwright, `.env.example`, README,
`.gitignore`. Add `AGENTS.md`/`CLAUDE.md`, `.mcp.json`, `skills-lock.json` with the four
skills, `.claude/rules/registry.md`, `.claude/launch.json`. Push to
`github.com/jamierthompson/uifiles`; connect Vercel.

**Phase 1, the system without components (one day).** `registry.json` with `include`;
`@uifiles/base` with your tokens (export from oklch studio), fonts, `type-*` utilities; one
`theme-*`; the 63 alias items generated by a script from `/r/index.json`; `shadcn build`;
docs home page; `/llms.txt`. Verify from a scratch consumer: `init @uifiles/base`,
`add @uifiles/button`. Tag `v0.1.0`.

**Phase 2, AI Elements Tier 1 (the bulk of the work). Done 2026-09-26: 18 items ported, `chat` block built, CLI round-trip verified.** Port `prompt-input`, `response`,
`branch`, `reasoning`, `tool`, `task`, `plan`, `code-block`, `sources`, `suggestion`,
`context`, `model-selector`, `chain-of-thought`, `queue`, `checkpoint`, `inline-citation`,
`confirmation`, `image`. Each port = file + Apache header + registry entry + preview route +
browser test with axe + screenshot. Build one `chat` block on `message-scroller` + `message` +
`bubble` + `prompt-input` + `@shadcn/helpers` scripted conversation for the preview.

**Phase 3, agent surface.** `skills/uifiles/SKILL.md` + generated references; submit to the
shadcn directory; preset code in README; `@uifiles/agent-rules` item; weekly upstream-diff
workflow. Tag `v1.0.0`.

**Phase 4, Tier 2 and 3, forks on demand.** Code/agent surfaces, then workflow and voice if
you want them. Fork a shadcn primitive only when a real divergence shows up (first candidates:
`button` for your size scale, `card` if `type-*` changes the anatomy).

---

## 8. Risks and open questions

- **`ai` v7.** AI Elements is authored against v6; types resolve on v7 (all 11 imported symbols
  exist) but runtime on v7 is unverified. Your port is the first thing that tests it.
- **Upstream AI Elements Base UI PR (#450).** If it merges, Tier 3 can stay aliased to
  `@ai-elements/*`; Tiers 1–2 stay yours regardless, because you will have diverged.
- **Alias items and forks.** Bare `registryDependencies` always mean upstream shadcn. Once you
  fork `button`, every item of yours that needs _your_ button must say `@uifiles/button`.
  Enforce it with a test over `registry/**/registry.json`.
- **Open in v0** ignores `cssVars`/`css`; blocks that depend on your tokens will render with
  defaults there. Not worth designing around.
- **`--defaults` help text** says `--preset=base-nova`; the CLI rejects that string. Use
  `--preset nova -b base`.
- **npm scope.** `@jamiethompson/oklch` is not on npm (404); the scope is unclaimed until the
  first publish. Not needed for this project, but note the memory said otherwise.

---

## 9. Name

Checked today: unscoped npm, `github.com/jamierthompson/uifiles`, and product collisions.
Registry namespace is `@uifiles/…`, so the unscoped npm name is vanity; GitHub and product
uniqueness matter. `loom` and `dolly` excluded (your projects).

| Name                  | npm unscoped | GitHub free | Collisions                      | Read                                                                                                            |
| --------------------- | ------------ | ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Quoin**             | free         | yes         | Quoin Inc, a small consultancy  | Cornerstone; the load-bearing block at the corner. Pronounced "coin", which is either the charm or the problem. |
| **Cornice**           | free         | yes         | none found                      | The finishing layer at the top of a wall; reads as "the last, visible layer".                                   |
| **Umber**             | free         | yes         | umber.tech, a fintech agency    | A colour; pairs with the OKLCH work. Softer, less structural.                                                   |
| **Batten**            | free         | yes         | none in software                | Structural strip; "batten down". Plain.                                                                         |
| Corbel                | free         | yes         | Microsoft typeface              | Typeface collision is awkward for a design system.                                                              |
| Mortise, Skein, Brume | taken        | yes         | none found                      | Fine under the scope; lose the unscoped name.                                                                   |
| Cairn, Plinth         | taken        | yes         | several existing design systems | Crowded.                                                                                                        |

Recommendation: **Quoin**, with **Cornice** if you want the word to be unambiguous when spoken.

---

## Appendix: verified facts used above

- shadcn 4.21.0 (2026-09-04): commands `init|create, apply, add, docs, view, search|list,
migrate, eject, info, build, mcp, preset {decode,resolve,url,open}, registry {add,validate}`;
  `init -b base|radix|aria`, `--preset <nova|vega|maia|lyra|mira|luma|sera|rhea|code|url>`,
  `--template`, `--monorepo`. `registry:base` with `config`, `registry:style` with `extends`,
  `registry:font`, `registry:theme`, `registry:item` with `~/` targets. `include` in
  `registry.json`; `shadcn build` writes `public/r/uifiles.json` + `registry.json`.
  GitHub registries `owner/repo/item#ref` (public and private). Directory of 382
  registries with health scores. MCP with 7 tools; `mcp init --client claude` writes
  `.mcp.json`. Skills `shadcn`, `migrate-radix-to-base` (`npx skills add shadcn-ui/ui`).
- shadcn styles: 8 presets × 3 bases; `base-nova` catalog = 63 ui, 30 blocks, 52 fonts,
  `utils`, `use-mobile`. Chat items June–Aug 2026; `@shadcn/react` 0.3.1 (headless
  questionnaire, message-scroller); `@shadcn/helpers` 0.2.0; Typeset; `cn` 0.4.0.
- AI Elements: 48 components + 88 examples at `elements.ai-sdk.dev/api/registry/`;
  `ai-elements@1.9.0` (2026-03-12) is a 50-line wrapper over `shadcn add`; Apache-2.0;
  skill at `skills/ai-elements` (`npx skills add vercel/ai-elements`); `llms.txt` present;
  MCP only on a stale legacy host. Base UI issues #383, #451, #473, #489, #498 open; PR #450
  open since 2026-07-17. 24 shadcn ui items as `registryDependencies`; 18 npm deps, unpinned.
- Experiments run today in the scratchpad: alias item (`files: []`) resolved upstream
  `button` against `base-nova` in a consumer via `add --dry-run`; `init <base.json>` applied
  `config`, `cssVars` and `font-geist` to a consumer project (`--no-reinstall` needed for
  non-interactive re-init).
- Your repos: `base-nova`, pnpm 11.18, Node 24 (`.nvmrc`), TS 7, Biome + Prettier,
  `AGENTS.md` as truth with `CLAUDE.md` importing it, shadcn MCP in `.mcp.json`, skills via
  `skills-lock.json`, `.claude/launch.json`. GitHub user `jamierthompson`; also
  `agent-conventions` (global conventions repo, MIT) which this repo's docs should stay
  downstream of.
