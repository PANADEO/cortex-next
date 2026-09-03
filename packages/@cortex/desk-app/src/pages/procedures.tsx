import { departmentLabel } from "@cortex/desk-core/capability-text"
import { viewer } from "@cortex/desk-core/identity"
import { names } from "@cortex/desk-core/people"
import { activeProcedures } from "@cortex/desk-core/procedures/store"
import { visibleFor } from "@cortex/desk-core/procedures/visible"
import { OtherRequest } from "@cortex/desk-ui/components/other-request"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskLocale, deskT } from "@cortex/desk-ui/i18n/server"

/**
 * „JAK TO ROBIMY" — spisane zasady firmy, widziane oczami pracownika.
 *
 * Ten sam kształt, co „Co potrafię", i to jest para: tamten ekran mówi, CO asystent
 * potrafi zrobić, ten — WEDŁUG CZEGO to robi. Oba są wyłącznie do czytania i oba mają
 * na dole to samo wyjście dla człowieka, któremu czegoś brakuje.
 *
 * WIDAĆ DOKŁADNIE TYLE, ILE WCHODZI DO TURY TEJ OSOBY. Zasięg liczy `visibleFor`, czyli
 * ta sama funkcja, którą `runtime.ts` odsiewa procedury przed złożeniem promptu. Ekran
 * z własnym filtrem pokazałby prędzej czy później zasadę, według której asystent u tej
 * osoby wcale nie pracuje — a to jest gorsze niż nie pokazać nic.
 */
export default async function Page() {
  const u = await viewer()
  const [locale, translate, all, people] = await Promise.all([
    deskLocale(),
    deskT(),
    activeProcedures(),
    names(),
  ])
  const mine = visibleFor(all, u.department)
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(iso),
    )

  return (
    <Shell>
      <div className="h-full overflow-y-auto pb-desk-bar md:pb-0">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">{translate("procedures.title")}</h1>
          <p className="t-body mt-1 text-desk-muted">
            {translate("procedures.lead", {
              department: departmentLabel(translate, u.department),
            })}
          </p>

          {mine.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed p-6 text-center">
              <p className="t-body">{translate("procedures.empty")}</p>
              <p className="t-meta mt-1">{translate("procedures.emptyHint")}</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {mine.map((p) => {
                // Procedura z zasiewu NIE MA podpisu i ekran mówi to wprost. Podstawienie
                // tam czyjegokolwiek nazwiska byłoby zmyśleniem podpisu pod dokumentem,
                // na który ta osoba ma się w pracy powoływać.
                const who = people[p.current.author] ?? null
                return (
                  <li key={p.name} className="rounded-lg border bg-desk-surface px-4 py-3">
                    <div className="t-body-m">{p.title}</div>
                    <p className="t-meta">{p.description}</p>
                    <details className="mt-2">
                      <summary className="t-micro cursor-pointer">
                        {translate("procedures.showBody")}
                      </summary>
                      <p className="t-body mt-1 whitespace-pre-wrap rounded-md bg-desk-sunken px-3 py-2">
                        {p.current.body}
                      </p>
                    </details>
                    <p className="t-micro mt-1.5">
                      {who
                        ? translate("procedures.issued", {
                            edition: p.current.edition,
                            who,
                            date: day(p.current.at),
                          })
                        : translate("procedures.unsigned", {
                            edition: p.current.edition,
                            date: day(p.current.at),
                          })}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          {/* TA SAMA PĘTLA PRÓŚB, co przy zdolnościach — `desk.access_request` z pozycją
              spoza katalogu. Druga droga zgłoszenia znaczyłaby drugą skrzynkę, do której
              przełożony musiałby pamiętać zajrzeć; ta jedna już stoi na jego ekranie. */}
          <div className="mt-4">
            <OtherRequest
              label={translate("procedures.propose")}
              title={translate("procedures.proposeTitle")}
              lead={translate("procedures.proposeLead")}
              placeholder={translate("procedures.proposePlaceholder")}
            />
          </div>
          <p className="t-micro mt-4">{translate("procedures.note")}</p>
        </div>
      </div>
    </Shell>
  )
}
