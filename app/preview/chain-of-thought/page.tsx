"use client"

import { ImageIcon, SearchIcon, WrenchIcon } from "lucide-react"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/registry/ai/chain-of-thought"

function LatencyChart() {
  return (
    <svg
      aria-label="Bar chart of p95 latency by region: iad 120ms, sfo 180ms, fra 240ms, syd 310ms"
      className="h-40 w-full max-w-md text-muted-foreground"
      role="img"
      viewBox="0 0 320 160"
    >
      <title>p95 latency by region</title>
      <line stroke="currentColor" x1="40" x2="40" y1="10" y2="130" />
      <line stroke="currentColor" x1="40" x2="310" y1="130" y2="130" />
      {[
        ["iad", 120],
        ["sfo", 180],
        ["fra", 240],
        ["syd", 310],
      ].map(([label, value], i) => {
        const height = (Number(value) / 320) * 110
        const x = 60 + i * 65
        return (
          <g key={String(label)}>
            <rect
              className="fill-primary"
              height={height}
              rx="3"
              width="36"
              x={x}
              y={130 - height}
            />
            <text
              className="fill-current text-[11px]"
              textAnchor="middle"
              x={x + 18}
              y="148"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ChainOfThoughtPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Chain of Thought</h1>
      <div className="rounded-lg border p-4">
        <ChainOfThought defaultOpen>
          <ChainOfThoughtHeader>
            Investigating slow checkout
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <ChainOfThoughtStep
              description="Looking for recent reports of checkout latency."
              icon={SearchIcon}
              label="Searching incident history"
              status="complete"
            >
              <ChainOfThoughtSearchResults>
                <ChainOfThoughtSearchResult>
                  INC-2291 checkout p95 regression
                </ChainOfThoughtSearchResult>
                <ChainOfThoughtSearchResult>
                  runbook: edge cache misses
                </ChainOfThoughtSearchResult>
                <ChainOfThoughtSearchResult>
                  PR #4410 pricing service
                </ChainOfThoughtSearchResult>
              </ChainOfThoughtSearchResults>
            </ChainOfThoughtStep>
            <ChainOfThoughtStep
              description="Pulled p95 by region for the last hour."
              icon={ImageIcon}
              label="Comparing latency across regions"
              status="complete"
            >
              <ChainOfThoughtImage caption="p95 latency by region, last 60 minutes">
                <LatencyChart />
              </ChainOfThoughtImage>
            </ChainOfThoughtStep>
            <ChainOfThoughtStep
              description="syd and fra are 2-3x slower; both route pricing calls cross-region."
              icon={WrenchIcon}
              label="Checking the pricing service deployment"
              status="active"
            />
            <ChainOfThoughtStep label="Proposing a fix" status="pending" />
          </ChainOfThoughtContent>
        </ChainOfThought>
      </div>
    </>
  )
}
