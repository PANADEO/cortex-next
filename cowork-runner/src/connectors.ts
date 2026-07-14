import { connectMcpServer, defineTool, type ToolDefinition } from "@flue/runtime"
import * as v from "valibot"
import { ENV, readJsonEnv } from "./env.ts"
import { runProcess } from "./run-process.ts"

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
  const parsed = readJsonEnv<unknown>(ENV.connectors, [])
  return Array.isArray(parsed) ? (parsed as ResolvedConnector[]) : []
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
    run: ({ input, signal }) =>
      runProcess(connector.target, [...(connector.baseArgs ?? []), ...input.args], {
        env: { ...process.env, ...connector.env },
        timeoutMs: CLI_TIMEOUT_MS,
        outputLimit: CLI_OUTPUT_LIMIT,
        ...(signal ? { signal } : {}),
      }),
  })
}

/**
 * Materializes the turn's connector tools. MCP handshakes run concurrently
 * (each is a network round-trip); a dead server is logged and skipped - the
 * model simply doesn't see that connector's tools this turn.
 */
export async function buildConnectorTools(
  connectors: ResolvedConnector[],
): Promise<ToolDefinition[]> {
  const settled = await Promise.allSettled(
    connectors.map(async (connector): Promise<ToolDefinition[]> => {
      if (connector.type === "cli") return [cliTool(connector)]
      try {
        const connection = await connectMcpServer(slug(connector.name), {
          url: connector.target,
          ...(connector.headers ? { headers: connector.headers } : {}),
        })
        return connection.tools
      } catch (error) {
        console.error(
          `[cowork-runner] MCP connector "${connector.name}" unavailable:`,
          error instanceof Error ? error.message : error,
        )
        return []
      }
    }),
  )
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
}
