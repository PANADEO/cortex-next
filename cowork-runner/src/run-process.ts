import { spawn } from "node:child_process"

// Shared spawn-to-promise used by the docker sandbox and CLI connectors.
// One implementation of the fiddly parts: settled flag, timeout -> SIGKILL,
// abort listener cleanup, and BOUNDED stdout/stderr accumulation (a chatty
// child must not hold unbounded output in the runner's memory).

export interface RunProcessOptions {
  env?: Record<string, string | undefined>
  stdin?: string
  timeoutMs?: number
  signal?: AbortSignal
  /** Per-stream accumulation cap in characters. Default 128k. */
  outputLimit?: number
}

export interface RunProcessResult {
  stdout: string
  stderr: string
  exitCode: number
}

const DEFAULT_OUTPUT_LIMIT = 128_000

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    const { signal } = options
    if (signal?.aborted) return reject(new Error("aborted"))
    const limit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT

    const child = spawn(command, args, {
      stdio: [options.stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
      ...(options.env ? { env: options.env as NodeJS.ProcessEnv } : {}),
    })

    let stdout = ""
    let stderr = ""
    let settled = false

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    const settle = (result: RunProcessResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => {
      child.kill("SIGKILL")
      fail(new Error("aborted"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL")
          settle({
            stdout,
            stderr: `${stderr}\n[timed out after ${options.timeoutMs}ms]`,
            exitCode: 124,
          })
        }, options.timeoutMs)
      : undefined

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < limit) stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < limit) stderr += chunk.toString()
    })
    child.on("error", (error) => fail(error))
    child.on("close", (code) => settle({ stdout, stderr, exitCode: code ?? 1 }))

    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin)
    }
    child.stdin?.end()
  })
}
