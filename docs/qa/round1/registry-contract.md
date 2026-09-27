# registry-contract — QA round 1

## Summary

Attacked everything that decides whether `@uifiles` installs through the shadcn CLI (4.21), passes
the directory's four requirements, and scores well on Registry Health: the seven source
`registry.json` files, the three scripts, `lib/registry.ts`, the tests, the built `public/r/`, and
the CLI source in the sparse clone. I ran the real installed CLI end to end (`add --dry-run`,
`--view`, GitHub path) against `localhost:3000` with a local mock of `ui.shadcn.com/r` built from
this repo's own `components/ui/*.tsx`, so the block, the aliases, `base` and the import rewrite
were exercised for real, not reasoned about.

Verdict: **no blockers.** The owner's worry about `files[].content` is a misreading (details in
F0 / Verified OK). The index, all 83 items, the directory entry, unique names, name match, HTTPS
and JSON content-type all pass the exact zod schemas the CLI and the health monitor use. Findings:
0 blocker, 0 high, 4 medium, 4 low, 2 nit. The worst thing is that 19 items import `cn` from the
`cn` package and none declares it, so a consumer whose `lib/utils.ts` predates the `cn` package
(the CLI ships a `migrate cn` command for exactly that population) gets `Module not found: 'cn'`
after `add @uifiles/response`. Second worst: the README's headline GitHub-path install
(`jamierthompson/uifiles/prompt-input#v1.0.0`) fails today (no such tag), and the GitHub path
cannot install `tool` or `chat` at all until the directory PR merges.

Note for the lead: while I was running, the working tree briefly showed `registry/ai/context.tsx`
modified and the branch gained a commit (`2f7e6e6`); neither was me. My only writes under the repo
are `tests/unit/qa-round1-registry-contract.test.ts`.

## Findings (most severe first)

### F0. Directory requirement 4 ("files must NOT include content") — uifiles complies today — severity: none (owner question)

- Where: `public/r/registry.json` (index) vs `public/r/<name>.json` (items).
- What the rule applies to: **the index the directory lists**, i.e. the JSON at
  `https://uifiles.dev/r/registry.json`. Not the per-item files. Evidence, all from the sparse clone
  at 98a1fe6:
  - `registry-index.mdx:32-33` lists the requirement right after "flat registry … `/registry.json`
    and `/component-name.json`", and the example that follows is a `registry.json` whose `files`
    carry only `path` and `type`.
  - `packages/shadcn/src/registry/loader.ts:124-142` (`createRegistryCatalog`) maps every item
    through `stripRegistryItemFileContent` (`loader.ts:231-236`) before `commands/build.ts:85-89`
    writes it as `registry.json`. The per-item build path, `createRegistryItem`
    (`loader.ts:144-184`), does the opposite: `file.content = await readRegistryItemFileContent(…)`
    at line 174. `content` on item files is what the CLI installs from (`utils/dry-run.ts:167`
    `if (!file.content) continue`), so an item file without it installs nothing.
  - The health monitor validates the index with `registrySchema` and items with
    `registryItemSchema` (`apps/v4/lib/registry-health/monitor.ts:165`, `:515`); both accept
    `content: z.string().optional()` (`registry/schema.ts:103,110`), so requirement 4 is a
    reviewer/size rule, not a schema rule.
- Evidence that uifiles complies (`registry-contract/validate-built.mjs`, run against the
  installed `shadcn/schema`):
  ```
  index registrySchema: PASS
  index items: 83 unique: true
  index name: uifiles homepage: https://uifiles.dev
  index items with files[].content: 0
  item files checked: 83 failures: 0
  ```
  and `public/r/response.json` etc. carry `content` on every file (19 of 83 item files, the ones
  with files). That is exactly the shape the rule asks for.
- Why the owner misread it: they looked at `public/r/<name>.json` (which must have `content`) and
  assumed the rule was about "the registry's files"; it is about `registry.json`. `shadcn build`
  produces the correct split on its own; nothing to change.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "index validates with the CLI
  schema and carries no file content" and "every item file validates, matches its name and carries
  content" (expected: PASS now; skipped when `public/r` is not built).

### F1. 19 items import `cn` from the `cn` package but no item declares it — severity: medium

- Where: every `registry/ai/*.tsx` and `registry/blocks/chat/components/blocks/chat.tsx` line
  `import { cn } from "cn"`; `registry/ai/registry.json` `dependencies` arrays;
  `registry/blocks/registry.json:9-14`.
- What: the CLI installs only what `dependencies` lists (`utils/dry-run.ts:110`,
  `add-components.ts:104`). `transformImport` rewrites `@/lib/utils`, never `"cn"`
  (`transformers/transform-import.ts:31-49`). Real round-trip of `add @uifiles/response --dry-run`
  lists five streamdown packages and not `cn`; the installed file still says `from "cn"`. Only
  `@uifiles/base` (`registry/base/registry.json:22`) lists `cn`. A consumer that did not init from
  `@uifiles/base` and whose project predates the `cn` package (the CLI ships
  `packages/shadcn/src/migrations/cn/` for exactly those projects: `index.ts:83`
  `installDependencies(options.cwd, ["cn"])`) gets `Module not found: Can't resolve 'cn'` at build.
  `response` and `image` have no `registryDependencies` at all, so nothing upstream pulls `cn` in
  for them either.
- Evidence: `registry-contract/deps-crosscheck.mjs` → 19 `[A] <item>: imports "cn" but
  dependencies does not declare it`; reproducer test output below.
- Why it matters: a consumer-visible build break on the most likely install path for people who
  already have shadcn (add one component, not re-init).
- Proposed fix: add `"cn"` to `dependencies` of every item whose file imports it (cheap; the
  package manager no-ops when present). Alternative: add `"utils"` to `registryDependencies`, but
  that depends on upstream `utils` declaring `cn`, which I could not verify offline.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "every bare package a file
  imports is declared in dependencies" (expected: FAIL now, 19 entries).

### F2. README's GitHub-path install is broken today and cannot install `tool`/`chat` before listing — severity: medium

- Where: `README.md:15-19` ("Or straight from GitHub, pinned to a tag, with no hosting involved:
  `pnpm dlx shadcn@latest add jamierthompson/uifiles/prompt-input#v1.0.0`"); `docs/plan.md` §2
  "GitHub-registry path … for free".
- What, run for real against `raw.githubusercontent.com` (reachable here) with the installed CLI:
  - `add jamierthompson/uifiles/prompt-input#v1.0.0 --dry-run` → exit 1, `Could not resolve GitHub
    ref "v1.0.0" for jamierthompson/uifiles.` `git tag` in the repo is empty; no such tag exists.
  - `add jamierthompson/uifiles/response#main --dry-run` → exit 0, correct (1 file, 5 deps).
  - `add jamierthompson/uifiles/tool#main --dry-run` in a consumer that has **no** `@uifiles`
    entry in `components.json` (which is the whole point of the GitHub path) with the directory
    mocked as not listing `@uifiles` → exit 1, `Unknown registry "@uifiles"`. Cause: `tool` declares
    `"@uifiles/code-block"` (`registry/ai/registry.json:320`); the CLI resolves namespaced deps only
    through `config.registries` or the directory (`registry/resolver.ts:187-194,473-478`;
    `utils/registries.ts:59-75`). The docs say it outright: "For same-repository GitHub
    dependencies, use the full GitHub item address" (`registry-item-json.mdx:184-186`). Same for
    `chat` (five `@uifiles/*` deps).
- Why it matters: the README's first alternative install command fails for everyone this week, and
  the two most valuable items (`tool`, `chat`) will keep failing on that path until the directory
  PR merges.
- Proposed fix: either drop the GitHub path from the README until `v1.0.0` exists and the
  directory lists `@uifiles`, or say it works for items without `@uifiles/*` dependencies and
  use `#main` in the example.
- Test written: none (network-dependent); scratch reproducer `registry-contract/roundtrip.mjs`
  scenarios `gh-tagged`, `gh-tool-noreg`.

### F3. `baseUrl()` falls back to `http://localhost:3000` in a production build — severity: medium

- Where: `lib/registry.ts:72-77`; consumers `app/page.tsx:6,21` and `app/llms.txt/route.ts:6`.
- What: both routes are prerendered at build (`.next/prerender-manifest.json`: `/llms.txt`
  `routeType: "route", compute: "static"`, `/` present; Next docs
  `01-getting-started/15-route-handlers.md:51` on `force-static`). `baseUrl()` reads only
  `NEXT_PUBLIC_BASE_URL`. `.env.example` sets it to `http://localhost:3000` and nothing in
  `next.config.ts` (empty), `vercel.json` (absent) or CI sets it for Vercel. A Vercel project whose
  env var is not configured ships a homepage that says
  `pnpm dlx shadcn@latest init http://localhost:3000/r/base.json` and an `/llms.txt` whose every
  link is `http://localhost:3000/r/…`. Verified locally: `curl localhost:3000/llms.txt` shows the
  localhost links (correct here, wrong on the deploy). `e2e/registry.spec.ts:26-30` only asserts
  `# uifiles`, so CI would not notice.
- Why it matters: the directory reviewer and the founders open the homepage first.
- Proposed fix: in `baseUrl()`, fall back to
  `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL}` when
  `VERCEL` is set, and throw at build when `VERCEL_ENV === "production"` and no origin is known;
  add an e2e assertion that `/llms.txt` links start with the request origin.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "never advertises localhost
  from a production deploy" (expected: FAIL now). (The `app-tooling-oss` lens found the same;
  see its test "baseUrl() derives the origin from Vercel…".)

### F4. `upstream.lock.json` tracks the wrong set, and the weekly workflow turns every 404/403/transient error into a new issue — severity: medium

- Where: `registry/ai/upstream.lock.json` (19 entries); `scripts/sync-upstream.ts:22-31,54`;
  `.github/workflows/upstream-diff.yml:18-28`.
- What:
  1. Lock ⊄ ported and ported ⊄ lock: `conversation`, `message`, `shimmer` are locked but "Do not
     port" (`docs/porting-ai-elements.md` last section); `branch` and `response` are shipped but
     unlocked, contrary to §0 of the same doc ("update it when you port"). They were extracted from
     upstream `message.tsx`, so drift is only tracked by accident through the `message` entry, and
     the issue body ("Re-port the changed items … registry/ai/message.tsx") points at a file that
     does not exist. Any upstream edit to `conversation.tsx` or `shimmer.tsx` opens an issue about
     nothing.
  2. `process.exit(1)` on `missing` (`sync-upstream.ts:54`) fires on any non-2xx. Run here against
     the blocked host: every entry reported `(403)`, exit 1. In CI that is one issue per transient
     5xx/rate-limit/redirect on `elements.ai-sdk.dev` (the plan calls its MCP "stale legacy host").
     A thrown `fetch` (DNS, TLS) is an unhandled rejection → also exit 1 → also an issue.
  3. `continue-on-error` + `github.rest.issues.create` with a dated title and no search for an
     existing open `upstream` issue → a new issue every Monday until someone re-ports.
- Evidence: `node scripts/sync-upstream.ts` → `Upstream missing: … (403)` ×19, `exit: 1`;
  `registry-contract` lock diff: `in lock not ported: conversation, message, shimmer`; `ported not
  in lock: branch, response`.
- Why it matters: noise erodes trust in the one signal that keeps the port honest.
- Proposed fix: lock exactly the shipped items, with `branch`/`response` mapped to the
  `message.json` source (add a `for` field or key the lock by item and store `source` explicitly,
  which it already does); treat 404 as "missing" and other statuses/throws as "error" with exit 2;
  in the workflow, search open issues with label `upstream` and comment instead of creating.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "locks exactly the ported
  registry/ai items" (expected: FAIL now). (Overlaps with `app-tooling-oss`; same conclusion.)

### F5. `sync-tokens.ts` silently drops tokens on ordinary CSS — severity: low (today's CSS parses correctly)

- Where: `scripts/sync-tokens.ts:10,15`.
- What: `[^}]*` ends the block at the first `}` anywhere, including inside a comment or a nested
  at-rule; the per-line regex requires `--x: v;` alone on the line. Harness
  (`registry-contract/sync-tokens-harness.mjs`, same code, no writes) against the real
  `app/globals.css`: 32 light / 31 dark / 7 theme, identical to the committed JSON. Mutations of
  the real file: a `/* } */` comment inside `:root` → **0 light tokens, no error**; a trailing
  `/* base */` on a line → that token dropped; a value wrapped onto two lines → dropped; a nested
  `@media` inside `:root` → every token after it dropped (8 sidebar tokens); a token defined twice →
  last wins (fine, matches CSS). The script prints counts but `registry:build` does not assert
  them, so `base.json` would publish with missing tokens and `registry validate` would pass (the
  schema accepts any record).
- `cssVars.theme`: only `radius-*` (7) today; `font-*` are `var(...)` and filtered. The keys are
  valid (`registryItemCssVarsSchema.theme` is `record<string,string>`). Note they duplicate what
  the CLI derives itself from `light.radius` with the same multipliers
  (`updaters/update-css-vars.ts:431-447`); the CLI skips existing declarations, so harmless. I
  could not compare against shadcn's own `registry:base` items (not in the sparse clone; host
  blocked).
- Proposed fix: strip comments and brace-match (a 20-line tokenizer, or `postcss`, which the CLI
  already depends on), and assert `light` and `dark` key sets are equal apart from `radius`.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "registry/base cssVars match
  app/globals.css" (expected: PASS now; a brace-matching parse that will diverge from the script
  the day the CSS grows a comment). (`tokens-css` lens has failing robustness tests for the same
  script.)

### F6. Health monitor dry-runs against `radix-vega`; `toast` is Base-only upstream — severity: low

- Where: `registry/ui/registry.json` `toast` alias (`registryDependencies: ["toast"]`);
  `apps/v4/lib/registry-health/monitor.ts:36` `DEFAULT_STYLE = "radix-vega"`,
  `dry-run.ts:48` writes `style: DEFAULT_STYLE` into the temp consumer.
- What: the weekly CLI check rotates through all 83 item names in index order
  (`monitor.ts:301-310`) and runs `add @uifiles/<item> --dry-run` with a `radix-vega`
  `components.json`. `@uifiles/toast` resolves upstream `styles/radix-vega/toast.json`; the CLI's
  own constants say `toast` is `availableIn: ["base"]` (`registry/constants.ts:179-186`). If that
  file is absent for radix styles (likely; could not fetch), the dry run for that slot fails. One
  failure in 83 does not degrade status (needs two consecutive), but it costs Installability
  points that week. `direction`, `message`, `bubble`, `attachment`, `marker`, `message-scroller`,
  `questionnaire`, `combobox` for `radix-vega` are unverified for the same reason. Separately, every
  ported AI item is Base-UI-only (`render=`, Base UI event signatures) but nothing machine-readable
  says so; the monitor's radix consumer "installs" it fine, a real radix consumer gets code that
  does not typecheck against their wrappers.
- Proposed fix: state "Base UI only" in the directory description and in `docs` of the AI items;
  consider dropping `toast` from the alias list or noting it is Base-only in its description.
- Test written: none (needs upstream).

### F7. `@/registry/ai/<x>` imports in the chat block install correctly only via the CLI's basename fallback — severity: low

- Where: `registry/blocks/chat/components/blocks/chat.tsx:64-79` (`@/registry/ai/prompt-input` …);
  `.claude/rules/registry.md` block-layout rule.
- What: `transformImport` maps `@/registry/ai/prompt-input` to `@/components/prompt-input`
  (`transform-import.ts:152-155`, the `^@/registry/[^/]+` rule; the `/components` rule at 125-133
  does not match because the specifier has no `/components/`). The correct
  `@/components/ai/prompt-input` comes from the second pass, `rewriteResolvedImportsInContent`
  (`update-files.ts:702-790`), whose `resolveModuleByProbablePath` falls back to matching the
  planned install files by basename (`update-files.ts:870-876`). It works today (verified: `add
  @uifiles/chat --view components/blocks/chat.tsx` prints `from "@/components/ai/prompt-input"`,
  `@/components/ai/tool`, etc.) because every provider is in the same install through
  `registryDependencies`. It silently does not run when the consumer has no resolvable
  tsconfig/jsconfig (`update-files.ts:721-723` returns content unchanged), leaving
  `@/components/prompt-input`. The `.claude/rules/registry.md` explanation ("the CLI's import
  rewrite (`@/registry/<x>/components/...` → components alias)") is right for the block's own
  files (`@/registry/blocks/chat/components/blocks/chat` → `@/components/blocks/chat`,
  `.../lib/demo-conversation` → `@/lib/demo-conversation`, both verified in `--view app/chat/page.tsx`)
  and does not cover the `@/registry/ai/<x>` case.
- Proposed fix: none required for 4.21; document that cross-item imports are repaired by the
  planned-files pass, and keep the "provider must be a registryDependency" invariant tested.
- Test written: `tests/unit/qa-round1-registry-contract.test.ts` › "cross-item imports resolve
  to a declared @uifiles dependency's target" (expected: PASS now; models the fallback).

### F8. Unit test does not guard four registry invariants a directory reviewer checks — severity: low

- Where: `tests/unit/registry.test.ts` (4 tests).
- What: nothing guards (a) `@uifiles/<typo>` in `registryDependencies` (a 404 on the consumer's
  machine), (b) a bare dependency that is not an upstream name, (c) two items writing the same
  `target` (CLI: last one wins, `registry/utils.ts:341-344`), (d) declared npm ranges vs what this
  repo actually typechecks against, (e) a file importing a package it does not declare (F1).
  `shadcn registry validate` covers only file existence and item schema
  (`registry/validate.ts:354-413`). The existing "references forked primitives by namespace" test
  is sound: mutation-forking `button` makes it report 8 violations including `branch`
  (`registry-contract/mutation-bare-rule.mjs`).
- Test written: all five as passing invariants in `tests/unit/qa-round1-registry-contract.test.ts`
  (a: "every @uifiles/<name> dependency names an item", b: "every bare dependency is a known
  upstream shadcn item", c: "no two items write the same target", d: "every declared dependency is
  installed … compatible major", e: F1's failing test).

### F9. `generate-aliases.ts` title casing — severity: nit

- Where: `scripts/generate-aliases.ts:69-74`; `registry/ui/registry.json` `input-otp`.
- What: `i.title ?? Title Case(name)` gives `"Input Otp"` (upstream calls it "Input OTP"). Visible
  on `/` and in `shadcn search`.

### F10. `base` adds `shadcn` to every consumer's `devDependencies` — severity: nit

- Where: `registry/base/registry.json:28` `"devDependencies": ["tw-animate-css", "shadcn"]`.
- What: verified by dry run (`add @uifiles/base --dry-run` → Dev Dependencies: tw-animate-css,
  shadcn). Upstream's `index` style item lists only `tw-animate-css`. Opinionated, not wrong.

## Coverage gaps (no bug found, but untested)

- `e2e/registry.spec.ts` › does not assert: JSON `content-type` on `/r/*.json`; that every item
  in the index is served with 200 and `name` matches; that the index has no `content`; that
  `/llms.txt` and `/` links use the request origin (F3); that `registry.json` `homepage` equals the
  deploy origin. Suggested: loop over `index.items`, `request.get(`/r/${name}.json`)`, assert
  `headers()["content-type"]` matches `/application\/json/` and `json().name === name`.
- `tests/unit/registry.test.ts` › does not run the CLI's zod schemas over the source registry;
  `registry validate` does, but only in `registry:build`/CI, not `pnpm test`.
- No test that `public/r/registry.json` item count equals the source item count after a build.
- `scripts/generate-aliases.ts` › no test that every `EXTRA` key is still a `registry:ui` name
  upstream (the script would throw for a missing description, but not for a stale extra key).
- Round-trip: nothing in CI does `add --dry-run` from a scratch consumer (`docs/plan.md` §6 says it
  should). `registry-contract/roundtrip.mjs` is a working harness (mock upstream from
  `components/ui`) if the fixer wants to adopt it.

## Verified OK

- Directory requirement 4: index has zero `files[].content`; items have it (F0). Built with
  `shadcn build` from `registry.json` + `include`, which strips it automatically.
- Requirements 1–3: root `registry.json` has `name`/`homepage`/`include`; `public/r/` is flat
  (`registry.json` + 83 `<name>.json`, no `/` in any item name); index passes `registrySchema`, all
  83 items pass `registryItemSchema` with `name` match (`validate-built.mjs`). Item count 83 = 1
  base + 63 ui + 18 ai + 1 block; source and built name sets equal; no extra files in `public/r`.
- Health "registry setup" signals: HTTPS (entry URL); `content-type: application/json;
  charset=UTF-8` served locally for `/r/*.json` (Vercel serves `public/` with the same type);
  unique names; `normalizeRegistryName("uifiles") === normalizeRegistryName("@uifiles")`
  (`registry-directory.ts:63-65`). Index size 52 KB, far under the 10 MB body cap
  (`network.ts:11`). 404s return `text/html`; the monitor only fetches listed names.
- Directory entry: drafted and validated against `registryDirectoryEntrySchema` (strict object;
  `logo` required string; `url` must contain `{name}`), no namespace or host clash with the 382
  existing entries (`validate-directory-entry.mjs`). See checklist below.
- Alias items: `add @uifiles/button --dry-run` fetched `styles/base-nova/button.json` upstream and
  planned `components/ui/button.tsx`; with `style: "radix-vega"` the same alias resolves
  `styles/radix-vega/...` (resolver.ts:122 uses `config.style`). A consumer without an `@uifiles`
  entry: before listing, `Unknown registry "@uifiles"` with the fix-it snippet (clean error); after
  listing (directory mocked to include `@uifiles`), `add @uifiles/response` and `add @uifiles/tool`
  succeed and the CLI would write the entry into `components.json` (`registries.ts:109-130`;
  skipped in dry run). The 9 `EXTRA` items resolve like the other 54 (same code path); their
  descriptions are the only difference.
- Upstream `registry:ui` names: the sparse clone's `apps/v4/registry.json` lists 54 `registry:ui`
  items, all 54 present in ours; the 9 extra (`attachment bubble combobox direction marker message
  message-scroller questionnaire toast`) are the June–Sept 2026 additions absent from that legacy
  file and could not be checked against the live index (blocked). None of ours is docs-only.
- Bare-vs-namespaced rule (`registry.test.ts:18-33`): mutation-forking `button` yields 8
  violations (`branch`, `checkpoint`, `code-block`, `confirmation`, `context`, `plan`, `queue`,
  `suggestion`); `@uifiles/button` is not flagged; the forked item's own leftover `["button"]` is
  skipped by design.
- Block layout: `add @uifiles/chat --dry-run` in a Next consumer plans 26 files:
  `components/blocks/chat.tsx`, `lib/demo-conversation.ts`, `app/chat/page.tsx`, 6 `components/ai/*`,
  17 `components/ui/*`; a `src/` consumer gets `src/` prefixes on all of them
  (`update-files.ts:442-444`). A `.ts` typed `registry:component` with an explicit target is
  placed by `target`, not by type (`update-files.ts:419-445`). Page imports rewritten to
  `@/components/blocks/chat` and `@/lib/demo-conversation`; block imports to `@/components/ai/*`
  (F7 caveat). `tool.tsx`'s relative `./code-block` is untouched and correct because both targets
  are `components/ai/`. Without a `next.config.*` the page file is silently omitted
  (`resolvePageTarget` returns `""` for unknown frameworks, `update-files.ts:567-601`): expected
  CLI behaviour, also what the health monitor's scaffold sees.
- `docs`, `dependencies` in dry run: `docs` pass through (`dry-run.ts:114`) and are printed by
  `formatDryRunResult`; declared ranges pass through verbatim (`streamdown@^2.6` etc.).
- Declared npm ranges vs installed: all 12 distinct pinned packages agree on major (and minor
  where pinned) with `package.json` (`ai@^7`/7.0.114, `@ai-sdk/react@^4`/4.0.117,
  `@shadcn/helpers@^0.2`/0.2.0, `nanoid@^6`/6.0.1, `shiki@^4.4`/4.4.3, `streamdown@^2.6`/2.6.0,
  `tokenlens@^1`/1.3.1, `@streamdown/*@^1`). All declared packages are installed here.
- `files[].path` all exist; no `target` collisions across 21 targets; every `@uifiles/<x>` dep
  exists; every bare dep is one of the 63 ui names or `utils`/`font-*`.
- `lib/registry.ts` at build: `/` and `/llms.txt` are `compute: "static"` in
  `.next/prerender-manifest.json`; `readFileSync(process.cwd() + "registry.json")` runs at build
  only. `outputFileTracingIncludes` is not needed ("Fully static pages are not affected",
  `next-config-js/output.md:126-130`). Would become needed only if someone adds `revalidate` or a
  dynamic API.
- `sync-tokens.ts` on today's CSS: output byte-identical to the committed `cssVars`; `radius` is
  light-only by design (matches the CLI's own `registryGetTheme`, `resolver.ts:596-601`). Prettier
  via `execFileSync("pnpm", …)` is only reached by `registry:sync`/`registry:build`, which run
  where pnpm exists (Vercel reads `packageManager`); `upstream-diff.yml` never calls it.
- Node 24 type stripping: `node scripts/sync-upstream.ts` runs under v24.21.0 (only erasable
  syntax in all three scripts); `.nvmrc` is `24`; the workflow needs no `pnpm install` because
  the script imports only `node:` builtins.
- `sync-upstream.ts` compares the right thing for what it locks: sha256 of upstream
  `files[0].content` (the served registry JSON, which is what the lock was made from). The local
  clone's `packages/elements/src/<name>.tsx` hashes differ from the lock for all 19 entries, as
  expected (registry content is the transformed file), so I could not confirm the hashes offline.
- `registry:base` via `add @uifiles/base --dry-run`: resolves `utils`, `font-geist`,
  `font-heading-geist` upstream, plans `lib/utils.ts`, 72 CSS vars, both fonts;
  `shouldInstallStyleIndex` is false for `registry:base` (`add.ts:122-125`).

## Could not reach

- `ui.shadcn.com` and `elements.ai-sdk.dev` are blocked, so: the live `/r/index.json` (to confirm
  the 9 newer `registry:ui` names), `styles/radix-vega/toast.json` existence (F6), upstream
  `base-nova` items' `dependencies` (whether `utils` declares `cn`, F1 alternative fix), shadcn's
  own `registry:base` `cssVars.theme` shape (F5), and the lock's sha256 values were not verified.
  The mock upstream serves this repo's installed `components/ui/*.tsx`, so upstream item
  *contents* were real but their metadata was mine.
- `https://uifiles.dev` returns 403 from the egress proxy; the deployed content-type, HTTPS and
  homepage could not be checked (locally all pass).
- `shadcn init @uifiles/base` (non-dry) would install packages into the scratch consumer and
  needs a framework; I used `add @uifiles/base --dry-run`, which exercises the same tree
  resolution and CSS/font massaging.
- The weekly workflow itself (needs GitHub Actions); reasoned from `upstream-diff.yml` and the
  script's observed exit codes.

## Commands run (for the fixer to reproduce)

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
S=/docs/qa/round1/registry-contract
node $S/validate-built.mjs                 # index + 83 items through shadcn/schema
node $S/validate-directory-entry.mjs       # directory entry through registry-directory.ts schema
node $S/deps-crosscheck.mjs                # imports vs dependencies vs package.json, paths, targets
node $S/sync-tokens-harness.mjs            # sync-tokens regexes vs real + mutated globals.css
node $S/mutation-bare-rule.mjs             # forks button, re-runs registry.test.ts logic
node scripts/sync-upstream.ts; echo $?     # -> "(403)" x19, exit 1 (no writes)
MOCK_PORT=3997 node $S/roundtrip.mjs tool chat chat-src            # real CLI, mocked upstream
MOCK_PORT=3998 node $S/roundtrip.mjs base-add response-radix-vega
MOCK_PORT=3996 node $S/roundtrip.mjs chat-next chat-next-view-page
MOCK_DIRECTORY=empty  MOCK_PORT=3995 node $S/roundtrip.mjs response-no-registries tool-noreg
MOCK_DIRECTORY=listed MOCK_PORT=3994 node $S/roundtrip.mjs response-no-registries tool-noreg
MOCK_PORT=3993 node $S/roundtrip.mjs gh-response gh-tool gh-tagged   # real raw.githubusercontent.com
MOCK_DIRECTORY=empty MOCK_PORT=3992 node $S/roundtrip.mjs gh-tool-noreg
curl -sI localhost:3000/r/registry.json | grep -i content-type
node -e 'const m=require("./.next/prerender-manifest.json");console.log(m.routes["/llms.txt"].compute)'
pnpm exec vitest run --project unit tests/unit/qa-round1-registry-contract.test.ts
pnpm exec biome check tests/unit/qa-round1-registry-contract.test.ts   # clean
pnpm exec prettier --check tests/unit/qa-round1-registry-contract.test.ts   # clean
pnpm exec tsc --noEmit   # 4 errors, all in other lenses' tests/browser/qa-round1/*.tsx; none in mine
```

Vitest output for my file:

```
 × npm dependencies > every bare package a file imports is declared in dependencies   (19 items import "cn")
 × upstream lock > locks exactly the ported registry/ai items                          (+conversation,message,shimmer / -branch,response)
 × baseUrl() > never advertises localhost from a production deploy                     ('http://localhost:3000' !== 'https://uifiles.dev')
 Test Files  1 failed (1)
      Tests  3 failed | 10 passed (13)
```

## Directory submission checklist

Entry for `apps/v4/registry/directory.json` (validated with the upstream schema; sorted position is
between `@ui-…` neighbours, the file is alphabetical):

```json
{
  "name": "@uifiles",
  "homepage": "https://uifiles.dev",
  "url": "https://uifiles.dev/r/{name}.json",
  "description": "A shadcn/ui registry on Base UI: every shadcn/ui primitive under one namespace, AI chat and agent components ported from Vercel AI Elements, and a registry:base design system with the uifiles tokens.",
  "author": "Jamie Thompson",
  "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='var(--foreground)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><path d='M14 2v6h6'/><path d='M9 13v4'/><path d='M12 11v6'/><path d='M15 15v2'/></svg>"
}
```

Schema facts: `name` must match `/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/`; `homepage` and `url` must be
URLs and `url` must contain `{name}`; `description` and `logo` are required strings (inline SVG,
use `var(--foreground)` like the other entries); `author` optional; `.strict()` so no other keys.
Only `name/homepage/url/description` are published at `/r/registries.json`. Validation command
upstream: `pnpm validate:registries` (`apps/v4/scripts/validate-registries.mts`). Replace the
placeholder logo and author before submitting.

Blockers: none in the registry itself. Prerequisites before opening the PR:

1. Deploy to `https://uifiles.dev` with `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` set in the
   Vercel project (F3), and confirm `curl -sI https://uifiles.dev/r/registry.json` returns 200 and
   `application/json` with no bot challenge (Vercel default is fine; `network.ts:282-313` treats
   challenges as "monitoringLimited", not failures).
2. Public GitHub repo (requirement 1); `raw.githubusercontent.com` already serves
   `registry.json` at `main` (verified via the CLI's GitHub path).
3. Fix F1 (`cn`) so the sampled-item dry runs never install a file with an unresolvable import;
   it does not affect the health score, it affects consumers.
4. Optional: make the description say "Base UI" (F6), since the monitor and many consumers run
   radix styles.

## Proposed invariant tests

All in `tests/unit/qa-round1-registry-contract.test.ts` (13 tests; Biome and Prettier clean; tsc
clean for this file):

| Test | Status today |
| --- | --- |
| registryDependencies › every `@uifiles/<name>` dependency names an item in this registry | PASS |
| registryDependencies › every bare dependency is a known upstream shadcn item | PASS |
| registryDependencies › the bare-vs-namespaced rule fires when a primitive is forked (mutation) | PASS |
| files › every `files[].path` exists on disk | PASS |
| files › no two items write the same target | PASS |
| files › cross-item imports resolve to a declared `@uifiles` dependency's target | PASS |
| npm dependencies › every declared dependency is installed here with a compatible major | PASS |
| npm dependencies › every bare package a file imports is declared in dependencies | **FAIL** (F1: 19 × `cn`) |
| upstream lock › locks exactly the ported `registry/ai` items | **FAIL** (F4) |
| registry:base tokens › `registry/base` cssVars match `app/globals.css` (brace-matching parse) | PASS |
| built output › index validates with the CLI schema and carries no file content | PASS (skips if `public/r` absent) |
| built output › every item file validates, matches its name and carries content | PASS (skips if `public/r` absent) |
| baseUrl() › never advertises localhost from a production deploy | **FAIL** (F3; encodes the proposed fallback) |

Scratch harnesses the fixer can reuse (under the `registry-contract/` scratch dir):
`roundtrip.mjs` (real CLI against `localhost:3000` with a mock `ui.shadcn.com/r` on
`MOCK_PORT`, `MOCK_DIRECTORY=empty|listed` to simulate the directory), `validate-built.mjs`,
`validate-directory-entry.mjs` + `directory-entry.json`, `deps-crosscheck.mjs`,
`sync-tokens-harness.mjs`, `mutation-bare-rule.mjs`.
