"use client"

import { TILE_COLOR_OPTIONS } from "@/features/system-config/colors"
import {
  useApplicationRoles,
  useApplications,
  useApplicationScopeGrants,
  useApplicationScopes,
  useDeleteApplication,
  useRoles,
  useSetApplicationRoles,
  useSetApplicationScopeRoles,
  useUpdateApplication,
} from "@/features/system-config/hooks"
import { resolveApplicationIcon } from "@/features/system-config/icons"
import { KIND_LABEL_KEYS } from "@/features/system-config/kinds"
import type { Application, ApplicationInput, RoleSummary } from "@/features/system-config/types"
import { apiErrorMessage } from "@/lib/i18n/api-error"
import { usePreset } from "@/lib/presets/preset-store"
import { presetUsesApplicationColor } from "@/lib/presets/registry"
import { DEPARTMENT_CATEGORIES, FUNCTIONAL_CATEGORIES } from "@/lib/tiles"
import { toastApiError } from "@cortex/api"
import type { TileKind } from "@cortex/tile-sdk"
import { TileKind as TileKindSchema } from "@cortex/tile-sdk"
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, ChevronDown, Info, LayoutDashboard, ShieldAlert, Trash2 } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { systemConfigTile } from "../../manifest"

/** Katalog `lucide-react` (D4/D5) jest duży — dociągamy go leniwie. Subpath
 *  (nie barrel `@cortex/ui`) zapewnia realny code-split, wzorem `DocumentViewer`
 *  (patrz komentarz w `packages/@cortex/ui/src/index.ts`).
 *
 *  UWAGA: `next/dynamic({ ssr: false })` sam z siebie odracza fetch modułu
 *  do MONTOWANIA komponentu, NIE do interakcji użytkownika — gdyby ten
 *  komponent renderował się bezwarunkowo w formularzu, chunk ładowałby się
 *  praktycznie od razu po wejściu na stronę szczegółów aplikacji, wbrew
 *  zamierzeniu D4/D5. Dlatego poniżej montujemy go warunkowo, dopiero po
 *  pierwszym kliknięciu placeholdera (patrz `isIconPickerActive`).
 *
 *  Ten sam klik, który montuje `IconPicker`, nie ląduje na jego WŁASNYM
 *  `PopoverTrigger` — placeholder w tym momencie znika, prawdziwy komponent
 *  dopiero się pojawia, więc bez dodatkowego kroku user musiałby kliknąć
 *  DRUGI raz, żeby popover faktycznie się otworzył (zgłoszony bug — jedno
 *  kliknięcie zamiast otwierać wybór ikony, tylko "aktywowało" pole).
 *  `autoOpen` na `IconPicker` niżej zamyka tę lukę: ten sam klik od razu
 *  otwiera popover po zamontowaniu, więc user nie widzi dwuetapowości. */
const IconPicker = dynamic(
  () => import("@cortex/ui/components/ui/icon-picker").then((mod) => mod.IconPicker),
  { ssr: false, loading: () => <Skeleton className="h-9 w-full rounded-md" /> },
)

/** Statyczny placeholder pokazujący aktualnie wybraną ikonę (przez
 *  `resolveApplicationIcon`, ta sama jawna named-import lista co lista
 *  Aplikacje — zero namespace-importu). Zajmuje miejsce prawdziwego
 *  `IconPicker`, dopóki użytkownik faktycznie z nim nie wejdzie w interakcję. */
function IconPickerPlaceholder({
  id,
  value,
  onActivate,
}: {
  id?: string
  value: string
  onActivate: () => void
}) {
  const { t } = useTranslation("system-config")
  const Icon = resolveApplicationIcon(value)
  return (
    <Button
      id={id}
      type="button"
      variant="outline"
      className="w-full justify-start gap-2 font-normal"
      onClick={onActivate}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{value || t("applications.form.iconPlaceholder")}</span>
    </Button>
  )
}

/** Wielowartościowy wybór z ZAMKNIĘTEJ listy, złożony z prymitywów, które repo
 *  już ma (Popover + Checkbox + Button) — biblioteka nie ma multi-selecta, a
 *  jedno pole na jednym ekranie nie uzasadnia nowego prymitywu w `@cortex/ui`.
 *  Wygląda i otwiera się jak `Select` obok, ale świadomie NIE MA pola tekstowego:
 *  wartość spoza listy nie może powstać z tego formularza. */
function ClosedListMultiSelect({
  id,
  labelledBy,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  labelledBy: string
  value: string[]
  options: ReadonlyArray<{ id: string; label: string }>
  placeholder: string
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const summary = options
    .filter((option) => value.includes(option.id))
    .map((option) => option.label)
    .join(", ")

  function toggle(optionId: string, checked: boolean) {
    onChange(
      checked
        ? [...new Set([...value, optionId])]
        : value.filter((existing) => existing !== optionId),
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={`${labelledBy} ${id}`}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !summary && "text-muted-foreground")}>
            {summary || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2 px-1 py-1">
              <Checkbox
                id={`${id}-${option.id}`}
                checked={value.includes(option.id)}
                onCheckedChange={(checked) => toggle(option.id, checked === true)}
              />
              <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Radix Select nie przyjmuje pustej wartości, a `target`/`categoryFunctional`
 *  w bazie bywają NULL — stąd wartownik zamiast "". */
const NO_TARGET = "default"
const NO_FUNCTIONAL_CATEGORY = "none"

interface FormState {
  name: string
  description: string
  icon: string
  kind: TileKind
  route: string
  url: string
  target: typeof NO_TARGET | "_self" | "_blank"
  isActive: boolean
  // Hub-render (Krok 3, PROJECT/cortex-frontend-hub-db-driven-projekt.md D1-D3).
  showOnHub: boolean
  color: string
  categoryFunctional: typeof NO_FUNCTIONAL_CATEGORY | string
  /** Pole „Kategoria” w UI — kolumna nazywa się `category_department`,
   *  patrz komentarz przy schemacie w @cortex/db. */
  categoryDepartment: string[]
}

function toFormState(application: Application): FormState {
  return {
    name: application.name,
    description: application.description ?? "",
    icon: application.icon ?? "",
    kind: application.kind,
    route: application.route ?? "",
    url: application.url ?? "",
    target:
      application.target === "_blank" || application.target === "_self"
        ? application.target
        : NO_TARGET,
    isActive: application.isActive,
    showOnHub: application.showOnHub,
    color: application.color ?? "",
    categoryFunctional: application.categoryFunctional ?? NO_FUNCTIONAL_CATEGORY,
    categoryDepartment: application.categoryDepartment ?? [],
  }
}

/** Formularz wysyła KOMPLET pól wiersza, łącznie z `target` — pominięcie
 *  któregokolwiek kasowało jego wartość przy każdej edycji. `sortOrder` NIE
 *  jest tu polem formularza (patrz komentarz przy Switch `isActive` niżej) —
 *  celowo pominięte, więc PATCH go nie dotyka i zostaje tym, co ustawił tryb
 *  zmiany kolejności na liście Aplikacje. */
function toInput(code: string, form: FormState): ApplicationInput {
  const isNative = form.kind === "native"
  return {
    code,
    name: form.name.trim(),
    description: form.description.trim() || null,
    icon: form.icon.trim() || null,
    kind: form.kind,
    route: isNative ? form.route.trim() : null,
    url: isNative ? null : form.url.trim(),
    target: form.target === NO_TARGET ? null : form.target,
    isActive: form.isActive,
    showOnHub: form.showOnHub,
    color: form.color || null,
    categoryFunctional:
      form.categoryFunctional === NO_FUNCTIONAL_CATEGORY ? null : form.categoryFunctional,
    categoryDepartment: form.categoryDepartment.length > 0 ? form.categoryDepartment : null,
  }
}

export default function ApplicationDetailPage() {
  const { t } = useTranslation(["system-config", "common"])
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(params.code)
  const router = useRouter()

  const applicationsQuery = useApplications()
  const application = applicationsQuery.data?.find((item) => item.code === code)

  const rolesQuery = useRoles()
  const applicationRolesQuery = useApplicationRoles(application?.id)
  // D9: katalog zakresów tej aplikacji + macierz zakres -> role, w dwóch
  // osobnych zapytaniach (katalog rzadko się zmienia, macierz owszem).
  const applicationScopesQuery = useApplicationScopes(application?.id)
  const applicationScopeGrantsQuery = useApplicationScopeGrants(application?.id)

  const updateApplication = useUpdateApplication()
  const deleteApplication = useDeleteApplication()
  const setApplicationRoles = useSetApplicationRoles()
  const setApplicationScopeRoles = useSetApplicationScopeRoles()

  const [form, setForm] = useState<FormState | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[] | null>(null)
  // Stan edycji macierzy zakresów: scopeId -> lista roleId, które go mają.
  // `null` = jeszcze nie zsynchronizowany z serwerem (patrz useEffect niżej).
  const [scopeGrants, setScopeGrants] = useState<Record<string, string[]> | null>(null)
  const [isSavingScopes, setIsSavingScopes] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  // Krok 3 (D5/D1, ostrzeżenie przy wyłączaniu WIDOCZNEGO kafelka): otwarte
  // wyłącznie gdy admin wyłącza show_on_hub na kafelku, który TERAZ faktycznie
  // renderuje się na hubie (isActive && showOnHub) — wyłączenie już-ukrytego
  // wiersza albo włączenie z powrotem nie potrzebuje potwierdzenia.
  const [isHideFromHubWarningOpen, setIsHideFromHubWarningOpen] = useState(false)
  // Gate na montowanie `IconPicker` — patrz komentarz przy jego `dynamic()`
  // wyżej. Placeholder poniżej pokazuje aktualnie wybraną ikonę (ta sama
  // jawna lista co lista Aplikacje, `resolveApplicationIcon`), więc przejście
  // placeholder -> prawdziwy picker nie skacze wizualnie.
  const [isIconPickerActive, setIsIconPickerActive] = useState(false)
  // Sekcje strony (D-taby, wydzielone z jednego długiego scrolla — Podstawowe
  // dane/Uprawnienia/Zakresy miały już wcześniej osobne zapisy per sekcja,
  // taby tylko grupują to, co i tak było niezależne). Zwykły stan komponentu,
  // nie URL param — tak samo jak istniejący precedens w tym repo (patrz
  // `tab`/`activeTab` w `idp/rules/[id]/page.tsx` i `content-guru/page.tsx`,
  // żaden z nich nie synchronizuje wyboru taba z query stringiem).
  const [tab, setTab] = useState("basics")

  // Aktywny wygląd — potrzebny wyłącznie po to, żeby paleta kolorów niżej
  // powiedziała, kiedy nic nie robi (D6). Hook stoi PRZED wczesnymi returnami,
  // jak każdy inny w tym komponencie.
  const preset = usePreset()
  const isColorInertHere = !presetUsesApplicationColor(preset)

  // Wiersz, którego uprawnieniem chroniony jest ten moduł — tę samą regułę
  // egzekwuje serwer (SelfLockoutError), UI tylko ją tłumaczy.
  const isSelfManaged = code === systemConfigTile.entitlementCode

  useEffect(() => {
    if (application) setForm(toFormState(application))
  }, [application])

  useEffect(() => {
    if (applicationRolesQuery.data) setSelectedRoleIds(applicationRolesQuery.data.roleIds)
  }, [applicationRolesQuery.data])

  useEffect(() => {
    if (applicationScopeGrantsQuery.data) {
      setScopeGrants(
        Object.fromEntries(
          applicationScopeGrantsQuery.data.map((grant) => [grant.scopeId, grant.roleIds]),
        ),
      )
    }
  }, [applicationScopeGrantsQuery.data])

  // Kolumny macierzy: jedna statyczna "Rola" + po jednej na każdy zakres tej
  // aplikacji (D9). Musi żyć PRZED wczesnymi returnami niżej — to hook.
  const scopeColumns = useMemo<ColumnDef<RoleSummary, unknown>[]>(() => {
    const roleColumn: ColumnDef<RoleSummary, unknown> = {
      id: "role",
      header: t("applications.detail.scopeRoleColumn"),
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.description ?? row.original.code}
          </span>
        </div>
      ),
    }

    const columns = (applicationScopesQuery.data ?? []).map<ColumnDef<RoleSummary, unknown>>(
      (scope) => ({
        id: scope.id,
        header: scope.name,
        cell: ({ row }) => {
          const roleId = row.original.id
          return (
            <Checkbox
              checked={(scopeGrants?.[scope.id] ?? []).includes(roleId)}
              onCheckedChange={(checked) =>
                setScopeGrants((current) => {
                  const base = current ?? {}
                  const existing = base[scope.id] ?? []
                  const next =
                    checked === true
                      ? [...new Set([...existing, roleId])]
                      : existing.filter((id) => id !== roleId)
                  return { ...base, [scope.id]: next }
                })
              }
              aria-label={`${scope.name} — ${row.original.name}`}
            />
          )
        },
      }),
    )

    return [roleColumn, ...columns]
  }, [applicationScopesQuery.data, scopeGrants, t])

  if (applicationsQuery.isLoading) {
    return (
      <>
        <PageHeader title={t("applications.detail.fallbackTitle")} />
        <div className="px-8 py-6">
          <LoadingState label={t("applications.loading")} />
        </div>
      </>
    )
  }

  if (!application || !form) {
    return (
      <>
        <PageHeader title={t("applications.detail.fallbackTitle")} />
        <div className="px-8 py-6">
          <EmptyState
            icon={LayoutDashboard}
            title={t("applications.detail.notFoundTitle")}
            description={t("applications.detail.notFoundDescription", { code })}
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/system-config/applications">
                  {t("applications.detail.backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </>
    )
  }

  const roles = rolesQuery.data ?? []
  const grantedRoleIds = selectedRoleIds ?? []
  const scopes = applicationScopesQuery.data ?? []
  // D10-rewizja d: route/code/kind niezmienne dla KAŻDEGO już aktywowanego
  // wiersza kind=native, nie tylko dla system-config (isSelfManaged pilnuje
  // tego jednego, szczególnego przypadku osobno, z bardziej opisowym
  // komunikatem). Serwer (updateApplication) odrzuca te zmiany niezależnie od
  // tego pola — disabled tu jest wyjaśnieniem z wyprzedzeniem, nie jedyną
  // linią obrony, dokładnie jak isSelfManaged wyżej.
  const isNativeLocked = application.kind === "native"

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  // D1/D5 (Krok 3): wyłączenie show_on_hub na kafelku, który TERAZ jest
  // widoczny (isActive && showOnHub), ostrzega przed zapisem — user hubu
  // straci go natychmiast po "Zapisz dane". Włączenie z powrotem albo
  // wyłączenie już-niewidocznego wiersza nie zmienia nic widocznego, więc nie
  // potrzebuje potwierdzenia.
  function handleShowOnHubChange(checked: boolean) {
    if (!checked && form?.isActive && form.showOnHub) {
      setIsHideFromHubWarningOpen(true)
      return
    }
    update("showOnHub", checked)
  }

  function confirmHideFromHub() {
    update("showOnHub", false)
    setIsHideFromHubWarningOpen(false)
  }

  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) => {
      const base = current ?? []
      return checked ? [...new Set([...base, roleId])] : base.filter((id) => id !== roleId)
    })
  }

  async function handleSaveDetails() {
    if (!application || !form) return
    try {
      await updateApplication.mutateAsync({ id: application.id, body: toInput(code, form) })
      toast.success(t("applications.detail.toast.detailsSaved"))
    } catch (error) {
      // apiErrorMessage, a nie toastApiError: samo-zablokowanie i niezmienność
      // wiersza natywnego niosą KLUCZ zdania mówiący, CO dokładnie blokuje.
      toast.error(apiErrorMessage(t, error, t("applications.detail.errors.saveFailed")))
    }
  }

  async function handleSavePermissions() {
    if (!application) return
    try {
      await setApplicationRoles.mutateAsync({ id: application.id, roleIds: grantedRoleIds })
      toast.success(t("applications.detail.toast.permissionsSaved"))
    } catch (error) {
      // Serwer odrzucił zapis (np. 409 samo-zablokowanie), więc granty zostały
      // po staremu — checkboxy muszą wrócić do stanu z serwera. Bez tego ekran
      // pokazuje odznaczoną rolę, której nikt nie odebrał.
      setSelectedRoleIds(applicationRolesQuery.data?.roleIds ?? [])
      toast.error(apiErrorMessage(t, error, t("applications.detail.errors.permissionsSaveFailed")))
    }
  }

  /**
   * Zapis wsadowy macierzy zakresów (D9): JEDNO żądanie PUT per ZMIENIONĄ
   * kolumnę (nie per komórka), równolegle przez Promise.all — przy typowych
   * 1-3 zakresach na aplikację to 1-3 żądania, nie N×M. Kolumny bez zmian nie
   * generują żadnego żądania.
   */
  async function handleSaveScopes() {
    if (!application || !scopeGrants) return

    const serverGrants = applicationScopeGrantsQuery.data ?? []
    const serverByScope = new Map(serverGrants.map((grant) => [grant.scopeId, grant.roleIds]))

    const changedScopeIds = scopes
      .map((scope) => scope.id)
      .filter((scopeId) => {
        const before = [...(serverByScope.get(scopeId) ?? [])].sort()
        const after = [...(scopeGrants[scopeId] ?? [])].sort()
        return (
          before.length !== after.length || before.some((roleId, index) => roleId !== after[index])
        )
      })

    if (changedScopeIds.length === 0) return

    setIsSavingScopes(true)
    try {
      await Promise.all(
        changedScopeIds.map((scopeId) =>
          setApplicationScopeRoles.mutateAsync({
            id: application.id,
            scopeId,
            roleIds: scopeGrants[scopeId] ?? [],
          }),
        ),
      )
      toast.success(t("applications.detail.toast.scopesSaved"))
    } catch (error) {
      // Błąd częściowy (jedna kolumna 409, inna 200) cofa lokalny stan do
      // prawdy serwera dla WSZYSTKICH kolumn, wzorem handleSavePermissions —
      // nie zostawia UI w stanie niespójnym z bazą.
      setScopeGrants(
        Object.fromEntries(serverGrants.map((grant) => [grant.scopeId, grant.roleIds])),
      )
      toastApiError(error, t("applications.detail.errors.scopesSaveFailed"))
    } finally {
      setIsSavingScopes(false)
    }
  }

  async function handleDelete() {
    if (!application) return
    try {
      await deleteApplication.mutateAsync(application.id)
      toast.success(t("applications.detail.toast.deleted", { name: application.name }))
      router.push("/system-config/applications")
    } catch (error) {
      toast.error(apiErrorMessage(t, error, t("applications.detail.errors.deleteFailed")))
    } finally {
      setIsDeleteOpen(false)
    }
  }

  return (
    <>
      <PageHeader
        title={application.name}
        description={t("applications.detail.entitlementCodeCaption", { code })}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/system-config/applications">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t("applications.detail.backLink")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSelfManaged}
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("common:actions.delete")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {isSelfManaged ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{t("applications.detail.selfManagedTitle")}</AlertTitle>
            <AlertDescription>{t("applications.detail.selfManagedBody")}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="basics">{t("applications.detail.tabBasics")}</TabsTrigger>
            <TabsTrigger value="permissions">{t("applications.detail.tabPermissions")}</TabsTrigger>
            <TabsTrigger value="scopes">{t("applications.detail.tabScopes")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{t("applications.detail.basicsIntro")}</p>

            <div className="grid gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="code">{t("applications.form.entitlementCodeLabel")}</Label>
                  <Input id="code" value={code} disabled />
                  <span className="text-xs text-muted-foreground">
                    {t("applications.detail.codeLockedHint")}
                  </span>
                </div>

                <div className="grid content-start gap-1.5">
                  <Label htmlFor="name">{t("applications.form.nameLabel")}</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid content-start gap-1.5">
                <Label htmlFor="description">{t("applications.form.descriptionLabel")}</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </div>

              <div className="grid content-start gap-1.5">
                <Label htmlFor="icon">{t("applications.form.iconLabel")}</Label>
                {isIconPickerActive ? (
                  <IconPicker
                    id="icon"
                    value={form.icon}
                    onChange={(value) => update("icon", value)}
                    autoOpen
                  />
                ) : (
                  <IconPickerPlaceholder
                    id="icon"
                    value={form.icon}
                    onActivate={() => setIsIconPickerActive(true)}
                  />
                )}
              </div>

              <div className="grid content-start gap-1.5">
                <Label id="color-label">{t("applications.form.colorLabel")}</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="color-label">
                  {TILE_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={form.color === option.value}
                      aria-label={t(option.labelKey)}
                      title={t(option.labelKey)}
                      onClick={() => update("color", option.value)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                        option.iconBg,
                        form.color === option.value
                          ? "ring-2 ring-cortex ring-offset-2 ring-offset-background"
                          : "opacity-70 hover:opacity-100",
                      )}
                    >
                      <span
                        className={cn("h-3 w-3 rounded-full", option.iconFg)}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("applications.form.colorHint")}
                </span>
                {/* Wygląd, który tej palety nie czyta (dziś: Domino, D6 — trzy
                    akcenty z kategorii funkcjonalnej), zostawiał tu w pełni
                    działającą kontrolkę bez żadnego skutku na hubie: wartość
                    się zapisywała, kafelek się nie zmieniał i nic tego nie
                    tłumaczyło.

                    Świadomie NIE `disabled` na swatchach: kolor jest daną
                    INSTANCJI, nie ustawieniem podglądu edytującego. Zapisana
                    wartość zostaje w bazie i maluje kafelek każdemu, kto ma
                    wygląd czytający paletę — wyszarzenie kontrolki mówiłoby
                    „nie da się ustawić", czyli nieprawdę. Stąd zdanie, nie
                    blokada, i w tym samym miejscu co pozostałe podpowiedzi
                    formularza (wzorem `isNativeLocked` niżej). */}
                {isColorInertHere ? (
                  <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t("applications.form.colorInertNotice", { preset: preset.label })}</span>
                  </span>
                ) : null}
              </div>

              {/* Dokładnie DWA pola kategorii, oba z zamkniętej listy — decyzja
                  Alexa 05.08.2026. Wolnotekstowa "Kategoria" (kolumna
                  `category`) zniknęła stąd całkowicie: była wyłącznie etykietą
                  panelu administracyjnego, hub nigdy jej nie czytał. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-1.5">
                  <Label id="categoryDepartment-label" htmlFor="categoryDepartment">
                    {t("applications.form.categoryDepartmentLabel")}
                  </Label>
                  <ClosedListMultiSelect
                    id="categoryDepartment"
                    labelledBy="categoryDepartment-label"
                    value={form.categoryDepartment}
                    options={DEPARTMENT_CATEGORIES.map((c) => ({
                      id: c.id,
                      label: t(`common:${c.labelKey}`),
                    }))}
                    placeholder={t("applications.form.categoryDepartmentPlaceholder")}
                    onChange={(next) => update("categoryDepartment", next)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("applications.form.categoryDepartmentHint")}
                  </span>
                </div>

                <div className="grid content-start gap-1.5">
                  <Label htmlFor="categoryFunctional">
                    {t("applications.form.categoryFunctionalLabel")}
                  </Label>
                  <Select
                    value={form.categoryFunctional}
                    onValueChange={(value) => update("categoryFunctional", value)}
                  >
                    <SelectTrigger id="categoryFunctional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_FUNCTIONAL_CATEGORY}>
                        {t("applications.form.categoryFunctionalNone")}
                      </SelectItem>
                      {FUNCTIONAL_CATEGORIES.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {t(`common:${option.labelKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {t("applications.form.categoryFunctionalHint")}
                  </span>
                </div>
              </div>

              <div className="grid content-start gap-1.5">
                <Label htmlFor="kind">{t("applications.form.kindDetailLabel")}</Label>
                <Select
                  value={form.kind}
                  disabled={isSelfManaged || isNativeLocked}
                  onValueChange={(value) => update("kind", value as TileKind)}
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
                {isNativeLocked && !isSelfManaged ? (
                  <span className="text-xs text-muted-foreground">
                    {t("applications.form.nativeLockedHint")}
                  </span>
                ) : null}
              </div>

              {form.kind === "native" ? (
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="route">{t("applications.form.routeLabel")}</Label>
                  <Input
                    id="route"
                    value={form.route}
                    disabled={isSelfManaged || isNativeLocked}
                    onChange={(event) => update("route", event.target.value)}
                    placeholder="/raportowanie-tokenow"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("applications.form.routeHint")}
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="url">{t("applications.form.urlLabel")}</Label>
                    <Input
                      id="url"
                      value={form.url}
                      disabled={isSelfManaged}
                      onChange={(event) => update("url", event.target.value)}
                      placeholder="https://chat.example.com"
                    />
                    <span className="text-xs text-muted-foreground">
                      {t("applications.form.urlHint")}
                    </span>
                  </div>

                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="target">{t("applications.form.targetLabel")}</Label>
                    <Select
                      value={form.target}
                      onValueChange={(value) => update("target", value as FormState["target"])}
                    >
                      <SelectTrigger id="target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TARGET}>
                          {t("applications.form.targetDefault")}
                        </SelectItem>
                        <SelectItem value="_self">{t("applications.form.targetSelf")}</SelectItem>
                        <SelectItem value="_blank">{t("applications.form.targetBlank")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  disabled={isSelfManaged}
                  onCheckedChange={(checked) => update("isActive", checked)}
                />
                <Label htmlFor="isActive">{t("applications.form.isActiveLabel")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="showOnHub"
                  checked={form.showOnHub}
                  onCheckedChange={handleShowOnHubChange}
                />
                <Label htmlFor="showOnHub">{t("applications.form.showOnHubLabel")}</Label>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("applications.form.showOnHubHint")}
              </span>

              {/* Kolejność nie jest już edytowalna tutaj — patrz tryb zmiany
                  kolejności na liście Aplikacje (strzałki góra/dół). Trzymanie
                  tej samej wartości w dwóch miejscach naraz (surowy input tutaj
                  + reorder na liście) tylko rozjeżdżałoby oczekiwania: który z
                  nich wygrywa, jeśli ktoś edytuje oba niemal jednocześnie. */}

              <div className="flex justify-end">
                <Button onClick={handleSaveDetails} disabled={updateApplication.isPending}>
                  {t("applications.detail.saveBasics")}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {t("applications.detail.permissionsIntro")}
            </p>

            <div className="grid gap-4 rounded-lg border border-border p-4">
              {rolesQuery.isLoading || applicationRolesQuery.isLoading ? (
                <LoadingState label={t("applications.detail.permissionsLoading")} />
              ) : roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("applications.detail.noRolesForAccess")}
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    {roles.map((role: RoleSummary) => (
                      <div key={role.id} className="flex items-start gap-2">
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={grantedRoleIds.includes(role.id)}
                          onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
                        />
                        <div className="grid gap-0.5">
                          <Label htmlFor={`role-${role.id}`} className="cursor-pointer">
                            {role.name}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {role.description ?? role.code}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSavePermissions}
                      disabled={setApplicationRoles.isPending}
                    >
                      {t("applications.detail.savePermissions")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scopes" className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{t("applications.detail.scopesIntro")}</p>

            <div className="grid gap-4 rounded-lg border border-border p-4">
              {applicationScopesQuery.isLoading ||
              applicationScopeGrantsQuery.isLoading ||
              rolesQuery.isLoading ? (
                <LoadingState label={t("applications.detail.scopesLoading")} />
              ) : scopes.length === 0 ? (
                // D8/D9: świadoma, centralna decyzja tego modułu — katalog zakresów
                // powstaje w kodzie modułu (seed), nie tutaj. Zero create/delete.
                <p className="text-sm text-muted-foreground">{t("applications.detail.noScopes")}</p>
              ) : roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("applications.detail.noRolesForScopes")}
                </p>
              ) : (
                <>
                  <DataTable
                    columns={scopeColumns}
                    data={roles}
                    getRowId={(role) => role.id}
                    bordered
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSaveScopes} disabled={isSavingScopes}>
                      {t("applications.detail.saveScopes")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("applications.detail.deleteConfirmTitle", { name: application.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("applications.detail.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteApplication.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isHideFromHubWarningOpen} onOpenChange={setIsHideFromHubWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("applications.detail.hideConfirmTitle", { name: application.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("applications.detail.hideConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHideFromHub}>
              {t("applications.detail.hideConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
