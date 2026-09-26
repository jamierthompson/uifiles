import { CheckIcon, ListTodoIcon, MessageSquareIcon, XIcon } from "lucide-react"
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemAttachment,
  QueueItemContent,
  QueueItemDescription,
  QueueItemFile,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
  type QueueTodo,
} from "@/registry/ai/queue"

const todos: QueueTodo[] = [
  {
    id: "todo-1",
    title: "Add the theme column migration",
    description: "drizzle/0004_theme.sql",
    status: "completed",
  },
  {
    id: "todo-2",
    title: "Validate the settings payload",
    description: "app/api/settings/route.ts",
    status: "pending",
  },
  {
    id: "todo-3",
    title: "Wire the settings form to the route",
    status: "pending",
  },
]

const queued = [
  {
    id: "msg-1",
    text: "Also update the README with the new setting",
    files: [] as string[],
  },
  {
    id: "msg-2",
    text: "Use this mockup for the settings page layout",
    files: ["settings-mockup.png", "tokens.json"],
  },
]

export default function QueuePreview() {
  const pending = todos.filter((todo) => todo.status !== "completed")

  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Queue</h1>
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel
              count={pending.length}
              icon={<ListTodoIcon className="size-4" />}
              label="tasks"
            />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {todos.map((todo) => {
                const completed = todo.status === "completed"
                return (
                  <QueueItem key={todo.id}>
                    <div className="flex items-start gap-2">
                      <QueueItemIndicator completed={completed} />
                      <QueueItemContent completed={completed}>
                        {todo.title}
                      </QueueItemContent>
                      <QueueItemActions>
                        <QueueItemAction aria-label="Mark complete">
                          <CheckIcon className="size-3.5" />
                        </QueueItemAction>
                        <QueueItemAction aria-label="Remove task">
                          <XIcon className="size-3.5" />
                        </QueueItemAction>
                      </QueueItemActions>
                    </div>
                    {todo.description && (
                      <QueueItemDescription completed={completed}>
                        {todo.description}
                      </QueueItemDescription>
                    )}
                  </QueueItem>
                )
              })}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>

        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel
              count={queued.length}
              icon={<MessageSquareIcon className="size-4" />}
              label="queued messages"
            />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {queued.map((message) => (
                <QueueItem key={message.id}>
                  <div className="flex items-start gap-2">
                    <QueueItemIndicator />
                    <QueueItemContent>{message.text}</QueueItemContent>
                    <QueueItemActions>
                      <QueueItemAction aria-label="Send now">
                        <CheckIcon className="size-3.5" />
                      </QueueItemAction>
                      <QueueItemAction aria-label="Remove message">
                        <XIcon className="size-3.5" />
                      </QueueItemAction>
                    </QueueItemActions>
                  </div>
                  {message.files.length > 0 && (
                    <QueueItemAttachment className="ml-6">
                      {message.files.map((file) => (
                        <QueueItemFile key={file}>{file}</QueueItemFile>
                      ))}
                    </QueueItemAttachment>
                  )}
                </QueueItem>
              ))}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    </>
  )
}
