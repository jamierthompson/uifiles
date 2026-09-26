import { FileCodeIcon } from "lucide-react"
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/registry/ai/task"

const files = ["app/layout.tsx", "app/page.tsx", "components/ui/button.tsx"]

export default function TaskPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Task</h1>
      <Task>
        <TaskTrigger title="Scanning the project for layout files" />
        <TaskContent>
          <TaskItem>Searched for files matching &quot;**/*.tsx&quot;</TaskItem>
          <TaskItem>
            Reading{" "}
            {files.map((file) => (
              <TaskItemFile key={file}>
                <FileCodeIcon className="size-3" />
                <span>{file}</span>
              </TaskItemFile>
            ))}
          </TaskItem>
          <TaskItem>Found 3 files that import the root layout</TaskItem>
        </TaskContent>
      </Task>
      <Task defaultOpen={false}>
        <TaskTrigger title="Checking package.json for the Next.js version" />
        <TaskContent>
          <TaskItem>
            Read <TaskItemFile>package.json</TaskItemFile>
          </TaskItem>
          <TaskItem>next@16.3.6 is installed</TaskItem>
        </TaskContent>
      </Task>
    </>
  )
}
