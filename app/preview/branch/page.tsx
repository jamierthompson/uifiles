import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import {
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
} from "@/registry/ai/branch"
import { MessageResponse } from "@/registry/ai/response"

export const metadata: Metadata = { title: "Message Branch" }

const branches = [
  {
    id: "concise",
    text: "Use `revalidate: 60` on the fetch. It keeps the page fast and the data no more than a minute stale.",
  },
  {
    id: "detailed",
    text: "You have three options:\n\n1. **`no-store`** for data that must always be fresh.\n2. **`revalidate: 60`** for dashboards that tolerate a minute of staleness.\n3. **`force-cache`** for static reference data.\n\nFor a user profile, option 2 is the usual choice.",
  },
  {
    id: "code",
    text: "```ts\nconst res = await fetch(url, { next: { revalidate: 60 } })\n```\n\nThis regenerates in the background at most once per minute.",
  },
]

export default function BranchPreview() {
  return (
    <Demo
      description="Arrow through the regenerations of one assistant turn; the selector shows which of the three is on screen."
      title="Three alternative responses"
    >
      <MessageBranch defaultBranch={0}>
        <MessageBranchContent>
          {branches.map((branch) => (
            <div className="rounded-lg border p-4 text-sm" key={branch.id}>
              <MessageResponse>{branch.text}</MessageResponse>
            </div>
          ))}
        </MessageBranchContent>
        <MessageBranchSelector>
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      </MessageBranch>
    </Demo>
  )
}
