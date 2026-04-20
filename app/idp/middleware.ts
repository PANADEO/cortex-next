import { NextResponse } from "next/server"
import { auth } from "./auth"

const PUBLIC_PATHS = ["/login"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p))

  if (isPublic) {
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.next()
  }
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|mockServiceWorker.js|pdfjs|mock-assets|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js|mjs|pdf)$).*)",
  ],
}
