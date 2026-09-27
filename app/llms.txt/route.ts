import { baseUrl, groupByType, loadRegistry, TYPE_LABELS } from "@/lib/registry"

export const dynamic = "force-static"

export function GET() {
  const registry = loadRegistry()
  const origin = baseUrl()
  const lines = [
    "# uifiles",
    "",
    "> uifiles is a shadcn/ui registry on Base UI: every shadcn/ui primitive under the @uifiles namespace, AI chat and agent components ported from Vercel AI Elements, and a registry:base item carrying the design tokens. Install with the shadcn CLI; components are copied into your project as source.",
    "",
    "## Install",
    "",
    `- [Design system base](${origin}/r/base.json): \`pnpm dlx shadcn@latest init ${origin}/r/base.json\` sets up a project with the uifiles config, tokens and fonts.`,
    `- [Registry index](${origin}/r/registry.json): the catalog the shadcn CLI and MCP server read. Add items with \`pnpm dlx shadcn@latest add @uifiles/<name>\`.`,
    "- [Skill](https://github.com/jamiethompsondesign/uifiles/tree/main/skills/uifiles): `pnpm dlx skills add jamiethompsondesign/uifiles` gives coding agents the workflow and rules.",
    "",
  ]
  for (const [type, items] of groupByType(registry.items)) {
    lines.push(`## ${TYPE_LABELS[type] ?? type}`, "")
    for (const item of items) {
      lines.push(
        `- [${item.title ?? item.name}](${origin}/r/${item.name}.json): ${item.description ?? ""}`
      )
    }
    lines.push("")
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
