import type { LanguageModelUsage } from "ai"
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/registry/ai/context"

const MAX_TOKENS = 200_000
const MODEL_ID = "openai:gpt-4o"

function usageFor({
  input,
  output,
  reasoning,
  cached,
}: {
  input: number
  output: number
  reasoning: number
  cached: number
}): LanguageModelUsage {
  return {
    inputTokens: input,
    inputTokenDetails: {
      noCacheTokens: input - cached,
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
    },
    outputTokens: output,
    outputTokenDetails: {
      textTokens: output - reasoning,
      reasoningTokens: reasoning,
    },
    totalTokens: input + output,
  }
}

const scenarios = [
  {
    label: "40% of the window",
    usedTokens: 80_000,
    usage: usageFor({
      input: 62_000,
      output: 18_000,
      reasoning: 6_000,
      cached: 20_000,
    }),
  },
  {
    label: "95% of the window",
    usedTokens: 190_000,
    usage: usageFor({
      input: 150_000,
      output: 40_000,
      reasoning: 12_000,
      cached: 90_000,
    }),
  },
]

export default function ContextPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Context</h1>
      <p className="text-sm text-muted-foreground">
        Hover the percentage to see token usage and estimated cost for the
        current model.
      </p>
      <div className="flex flex-col gap-4">
        {scenarios.map((scenario) => (
          <div
            className="flex items-center justify-between rounded-xl border p-4"
            key={scenario.label}
          >
            <span className="text-sm">{scenario.label}</span>
            <Context
              maxTokens={MAX_TOKENS}
              modelId={MODEL_ID}
              usage={scenario.usage}
              usedTokens={scenario.usedTokens}
            >
              <ContextTrigger />
              <ContextContent>
                <ContextContentHeader />
                <ContextContentBody>
                  <div className="space-y-2">
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </div>
                </ContextContentBody>
                <ContextContentFooter />
              </ContextContent>
            </Context>
          </div>
        ))}
      </div>
    </>
  )
}
