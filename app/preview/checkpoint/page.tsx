import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import { Message, MessageContent } from "@/components/ui/message"
import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/registry/ai/checkpoint"

export const metadata: Metadata = { title: "Checkpoint" }

const turns = [
  {
    id: "turn-1",
    user: "Set up a Drizzle schema for users with a theme preference.",
    assistant:
      "Added db/schema.ts with a users table and a theme enum column, plus the first migration.",
  },
  {
    id: "turn-2",
    user: "Now expose it through a settings route.",
    assistant:
      "Created app/api/settings/route.ts with a PATCH handler that validates the theme value before writing.",
  },
]

export default function CheckpointPreview() {
  return (
    <Demo
      description="A checkpoint after each assistant turn. The button carries a tooltip and restores the workspace to that point."
      title="Between turns"
    >
      <div className="flex flex-col gap-4">
        {turns.map((turn, index) => (
          <div className="flex flex-col gap-4" key={turn.id}>
            <Message align="end">
              <MessageContent>
                <p className="rounded-lg bg-muted px-3 py-2">{turn.user}</p>
              </MessageContent>
            </Message>
            <Message>
              <MessageContent>
                <p>{turn.assistant}</p>
              </MessageContent>
            </Message>
            <Checkpoint>
              <CheckpointIcon />
              <CheckpointTrigger tooltip="Restore the workspace to this point">
                Checkpoint {index + 1}
              </CheckpointTrigger>
            </Checkpoint>
          </div>
        ))}
      </div>
    </Demo>
  )
}
