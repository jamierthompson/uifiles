import type { Metadata } from "next"
import { MessageResponse } from "@/registry/ai/response"

export const metadata: Metadata = { title: "Message Response" }

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

A regularised logistic loss is wider than a phone, so it scrolls on its own instead of widening the page:

$$
\\mathcal{L}(\\theta) = -\\frac{1}{n} \\sum_{i=1}^{n} \\left[ y_i \\log \\sigma(\\theta^\\top x_i) + (1 - y_i) \\log\\left(1 - \\sigma(\\theta^\\top x_i)\\right) \\right] + \\lambda \\lVert \\theta \\rVert_2^2
$$

Tip: keep the chunk size small so partial output paints early. Links such as the [Next.js caching guide](https://nextjs.org/docs/app/guides/caching) ask before they open.
`

export default function ResponsePreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Message Response</h1>
      <div className="rounded-lg border p-4 text-sm">
        <MessageResponse>{markdown}</MessageResponse>
      </div>
    </>
  )
}
