import { getRequestEmail } from "@cortex/service"
import type { NextRequest } from "next/server"

/**
 * Tożsamość żądania dla tras cowork. Cienki adapter na getRequestEmail()
 * z @cortex/service — JEDNA implementacja tej reguły w repo, wspólna z bramką
 * RBAC, zamiast trzeciej równoległej kopii tego samego `??`-łańcucha.
 *
 * Model zaufania bez zmian: nagłówek `x-auth-request-email` wstrzykuje
 * oauth2-proxy na brzegu (wartości od klienta są tam usuwane), z fallbackiem
 * na DEV_USER_EMAIL poza produkcją.
 *
 * Względem poprzedniej, lokalnej kopii dochodzą dwie własności wersji
 * serwisowej: e-mail jest normalizowany do lowercase (tak samo dopasowuje go
 * governance store, patrz `rolesFor`/`visibleProjectsFor`), a nagłówek pusty
 * albo złożony z białych znaków liczy się jako BRAK tożsamości, nie jako
 * tożsamość `""` — co dla project-gate.ts jest różnicą między 401 a wpuszczeniem
 * przez gałąź bootstrapu.
 */
export function requestEmail(request: NextRequest): string | undefined {
  return getRequestEmail(request.headers) ?? undefined
}
