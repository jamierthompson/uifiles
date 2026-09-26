# Porting an AI Elements component to uifiles

This is the checklist for every file under `registry/ai/`. Upstream is Radix-only; uifiles is
Base UI. The goal is the same public API (same export names, same props) on Base UI
primitives, with dependencies re-pointed at this registry. When the API must change, it is
documented in the item's `docs` field.

## 0. Inputs

- Upstream source for each item: `https://elements.ai-sdk.dev/api/registry/<name>.json`
  (`files[0].content`). `registry/ai/upstream.lock.json` records the sha256 of the source each
  port was made from; update it when you port or re-port.
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

Keep the `"use client"` directive if upstream has it.

### Imports

| Upstream                                            | uifiles                                                                                                                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/registry/default/ui/<x>`                         | `@/components/ui/<x>` (the CLI rewrites this to the consumer's `ui` alias)                                                                                                                           |
| `@/lib/utils` (`cn`)                                | `import { cn } from "cn"`                                                                                                                                                                            |
| `./code-block`, `./tool` (sibling AI Elements item) | keep relative `./<name>`; add `"@uifiles/<name>"` to `registryDependencies`                                                                                                                          |
| `./shimmer` (`<Shimmer>` component)                 | delete; use shadcn's `shimmer` class from `shadcn/tailwind.css`: `<span className="shimmer">…</span>`                                                                                                |
| `@radix-ui/react-use-controllable-state`            | delete; implement with `useState` + a controlled/uncontrolled pattern (see below), or Base UI's `useControlled` from `@base-ui/react/utils` if it is exported in the installed version (check first) |

Controlled/uncontrolled replacement:

```tsx
const [uncontrolled, setUncontrolled] = useState(defaultOpen ?? false)
const isControlled = open !== undefined
const value = isControlled ? open : uncontrolled
const setValue = useCallback(
  (next: boolean) => {
    if (!isControlled) setUncontrolled(next)
    onOpenChange?.(next)
  },
  [isControlled, onOpenChange]
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
| `<Button asChild><a/></Button>`                          | `<Button render={<a />} />` (Base UI Button; see `nativeButton` in `components/ui/button.tsx`)                                                       |

Anything else Radix-specific that you find: fix it and list it in the item's `docs`.

### Everything else

- Keep export names and prop names identical to upstream unless Base UI makes that
  impossible. Never rename to "improve" it; that is a separate decision.
- Keep upstream's Tailwind classes, but semantic tokens only (`bg-muted`, not `bg-zinc-100`).
- `lucide-react` icons stay.
- Types from `ai` stay (`ai@7` is installed; if a type no longer exists, find its v7 name in
  `node_modules/ai/dist/index.d.ts` and note it in `docs`).

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
realistic state with static sample data. Use `app/preview/` siblings as examples. The page
exists so people and agents can look at the port (`pnpm dev` → `/preview/<name>`) and so
Playwright can screenshot it later.

## 4. Browser test

`tests/browser/ai/<name>.test.tsx`, following `tests/browser/button.test.tsx`: render the
main composition, assert something visible by role or text, run `axe.run(document.body)` and
expect zero violations. Wrap the fixture in `<main>` (axe's `region` rule needs a landmark
and the test page has none), and await enter animations before `axe.run`
so axe does not sample mid-fade colors:

````ts
await Promise.all(
  document
    .getAnimations()
    .filter((a) => a.timeline === document.timeline) // scroll-driven ones never finish
    .map((a) => a.finished),
)
``` If the component needs interaction (open a collapsible, open a menu),
do it with `userEvent` from `vitest/browser` and assert the result. Import `@/app/globals.css`.

## 5. Verify

```bash
pnpm exec tsc --noEmit
pnpm exec biome check registry/ai/<name>.tsx app/preview/<name> tests/browser/ai/<name>.test.tsx
pnpm exec vitest run --project browser tests/browser/ai/<name>.test.tsx
pnpm registry:validate
````

Then update `registry/ai/upstream.lock.json` for the item and add it to `docs/plan.md` §5 if
the resolution changed.

## Do not port

`message`, `conversation`, `attachments`, `shimmer`, `loader`. shadcn ships these. From
`message`, port only `MessageResponse` (as `response`) and `MessageBranch*` (as `branch`).
