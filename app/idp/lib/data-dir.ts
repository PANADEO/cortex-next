import { existsSync } from "node:fs"
import path from "node:path"

// `npm run dev|build|start` and the Docker image all invoke Next.js as
// `next <cmd> app/idp` from the repo root, so `process.cwd()` is the repo
// root, not `app/idp`. Resolve explicitly through `app/idp` so file-backed
// stores stay app-scoped regardless of which entry point started the process.
export function resolveAppDataDir(subdir: string): string {
  const appIdpRelative = path.join(process.cwd(), "app", "idp")
  const base = existsSync(appIdpRelative) ? appIdpRelative : process.cwd()
  return path.join(base, ".data", subdir)
}
