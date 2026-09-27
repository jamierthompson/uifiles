import type { Metadata } from "next"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/registry/ai/inline-citation"

export const metadata: Metadata = { title: "Inline Citation" }

const streamingSources = [
  {
    url: "https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data",
    title: "Streaming custom data",
    description:
      "The AI SDK lets you stream arbitrary data parts alongside text so the UI can render structured content as it arrives.",
    quote:
      "Data parts are typed, so the client can narrow on `part.type` before rendering.",
  },
  {
    url: "https://react.dev/reference/react/useTransition",
    title: "useTransition",
    description:
      "React transitions keep the UI responsive while expensive state updates, such as appending streamed tokens, are applied.",
    quote: "Transitions let you update state without blocking the UI.",
  },
]

const baseUiSources = [
  {
    url: "https://base-ui.com/react/components/preview-card",
    title: "Preview Card",
    description:
      "Base UI's Preview Card opens a popup on hover or focus of a link. Delays live on the trigger rather than the root.",
    quote: "A popup that appears when a link is hovered, showing a preview.",
  },
]

export default function InlineCitationPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Inline Citation</h1>
      <p className="text-sm text-muted-foreground">
        Hover or focus a citation badge to peek at the source card; click, tap
        or press Enter to pin it and move focus inside, where Tab reaches the
        arrows that page through multiple sources and Escape closes it.
      </p>
      <div className="rounded-xl border p-4 text-sm leading-7">
        <p>
          <InlineCitation>
            <InlineCitationText>
              Streaming responses render progressively, so the first token
              appears long before the model has finished
            </InlineCitationText>
            <InlineCitationCard>
              <InlineCitationCardTrigger
                sources={streamingSources.map((source) => source.url)}
              />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselNext />
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    {streamingSources.map((source) => (
                      <InlineCitationCarouselItem key={source.url}>
                        <InlineCitationSource
                          description={source.description}
                          title={source.title}
                          url={source.url}
                        />
                        <InlineCitationQuote>
                          {source.quote}
                        </InlineCitationQuote>
                      </InlineCitationCarouselItem>
                    ))}
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
          . The hover cards in this registry are built on{" "}
          <InlineCitation>
            <InlineCitationText>Base UI's Preview Card</InlineCitationText>
            <InlineCitationCard>
              <InlineCitationCardTrigger
                sources={baseUiSources.map((source) => source.url)}
              />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    {baseUiSources.map((source) => (
                      <InlineCitationCarouselItem key={source.url}>
                        <InlineCitationSource
                          description={source.description}
                          title={source.title}
                          url={source.url}
                        />
                        <InlineCitationQuote>
                          {source.quote}
                        </InlineCitationQuote>
                      </InlineCitationCarouselItem>
                    ))}
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
          , which places open and close delays on the trigger.
        </p>
      </div>
    </>
  )
}
