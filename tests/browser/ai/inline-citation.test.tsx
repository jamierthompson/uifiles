import axe from "axe-core"
import { expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
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
import "@/app/globals.css"

// Wait for enter animations so axe measures final colors, not mid-fade frames.
const settle = () =>
  Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))

const sources = [
  {
    url: "https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data",
    title: "Streaming custom data",
    description: "Stream typed data parts alongside text.",
  },
  {
    url: "https://react.dev/reference/react/useTransition",
    title: "useTransition",
    description: "Keep the UI responsive during expensive updates.",
  },
]

it("opens the source card on hover and pages through sources", async () => {
  const screen = await render(
    <main>
      <h1>Inline citations</h1>
      <p>
        <InlineCitation>
          <InlineCitationText>
            Streaming responses render progressively
          </InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger sources={sources.map((s) => s.url)} />
            <InlineCitationCardBody>
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <InlineCitationCarouselPrev />
                  <InlineCitationCarouselNext />
                  <InlineCitationCarouselIndex />
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  {sources.map((source) => (
                    <InlineCitationCarouselItem key={source.url}>
                      <InlineCitationSource
                        description={source.description}
                        title={source.title}
                        url={source.url}
                      />
                      <InlineCitationQuote>Quoted passage.</InlineCitationQuote>
                    </InlineCitationCarouselItem>
                  ))}
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
      </p>
    </main>
  )

  const badge = screen.getByText("ai-sdk.dev +1")
  await expect.element(badge).toBeVisible()
  await expect
    .element(page.getByText("Streaming custom data"))
    .not.toBeInTheDocument()

  await userEvent.hover(badge)

  await expect.element(page.getByText("Streaming custom data")).toBeVisible()
  await expect.element(page.getByText("1/2")).toBeVisible()

  await userEvent.click(page.getByRole("button", { name: "Next" }))
  await expect.element(page.getByText("2/2")).toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})
