# uifiles

Sets a project up for the [`@uifiles`](https://uifiles.dev) shadcn registry: every shadcn/ui
primitive on Base UI under one namespace, AI chat and agent components ported from Vercel AI
Elements, and a `chat` block.

```bash
pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json   # config, tokens, fonts
pnpm dlx uifiles@latest init                                    # registers @uifiles in components.json
pnpm dlx shadcn@latest add @uifiles/button @uifiles/prompt-input
```

`uifiles init` adds `"@uifiles": "https://uifiles.dev/r/{name}.json"` to the `registries` of
`components.json`. Without it the shadcn CLI stops at `Unknown registry "@uifiles"`, because
it resolves a namespace through `components.json` or the shadcn registry directory, and the
directory does not list `uifiles` yet. The command keeps the file's other keys, indentation
and final newline, and does nothing when the entry is already there.

| Option           | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `--cwd <dir>`    | The directory that holds `components.json` (default: the current one)   |
| `--url <origin>` | The origin the registry is served from (default: `https://uifiles.dev`) |
| `--force`        | Replace an existing `@uifiles` entry that points elsewhere              |

Exit code 1 when `components.json` is missing (the message names the `shadcn init` command
that creates it), is not a JSON object, or has a `registries` value that is not an object.
Node 20 or later; no dependencies.

Source and issues: [jamiethompsondesign/uifiles](https://github.com/jamiethompsondesign/uifiles),
under `packages/uifiles`. MIT.
