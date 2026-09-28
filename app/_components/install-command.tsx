import { cn } from "cn"
import { CopyButton } from "./copy-button"

/**
 * A shell command with a copy button. The command wraps at phone width
 * instead of scrolling sideways: a scroll region would need a tab stop to be
 * keyboard reachable (WCAG 2.1.1), and a soft-wrapped command still copies as
 * one line.
 */
function InstallCommand({
  command,
  label,
  className,
}: {
  command: string
  /** The copy button's accessible name. */
  label: string
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-muted/50 py-1.5 pr-1.5 pl-3",
        className
      )}
      data-slot="install-command"
    >
      <pre className="min-w-0 flex-1 font-mono text-[0.8125rem] leading-relaxed break-words whitespace-pre-wrap">
        {command}
      </pre>
      <CopyButton label={label} text={command} />
    </div>
  )
}

export { InstallCommand }
