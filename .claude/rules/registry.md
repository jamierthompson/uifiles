---
paths:
  - "registry/**"
  - "registry.json"
---

# Registry rules (loaded when touching registry files)

- Validate before you finish: `pnpm registry:validate`, then `pnpm registry:build`.
- `registry/ui/registry.json` and the `cssVars` of `registry/base` are generated. To change
  tokens edit `app/globals.css`; to fork a primitive add `files` to its entry and keep the name.
- Item `files[].path` is relative to the `registry.json` that declares it. Targets use
  `@ui/`, `@components/`, `@lib/`, `@hooks/` placeholders or `~/` for project root.
- Cross-item dependencies inside this registry are `@uifiles/<name>`, never relative imports
  across items and never absolute URLs.
- Ported AI Elements files start with:
  `// Derived from Vercel AI Elements (Apache-2.0, Copyright 2023 Vercel, Inc.). Modified for Base UI.`
- After adding an item, check `pnpm dev` → `/` lists it with a useful description, and
  `/llms.txt` includes it.
