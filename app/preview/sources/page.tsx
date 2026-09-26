import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/registry/ai/sources"

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
]

export default function SourcesPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Sources</h1>
      <p className="text-sm text-muted-foreground">
        Collapsed by default; the trigger reveals the links the answer drew on.
      </p>
      <div className="rounded-xl border p-4">
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
    </>
  )
}
