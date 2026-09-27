import type { Metadata } from "next"
import { CodeBlockDemo } from "./code-block-demo"

export const metadata: Metadata = { title: "Code Block" }

export default function CodeBlockPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Code Block</h1>
      <CodeBlockDemo />
    </>
  )
}
