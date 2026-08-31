import 'server-only'
import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { jsonSchema, tool } from 'ai'
import { randomUUID } from 'node:crypto'
import { dopiszKarte } from '../narzedzia'
import { maZdolnosc } from '../brama-zdolnosci'
import type { DeskEvent, Polityka } from '../typy'
import { SchematOdrzucony, kluczNarzedzia, oczyscSchemat, odcisk } from './higiena'
import { katalogSerwerow, wstrzymaj } from './katalog-serwer'
export type { SerwerMcp, ZatwierdzoneNarzedzie } from './katalog'

/**
 * KLIENT MCP — jedyne miejsce w kodzie, które wie, że MCP w ogóle istnieje.
 * Ta sama dyscyplina, co z biblioteką agentową w `runtime.ts`: na zewnątrz wychodzą
 * wyłącznie nasze `DeskEvent` i nasze narzędzia.
 *
 * Na tym etapie katalog serwerów jest PUSTY i to jest celowe. Zależność wchodzi
 * osobnym krokiem, przed pierwszym serwerem — inaczej przy pierwszej regresji
 * nie dałoby się odróżnić awarii harnessu od awarii integracji.
 */

export class DryfNarzedzia extends Error {}

/**
 * Buduje narzędzia z zatwierdzonych serwerów. Cztery rzeczy dzieją się tu naraz
 * i żadnej nie wolno pominąć:
 *
 * 1. `tools({ schemas })` z mapą pinowaną PO NASZEJ STRONIE. Domyślne `'automatic'`
 *    zaciągnęłoby każde narzędzie, które serwer akurat wystawia — czyli nowe narzędzie
 *    pojawiłoby się u pani Basi samo, bez niczyjej zgody.
 * 2. Opis widziany przez model pochodzi od zatwierdzającego, nie z serwera.
 * 3. Odcisk sprawdzany przy każdej rejestracji, fail-closed.
 * 4. Zdarzenia `narzedzie_start`/`narzedzie_koniec` emituje NASZ kod, nie SDK —
 *    bo na nich stoi cały dowód.
 */
export type WynikMcp = {
  narzedzia: Record<string, unknown>
  /**
   * Klienci MUSZĄ żyć do końca tury. Zamknięcie ich zaraz po rejestracji wygląda
   * na porządek, a kończy się „Attempted to send a request from a closed client"
   * przy pierwszym wywołaniu — bo model sięga po narzędzie dopiero w `generateText`.
   */
  zamknij: () => Promise<void>
}

export async function narzedziaMcp(
  p: Polityka,
  zdarz: (e: DeskEvent) => Promise<void>,
): Promise<WynikMcp> {
  const wynik: Record<string, unknown> = {}
  const otwarte: { close: () => Promise<void> }[] = []

  for (const serwer of await katalogSerwerow()) {
    // FILTR NA ODKRYCIU obowiązuje tak samo jak dla wbudowanych: narzędzie, którego
    // ta osoba nie ma przyznanego, nie jest rejestrowane — model go nie widzi.
    const dozwolone = serwer.narzedzia.filter((n) => maZdolnosc(p, n.zdolnoscId))
    if (!dozwolone.length) continue

    let klient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null
    try {
      klient = await experimental_createMCPClient({
        // Streamable HTTP, nigdy stdio: stdio w aplikacji webowej to nie transport,
        // tylko uruchomienie obcego binarium z uprawnieniami procesu Node.
        transport: { type: 'http', url: serwer.url },
      })
      otwarte.push(klient)
      const zdalne = await klient.tools({ schemas: 'automatic' })

      for (const n of dozwolone) {
        const surowe = (zdalne as Record<string, { inputSchema?: unknown }>)[n.nazwaZdalna]
        if (!surowe) throw new DryfNarzedzia(`Serwer ${serwer.nazwa} nie wystawia już ${n.nazwaZdalna}.`)

        // AI SDK opakowuje schemat w obiekt `Schema` — do odcisku i do rejestracji
        // bierzemy TREŚĆ, nie opakowanie, bo to ona jest kontraktem narzędzia.
        const surowyJson = (surowe.inputSchema as { jsonSchema?: unknown })?.jsonSchema ?? surowe.inputSchema
        const schemat = oczyscSchemat(surowyJson)
        const teraz = odcisk(serwer.nazwa, n.nazwaZdalna, n.opis, schemat)
        if (teraz !== n.odcisk) {
          // Wstrzymujemy POJEDYNCZE narzędzie i lecimy dalej: jedno zdryfowane nie ma prawa
          // odciąć pozostałych, które człowiek zatwierdził i które się nie zmieniły.
          const powod = `Serwer zmienił to narzędzie po zatwierdzeniu (odcisk ${n.odcisk.slice(0, 8)}… → ${teraz.slice(0, 8)}…).`
          await wstrzymaj(serwer.nazwa, n.nazwaZdalna, powod)
          await zdarz({ typ: 'zablokowane', opis: `${n.krotko} — ${powod} Czynność czeka na ponowną zgodę przełożonego.` })
          continue
        }

        const klucz = kluczNarzedzia(serwer.nazwa, n.nazwaZdalna)
        dopiszKarte({
          nazwa: klucz, klasa: 'zewnetrzna', zrodlo: serwer.nazwa,
          trwa: `Pytam ${serwer.etykieta}`, ok: `Zapytałem ${serwer.etykieta}`,
          grupa: {
            klucz: `zewnetrzne:${serwer.nazwa}`, czasownik: `zapytałem ${serwer.etykieta}`,
            liczone: ['raz', 'razy', 'razy'], waga: 4,
          },
          dowod: { lista: 'weszlo', fraza: (_x, d) => `${serwer.etykieta}: ${n.opis}${d ? ` — ${d}` : ''}` },
        })

        wynik[klucz] = tool({
          description: n.opis,
          inputSchema: jsonSchema(schemat as Record<string, unknown>),
          execute: async (argumenty: unknown) => {
            const start = Date.now(), kid = randomUUID()
            await zdarz({ typ: 'narzedzie_start', id: kid, nazwa: klucz, etykieta: n.krotko, zrodlo: serwer.etykieta, argumenty: argumenty as Record<string, unknown> })
            try {
              const r = await (surowe as { execute: (a: unknown) => Promise<unknown> }).execute(argumenty)
              // „serwer odpowiedział" to NIE to samo co „rzecz się wydarzyła" — stąd wiersz
              // dowodu idzie do „Co weszło", a nie do „Co zrobione". Decyduje o tym karta wyżej.
              await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: klucz, ok: true, podsumowanie: 'serwer odpowiedział', ms: Date.now() - start })
              return r
            } catch (e) {
              await zdarz({ typ: 'narzedzie_koniec', id: kid, nazwa: klucz, ok: false, podsumowanie: String(e).slice(0, 120), ms: Date.now() - start })
              throw e
            }
          },
        })
      }
    } catch (e) {
      // Martwy albo zdryfowany serwer NIE jest po cichu pomijany. Dla agenta w tle
      // pominięcie byłoby poprawne; dla pani Basi to dokładnie ta patologia, przeciw
      // której zbudowano `zglos_brak` — zlecenie wychodzi gorzej i nikt nie wie dlaczego.
      await zdarz({
        typ: 'zablokowane',
        opis: e instanceof DryfNarzedzia || e instanceof SchematOdrzucony
          ? e.message
          : `Nie udało się połączyć z ${serwer.nazwa}.`,
      })
      // klient zostaje otwarty — zamknie go runtime po zakończeniu tury
    }
  }

  return {
    narzedzia: wynik,
    zamknij: async () => { for (const k of otwarte) await k.close().catch(() => {}) },
  }
}

export type KandydatNarzedzia = {
  nazwaZdalna: string
  /** Schemat PO oczyszczeniu — to on wchodzi do odcisku i to on trafi do modelu. */
  schemat: unknown
  odciskDla: (opis: string) => string
  /**
   * SUROWY tekst napisany przez dostawcę serwera. Wolno go pokazać wyłącznie na ekranie
   * przyjmowania i wyłącznie pod etykietą mówiącą, czyj to tekst — nigdzie indziej i nigdy
   * modelowi. Jest tu po to, żeby zatwierdzający wiedział, co serwer o sobie twierdzi,
   * zanim napisze własny opis.
   */
  obcyOpis: string | null
  odrzucone: string | null
}

/**
 * Jedyne miejsce w aplikacji, które wykonuje `tools/list`. Nie rejestruje niczego —
 * zwraca kandydatów do obejrzenia przez człowieka.
 */
export async function przejrzyjSerwer(url: string, nazwa: string): Promise<KandydatNarzedzia[]> {
  const klient = await experimental_createMCPClient({ transport: { type: 'http', url } })
  try {
    const zdalne = await klient.tools({ schemas: 'automatic' })
    return Object.entries(zdalne as Record<string, { inputSchema?: unknown; description?: string }>)
      .map(([nazwaZdalna, def]) => {
        const surowyJson = (def.inputSchema as { jsonSchema?: unknown })?.jsonSchema ?? def.inputSchema
        try {
          const schemat = oczyscSchemat(surowyJson)
          return {
            nazwaZdalna, schemat,
            odciskDla: (opis: string) => odcisk(nazwa, nazwaZdalna, opis, schemat),
            obcyOpis: def.description ?? null,
            odrzucone: null,
          }
        } catch (e) {
          return {
            nazwaZdalna, schemat: null,
            odciskDla: () => '',
            obcyOpis: def.description ?? null,
            odrzucone: e instanceof SchematOdrzucony ? e.message : 'Nie umiem odczytać schematu tego narzędzia.',
          }
        }
      })
  } finally {
    await klient.close().catch(() => {})
  }
}
