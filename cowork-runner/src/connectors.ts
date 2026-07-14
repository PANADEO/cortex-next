import { spawn } from "node:child_process"
import { connectMcpServer, defineTool, type ToolDefinition } from "@flue/runtime"
import * as v from "valibot"

// Connector plumbing for a turn. The app resolves credential refs before the
// spawn, so what arrives here (via the COWORK_CONNECTORS env var - never
// argv) is ready to use: headers for MCP servers, env vars for CLI tools.
//
// Connectors are by design a bridge OUT of the sandbox: an MCP call hits a
// remote server, a CLI tool executes on the runner host. Which connectors
// exist (and with what credentials) is exactly what cortex-config governs.

export interface ResolvedConnector {
  id: string
  type: "mcp" | "cli"
  name: string
  description?: string
  /** MCP: endpoint URL. CLI: absolute executable path. */
  target: string
  /** MCP only: resolved request headers. */
  headers?: Record<string, string>
  /** CLI only: resolved env vars for the child process. */
  env?: Record<string, string>
  /** CLI only: fixed arguments always prepended. */
  baseArgs?: string[]
}

const CLI_TIMEOUT_MS = 60_000
const CLI_OUTPUT_LIMIT = 32_000

export function readConnectorsFromEnv(): ResolvedConnector[] {
  const raw = process.env.COWORK_CONNECTORS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ResolvedConnector[]) : []
  } catch {
    console.error("[cowork-runner] COWORK_CONNECTORS is not valid JSON - ignoring")
    return []
  }
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_")
}

function cliTool(connector: ResolvedConnector): ToolDefinition {
  return defineTool({
    name: `cli__${slug(connector.name)}`,
    description:
      `${connector.description ?? `Runs the ${connector.name} command-line tool.`} ` +
      `Pass arguments as a list; the executable and base arguments are fixed by configuration.`,
    input: v.object({
      args: v.array(v.string()),
    }),
    run: async ({ input, signal }) => {
      return new Promise((resolve, reject) => {
        const child = spawn(connector.target, [...(connector.baseArgs ?? []), ...input.args], {
          env: { ...process.env, ...connector.env },
          stdio: ["ignore", "pipe", "pipe"],
        })
        let stdout = ""
        let stderr = ""
        let settled = false
        const finish = (value: { exitCode: number; stdout: string; stderr: string }) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve({
            exitCode: value.exitCode,
            stdout: value.stdout.slice(0, CLI_OUTPUT_LIMIT),
            stderr: value.stderr.slice(0, CLI_OUTPUT_LIMIT),
          })
        }
        const fail = (error: Error) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          reject(error)
        }
        const timer = setTimeout(() => {
          child.kill("SIGKILL")
          finish({ exitCode: 124, stdout, stderr: `${stderr}\n[timed out]` })
        }, CLI_TIMEOUT_MS)
        signal?.addEventListener(
          "abort",
          () => {
            child.kill("SIGKILL")
            fail(new Error("aborted"))
          },
          { once: true },
        )
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString()
        })
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString()
        })
        child.on("error", (error) => fail(error))
        child.on("close", (code) => finish({ exitCode: code ?? 1, stdout, stderr }))
      })
    },
  })
}

/**
 * Materializes the turn's connector tools. MCP failures are logged and
 * skipped (one dead server must not take the whole turn down); the model
 * simply doesn't see that connector's tools this turn.
 */
export async function buildConnectorTools(
  connectors: ResolvedConnector[],
): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []
  for (const connector of connectors) {
    if (connector.type === "cli") {
      tools.push(cliTool(connector))
      continue
    }
    try {
      const connection = await connectMcpServer(slug(connector.name), {
        url: connector.target,
        ...(connector.headers ? { headers: connector.headers } : {}),
      })
      tools.push(...connection.tools)
    } catch (error) {
      console.error(
        `[cowork-runner] MCP connector "${connector.name}" unavailable:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
  return tools
}
