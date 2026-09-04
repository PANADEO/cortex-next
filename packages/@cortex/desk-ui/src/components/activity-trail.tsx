"use client"
import { evidenceFromEvents, type EvidenceLine } from "@cortex/desk-core/evidence"
import {
  describeFailure,
  describeStep,
  pairSteps,
  stepDuration,
  summariseGroup,
  type Step,
} from "@cortex/desk-core/steps"
import type { AuditEntry } from "@cortex/desk-core/types"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  ChevronDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  LoaderCircle,
  Lock,
  TriangleAlert,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { Icon } from "./icon"

function fileIcon(name: string): LucideIcon {
  if (/\.(csv|xlsx?|tsv)$/i.test(name)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return FileImage
  return FileText
}

/**
 * Nazwa pliku jako osobny, rozpoznawalny obiekt — nie fragment zdania.
 *
 * Z `open` staje się rzeczą DO KLIKNIĘCIA i prowadzi do tego pliku. Bez `open` zostaje
 * napisem, i to nie jest wybór stylu: w wierszu przebiegu plakietka siedzi wewnątrz
 * przycisku rozwijającego krok, a przycisk w przycisku to układ, którego przeglądarka
 * ani czytnik ekranu nie umieją obsłużyć.
 */
function Pill({ name, open }: { name: string; open?: ((name: string) => void) | undefined }) {
  const translate = useDeskT()
  const inside = (
    <>
      <Icon as={fileIcon(name)} px={12} className="shrink-0 text-desk-muted" />
      <span className="truncate text-[13px]">{name}</span>
    </>
  )
  const shape =
    "inline-flex h-5 max-w-[220px] shrink-0 items-center gap-1 rounded-sm bg-desk-raised px-1.5 align-middle"
  return open ? (
    <button
      type="button"
      onClick={() => open(name)}
      aria-label={translate("trail.openFile", { name })}
      className={`${shape} hover:bg-desk-raised/60 hover:underline`}
    >
      {inside}
    </button>
  ) : (
    <span className={shape}>{inside}</span>
  )
}

/**
 * POTWIERDZENIE, NIE SKLEJKA — jedna sekcja dowodu jako historia operacji.
 *
 * Dotąd „co weszło" i „co powstało" stały pod jednym słowem „Sprawdzone:", sklejone
 * kropkami w akapit trzynastką, w którym nic nie było klikalne. To są dwie różne rzeczy:
 * pliki, które agent PRZECZYTAŁ, i dokumenty, które ZAPISAŁ — a człowiek musi je
 * rozróżnić bez wysiłku. Forma jest ta, którą pani Basia zna z banku: wiersz na
 * zdarzenie, słowo statusu, obiekt do kliknięcia, godzina po prawej.
 */
function Ledger({
  title,
  lines,
  timeOf,
  openFile,
  canOpenFile,
}: {
  title: string
  lines: EvidenceLine[]
  timeOf: (i: number) => string | null
  openFile?: ((name: string) => void) | undefined
  canOpenFile?: ((name: string) => boolean) | undefined
}) {
  if (!lines.length) return null
  return (
    <div>
      {/* `desk-muted`, nie `desk-muted-2` — ten drugi nie wyrabia progu kontrastu
          na tle podniesionym; to samo ustalenie, co przy nagłówkach karty awarii. */}
      <div className="t-micro text-desk-muted">{title}</div>
      {/* Nazwa na LIŚCIE, nie tylko w nagłówku nad nią: kto czyta ten ekran czytnikiem,
          wchodzi w listę wprost i musi wiedzieć, do której z dwóch wszedł. */}
      <ul aria-label={title} className="mt-0.5">
        {lines.map((w) => {
          const at = timeOf(w.i)
          return (
            <li
              key={`${w.i}-${w.text}`}
              className="flex items-center gap-1.5 py-px text-[13px] leading-5"
            >
              <Icon as={Check} px={12} className="shrink-0 text-desk-ok" />
              {w.word ? (
                <>
                  <span className="shrink-0 text-desk-ink">{w.word}</span>
                  {/* PRZYCISK TYLKO WTEDY, GDY JEST CO OTWORZYĆ.
                      Widok sprawy szuka pliku WYŁĄCZNIE w teczce sprawy, a „Co weszło"
                      wymienia pliki z biurka („Moje pliki/…", „Wspólne pliki/…"). Zmierzone
                      na ekranie: klik w „zestawienie.docx" otwierał panel, klik
                      w „faktury-08.csv" nie robił NIC — a element wyglądał i brzmiał
                      (`aria-label` „Otwórz plik…") jak przycisk. Ekran obiecywał czynność,
                      której nie wykonuje. Plakietka bez celu jest teraz napisem. */}
                  {w.file && (
                    <Pill
                      name={w.file}
                      open={canOpenFile?.(w.file) === false ? undefined : openFile}
                    />
                  )}
                  {w.detail && <span className="truncate text-desk-muted">{w.detail}</span>}
                </>
              ) : (
                <span className="truncate text-desk-muted">{w.text}</span>
              )}
              {at && <span className="t-micro ml-auto shrink-0 pl-2 tabular-nums">{at}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Krok, który padł, ma WŁASNĄ ikonę i WŁASNY token koloru — nie pożycza ich od
 * ostrzeżenia. Wcześniej stał tu ten sam trójkąt i ten sam `desk-warn`, co przy
 * „niesprawdzone", więc dwie różne rzeczy wyglądały identycznie: „zrobiłem, ale nie
 * odczytałem po zapisie" i „nie zrobiłem wcale". Krzyżyk mówi „tego nie ma", trójkąt
 * mówi „to jest, ale uważaj" — i tę różnicę widać zanim człowiek przeczyta tytuł.
 *
 * Samo rozróżnienie graficzne niczego jednak nie niesie: porażkę niesie SŁOWO w tytule
 * („Nie zapisałem"), a ikona i kolor tylko je wspierają.
 */
const STEP_STATUS: Record<Step["status"], { icon: LucideIcon; className: string; spin?: boolean }> =
  {
    running: { icon: LoaderCircle, className: "text-desk-accent", spin: true },
    ok: { icon: Check, className: "text-desk-muted" },
    failed: { icon: X, className: "text-desk-bad" },
  }

/**
 * TRZY ZDANIA KROKU, KTÓRY SIĘ NIE UDAŁ — w stałej kolejności i z nagłówkami.
 *
 * Nagłówki są tu po to, żeby środkowe zdanie dało się znaleźć wzrokiem, nie czytając
 * całości. Jest ono najważniejsze z trójki: najgorsza awaria to taka, po której człowiek
 * nie wie, czy coś się już wydarzyło — i wtedy jedynym bezpiecznym ruchem jest nie ruszać
 * niczego. Zdania powstają w `describeFailure`, ze zdarzenia; ten komponent ich nie pisze.
 */
function Failure({ text }: { text: { happened: string; changed: string; next: string } }) {
  const translate = useDeskT()
  const parts = [
    { title: translate("trail.failure.titleHappened"), body: text.happened },
    { title: translate("trail.failure.titleChanged"), body: text.changed },
    { title: translate("trail.failure.titleNext"), body: text.next },
  ]
  return (
    <div className="space-y-2 pt-1">
      {parts.map((part) => (
        <div key={part.title}>
          {/*
            `desk-muted`, nie `desk-muted-2`: ten drugi ma na tle podniesionym 2,59:1,
            czyli poniżej progu 4,5:1 dla tekstu (pomiar: `npm run kontrast:pomiar`).
            Nagłówek, którego nie widać, jest gorszy niż jego brak — a to jest ostatnie
            miejsce w produkcie, które wolno przeoczyć wzrokiem.
          */}
          <div className="t-micro text-desk-muted">{part.title}</div>
          <p className="text-desk-ink">{part.body}</p>
        </div>
      ))}
    </div>
  )
}

function Row({
  k,
  at,
  now,
  approver,
  iAmTheApprover,
  revealFailure,
}: {
  k: Step
  at: string
  now: number
  /** „Imię Nazwisko" osoby wydającej zgody; pusto, gdy Biurko nie umie jej wskazać. */
  approver?: string | undefined
  iAmTheApprover?: boolean | undefined
  /**
   * Czy krok, który padł, ma sam się otworzyć. Decyduje o tym CAŁA tura, nie ten wiersz:
   * gdy tura skończyła się źle, zdanie „co teraz" jest najważniejszą rzeczą na ekranie
   * i chowanie go za kliknięciem szkodzi; gdy tura się udała, ten sam tekst jest opisem
   * objazdu, który agent zrobił sam sobie — i wygląda jak awaria, której nie było.
   */
  revealFailure?: boolean | undefined
}) {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const [open, setOpen] = useState(k.status === "failed" && revealFailure === true)
  const o = describeStep(k, translate)
  const failure = describeFailure(k, translate, { approver, iAmTheApprover })
  const s = STEP_STATUS[k.status]
  const ms = k.status === "running" ? now - new Date(at).getTime() : k.ms
  const duration = stepDuration(ms)
  const hasDetail = Boolean(o.path || o.detail || failure)

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((x) => !x)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className="group flex h-9 w-full items-center gap-2 rounded-sm px-3 text-left enabled:hover:bg-desk-raised/60 md:h-desk-step"
      >
        <span className={`grid w-5 shrink-0 place-items-center ${s.className}`}>
          <Icon as={s.icon} px={16} className={s.spin ? "spin" : undefined} />
        </span>
        <span className="t-body flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0">{o.title}</span>
          {o.file && <Pill name={o.file} />}
        </span>
        {duration && <span className="t-meta shrink-0 tabular-nums">{duration}</span>}
        {hasDetail && (
          <Icon
            as={ChevronDown}
            px={14}
            className={`shrink-0 text-desk-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && hasDetail && (
        <div className="pb-2 pl-10 pr-3 pt-0.5 text-[13px] leading-5 text-desk-muted">
          {o.path && <div>{translate("trail.onFile", { path: o.path })}</div>}
          {o.detail && <div>{translate("trail.saw", { detail: o.detail })}</div>}
          {failure && <Failure text={failure} />}
          <div className="t-micro pt-0.5">
            {new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(at))}
          </div>
        </div>
      )}
    </li>
  )
}

export function ActivityTrail({
  entries,
  isWorking,
  now,
  approver,
  iAmTheApprover,
  openFile,
  canOpenFile,
}: {
  entries: AuditEntry[]
  isWorking: boolean
  now: number
  /** Przechodzi do zdania „co teraz" przy kroku, który padł — patrz `describeFailure`. */
  approver?: string | undefined
  iAmTheApprover?: boolean | undefined
  /**
   * Otwarcie pliku z wiersza dowodu. Wchodzi propem, bo teczkę sprawy zna widok sprawy,
   * a przebieg zna wyłącznie zdarzenia — i tak ma zostać.
   */
  openFile?: ((name: string) => void) | undefined
  /** Czy ten plik da się w ogóle otworzyć z tego ekranu — patrz komentarz przy `Pill`. */
  canOpenFile?: ((name: string) => boolean) | undefined
}) {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const steps = pairSteps(entries.map((w) => w.event))
  const evidence = evidenceFromEvents(
    entries.map((w) => w.event),
    translate,
  )
  /**
   * CZY TURA SKOŃCZYŁA SIĘ ŹLE — po OSTATNIM kroku, nie po jakimkolwiek.
   *
   * Dotąd wystarczył jeden krok z krzyżykiem w dowolnym miejscu, żeby nagłówek zapalił
   * się na żółto, cały przebieg został rozwinięty na stałe, a wiersz z surowym błędem
   * sam się otworzył. Tymczasem agent, który pomylił ścieżkę pliku, poprawił ją i dokończył
   * pracę, NIE zrobił nic niepokojącego — to jego własny objazd, tak samo jak człowiek
   * otwierający nie ten segregator. Pani Basia dostawała ostrzeżenie o zdarzeniu, które
   * jej nie dotyczy, i ślad `FileNotFoundError` pod nim.
   *
   * O tym, czy jest źle, mówi krok OSTATNI: jeśli padła ostatnia próba, tura naprawdę
   * skończyła się porażką i nagłówek ma o tym krzyczeć. Jeśli po potknięciu przyszedł
   * udany krok, potknięcie było drogą, a nie wynikiem — zostaje w przebiegu z krzyżykiem,
   * jeden klik stąd, i nic z niego nie znika.
   */
  const endedBadly = steps[steps.length - 1]?.status === "failed"
  // „Zrobione z potknięciem: nic nie zostało zrobione" jest zdaniem sprzecznym samym
  // ze sobą, a właśnie tak brzmiał nagłówek, gdy PADŁY WSZYSTKIE kroki. Grupa, z której
  // nie wyszła ani jedna czynność, mówi wprost, że się nie udało.
  const nothingDone = endedBadly && !steps.some((k) => k.status === "ok")
  const uncertain = evidence.unverified.length > 0
  const blocked = evidence.notAllowed.length > 0
  const external = evidence.external.length > 0
  /**
   * SPRAWA OTWARTA PO CZASIE ZACZYNA ZWINIĘTA. Zwijanie po 800 ms jest po to, żeby przebieg
   * nie zatrzasnął się w oczach człowieka, który właśnie na niego patrzył. Kto wraca do
   * sprawy sprzed godziny, nie patrzył — dostawał więc mignięcie całej listy kroków i
   * dopiero potem porządek. Praca agenta ma być rzeczą DO OBEJRZENIA NA ŻĄDANIE, a nie
   * pierwszą rzeczą, którą widać po wejściu.
   */
  const [collapsed, setCollapsed] = useState(
    !isWorking && steps.length > 0 && !endedBadly && !uncertain && !blocked,
  )
  const collapsedOnce = useRef(false)

  /**
   * GODZINA WIERSZA DOWODU. Dowód liczy się ze zdarzeń i nie zna zegara — indeks kroku
   * jest jedynym, co z niego wychodzi, a wpis dziennika trzyma czas. Ta sama droga, którą
   * godzinę bierze wiersz przebiegu, więc obie liczby na ekranie zawsze się zgadzają.
   */
  const timeOf = (i: number) => {
    const at = entries[i]?.at
    return at ? new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(at)) : null
  }

  // Zwijamy 800 ms po zakończeniu — ale zła wiadomość nigdy nie chowa się sama.
  useEffect(() => {
    if (isWorking || collapsedOnce.current || !steps.length) return
    if (endedBadly || uncertain || blocked) {
      collapsedOnce.current = true
      return
    }
    const t = setTimeout(() => {
      setCollapsed(true)
      collapsedOnce.current = true
    }, 800)
    return () => clearTimeout(t)
  }, [isWorking, steps.length, endedBadly, uncertain, blocked])

  if (!steps.length) return null

  const running = steps.find((k) => k.status === "running")
  const totalMs = steps.reduce((a, k) => a + (k.ms ?? 0), 0)
  const totalDuration = stepDuration(totalMs)

  const header = isWorking
    ? {
        icon: LoaderCircle,
        className: "text-desk-accent",
        spin: true,
        text: translate("trail.working"),
      }
    : nothingDone
      ? { icon: X, className: "text-desk-bad", text: translate("trail.allFailed") }
      : endedBadly
        ? {
            icon: TriangleAlert,
            className: "text-desk-warn",
            text: translate("trail.stumbled", {
              what: summariseGroup(steps, translate).toLowerCase(),
            }),
          }
        : { icon: Check, className: "text-desk-ok", text: summariseGroup(steps, translate) }

  return (
    <section
      className="slide-in overflow-hidden rounded-lg border bg-desk-surface"
      aria-label={translate("trail.label")}
    >
      <h3>
        <button
          type="button"
          onClick={() => setCollapsed((z) => !z)}
          aria-expanded={!collapsed}
          className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-desk-raised/50"
        >
          <span className={`grid w-5 shrink-0 place-items-center ${header.className}`}>
            <Icon as={header.icon} px={16} className={header.spin ? "spin" : undefined} />
          </span>
          <span className="t-body-m min-w-0 flex-1 truncate">{header.text}</span>
          {isWorking && running && (
            <span className="t-meta shrink-0">
              {translate("trail.step", { n: steps.indexOf(running) + 1 })}
            </span>
          )}
          {!isWorking && totalDuration && (
            <span className="t-meta shrink-0 tabular-nums">{totalDuration}</span>
          )}
          {!isWorking && uncertain && (
            <span className="t-meta flex shrink-0 items-center gap-1 text-desk-warn">
              <Icon as={TriangleAlert} px={12} />
              {translate("trail.unverifiedCount", { count: evidence.unverified.length })}
            </span>
          )}
          <Icon
            as={ChevronDown}
            px={16}
            className={`shrink-0 text-desk-muted-2 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
      </h3>

      {/*
        Kreski osi tu NIE MA i to jest poprawka, nie przeoczenie. Biegła na `left-[22px]`,
        czyli dokładnie przez środek kolumny ikon (`px-3` + połowa `w-5`), mimo komentarza
        twierdzącego, że biegnie pod nimi — przecinała każdy krzyżyk i każdą fajkę w poprzek.
      */}
      {!collapsed && (
        <ul aria-label={translate("trail.steps")} className="space-y-0.5 border-t py-1.5">
          {steps.map((k) => (
            <Row
              key={k.i}
              k={k}
              at={entries[k.i]?.at ?? new Date().toISOString()}
              now={now}
              approver={approver}
              iAmTheApprover={iAmTheApprover}
              revealFailure={endedBadly}
            />
          ))}
        </ul>
      )}

      {/* Stopka dowodu zostaje widoczna także po zwinięciu — bez niej zwinięcie chowa
          jedyną rzecz, która odróżnia to narzędzie od zwykłego czatu. */}
      {(evidence.intake.length > 0 ||
        evidence.produced.length > 0 ||
        evidence.basis.length > 0 ||
        external ||
        uncertain ||
        blocked) && (
        <div className="space-y-2 border-t bg-desk-raised/40 px-3 py-2.5">
          {/* DWA NAGŁÓWKI, NIE JEDEN. „Co wziąłem" i „co zrobiłem" to dla człowieka dwie
              różne rzeczy, a stały pod wspólnym słowem „Sprawdzone:" — i pierwsza z nich
              wyglądała wtedy jak zasługa, choć jest tylko lekturą. */}
          <Ledger
            title={translate("trail.cameIn")}
            lines={evidence.intake}
            timeOf={timeOf}
            openFile={openFile}
            canOpenFile={canOpenFile}
          />
          <Ledger
            title={translate("trail.cameOut")}
            lines={evidence.produced}
            timeOf={timeOf}
            openFile={openFile}
            canOpenFile={canOpenFile}
          />
          {/* WG CZEGO — spisane zasady firmy, według których zrobiono tę sprawę.
              Osobna lista, nie wiersz w „Co weszło": procedura nie jest treścią wniesioną
              do sprawy, tylko PODSTAWĄ. W biurze rachunkowym to jest gotowy dowód należytej
              staranności i ma się czytać jak taki.

              Stoi NA KOŃCU list, a nie na początku, bo odpowiada na pytanie zadawane po
              fakcie — „na jakiej podstawie to zrobiłeś" — a nie na „co się stało".

              Bez plakietki pliku: obiektem tego wiersza jest dokument firmy, nie plik
              w teczce sprawy, więc `Pill` prowadziłby donikąd. Cała treść wiersza — tytuł,
              wydanie, podpis i data — siedzi w zdaniu. */}
          <Ledger title={translate("trail.basedOn")} lines={evidence.basis} timeOf={timeOf} />
          {external && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Globe} px={14} className="mt-0.5 shrink-0 text-desk-muted" />
              <div>
                {/* „Zapytałem", nie „sprawdziłem": z tego, że obcy serwer odpowiedział,
                    nie wynika, że odpowiedział prawdę ani że rzecz się wydarzyła. */}
                <span className="text-desk-ink">{translate("trail.asked")}</span>{" "}
                <span className="text-desk-muted">
                  {evidence.external.map((w) => w.text).join(" · ")}
                </span>
              </div>
            </div>
          )}
          {uncertain && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={TriangleAlert} px={14} className="mt-0.5 shrink-0 text-desk-warn" />
              <div>
                <span className="text-desk-ink">{translate("trail.notChecked")}</span>{" "}
                <span className="text-desk-muted">{evidence.unverified.join(" · ")}</span>
              </div>
            </div>
          )}
          {blocked && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Lock} px={14} className="mt-0.5 shrink-0 text-desk-muted" />
              <div>
                <span className="text-desk-ink">{translate("trail.notAllowed")}</span>{" "}
                <span className="text-desk-muted">{evidence.notAllowed.join(" · ")}</span>
              </div>
            </div>
          )}
          <p className="t-micro pt-0.5">{translate("trail.note")}</p>
        </div>
      )}
    </section>
  )
}
