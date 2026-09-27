# uifiles: what to do before and after you share it

Written for you as the maintainer. Everything below is either already done on the branch
(marked ✅), a step only you can take (🔑), or a recommendation (💡).

## 1. Your specific question: the `content` property

✅ Not a problem. The shadcn directory rule ("the `files` array must NOT include a `content`
property") applies to the index at `/r/registry.json`. `shadcn build` strips `content` from
the index and writes it into each `/r/<name>.json`, which the CLI needs to install the file.
This was verified against the CLI source (`loader.ts`, `stripRegistryItemFileContent`) and
the health monitor, and a unit test now pins it (index has no `content`; every item file does).

## 2. Directory submission (🔑 you)

1. Deploy the branch to Vercel and set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` on the
   project. The build now fails on Vercel production if that variable is missing, because
   the home page and `/llms.txt` bake the origin in at build time.
2. After the deploy, check `https://uifiles.dev/r/registry.json` (JSON, no `content`),
   `https://uifiles.dev/r/tool.json` (has `content`), and `https://uifiles.dev/llms.txt`
   (no `localhost`).
3. Tag the release: `git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0`. The README's
   GitHub-path example pins `#v0.1.0` and the CHANGELOG links to it.
4. Open the PR against `shadcn-ui/ui`: append the entry below to
   `apps/v4/registry/directory.json` (the file is not alphabetical; append), replace the
   placeholder logo with your own inline SVG, and run `pnpm validate:registries` there.
   The entry was validated against upstream's `registry-directory.ts` schema:

   ```json
   {
     "name": "@uifiles",
     "homepage": "https://uifiles.dev",
     "url": "https://uifiles.dev/r/{name}.json",
     "description": "A shadcn/ui registry on Base UI: every shadcn primitive under one namespace, AI chat and agent components ported from Vercel AI Elements, and the tokens that tie them together.",
     "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='var(--foreground)'/></svg>"
   }
   ```
5. Registry Health then monitors hourly. The two things that would cost points: the index
   going offline, and an item failing `add --dry-run` against a `radix-vega` consumer (the
   monitor's default style). The AI items are Base UI only; their `docs` say so. If health
   flags one, the honest fix is to note it in the description rather than fake Radix support.

## 3. Repository settings (🔑 you, 10 minutes)

- Enable "Private vulnerability reporting" (Settings → Security) so `SECURITY.md`'s advice works.
- Branch protection on `main`: require the `gate` check, require PRs.
- Topics: `shadcn`, `shadcn-ui`, `registry`, `base-ui`, `ai-elements`, `tailwindcss`, `react`.
- Description and website on the repo header (GitHub reads `package.json` for neither).
- Confirm the licence badge reads "MIT" after the branch merges (the second root `LICENSE*`
  file that made GitHub say "Other" now lives under `licenses/`).

## 4. What is now in place to catch bugs as the project grows (✅)

| Layer | What it catches |
| --- | --- |
| 1,258 Vitest tests (344 unit, 914 browser-mode in real Chromium), 98 Playwright e2e (light+dark, desktop+mobile, against the production build) | Behaviour, keyboard, a11y, hydration, console noise, page width, served HTML |
| Upstream AI Elements test suites ported per component | API parity with what people expect from AI Elements |
| `tests/a11y.ts`: WCAG 2.0/2.1/2.2 AA + best-practice tags, `target-size` on | Contrast, names, landmarks, 24 px targets, focusable scroll regions |
| `tests/setup.ts` fail-on-console guard (spy-proof) | React key/act/hydration warnings, unknown DOM props |
| Coverage thresholds per file (80/80/70; measured ~99/93/97) | Untested branches in new code |
| Strict TS (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`) | Consumers with strict configs cannot get a red build from an installed file |
| Pre-bundling scan that follows local imports into the preview pages browser tests render | A bare specifier Vite meets mid-run (the re-bundle that breaks a suite) |
| Registry invariants (unit) | Undeclared imports and stale declared dependencies (a `css` `@import`/`@plugin` counts as a use), unknown deps, target collisions, version drift, built index vs source, every item has a test + preview with the registry title, no `css` rule repeated from an `@uifiles/*` dependency, SSR render of every component |
| `sync-tokens.ts` with invariants | Token drift between the site and the base item; cascade mistakes |
| CI: SHA-pinned actions, least privilege, concurrency, audit, generated-file diff check, e2e against the production build, mobile project, artifacts | Supply chain, stale generated files, prod-only bugs |
| Weekly upstream-drift workflow (dedupes into one issue) | AI Elements changing under you |
| Dependabot (actions + npm, grouped) | Stale pins |

💡 Next additions, in order of value:
1. Visual regression (`toHaveScreenshot` per preview, light+dark) once you have a stable CI
   rasteriser; baselines from a laptop will not match Ubuntu runners, so generate them in CI.
2. A weekly "flake hunt" workflow: browser suite with `--sequence.shuffle --retry=0`, e2e with
   `retries: 0`.
3. A CLI round-trip job in CI: `pnpm start`, then `shadcn add` every item into a scratch
   Next app (upstream hosts are reachable on GitHub runners, unlike in this sandbox).
4. Type-level contract tests (`expectTypeOf`) for the public prop unions, so an accidental
   prop rename fails typecheck before a test.
5. Knip for dead exports once the API settles.

## 5. Decisions I left to you (documented, not changed)

- Light `--input` / `--border` stay at Nova's 1.26:1. Making field borders 3:1 is a visible
  design change (`oklch(0.66 0 0)` passes); decide it as a design call, then `pnpm registry:build`.
- Chart tokens are still a grey ramp. A 5-hue proposal is in the round-1 tokens report.
- Reasoning: a second stream auto-opens and auto-closes once more (upstream never did).
  Reviewer's verdict: yours is right for a chat; it is documented.
- Context cost rows are partitioned (Input excludes cached reads, Output excludes reasoning)
  so counts and costs agree; upstream double-counted.
- `Image` now requires `alt`. This is a type-level API change from upstream; it is documented.

## 6. Known limits

- Upstream registries are blocked in this sandbox, so `shadcn add` of items with bare upstream
  dependencies was verified from the CLI source and a mocked upstream, not against ui.shadcn.com.
  Run one real `shadcn add @uifiles/chat` into a scratch app after deploy, and check that the
  two stylesheet `@import`s and the `.katex-display` rule from the `response` item's `css`
  field land in that app's `globals.css` (the CLI inserts them after its existing imports).
- `uifiles.dev` could not be reached from here; the README and manifests assume it.
- Safari was not available; the IME `keyCode 229` guard is standard but untested there.
- Low notes the last critic and verifiers left open, on purpose (all in `docs/qa/round3/critic.md`
  and the `verify-*.md` verdicts): a controlled `InlineCitationCard` whose parent refuses a
  press-close keeps its focus-restore flag armed until the next close; a bare `ChatComposer`
  without `onStop` shows an inert Submit button while busy (the `Chat` wrapper always passes
  `onStop`); the console-spy static check does not cover an alias of `console` (the runtime
  guard does); the Flight round-trip test in `tests/unit/branch.test.ts` couples to Next's
  compiled internals and may need attention on a Next upgrade; `components/ui/kbd.tsx` is
  vendored but unused; three unit tests use a `mockImplementation` on `console.warn` (allowed
  in the unit project).
- The archived reports under `docs/qa/` are unedited agent output; they name the model used for
  the coder agents in places, and quote sandbox-relative paths as `<scratchpad>/…`.
