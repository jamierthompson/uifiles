"use client"

import { useState } from "react"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockLanguageSelector,
  CodeBlockLanguageSelectorContent,
  CodeBlockLanguageSelectorItem,
  CodeBlockLanguageSelectorTrigger,
  CodeBlockLanguageSelectorValue,
  CodeBlockTitle,
} from "@/registry/ai/code-block"

const samples = {
  typescript: {
    filename: "use-debounce.ts",
    code: `import { useEffect, useState } from "react"

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}`,
  },
  javascript: {
    filename: "use-debounce.js",
    code: `import { useEffect, useState } from "react"

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}`,
  },
  python: {
    filename: "debounce.py",
    code: `import threading


def debounce(wait: float):
    def decorator(fn):
        timer: threading.Timer | None = None

        def wrapper(*args, **kwargs):
            nonlocal timer
            if timer is not None:
                timer.cancel()
            timer = threading.Timer(wait, fn, args, kwargs)
            timer.start()

        return wrapper

    return decorator`,
  },
} as const

type Language = keyof typeof samples

const languageLabels: Record<Language, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
}

export default function CodeBlockPreview() {
  const [language, setLanguage] = useState<Language>("typescript")
  const sample = samples[language]

  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Code Block</h1>
      <CodeBlock code={sample.code} language={language} showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>{sample.filename}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockLanguageSelector
              items={languageLabels}
              onValueChange={(value) => {
                if (value) setLanguage(value as Language)
              }}
              value={language}
            >
              <CodeBlockLanguageSelectorTrigger aria-label="Language">
                <CodeBlockLanguageSelectorValue />
              </CodeBlockLanguageSelectorTrigger>
              <CodeBlockLanguageSelectorContent>
                {(Object.keys(languageLabels) as Language[]).map((key) => (
                  <CodeBlockLanguageSelectorItem key={key} value={key}>
                    {languageLabels[key]}
                  </CodeBlockLanguageSelectorItem>
                ))}
              </CodeBlockLanguageSelectorContent>
            </CodeBlockLanguageSelector>
            <CodeBlockCopyButton aria-label="Copy code" />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
      <h2 className="font-heading text-lg font-semibold">Without header</h2>
      <CodeBlock
        code={`{ "city": "Melbourne", "unit": "celsius" }`}
        language="json"
      />
    </>
  )
}
