---
paths:
  - "registry/**"
  - "registry.json"
---

# Registry rules (loaded when touching registry files)

- Validate before you finish: `pnpm registry:validate`, then `pnpm registry:build`.
- `registry/ui/registry.json` and the `cssVars` of `registry/base` are generated. To change
  tokens edit `app/globals.css`; to fork a primitive add `files` to its entry and keep the name.
- Item `files[].path` is relative to the `registry.json` that declares it. Targets are plain
  project-relative paths (`components/ai/<name>.tsx`, `app/chat/page.tsx`); use `~/` only for
  project-root files such as `~/AGENTS.md`.
- Block sources nest as `registry/blocks/<block>/{components,lib,hooks}/...` so the CLI's
  import rewrite (`@/registry/<x>/components/...` → components alias, `/lib/` → lib alias)
  lands them where their targets say. A flat `registry/blocks/<block>/<file>` would land in
  `components/<block>/`.
- Cross-item dependencies inside this registry are `@uifiles/<name>`, never relative imports
  across items and never absolute URLs.
- Ported AI Elements files start with the two-line header in
  `docs/porting-ai-elements.md` §1 (upstream file, Apache-2.0, what was modified).
- After adding an item, check `pnpm dev` → `/` lists it with a useful description, and
  `/llms.txt` includes it.
