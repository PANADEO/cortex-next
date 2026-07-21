import { existsSync } from "node:fs"
import path from "node:path"

// `npm run dev|build|start` and the Docker image all invoke Next.js as
// `next <cmd> app/idp` from the repo root, so `process.cwd()` is the repo
// root, not `app/idp`. Resolve explicitly through `app/idp` so file-backed
// stores and bundled assets are found regardless of which entry point
// started the process.
//
// The marker check is `app/idp/features`, not bare `app/idp`: the standalone
// server's generated server.js chdir()s to its own directory at startup, so
// process.cwd() can already BE the app root - and this app also has a page
// route literally named "idp" (app/idp/app/idp/verify, .../classification),
// which compiles into a same-named subdirectory. A bare existsSync(app/idp)
// check can't tell that route-tree lookalike apart from the real app root
// and descends a level too far (verified: produced .../app/idp/app/idp/...
// on a live deploy). `features/` only exists at the real root.
export function appIdpDir(): string {
  const appIdpRelative = path.join(process.cwd(), "app", "idp")
  return existsSync(path.join(appIdpRelative, "features")) ? appIdpRelative : process.cwd()
}

export function resolveAppDataDir(subdir: string): string {
  return path.join(appIdpDir(), ".data", subdir)
}

/** Absolute path to the built-in skills folder shipped with the cowork tile. */
export function builtinSkillsDir(): string {
  return process.env.COWORK_BUILTIN_SKILLS_DIR ?? path.join(appIdpDir(), "features", "cortex-cowork", "skills")
}
