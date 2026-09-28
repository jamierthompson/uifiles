#!/usr/bin/env node
// The `uifiles` command. `uifiles init` writes the @uifiles registry into a
// project's components.json so that `shadcn add @uifiles/<name>` resolves.
// The shadcn CLI resolves a namespace through the consumer's components.json
// `registries` or the shadcn registry directory; until the directory lists
// @uifiles, a fresh project fails with `Unknown registry "@uifiles"`.
//
//   uifiles init [--cwd <dir>] [--url <origin>] [--force]
//
// Node built-ins only: the package has no dependencies. `run()` is exported
// for the unit tests; the file acts as the bin only when Node runs it directly.
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"

export const NAMESPACE = "@uifiles"
export const DEFAULT_ORIGIN = "https://uifiles.dev"
export const CONFIG_FILE = "components.json"
export const SHADCN_INIT = `pnpm dlx shadcn@latest init ${DEFAULT_ORIGIN}/r/base.json`
export const SHADCN_ADD = `pnpm dlx shadcn@latest add ${NAMESPACE}/<name>`

export type InitOptions = {
  /** Directory that holds components.json. Defaults to the current directory. */
  cwd?: string | undefined
  /** Origin the registry is served from. Defaults to https://uifiles.dev. */
  origin?: string | undefined
  /** Replace an existing @uifiles entry that points elsewhere. */
  force?: boolean | undefined
}

export type InitResult =
  /** The entry was written. */
  | { status: "added"; file: string; url: string }
  /** The entry was already there with this URL; nothing was written. */
  | { status: "unchanged"; file: string; url: string }
  /** A different entry is there and `force` was not set; nothing was written. */
  | { status: "kept"; file: string; url: string; current: unknown }
  /** A different entry was there and `force` replaced it. */
  | { status: "replaced"; file: string; url: string; previous: unknown }

/** A failure the command reports as one line, without a stack trace. */
export class InitError extends Error {
  override name = "InitError"
}

/**
 * The `registries` value for an origin: `<origin>/r/{name}.json`, the same
 * shape `components.json` uses for every hosted shadcn registry. A trailing
 * slash is dropped and a path prefix kept, as `baseUrl()` does for the site.
 */
export function registryUrl(origin = DEFAULT_ORIGIN) {
  if (origin.includes("{name}")) {
    throw new InitError(
      `--url takes the registry's origin (${DEFAULT_ORIGIN}), not a URL template; got "${origin}"`
    )
  }
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new InitError(
      `--url must be an absolute URL such as ${DEFAULT_ORIGIN}; got "${origin}"`
    )
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InitError(
      `--url must be an http or https URL such as ${DEFAULT_ORIGIN}; got "${origin}"`
    )
  }
  const base = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
  return `${base}/r/{name}.json`
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The indentation of the first indented line, or two spaces. */
function detectIndent(text: string) {
  return /^([ \t]+)\S/m.exec(text)?.[1] ?? "  "
}

/**
 * Adds `"@uifiles": "<origin>/r/{name}.json"` to the `registries` of the
 * components.json in `cwd`, keeping the file's other keys, its key order, its
 * indentation and its final newline. Throws `InitError` when the file is
 * missing (the message names the shadcn init command that creates it), is not
 * a JSON object, or has a `registries` value that is not an object.
 */
export function initRegistry(options: InitOptions = {}): InitResult {
  const cwd = resolve(options.cwd ?? process.cwd())
  const file = join(cwd, CONFIG_FILE)
  const url = registryUrl(options.origin ?? DEFAULT_ORIGIN)
  if (!existsSync(file)) {
    throw new InitError(
      `No ${CONFIG_FILE} in ${cwd}.\nSet the project up first:\n  ${SHADCN_INIT}\nor pass --cwd <dir> to point at the directory that holds it.`
    )
  }
  const text = readFileSync(file, "utf8")
  let config: unknown
  try {
    config = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new InitError(`${file} is not valid JSON: ${reason}`)
  }
  if (!isObject(config)) {
    throw new InitError(`${file} must hold a JSON object.`)
  }
  const registries = config.registries ?? {}
  if (!isObject(registries)) {
    throw new InitError(
      `${file} has a "registries" value that is not an object; fix it by hand, then run this again.`
    )
  }
  const current = registries[NAMESPACE]
  if (current === url) return { status: "unchanged", file, url }
  const present = NAMESPACE in registries
  if (present && !options.force) {
    return { status: "kept", file, url, current }
  }
  registries[NAMESPACE] = url
  config.registries = registries
  const eol = text.endsWith("\n") ? "\n" : ""
  writeFileSync(file, JSON.stringify(config, null, detectIndent(text)) + eol)
  return present
    ? { status: "replaced", file, url, previous: current }
    : { status: "added", file, url }
}

const USAGE = `uifiles: set a project up for the ${NAMESPACE} shadcn registry

Usage
  uifiles init [--cwd <dir>] [--url <origin>] [--force]

Commands
  init            Add "${NAMESPACE}" to the registries of ${CONFIG_FILE}, so that
                  \`shadcn add ${NAMESPACE}/<name>\` resolves. Run it after
                  \`${SHADCN_INIT}\`.

Options
  --cwd <dir>     The directory that holds ${CONFIG_FILE} (default: the current directory)
  --url <origin>  The origin the registry is served from (default: ${DEFAULT_ORIGIN})
  --force         Replace an existing "${NAMESPACE}" entry that points elsewhere
  -h, --help      Show this help
  -v, --version   Show the version`

export type RunEnv = {
  /** The process's working directory; `--cwd` resolves against it. */
  cwd: string
  /** Where the output lines go (`process.stdout` in the bin). */
  stdout: { write(chunk: string): unknown }
  /** Where the error lines go (`process.stderr` in the bin). */
  stderr: { write(chunk: string): unknown }
}

function version() {
  const require = createRequire(import.meta.url)
  return (require("../package.json") as { version: string }).version
}

function describe(value: unknown) {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value)
}

/** Runs the command line and returns the exit code. */
export function run(argv: string[], env: RunEnv): number {
  const out = (line: string) => env.stdout.write(`${line}\n`)
  const err = (line: string) => env.stderr.write(`${line}\n`)
  let parsed: ReturnType<typeof parseArgs<typeof spec>>
  const spec = {
    args: argv,
    allowPositionals: true,
    options: {
      cwd: { type: "string" },
      url: { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  } as const
  try {
    parsed = parseArgs(spec)
  } catch (error) {
    err(error instanceof Error ? error.message : String(error))
    err("")
    err(USAGE)
    return 1
  }
  const { values, positionals } = parsed
  if (values.help) {
    out(USAGE)
    return 0
  }
  if (values.version) {
    out(version())
    return 0
  }
  const [command, ...rest] = positionals
  if (command !== "init" || rest.length > 0) {
    err(
      command === undefined
        ? "Missing command."
        : `Unknown command: ${[command, ...rest].join(" ")}`
    )
    err("")
    err(USAGE)
    return 1
  }
  let result: InitResult
  try {
    result = initRegistry({
      cwd: resolve(env.cwd, values.cwd ?? "."),
      ...(values.url !== undefined && { origin: values.url }),
      ...(values.force !== undefined && { force: values.force }),
    })
  } catch (error) {
    if (error instanceof InitError) {
      err(error.message)
      return 1
    }
    throw error
  }
  const file = relative(env.cwd, result.file) || CONFIG_FILE
  switch (result.status) {
    case "added":
      out(`Added "${NAMESPACE}": "${result.url}" to ${file}.`)
      out(`Add components with: ${SHADCN_ADD}`)
      return 0
    case "unchanged":
      out(
        `${file} already points ${NAMESPACE} at ${result.url}; nothing to do.`
      )
      return 0
    case "kept":
      out(
        `${file} points ${NAMESPACE} at ${describe(result.current)}; left as is. Pass --force to replace it with ${result.url}.`
      )
      return 0
    case "replaced":
      out(
        `Replaced ${NAMESPACE} in ${file}: ${describe(result.previous)} is now ${result.url}.`
      )
      return 0
  }
}

/**
 * Whether Node was started on this file (`node dist/cli.js`, or the bin shim
 * pnpm and npm write, which resolves to it), as opposed to importing it. The
 * entry is compared by real path, since the bin shim points at a symlink.
 */
export function isMain(
  entry: string | undefined = process.argv[1],
  moduleUrl = import.meta.url
) {
  if (!entry) return false
  try {
    return moduleUrl === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (isMain()) {
  process.exitCode = run(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
  })
}
