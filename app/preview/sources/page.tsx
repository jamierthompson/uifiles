import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/registry/ai/sources"

export const metadata: Metadata = { title: "Sources" }

const sources = [
  {
    href: "https://ai-sdk.dev/docs/ai-sdk-ui/chatbot",
    title: "AI SDK UI: Chatbot",
  },
  {
    href: "https://base-ui.com/react/components/collapsible",
    title: "Base UI: Collapsible",
  },
  {
    href: "https://ui.shadcn.com/docs/registry",
    title: "shadcn/ui: Registry",
  },
  // No title: the link is labeled with its hostname.
  { href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a" },
]

export default function SourcesPreview() {
  return (
    <Demo
      description="Collapsed by default; the trigger reveals the links the answer drew on. A source without a title is labelled with its hostname."
      title="Under an answer"
    >
      <div>
        <p className="mb-4 text-sm">
          The AI SDK UI package ships a <code>useChat</code> hook that streams
          assistant messages into React state, and shadcn registries can host
          the components that render them.
        </p>
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source
                href={source.href}
                key={source.href}
                title={source.title}
              />
            ))}
          </SourcesContent>
        </Sources>
      </div>
    </Demo>
  )
}
