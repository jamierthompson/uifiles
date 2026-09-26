import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/registry/ai/tool"

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
      <h1 className="font-heading text-xl font-semibold">Tool</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">input-streaming</h2>
        <Tool>
          <ToolHeader state="input-streaming" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={{ city: "Melb" }} />
          </ToolContent>
        </Tool>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">input-available</h2>
        <Tool>
          <ToolHeader state="input-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
          </ToolContent>
        </Tool>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">output-available</h2>
        <Tool defaultOpen>
          <ToolHeader state="output-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput errorText={undefined} output={output} />
          </ToolContent>
        </Tool>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">output-error</h2>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">
          dynamic-tool, custom title
        </h2>
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
      </section>
    </>
  )
}
