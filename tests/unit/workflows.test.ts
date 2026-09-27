import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

type Step = {
  name?: string
  id?: string
  run?: string
  uses?: string
  if?: string
  shell?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
  "continue-on-error"?: boolean
}

type Job = {
  "timeout-minutes"?: number
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  steps: Step[]
}

type Workflow = {
  permissions?: Record<string, string>
  concurrency?: { group?: string; "cancel-in-progress"?: boolean }
  env?: Record<string, unknown>
  jobs: Record<string, Job>
}

function workflow(path: string): { text: string; doc: Workflow } {
  const text = read(path)
  return { text, doc: parse(text) as Workflow }
}

const jobs = (doc: Workflow) => Object.values(doc.jobs)
const steps = (doc: Workflow) => jobs(doc).flatMap((job) => job.steps)

/** Index of the first step whose `run` or `name` contains `needle`. */
function stepIndex(list: Step[], needle: string): number {
  const index = list.findIndex(
    (step) => step.run?.includes(needle) || step.name?.includes(needle)
  )
  expect(index, `step "${needle}"`).toBeGreaterThanOrEqual(0)
  return index
}

/**
 * The `uses:` refs that are not a full commit SHA with the version tag as a
 * comment. Dependabot rewrites the comment to the most specific tag of the
 * new SHA (`# v5` becomes `# v5.0.1` on the first bump), so a major, a
 * minor and a patch tag are all accepted. Comments do not survive parsing,
 * so this one check reads the text.
 */
function unpinnedActions(text: string, doc: Workflow): string[] {
  return steps(doc)
    .map((step) => step.uses)
    .filter((ref): ref is string => ref !== undefined)
    .filter(
      (ref) =>
        !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(ref) ||
        !new RegExp(
          `^\\s*(?:- )?uses: ${ref.replace(/[.]/g, "\\.")} # v\\d+(?:\\.\\d+){0,2}\\s*$`,
          "m"
        ).test(text)
    )
}

function expectPinnedActions(text: string, doc: Workflow) {
  expect(steps(doc).some((step) => step.uses)).toBe(true)
  expect(unpinnedActions(text, doc)).toEqual([])
}

describe("the SHA-pin check", () => {
  const sha = "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"
  const check = (line: string) => {
    const text = `jobs:\n  gate:\n    steps:\n      - uses: ${line}\n`
    return unpinnedActions(text, parse(text) as Workflow)
  }

  it("accepts the tag comment Dependabot writes: a major, or the most specific version such as # v5.0.1", () => {
    for (const comment of ["v5", "v5.0", "v5.0.1", "v12.3.45"]) {
      expect(check(`actions/checkout@${sha} # ${comment}`), comment).toEqual([])
    }
  })

  it("rejects a ref without a SHA, a missing comment, and a comment that is not a version tag", () => {
    for (const line of [
      "actions/checkout@v5 # v5",
      `actions/checkout@${sha}`,
      `actions/checkout@${sha} # 5`,
      `actions/checkout@${sha} # v5.0.1.2`,
      `actions/checkout@${sha} # latest`,
      `actions/checkout@${sha.slice(0, 7)} # v5`,
    ]) {
      expect(check(line), line).toHaveLength(1)
    }
  })
})

describe(".github/workflows/ci.yml", () => {
  const { text, doc } = workflow(".github/workflows/ci.yml")
  const gate = doc.jobs.gate
  if (!gate) throw new Error("ci.yml has no gate job")
  const list = gate.steps

  it("grants the token read-only contents and nothing else, at the workflow level only", () => {
    expect(doc.permissions).toEqual({ contents: "read" })
    for (const job of jobs(doc)) expect(job.permissions).toBeUndefined()
  })

  it("cancels superseded runs per ref and bounds the job", () => {
    expect(doc.concurrency).toEqual({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template
      group: "ci-${{ github.ref }}",
      "cancel-in-progress": true,
    })
    expect(gate["timeout-minutes"]).toBeGreaterThan(0)
  })

  it("pins every action to a full commit SHA with its version in a comment", () => {
    expect(
      steps(doc).filter((step) => step.uses).length
    ).toBeGreaterThanOrEqual(5)
    expectPinnedActions(text, doc)
  })

  it("builds the registry before the tests, so the built-output checks run instead of skipping", () => {
    expect(stepIndex(list, "pnpm registry:build")).toBeLessThan(
      stepIndex(list, "pnpm test:coverage")
    )
  })

  it("runs coverage, then the build, the generated-files check and e2e against that build, in that order", () => {
    const coverage = stepIndex(list, "pnpm test:coverage")
    const build = stepIndex(list, "pnpm build")
    const diff = stepIndex(list, "git diff --exit-code -- registry")
    const e2e = stepIndex(list, "pnpm test:e2e")
    expect(build).toBeGreaterThan(coverage)
    expect(diff).toBeGreaterThan(build)
    expect(e2e).toBeGreaterThan(diff)
  })

  it("audits production dependencies at the high level, as a hard failure after every test step", () => {
    const audit = list.findIndex(
      (step) => step.run === "pnpm audit --prod --audit-level=high"
    )
    expect(audit).toBeGreaterThan(stepIndex(list, "pnpm test:e2e"))
    expect(list[audit]?.["continue-on-error"]).toBeUndefined()
    expect(list[audit]?.if).toBeUndefined()
  })

  it("sets CI and the public origin for the whole job, so the build and the e2e no-localhost assertions agree", () => {
    expect(doc.env).toMatchObject({
      CI: "true",
      NEXT_PUBLIC_BASE_URL: "https://uifiles.dev",
    })
    for (const job of jobs(doc)) {
      expect(job.env?.NEXT_PUBLIC_BASE_URL).toBeUndefined()
      for (const step of job.steps) {
        expect(
          step.env?.NEXT_PUBLIC_BASE_URL,
          step.run ?? step.name
        ).toBeUndefined()
      }
    }
  })

  it("caches Playwright browsers by the installed Playwright version", () => {
    const version = list.find((step) => step.id === "playwright")
    expect(version?.run).toContain("require('playwright/package.json').version")
    const cache = list.find((step) => step.id === "playwright-cache")
    expect(cache?.uses).toMatch(/^actions\/cache@/)
    expect(cache?.with).toMatchObject({
      path: "~/.cache/ms-playwright",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template
      key: "playwright-${{ runner.os }}-${{ steps.playwright.outputs.version }}",
    })
  })

  it("uploads the Playwright HTML report and traces when a step fails", () => {
    const upload = list.find((step) =>
      step.uses?.startsWith("actions/upload-artifact@")
    )
    expect(upload?.if).toBe("failure()")
    const path = String(upload?.with?.path ?? "")
    expect(path).toContain("playwright-report")
    expect(path).toContain("test-results")
  })
})

describe(".github/workflows/upstream-diff.yml", () => {
  const { text, doc } = workflow(".github/workflows/upstream-diff.yml")
  const list = steps(doc)
  const diff = list.find((step) => step.id === "diff")
  const script = list.find((step) =>
    step.uses?.startsWith("actions/github-script@")
  )

  it("runs the script under bash and captures its exit code without a pipe", () => {
    expect(diff?.shell).toBe("bash")
    const run = diff?.run ?? ""
    expect(run).toMatch(/^set \+e$/m)
    expect(run).toMatch(/^node scripts\/sync-upstream\.ts > diff\.txt 2>&1$/m)
    expect(run).toMatch(/^code=\$\?$/m)
    expect(run).toMatch(/^echo "code=\$code" >> "\$GITHUB_OUTPUT"$/m)
    expect(run).toContain("$GITHUB_STEP_SUMMARY")
  })

  it("files a report only when a source changed (exit 1), never for a missing or unreachable one (exit 2)", () => {
    expect(script?.if).toBe("steps.diff.outputs.code == '1'")
    for (const step of list) {
      expect(step["continue-on-error"]).toBeUndefined()
      expect(step.if ?? "").not.toContain("outcome == 'failure'")
    }
  })

  it("comments on an open `upstream` issue before creating one, and creates the label when missing", () => {
    const body = String(script?.with?.script ?? "")
    const order = [
      "getLabel",
      "createLabel",
      "listForRepo",
      "createComment",
      "issues.create(",
    ]
    const positions = order.map((call) => body.indexOf(call))
    for (const [index, call] of order.entries()) {
      expect(positions[index], call).toBeGreaterThanOrEqual(0)
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(body).toMatch(/labels: label/)
    expect(body).toMatch(/state: 'open'/)
  })

  it("has issues:write, a concurrency group, a timeout and SHA-pinned actions", () => {
    expect(doc.permissions).toEqual({ contents: "read", issues: "write" })
    expect(doc.concurrency?.group).toBe("upstream-diff")
    for (const job of jobs(doc)) {
      expect(job["timeout-minutes"]).toBeGreaterThan(0)
    }
    expectPinnedActions(text, doc)
  })
})

describe(".github/dependabot.yml", () => {
  type Dependabot = {
    version: number
    updates: Array<{
      "package-ecosystem": string
      directory: string
      schedule: { interval: string }
      groups?: Record<
        string,
        { "applies-to"?: string; "update-types"?: string[] }
      >
      ignore?: Array<{ "dependency-name": string; "update-types"?: string[] }>
    }>
  }
  const doc = parse(read(".github/dependabot.yml")) as Dependabot

  it("updates GitHub Actions and npm weekly, grouping npm minor and patch bumps", () => {
    expect(doc.version).toBe(2)
    const by = (ecosystem: string) =>
      doc.updates.find((u) => u["package-ecosystem"] === ecosystem)
    expect(by("github-actions")).toMatchObject({
      directory: "/",
      schedule: { interval: "weekly" },
    })
    const npm = by("npm")
    expect(npm).toMatchObject({
      directory: "/",
      schedule: { interval: "weekly" },
    })
    const groups = Object.values(npm?.groups ?? {})
    expect(groups).toHaveLength(1)
    expect(groups[0]?.["update-types"]).toEqual(["minor", "patch"])
  })

  it("holds @types/node to the runtime major and katex to the minor its renderers use", () => {
    const npm = doc.updates.find((u) => u["package-ecosystem"] === "npm")
    const ignored = (name: string) =>
      npm?.ignore?.find((i) => i["dependency-name"] === name)?.["update-types"]
    expect(ignored("@types/node")).toEqual(["version-update:semver-major"])
    expect(ignored("katex")).toEqual([
      "version-update:semver-major",
      "version-update:semver-minor",
    ])
  })
})
