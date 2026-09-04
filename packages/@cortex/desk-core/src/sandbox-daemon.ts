/**
 * KLIENT DEMONA `cortex-sandbox` — piaskownica prawdziwa, nie zastępcza.
 *
 * Cały ten plik to klient HTTP po gnieździe uniksowym i nie ma w nim ANI JEDNEJ decyzji
 * o izolacji. Wszystkie przeniosły się do demona, gdzie jest jedno miejsce, w którym da się
 * je przeczytać, i jeden profil utwardzenia, którego nie da się ominąć z poziomu wywołania.
 * To jest cała różnica wobec `sandbox.ts`, gdzie o izolacji decydowały flagi sklejane
 * w miejscu wywołania — czyli tam, gdzie najłatwiej o nich zapomnieć.
 *
 * Gniazdo, nie port: prawa dostępu do piaskownicy to prawa do pliku gniazda. Nie ma tokenu
 * do rotacji ani portu, który ktoś przypadkiem wystawi na świat.
 *
 * `node:http`, nie `undici` i nie `fetch`: repozytorium nie ma `undici` w zależnościach,
 * a wbudowany `fetch` Node'a nie umie gniazd uniksowych bez własnego dispatchera.
 */
import http from "node:http"

export type DaemonLimits = {
  seconds?: number
  memoryMb?: number
  cpu?: number
  pids?: number
  diskMb?: number
  outputKb?: number
}

/**
 * Powód zatrzymania. Dziś `ok:false` znaczy jednocześnie „twój kod rzucił wyjątek"
 * i „ubiliśmy cię, bo chciałeś dwa gigabajty". Pani Basia ma zobaczyć różnicę między
 * „obliczenie się nie udało" a „obliczenie było za duże" — a interfejs nie napisze tego
 * zdania, jeśli go nie dostanie.
 */
export type Stopped = "" | "timeout" | "memory" | "processes" | "output"

export type DaemonExec = {
  ok: boolean
  output: string
  exitCode: number
  stopped: Stopped
  ms: number
  /** pliki, które kod zostawił w katalogu sprawy — bez zgadywania przez skanowanie */
  produced: string[]
  /** ile pozycji NIE będących zwykłym plikiem usunięto przed policzeniem `produced` */
  removed?: number
}

export type DaemonBox = { id: string; folder: string; preset: string }

const socketPath = () => process.env.DESK_SANDBOX_SOCKET ?? ""

/** Czy w ogóle mamy demona. Brak zmiennej znaczy „zostajemy na ścieżce zastępczej". */
export const daemonConfigured = () => socketPath() !== ""

/**
 * CZY WOLNO W OGÓLE URUCHAMIAĆ KOD Z MODELU.
 *
 * Ścieżka zastępcza (`node --permission` w `sandbox.ts`) odcina system plików, ale NIE
 * ZAMYKA SIECI — jej własny komentarz mówi to wprost. Kod napisany przez model, puszczony
 * na dokumentach klienta, z otwartym internetem, jest czymś innym niż piaskownica i nie
 * może być domyślnym stanem wdrożenia tylko dlatego, że nikt nie ustawił zmiennej.
 *
 * `DESK_ALLOW_WEAK_SANDBOX` istnieje dla wdrożeń, które tę cenę znają i płacą świadomie
 * — jej obecność w pliku uruchomieniowym jest podpisem pod tą decyzją. Bez niej i bez
 * demona czynność licząca po prostu NIE WCHODZI do tury.
 */
export const sandboxUsable = () => daemonConfigured() || process.env.DESK_ALLOW_WEAK_SANDBOX === "1"

function call<T>(method: string, path: string, body?: unknown, timeoutMs = 120_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
    const req = http.request(
      {
        socketPath: socketPath(),
        path,
        method,
        headers: payload
          ? { "content-type": "application/json", "content-length": String(payload.length) }
          : {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c: Buffer) => chunks.push(c))
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          let parsed: unknown
          try {
            parsed = text === "" ? {} : JSON.parse(text)
          } catch {
            reject(
              new Error(
                `piaskownica odpowiedziała czymś, co nie jest JSON-em: ${text.slice(0, 200)}`,
              ),
            )
            return
          }
          const code = res.statusCode ?? 0
          if (code >= 400) {
            const message = (parsed as { error?: string }).error ?? `HTTP ${code}`
            reject(new Error(message))
            return
          }
          resolve(parsed as T)
        })
      },
    )
    // Bez tego zawieszony demon wiesza CAŁĄ turę, a człowiek widzi krok „w toku" bez końca.
    req.on("timeout", () => req.destroy(new Error("piaskownica nie odpowiedziała w czasie")))
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

export const health = () =>
  call<{ ok: boolean; docker: string; presets: string[] }>("GET", "/v1/health", undefined, 5_000)

export const presets = () =>
  call<{ presets: { id: string; label: string; kind: string }[]; default: string }>(
    "GET",
    "/v1/presets",
    undefined,
    5_000,
  )

/**
 * Wołający nazywa PRESET, nigdy obraz — to jest reguła demona i tu jej pilnujemy po naszej
 * stronie. Pole nazywa się `preset`, a nie `runtime`: pierwsza wersja tego klienta wysyłała
 * `runtime`, demon oczekiwał `preset`, a JSON połykał to po cichu — HTTP 201 i kod wykonany
 * w złym języku. Dziś demon odrzuca nieznane pola, więc taka pomyłka jest głośna.
 */
export const createBox = (opts: {
  user: string
  caseId: string
  preset?: string
  limits?: DaemonLimits
}) => call<DaemonBox>("POST", "/v1/sandboxes", opts, 60_000)

export const execBox = (id: string, code: string, timeoutMs: number) =>
  call<DaemonExec>("POST", `/v1/sandboxes/${encodeURIComponent(id)}/exec`, { code }, timeoutMs)

export const disposeBox = (id: string) =>
  call<unknown>("DELETE", `/v1/sandboxes/${encodeURIComponent(id)}`, undefined, 30_000).then(
    () => undefined,
  )
