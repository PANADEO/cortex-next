import { deskT } from "../i18n/server"

/**
 * ŁADOWANIE — kółko i szkielet wiersza, w jednym miejscu.
 *
 * DLACZEGO POWSTAŁO. Ekrany „Moje pliki", „Pamięć" i lista spraw stały na `<Suspense>`
 * BEZ `fallback`. Granica bez zapasowej treści renderuje PUSTKĘ, dopóki dane nie dojdą —
 * więc człowiek wchodził na ekran, widział nic, i po chwili treść pojawiała się sama.
 * Wygląda to jak pusty katalog, a nie jak czekanie, i to jest różnica między „nic tu nie
 * mam" a „zaraz pokażę".
 *
 * DWA KSZTAŁTY, bo czekanie ma dwa różne konteksty:
 *  · `rows` — szkielet listy. Trzyma WYSOKOŚĆ, więc treść nie podskakuje przy pojawieniu
 *    się, a oko od razu wie, czego się spodziewać. Do list plików, wspomnień, spraw.
 *  · bez `rows` — kółko z podpisem. Do miejsc, gdzie nie znamy kształtu treści.
 *
 * `role="status"` i `aria-live="polite"`, bo czytnik ekranu ma powiedzieć, że coś się
 * dzieje — pusty ekran nie mówi nic także jemu. `motion-reduce:animate-none` zostawia
 * podpis osobom, dla których wirujące elementy są kosztem, a nie informacją.
 */
export async function Loading({ rows }: { rows?: number }) {
  const translate = await deskT()
  const label = translate("common.loading")

  if (rows && rows > 0) {
    return (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="h-11 animate-pulse rounded-desk bg-desk-line/40 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 py-6 text-desk-muted">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-desk-line border-t-desk-ink motion-reduce:animate-none"
      />
      <span className="t-meta">{label}</span>
    </div>
  )
}
