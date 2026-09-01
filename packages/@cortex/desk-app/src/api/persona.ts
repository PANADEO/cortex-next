import { NextResponse } from "next/server"
export async function POST(req: Request) {
  const { id } = await req.json()
  const res = NextResponse.json({ ok: true })
  res.cookies.set("desk_persona", id, { path: "/", httpOnly: false, sameSite: "lax" })
  return res
}
