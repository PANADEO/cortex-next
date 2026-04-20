import type { DefaultSession, DefaultUser } from "next-auth"
import type { JWT as DefaultJWT } from "next-auth/jwt"

type CortexRole = "admin" | "operator" | "viewer"
type CortexTile = "idp" | (string & {})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: CortexRole
      tileAccess: CortexTile[]
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: CortexRole
    tileAccess: CortexTile[]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    role: CortexRole
    tileAccess: CortexTile[]
  }
}
