"use client"

import {
  useActivateApplication,
  useApplications,
  useCreateApplication,
  useUnactivatedNativeApplications,
  useUpdateApplication,
} from "@/features/system-config/hooks"
import { resolveApplicationIcon } from "@/features/system-config/icons"
import { KIND_LABEL_KEYS, KIND_SHORT_LABEL_KEYS } from "@/features/system-config/kinds"
import type { Application } from "@/features/system-config/types"
import { apiErrorMessage } from "@/lib/i18n/api-error"
import { toastApiError } from "@cortex/api"
import type { TileKind } from "@cortex/tile-sdk"
import { TileKind as TileKindSchema } from "@cortex/tile-sdk"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@cortex/ui"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Power,
  PowerOff,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { systemConfigTile } from "../manifest"

interface NewApplicationForm {
  kind: TileKind
  // Ścieżka external-link/iframe (bez zmian, wolny tekst) — jak dziś.
  code: string
  name: string
  url: string
  // Ścieżka native (D6-rewizja/D10-rewizja d): code/name/route NIE są tu
  // wpisywane ręcznie — dochodzą wyłącznie z wybranego, zarejestrowanego
  // manifestu (patrz selectedManifest niżej). Samo `manifestCode` steruje
  // SELECT-em; reszta pól jest DERIVED z listy kandydatów w renderze, nie
  // duplikowana w stanie, żeby nie mogła się z nią rozjechać.
  manifestCode: string
}

const EMPTY_FORM: NewApplicationForm = {
  kind: "native",
  code: "",
  name: "",
  url: "",
  manifestCode: "",
}

/** Krok między kolejnymi wartościami po przenumerowaniu w trybie zmiany
 *  kolejności — zostawia miejsce (dziś nieużywane), spójnie z tym jak seedy
 *  dziś numerują (`index * 10`). */
const SORT_ORDER_STEP = 10

export default function ApplicationsPage() {
  const { t } = useTranslation(["system-config", "common"])
  const router = useRouter()
  const applicationsQuery = useApplications()
  const createApplication = useCreateApplication()
  const updateApplication = useUpdateApplication()
  const activateApplication = useActivateApplication()

  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<NewApplicationForm>(EMPTY_FORM)
  // D6-rewizja/D10-rewizja d: kandydaci dla kind=native — manifesty
  // zarejestrowane w kodzie (@cortex/tile-sdk defineTile()), jeszcze nigdy nie
  // aktywowane w tej instancji. Pobierane tylko gdy faktycznie potrzebne
  // (dialog otwarty i wybrany typ to native), nie na każde otwarcie strony.
  const unactivatedNativeQuery = useUnactivatedNativeApplications(isOpen && form.kind === "native")
  const unactivatedNative = unactivatedNativeQuery.data ?? []
  const selectedManifest = unactivatedNative.find(
    (candidate) => candidate.code === form.manifestCode,
  )

  // Tryb zmiany kolejności: `localOrder` to robocza kopia listy, edytowana
  // strzałkami góra/dół. Poza tym trybem renderujemy zawsze świeże dane z
  // serwera — `localOrder` istnieje wyłącznie żeby ruch nie migał z powrotem
  // do starej kolejności w oknie między optymistyczną zmianą a odświeżeniem
  // zapytania (ten sam wzorzec co macierz zakresów w szczegółach aplikacji).
  const [isReordering, setIsReordering] = useState(false)
  const [localOrder, setLocalOrder] = useState<Application[] | null>(null)
  const [isMovingOrder, setIsMovingOrder] = useState(false)

  const applications = applicationsQuery.data ?? []
  const displayedApplications = isReordering ? (localOrder ?? applications) : applications

  function openCreate() {
    setForm(EMPTY_FORM)
    setIsOpen(true)
  }

  function update<K extends keyof NewApplicationForm>(key: K, value: NewApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Zmiana typu resetuje resztę formularza: ścieżka native (wybór z listy
  // manifestów) i ścieżka external-link/iframe (wolny tekst) nie mają ze sobą
  // nic wspólnego poza polem `kind` — carry-over tylko myliłby.
  function handleKindChange(kind: TileKind) {
    setForm({ ...EMPTY_FORM, kind })
  }

  function selectManifest(manifestCode: string) {
    update("manifestCode", manifestCode)
  }

  // Po utworzeniu/aktywacji wchodzimy od razu w szczegóły — tam jest sekcja
  // Uprawnienia, bez której nowa aplikacja jest niedostępna dla nikogo.
  async function handleCreate() {
    try {
      if (form.kind === "native") {
        // Formularz nie pozwala kliknąć "Aktywuj" bez wyboru — patrz `disabled`
        // niżej — ale serwis i tak odrzuciłby pusty/nieznany kod, więc to tylko
        // wcześniejszy, czytelniejszy wyjazd.
        if (!form.manifestCode) return
        const activated = await activateApplication.mutateAsync(form.manifestCode)
        setIsOpen(false)
        toast.success(t("applications.toast.activated", { name: activated.name }))
        router.push(`/system-config/applications/${activated.code}`)
        return
      }

      const created = await createApplication.mutateAsync({
        code: form.code.trim(),
        name: form.name.trim(),
        kind: form.kind,
        route: null,
        url: form.url.trim(),
      })
      setIsOpen(false)
      toast.success(t("applications.toast.created", { name: created.name }))
      router.push(`/system-config/applications/${created.code}`)
    } catch (error) {
      // apiErrorMessage, a nie toastApiError: brak licencji na moduł i odmowa
      // utworzenia kafelka natywnego z formularza niosą KLUCZ zdania.
      toast.error(
        apiErrorMessage(
          t,
          error,
          form.kind === "native"
            ? t("applications.errors.activateFailed")
            : t("applications.errors.createFailed"),
        ),
      )
    }
  }

  // Ten sam poziom ryzyka co "Zmień role"/"Dezaktywuj użytkownika" gdzie
  // indziej w tym module — zapisuje się od razu po kliknięciu, bez
  // potwierdzenia. Wiersz `system-config` jest chroniony przez
  // `assertKeepsModuleReachable` w serwisie niezależnie od tego, czy przycisk
  // tutaj jest disabled — disabled jest tylko wyjaśnieniem z wyprzedzeniem,
  // nie jedyną linią obrony.
  async function handleToggleActive(application: Application) {
    try {
      await updateApplication.mutateAsync({
        id: application.id,
        body: { isActive: !application.isActive },
      })
      toast.success(
        application.isActive
          ? t("applications.toast.disabled", { name: application.name })
          : t("applications.toast.enabled", { name: application.name }),
      )
    } catch (error) {
      toast.error(
        apiErrorMessage(
          t,
          error,
          application.isActive
            ? t("applications.errors.disableFailed")
            : t("applications.errors.enableFailed"),
        ),
      )
    }
  }

  function enterReorderMode() {
    setLocalOrder(applications)
    setIsReordering(true)
  }

  function exitReorderMode() {
    setIsReordering(false)
    setLocalOrder(null)
  }

  // Przenumerowuje WSZYSTKIE wiersze na czyste wielokrotności 10 wg nowej
  // kolejności i zapisuje tylko te, których sortOrder faktycznie się zmienił
  // (zwykle 2 — przenoszony wiersz i ten, z którym się zamienił miejscami).
  // Celowo nie zamieniamy samych wartości sortOrder między sąsiadami: dzisiejsze
  // dane mają znane kolizje (ten sam sortOrder na dwóch wierszach z różnych
  // seedów) — zamiana identycznych wartości byłaby zauważalnym no-opem.
  //
  // Po zapisie ZAWSZE odświeżamy `localOrder` ze świeżego refetchu, nigdy z
  // domkniętego `applications`/`next` sprzed batcha. Dwa powody (znalezione w
  // niezależnym review): (1) obiekty w `next` nie miały własnego pola
  // `sortOrder` zaktualizowanego po zapisie — tylko pozycję w tablicy — więc
  // kolejny ruch w tej samej sesji porównywałby się do już nieaktualnej
  // wartości i wysyłał coraz więcej zbędnych PATCH-y; (2) `Promise.allSettled`
  // (nie `Promise.all`) pozwala odróżnić częściową porażkę od całkowitej —
  // przy częściowej część wierszy w tym samym batchu faktycznie zapisała się
  // w bazie, więc cofnięcie do stanu SPRZED batcha pokazywałoby coś, co już
  // nieprawda.
  async function persistOrder(next: Application[]) {
    const changes = next
      .map((application, index) => ({ application, sortOrder: (index + 1) * SORT_ORDER_STEP }))
      .filter(({ application, sortOrder }) => application.sortOrder !== sortOrder)

    if (changes.length === 0) return

    setIsMovingOrder(true)
    const results = await Promise.allSettled(
      changes.map(({ application, sortOrder }) =>
        updateApplication.mutateAsync({ id: application.id, body: { sortOrder } }),
      ),
    )
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )

    const refetched = await applicationsQuery.refetch()
    setLocalOrder(refetched.data ?? next)

    if (failures.length > 0) {
      toastApiError(
        failures[0]?.reason,
        failures.length === changes.length
          ? t("applications.errors.reorderFailed")
          : t("applications.errors.reorderPartial", {
              failed: failures.length,
              total: changes.length,
            }),
      )
    }

    setIsMovingOrder(false)
  }

  function moveApplication(index: number, direction: -1 | 1) {
    const current = localOrder ?? applications
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= current.length) return

    const next = [...current]
    const moved = next[index]!
    next[index] = next[targetIndex]!
    next[targetIndex] = moved
    setLocalOrder(next)
    void persistOrder(next)
  }

  return (
    <>
      <PageHeader
        title={t("applications.title")}
        description={t("applications.description")}
        actions={
          isReordering ? (
            <Button size="sm" variant="outline" onClick={exitReorderMode}>
              {t("applications.reorderExit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={enterReorderMode}>
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                {t("applications.reorderEnter")}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("applications.add")}
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {isReordering ? (
          <p className="text-xs text-muted-foreground">{t("applications.reorderHint")}</p>
        ) : null}
        {applicationsQuery.isLoading ? (
          <LoadingState label={t("applications.loading")} />
        ) : applicationsQuery.isError ? (
          <EmptyState
            icon={LayoutDashboard}
            title={t("applications.loadFailedTitle")}
            description={t("shared.dbConnectionHint")}
          />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title={t("applications.emptyTitle")}
            description={t("applications.emptyDescription")}
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("applications.add")}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2 font-medium">{t("applications.columnCode")}</th>
                  <th className="px-4 py-2 font-medium">{t("applications.columnName")}</th>
                  <th className="px-4 py-2 font-medium">{t("applications.columnKind")}</th>
                  <th className="px-4 py-2 font-medium">{t("applications.columnStatus")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {displayedApplications.map((application, index) => {
                  const Icon = resolveApplicationIcon(application.icon)
                  const isSelfManaged = application.code === systemConfigTile.entitlementCode
                  return (
                    <tr key={application.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{application.code}</td>
                      <td className="px-4 py-2 font-medium">{application.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">
                          {t(KIND_SHORT_LABEL_KEYS[application.kind])}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={application.isActive ? "default" : "secondary"}>
                          {application.isActive
                            ? t("applications.statusActive")
                            : t("applications.statusDisabled")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isReordering ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0 || isMovingOrder}
                              onClick={() => moveApplication(index, -1)}
                              aria-label={t("applications.moveUpAria", { name: application.name })}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === displayedApplications.length - 1 || isMovingOrder}
                              onClick={() => moveApplication(index, 1)}
                              aria-label={t("applications.moveDownAria", {
                                name: application.name,
                              })}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isSelfManaged || updateApplication.isPending}
                              title={
                                isSelfManaged ? t("applications.selfManagedTooltip") : undefined
                              }
                              onClick={() => handleToggleActive(application)}
                              aria-label={
                                application.isActive
                                  ? t("applications.disableAria", { name: application.name })
                                  : t("applications.enableAria", { name: application.name })
                              }
                            >
                              {application.isActive ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t("applications.openDetailsAria", {
                                name: application.name,
                              })}
                              onClick={() =>
                                router.push(`/system-config/applications/${application.code}`)
                              }
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("applications.createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="kind">{t("applications.form.kindLabel")}</Label>
              <Select
                value={form.kind}
                onValueChange={(value) => handleKindChange(value as TileKind)}
              >
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TileKindSchema.options.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(KIND_LABEL_KEYS[kind])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.kind === "native" ? (
              // D6-rewizja/D10-rewizja d: kind=native powstaje WYŁĄCZNIE przez
              // aktywację zarejestrowanego manifestu — kod/nazwa/ścieżka nie są
              // tu wolnym tekstem, tylko wyborem z listy tego, co realnie ma
              // stronę w kodzie (defineTile() w danym module).
              <div className="grid gap-1.5">
                <Label htmlFor="manifest">{t("applications.form.manifestLabel")}</Label>
                {unactivatedNativeQuery.isLoading ? (
                  <Skeleton className="h-9 w-full rounded-md" />
                ) : unactivatedNative.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("applications.form.noManifests")}
                  </p>
                ) : (
                  <Select value={form.manifestCode} onValueChange={selectManifest}>
                    <SelectTrigger id="manifest">
                      <SelectValue placeholder={t("applications.form.manifestPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {unactivatedNative.map((candidate) => (
                        <SelectItem key={candidate.code} value={candidate.code}>
                          {candidate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedManifest ? (
                  <div className="mt-2 grid gap-2 rounded-md border border-border p-3 text-xs">
                    <div className="grid gap-0.5">
                      <span className="text-muted-foreground">
                        {t("applications.form.entitlementCodeLabel")}
                      </span>
                      <span className="font-mono">{selectedManifest.code}</span>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-muted-foreground">
                        {t("applications.form.routeLabel")}
                      </span>
                      <span className="font-mono">{selectedManifest.route}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {t("applications.form.manifestLockedHint")}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="code">{t("applications.form.entitlementCodeLabel")}</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(event) => update("code", event.target.value)}
                    placeholder={t("applications.form.codePlaceholder")}
                  />
                  <span className="text-xs text-muted-foreground">{t("shared.codeHint")}</span>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="name">{t("applications.form.nameLabel")}</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder={t("applications.form.namePlaceholder")}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="url">{t("applications.form.urlLabel")}</Label>
                  <Input
                    id="url"
                    value={form.url}
                    onChange={(event) => update("url", event.target.value)}
                    placeholder="https://chat.example.com"
                  />
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground">
              {form.kind === "native"
                ? t("applications.form.nextStepNative")
                : t("applications.form.nextStepExternal")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                form.kind === "native"
                  ? !form.manifestCode || activateApplication.isPending
                  : createApplication.isPending
              }
            >
              {form.kind === "native" ? t("applications.activate") : t("common:actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
