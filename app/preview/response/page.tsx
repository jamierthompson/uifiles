import { MessageResponse } from "@/registry/ai/response"

const markdown = `## Choosing a cache strategy

Streamed markdown renders **incrementally** as tokens arrive, including *incomplete* fences and tables.

\`\`\`ts
export async function getUser(id: string) {
  const res = await fetch(\`/api/users/\${id}\`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error("Failed to load user")
  return res.json() as Promise<{ id: string; name: string }>
}
\`\`\`

| Strategy | Freshness | Cost |
| --- | --- | --- |
| \`no-store\` | Always fresh | Highest |
| \`revalidate: 60\` | Up to 60s stale | Low |
| \`force-cache\` | Until redeploy | Lowest |

For a cache hit rate of *h*, the effective cost per request is:

$$
c_{\\text{eff}} = h \\cdot c_{\\text{hit}} + (1 - h) \\cdot c_{\\text{miss}}
$$

Tip: keep the chunk size small so partial output paints early.
`

export default function ResponsePreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">response</h1>
      <div className="rounded-lg border p-4 text-sm">
        <MessageResponse>{markdown}</MessageResponse>
      </div>
    </>
  )
}
