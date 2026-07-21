import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import type { SandboxFactory, SessionEnv, ShellResult } from "@flue/runtime"
import { runProcess } from "./run-process.ts"

// Docker-backed Flue SandboxFactory: the hard enforcement behind a project's
// "allowed sandbox paths". One container per harness; the session sandbox dir
// mounts at /workspace and every configured path mounts at its own host path
// (append ":ro" to a path for read-only). Everything else on the host simply
// does not exist inside the container - this is deny-by-default, not a
// prompt-level allow-list.
//
// All exec AND fs operations go through `docker exec`, never the host fs:
// the container is the single source of truth for what paths are visible.

const CONTAINER_LABEL = "flue-cowork-sandbox"
const DEFAULT_IMAGE = "node:22-slim"
/** Orphan containers older than this are reaped on the next sandbox start. */
const ORPHAN_MAX_AGE_MS = 60 * 60 * 1000

export interface DockerSandboxOptions {
  /** Host path of the session sandbox; mounted read-write at /workspace. */
  sandboxDir: string
  /** Extra host paths mounted at identical container paths. ":ro" suffix = read-only. */
  allowedPaths?: string[]
  /** Container image. Needs a POSIX shell; node image keeps skills usable. */
  image?: string
}

class DockerError extends Error {}

async function runDocker(args: string[]): Promise<ShellResult> {
  try {
    return await runProcess("docker", args)
  } catch (error) {
    throw new DockerError(
      `docker not available: ${error instanceof Error ? error.message : error}`,
    )
  }
}

/**
 * Best-effort reaper for containers a SIGKILLed runner left behind. Runs off
 * the turn's critical path (fire-and-forget from createSessionEnv).
 */
async function reapOrphans(): Promise<void> {
  const list = await runDocker([
    "ps",
    "--filter",
    `label=${CONTAINER_LABEL}`,
    "--format",
    "{{.ID}}\t{{.CreatedAt}}",
  ]).catch(() => null)
  if (!list || list.exitCode !== 0) return
  const removals: Promise<unknown>[] = []
  for (const line of list.stdout.split("\n")) {
    const [id, createdAt] = line.split("\t")
    if (!id || !createdAt) continue
    // Docker's CreatedAt: "2026-07-14 13:20:11 +0200 CEST" - Date.parse
    // handles the leading date+offset once the trailing zone name drops.
    const created = Date.parse(createdAt.split(" ").slice(0, 3).join(" "))
    if (Number.isNaN(created) || Date.now() - created < ORPHAN_MAX_AGE_MS) continue
    removals.push(runDocker(["rm", "-f", id]).catch(() => undefined))
  }
  await Promise.all(removals)
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

async function startContainer(options: DockerSandboxOptions): Promise<string> {
  const name = `cowork-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`
  const args = [
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--label",
    CONTAINER_LABEL,
    "--volume",
    `${options.sandboxDir}:/workspace`,
    "--workdir",
    "/workspace",
  ]
  for (const entry of options.allowedPaths ?? []) {
    const readOnly = entry.endsWith(":ro")
    const hostPath = readOnly ? entry.slice(0, -3) : entry
    if (!hostPath.startsWith("/")) {
      throw new DockerError(`sandbox path must be absolute: ${entry}`)
    }
    args.push("--volume", `${hostPath}:${hostPath}${readOnly ? ":ro" : ""}`)
  }
  args.push(options.image ?? DEFAULT_IMAGE, "sleep", "infinity")

  const result = await runDocker(args)
  if (result.exitCode !== 0) {
    throw new DockerError(`docker run failed: ${result.stderr.trim() || result.stdout.trim()}`)
  }

  const stopContainer = () => {
    // Sync on purpose: async work does not run inside process "exit".
    spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" })
  }
  process.once("exit", stopContainer)
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stopContainer()
      process.exit(1)
    })
  }
  return name
}

function createContainerEnv(container: string): SessionEnv {
  const cwd = "/workspace"
  const resolvePath = (p: string): string => (p.startsWith("/") ? p : `${cwd}/${p}`)

  const exec: SessionEnv["exec"] = async (command, opts) => {
    const args = ["exec", "--workdir", opts?.cwd ? resolvePath(opts.cwd) : cwd]
    for (const [key, value] of Object.entries(opts?.env ?? {})) {
      args.push("--env", `${key}=${value}`)
    }
    args.push(container, "sh", "-lc", command)
    try {
      return await runProcess("docker", args, {
        ...(opts?.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      })
    } catch (error) {
      if (error instanceof Error && error.message === "aborted") throw error
      throw new DockerError(error instanceof Error ? error.message : String(error))
    }
  }

  const execOrThrow = async (command: string): Promise<string> => {
    const result = await exec(command)
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `command failed: ${command}`)
    }
    return result.stdout
  }

  return {
    exec,
    cwd,
    resolvePath,
    async readFile(p) {
      return execOrThrow(`cat ${shellQuote(resolvePath(p))}`)
    },
    async readFileBuffer(p) {
      const b64 = await execOrThrow(`base64 ${shellQuote(resolvePath(p))}`)
      return Uint8Array.from(Buffer.from(b64.replaceAll("\n", ""), "base64"))
    },
    async writeFile(p, content) {
      const resolved = resolvePath(p)
      const dir = resolved.slice(0, resolved.lastIndexOf("/")) || "/"
      const b64 = Buffer.from(content).toString("base64")
      await execOrThrow(
        `mkdir -p ${shellQuote(dir)} && printf %s ${shellQuote(b64)} | base64 -d > ${shellQuote(resolved)}`,
      )
    },
    async stat(p) {
      const out = await execOrThrow(`stat -c '%F|%s|%Y' ${shellQuote(resolvePath(p))}`)
      const [kind, size, mtime] = out.trim().split("|")
      return {
        isFile: kind === "regular file" || kind === "regular empty file",
        isDirectory: kind === "directory",
        isSymbolicLink: kind === "symbolic link",
        ...(size ? { size: Number(size) } : {}),
        ...(mtime ? { mtime: new Date(Number(mtime) * 1000) } : {}),
      }
    },
    async readdir(p) {
      const out = await execOrThrow(`ls -A ${shellQuote(resolvePath(p))}`)
      return out.split("\n").filter(Boolean)
    },
    async exists(p) {
      const result = await exec(`test -e ${shellQuote(resolvePath(p))}`)
      return result.exitCode === 0
    },
    async mkdir(p, opts) {
      await execOrThrow(`mkdir ${opts?.recursive ? "-p " : ""}${shellQuote(resolvePath(p))}`)
    },
    async rm(p, opts) {
      const flags = `${opts?.recursive ? "r" : ""}${opts?.force ? "f" : ""}`
      await execOrThrow(`rm ${flags ? `-${flags} ` : ""}${shellQuote(resolvePath(p))}`)
    },
  }
}

/**
 * SandboxFactory wrapping a per-harness Docker container. Throws (fails the
 * turn) when Docker is unavailable - a project that demands hard isolation
 * must not silently degrade to host execution.
 */
export function dockerSandbox(options: DockerSandboxOptions): SandboxFactory {
  return {
    createSessionEnv: async () => {
      // Reaping is independent of this turn's container - don't pay its
      // latency on the hot path.
      void reapOrphans().catch(() => undefined)
      const container = await startContainer(options)
      return createContainerEnv(container)
    },
  }
}
