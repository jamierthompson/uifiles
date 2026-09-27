# Porting an AI Elements component to uifiles

This is the checklist for every file under `registry/ai/`. Upstream is Radix-only; uifiles is
Base UI. The goal is the same public API (same export names, same props) on Base UI
primitives, with dependencies re-pointed at this registry. When the API must change, it is
documented in the item's `docs` field.

## 0. Inputs

- Upstream source for each item: `https://elements.ai-sdk.dev/api/registry/<name>.json`
  (`files[0].content`). `registry/ai/upstream.lock.json` records, per shipped item,
  `{ source, sha256, fetchedAt, upstream? }`: the upstream registry URL, the sha256 of its
  `files[0].content` at the time of the port, and the fetch date; update the entry when you
  port or re-port. An item cut from a differently named upstream file names it in `upstream`:
  `branch` and `response` both come from `message.tsx`, so each has its own key with
  `"upstream": "message"`, the same `source` and the same hash, and both are re-checked
  whenever `message.json` changes. The lock lists exactly the shipped items
  (`tests/unit/registry.test.ts` enforces it); do not add entries for files on the
  do-not-port list.
- Read `AGENTS.md`, this file, and the `migrate-radix-to-base` skill in `.claude/skills/`.
- Read the Base UI wrappers you will compose, in `components/ui/`. They are the installed
  `base-nova` versions. Do not recall their APIs from memory; read the file and the Base UI
  types in `node_modules/@base-ui/react/`.

## 1. File

Path: `registry/ai/<name>.tsx`. First lines:

```tsx
// Derived from Vercel AI Elements <name>.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"
```

Keep the `"use client"` directive if upstream has it (add it when the port gains hooks that
upstream did not have). The licence copy the header refers to lives at
`licenses/APACHE-2.0-ai-elements.txt`, deliberately outside the repository root, and `NOTICE`
records the modifications; never add another `LICENSE*` file at the root.

### Imports

| Upstream                                            | uifiles                                                                                                                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/registry/default/ui/<x>`                         | `@/components/ui/<x>` (the CLI rewrites this to the consumer's `ui` alias)                                                                                                                           |
| `@/lib/utils` (`cn`)                                | `import { cn } from "cn"`                                                                                                                                                                            |
| `./code-block`, `./tool` (sibling AI Elements item) | keep relative `./<name>`; add `"@uifiles/<name>"` to `registryDependencies`                                                                                                                          |
| `./shimmer` (`<Shimmer>` component)                 | delete; use shadcn's `shimmer` class from `shadcn/tailwind.css`: `<span className="shimmer">…</span>`                                                                                                |
| `@radix-ui/react-use-controllable-state`            | delete; implement with `useState` + a controlled/uncontrolled pattern (see below), or Base UI's `useControlled` from `@base-ui/react/utils` if it is exported in the installed version (check first) |

Controlled/uncontrolled replacement. Keep the latest `onOpenChange` in a ref so the setter's
identity does not depend on it: a parent that passes an inline callback re-renders with a
new function every time, and a setter that lists the callback in its dependencies would
change identity on every render too. Every effect that lists the setter (auto-open while
streaming, the auto-close timer in `reasoning`) would then restart, so the timer never
fires.

```tsx
const onOpenChangeRef = useRef(onOpenChange)
useEffect(() => {
  onOpenChangeRef.current = onOpenChange
})
const [uncontrolled, setUncontrolled] = useState(defaultOpen ?? false)
const isControlled = open !== undefined
const isOpen = isControlled ? open : uncontrolled
const setIsOpen = useCallback(
  (next: boolean) => {
    if (!isControlled) setUncontrolled(next)
    onOpenChangeRef.current?.(next)
  },
  [isControlled]
)
```

### Radix → Base UI API changes

| Radix (upstream)                                         | Base UI (ours)                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<TooltipTrigger asChild><Button/></TooltipTrigger>`     | `<TooltipTrigger render={<Button />} />` or keep children when the trigger can be the button itself. Read `components/ui/tooltip.tsx`.               |
| `<CollapsibleTrigger asChild>` / `<Collapsible asChild>` | `render={…}`                                                                                                                                         |
| `<DropdownMenuTrigger asChild>`                          | `render={…}`                                                                                                                                         |
| `<DropdownMenuItem onSelect={fn}>`                       | `onClick={fn}`                                                                                                                                       |
| `<HoverCard openDelay={0} closeDelay={0}>`               | Base UI `PreviewCard.Root` uses `delay` and `closeDelay`; verify names in `node_modules/@base-ui/react/preview-card` types                           |
| `side=` / `align=` on content                            | Read the wrapper; the `base-nova` wrappers forward `side`/`align` to the positioner. Verify.                                                         |
| `data-state="open"` selectors in classNames              | Base UI uses `data-open` / `data-closed`; `shadcn/tailwind.css` provides `data-open:` variants. Check the wrapper's existing classes and match them. |
| `forceMount`                                             | `keepMounted`                                                                                                                                        |
| `<Button asChild><a/></Button>`                          | `<Button render={<a />} />` (Base UI Button; see `nativeButton` in `components/ui/button.tsx`)                                                       |

Anything else Radix-specific that you find: fix it and list it in the item's `docs`.

### Everything else

- Keep export names and prop names identical to upstream unless Base UI makes that
  impossible. Never rename to "improve" it; that is a separate decision.
- Keep upstream's Tailwind classes, but semantic tokens only (`bg-muted`, not `bg-zinc-100`)
  and no alpha-faded text (`text-foo/50`) for information-bearing text.
- `lucide-react` icons stay.
- Types from `ai` stay (`ai@7` is installed; if a type no longer exists, find its v7 name in
  `node_modules/ai/dist/index.d.ts` and note it in `docs`).
- The file is copied into consumer projects with unknown compiler settings, so it must
  compile under `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
  `noUnusedLocals` (on in `tsconfig.json`; see §5). Type optional props as
  `x?: T | undefined` and spread conditionally (`...(v !== undefined && { v })`) when
  forwarding to a wrapper prop that lacks the `| undefined`.
- A Server Component parent hands a client component lazy children. Read them through
  `Children.toArray` (it resolves them and drops null and boolean children); a direct
  `child.key` read on a lazy node is `undefined`.
- Streamdown renders emphasis as `<span data-streamdown="strong">`, not `<strong>`; assert by
  attribute in tests. Render markdown through `MessageResponse` (`@uifiles/response`) rather
  than Streamdown directly: its `css` field installs `@import "streamdown/styles.css"`,
  `@import "katex/dist/katex.min.css"` and the `.katex-display` rule, and an item that depends
  on it inherits them; the consumer still adds `@source "../node_modules/streamdown/dist/*.js"`
  by hand, so say so in `docs`.

## 2. Registry entry

Add one object to `registry/ai/registry.json` `items` (keep the array sorted by name):

```json
{
  "name": "<name>",
  "type": "registry:component",
  "title": "<Title>",
  "description": "<what it is, when to use it, what it composes with — written for search>",
  "dependencies": ["lucide-react", "streamdown@^2.6"],
  "registryDependencies": ["collapsible", "@uifiles/code-block"],
  "files": [
    {
      "path": "<name>.tsx",
      "type": "registry:component",
      "target": "components/ai/<name>.tsx"
    }
  ],
  "docs": "<API changes vs AI Elements, if any>",
  "categories": ["ai", "chat"]
}
```

- `dependencies`: pin a major/minor range for anything upstream leaves bare (`ai@^7`,
  `streamdown@^2.6`, `shiki@^4`, `tokenlens@^1`, `nanoid@^6`). `lucide-react` can stay bare.
- `registryDependencies`: bare names for upstream shadcn primitives, `@uifiles/<name>` for
  siblings in this registry. Never URLs.
- `files[0].path` is relative to `registry/ai/`.

## 3. Preview page

`app/preview/<name>/page.tsx`: a server or client page that renders the component in a
realistic state with static sample data, with one `<h1>` naming the item (the preview
layout provides the `<main>` landmark and the theme toggle). Use `app/preview/` siblings as
examples. The page exists so people and agents can look at the port (`pnpm dev` →
`/preview/<name>`) and so the Playwright suite can run axe over it in a real browser
against server-rendered, hydrated output. A server page may `export const metadata` with
the item's title; a `"use client"` page cannot.

## 4. Browser test

`tests/browser/ai/<name>.test.tsx`, run with Vitest browser mode (Chromium) and
`vitest-browser-react`. Start from upstream's test file
(`packages/elements/__tests__/<name>.test.tsx` in the AI Elements repository) and port it:
`render`/`screen`/`fireEvent` from Testing Library become `render` from
`vitest-browser-react`, locators, `userEvent` from `vitest/browser`, `expect.element` and
`expect.poll`; `@/registry/default/ui/*` imports become `@/components/ui/*`; Radix
expectations (`asChild`, `data-state`, `onSelect`) become their Base UI equivalents. Keep
upstream's test names where the behaviour maps, and skip only tests of upstream APIs the
port does not have (say which, in the PR). Then cover what upstream did not: every prop,
every state in a union, controlled and uncontrolled modes, keyboard interaction, and error
paths. Name each test by the behaviour it asserts, never by the bug or the review that
prompted it.

Accessibility assertions go through the shared helpers in `tests/a11y.ts`; do not copy a
`settle` or `axe.run` call into the file:

```tsx
import { expect, it } from "vitest"
import { render } from "vitest-browser-react"
import { expectNoViolations, withDark } from "@/tests/a11y"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/registry/ai/reasoning"
import "@/app/globals.css"

it("announces the duration once thinking has finished", async () => {
  const screen = await render(
    <main>
      <Reasoning duration={4}>
        <ReasoningTrigger />
        <ReasoningContent>First I check the cache headers.</ReasoningContent>
      </Reasoning>
    </main>
  )
  await expect
    .element(screen.getByRole("button", { name: /Thought for 4 seconds/ }))
    .toBeVisible()
  await expectNoViolations()
  await withDark(() => expectNoViolations())
})
```

- `expectNoViolations()` runs WCAG 2.0/2.1/2.2 AA plus best-practice rules with
  `target-size` enabled, after `settle()` has waited for finite animations (so axe samples
  colours at rest; infinite spinners and shimmer are skipped). `runAxe()` returns the raw
  results when a test needs them. Run it in every meaningful state (closed, open,
  streaming, error) and once under `withDark()`.
- Wrap every fixture in `<main>`. axe's `region` rule requires page content to sit in a
  landmark; a fixture that passes without one does so only because it contains nothing the
  rule counts, and the first `<p>` added to it fails. Never disable `region` or
  `color-contrast`; scope with `exclude` or fix the colour.
- The console must stay clean. `tests/setup.ts` wraps `console.error` and `console.warn`
  around every browser test and fails the test at its end with the messages (React act, key
  and hydration warnings included). A test that asserts a warning calls `allowConsole("error")`
  or `allowConsole("warn")` from `@/tests/setup` at its top; nothing else opts out. A
  `vi.spyOn(console, "error").mockImplementation(() => {})` hides nothing: the calls the mock
  swallowed are charged to the test as well.
- Portaled popups (Base UI menu, select, dialog, hover card) render outside the fixture: run
  axe on the popup on its own and exclude `[data-base-ui-portal]` from the page scan. An open
  modal Select also renders focus guards that axe's `aria-hidden-focus` flags; exclude
  `[data-base-ui-focus-guard]` as well. Playwright leaves the pointer where the previous test
  put it, which opens delay-0 tooltips and hover cards on the next render: `userEvent.unhover`
  the trigger or park the pointer on inert text first.
- Vitest browser defaults worth knowing: `getByText` matches the whole string
  (`locators.exact` is true; pass `{ exact: false }` or a RegExp for a substring), the
  viewport is 414×896, and the test timeout is 15 s. `screen.unmount()` returns a promise;
  await it, or a loop of renders produces "overlapping act() calls".
  `expect.element(x).toHaveTextContent(y)` compares the whole (whitespace-normalised) text and
  stringifies a RegExp; use `toMatchTextContent` or `expect.poll(() => el.textContent)` for a
  substring. Browser `console.log` is not forwarded to the terminal.
- Interaction uses `userEvent` from `vitest/browser`; timers use `vi.useFakeTimers()` as
  upstream does. Fake only what the component needs (`toFake: [setTimeout, …, Date]`) and,
  while timers are faked, click with `element.click()` inside `act`, because `userEvent`
  awaits real timers (`tests/browser/ai/reasoning.test.tsx` has the helper). Import
  `@/app/globals.css` so tokens and the `dark` variant apply.

## 5. Verify

```bash
pnpm exec tsc --noEmit   # tsconfig.json carries exactOptionalPropertyTypes, noUncheckedIndexedAccess, noUnusedLocals
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals   # the same flags, spelled out for a registry file checked on its own
pnpm exec prettier --write registry/ai/<name>.tsx app/preview/<name> tests/browser/ai/<name>.test.tsx
pnpm exec biome check registry/ai/<name>.tsx app/preview/<name> tests/browser/ai/<name>.test.tsx
pnpm exec vitest run --project browser tests/browser/ai/<name>.test.tsx
pnpm exec vitest run --project unit tests/unit/registry.test.ts tests/unit/ssr.test.ts
pnpm test:coverage   # per-file thresholds: 80% lines, 80% functions, 70% branches
pnpm registry:validate
```

Run the browser file three times in a row to catch flakes. Then update
`registry/ai/upstream.lock.json` for the item, open `/preview/<name>` in `pnpm dev` and look
at it in both themes, and update the divergence list and the resolution table in
`docs/architecture.md` §3 if the behaviour or the decision for the item changed.

## Do not port

`message`, `conversation`, `attachments`, `shimmer`, `loader`. shadcn ships these. From
`message`, port only `MessageResponse` (as `response`) and `MessageBranch*` (as `branch`);
both are locked against upstream `message.json`, so a change to upstream `message.tsx`
means re-checking both items.
