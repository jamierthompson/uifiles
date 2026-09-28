import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/registry/ai/tool"

export const metadata: Metadata = { title: "Tool" }

const input = { city: "Melbourne", unit: "celsius" }

const output = {
  city: "Melbourne",
  temperature: 18,
  unit: "celsius",
  conditions: "Partly cloudy",
  humidity: 62,
}

export default function ToolPreview() {
  return (
    <>
      <Demo
        description={
          <>
            <code>input-streaming</code>: nothing has arrived yet, so the input
            area shows a placeholder.
          </>
        }
        title="Waiting for input"
      >
        <Tool defaultOpen>
          <ToolHeader state="input-streaming" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={undefined} />
          </ToolContent>
        </Tool>
      </Demo>

      <Demo
        description={
          <>
            <code>input-streaming</code>: the arguments so far, updated as they
            stream.
          </>
        }
        title="Input streaming"
      >
        <Tool>
          <ToolHeader state="input-streaming" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={{ city: "Melb" }} />
          </ToolContent>
        </Tool>
      </Demo>

      <Demo
        description={
          <>
            <code>input-available</code>: the call is ready and has not returned
            yet.
          </>
        }
        title="Input complete"
      >
        <Tool>
          <ToolHeader state="input-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
          </ToolContent>
        </Tool>
      </Demo>

      <Demo
        description={
          <>
            <code>output-available</code>: input and the result, both as
            formatted JSON.
          </>
        }
        title="Output available"
      >
        <Tool defaultOpen>
          <ToolHeader state="output-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput errorText={undefined} output={output} />
          </ToolContent>
        </Tool>
      </Demo>

      <Demo
        description={
          <>
            <code>output-error</code>: the error text in place of a result.
          </>
        }
        title="Output error"
      >
        <Tool defaultOpen>
          <ToolHeader state="output-error" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput
              errorText="Upstream weather service returned 503 Service Unavailable"
              output={undefined}
            />
          </ToolContent>
        </Tool>
      </Demo>

      <Demo
        description={
          <>
            <code>approval-requested</code>: a dynamic-tool part named by its
            toolName and a title of its own.
          </>
        }
        title="Dynamic tool, custom title"
      >
        <Tool>
          <ToolHeader
            state="approval-requested"
            title="Search the web"
            toolName="web_search"
            type="dynamic-tool"
          />
          <ToolContent>
            <ToolInput input={{ query: "Base UI collapsible" }} />
          </ToolContent>
        </Tool>
      </Demo>
    </>
  )
}
