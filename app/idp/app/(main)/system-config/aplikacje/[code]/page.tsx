"use client"

import {
  useApplicationRoles,
  useApplicationScopeGrants,
  useApplicationScopes,
  useDeleteApplication,
  useKonfiguracjaApplications,
  useKonfiguracjaRoles,
  useSetApplicationRoles,
  useSetApplicationScopeRoles,
  useUpdateApplication,
} from "@/features/system-config/hooks"
import { resolveApplicationIcon } from "@/features/system-config/icons"
import { KIND_LABELS } from "@/features/system-config/kinds"
import type { Application, ApplicationInput, RoleSummary } from "@/features/system-config/types"
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
  Combobox,
  DataTable,
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
  Switch,
} from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, LayoutDashboard, ShieldAlert, Trash2 } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
 *  pierwszym kliknięciu/focusie placeholdera (patrz `isIconPickerActive`). */
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
  const Icon = resolveApplicationIcon(value)
  return (
    <Button
      id={id}
      type="button"
      variant="outline"
      className="w-full justify-start gap-2 font-normal"
      onClick={onActivate}
      onFocus={onActivate}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{value || "Wybierz ikonę"}</span>
    </Button>
  )
}

/** Radix Select nie przyjmuje pustej wartości, a `target` w bazie bywa NULL —
 *  stąd wartownik zamiast "". */
const NO_TARGET = "default"

interface FormState {
  name: string
  description: string
  icon: string
  category: string
  kind: TileKind
  route: string
  url: string
  target: typeof NO_TARGET | "_self" | "_blank"
  isActive: boolean
  sortOrder: string
}

function toFormState(application: Application): FormState {
  return {
    name: application.name,
    description: application.description ?? "",
    icon: application.icon ?? "",
    category: application.category ?? "",
    kind: application.kind,
    route: application.route ?? "",
    url: application.url ?? "",
    target: application.target === "_blank" || application.target === "_self" ? application.target : NO_TARGET,
    isActive: application.isActive,
    sortOrder: String(application.sortOrder),
  }
}

/** Formularz wysyła KOMPLET pól wiersza, łącznie z `target` — pominięcie
 *  któregokolwiek kasowało jego wartość przy każdej edycji. */
function toInput(code: string, form: FormState): ApplicationInput {
  const isNative = form.kind === "native"
  return {
    code,
    name: form.name.trim(),
    description: form.description.trim() || null,
    icon: form.icon.trim() || null,
    category: form.category.trim() || null,
    kind: form.kind,
    route: isNative ? form.route.trim() : null,
    url: isNative ? null : form.url.trim(),
    target: form.target === NO_TARGET ? null : form.target,
    isActive: form.isActive,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
  }
}

export default function AplikacjaSzczegolyPage() {
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(params.code)
  const router = useRouter()

  const applicationsQuery = useKonfiguracjaApplications()
  const application = applicationsQuery.data?.find((item) => item.code === code)

  // Katalog podpowiedzi dla comboboksa Kategorii — zero nowego endpointu,
  // wartości już są w pamięci przeglądarki na tym ekranie (design doc D6).
  const existingCategories = useMemo(() => {
    const values = (applicationsQuery.data ?? [])
      .map((item) => item.category)
      .filter((category): category is string => Boolean(category))
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  }, [applicationsQuery.data])

  const rolesQuery = useKonfiguracjaRoles()
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
  // Gate na montowanie `IconPicker` — patrz komentarz przy jego `dynamic()`
  // wyżej. Placeholder poniżej pokazuje aktualnie wybraną ikonę (ta sama
  // jawna lista co lista Aplikacje, `resolveApplicationIcon`), więc przejście
  // placeholder -> prawdziwy picker nie skacze wizualnie.
  const [isIconPickerActive, setIsIconPickerActive] = useState(false)

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
        Object.fromEntries(applicationScopeGrantsQuery.data.map((grant) => [grant.scopeId, grant.roleIds])),
      )
    }
  }, [applicationScopeGrantsQuery.data])

  // Kolumny macierzy: jedna statyczna "Rola" + po jednej na każdy zakres tej
  // aplikacji (D9). Musi żyć PRZED wczesnymi returnami niżej — to hook.
  const scopeColumns = useMemo<ColumnDef<RoleSummary, unknown>[]>(() => {
    const roleColumn: ColumnDef<RoleSummary, unknown> = {
      id: "role",
      header: "Rola",
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.description ?? row.original.code}
          </span>
        </div>
      ),
    }

    const columns = (applicationScopesQuery.data ?? []).map<ColumnDef<RoleSummary, unknown>>((scope) => ({
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
    }))

    return [roleColumn, ...columns]
  }, [applicationScopesQuery.data, scopeGrants])

  if (applicationsQuery.isLoading) {
    return (
      <>
        <PageHeader title="Aplikacja" />
        <div className="px-8 py-6">
          <LoadingState label="Wczytywanie aplikacji…" />
        </div>
      </>
    )
  }

  if (!application || !form) {
    return (
      <>
        <PageHeader title="Aplikacja" />
        <div className="px-8 py-6">
          <EmptyState
            icon={LayoutDashboard}
            title="Nie ma aplikacji o tym kodzie"
            description={`Kod ${code} nie występuje w rejestrze aplikacji.`}
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/system-config/aplikacje">Wróć do listy</Link>
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
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
      toast.success("Zapisano dane aplikacji")
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać aplikacji")
    }
  }

  async function handleSavePermissions() {
    if (!application) return
    try {
      await setApplicationRoles.mutateAsync({ id: application.id, roleIds: grantedRoleIds })
      toast.success("Zapisano uprawnienia")
    } catch (error) {
      // Serwer odrzucił zapis (np. 409 samo-zablokowanie), więc granty zostały
      // po staremu — checkboxy muszą wrócić do stanu z serwera. Bez tego ekran
      // pokazuje odznaczoną rolę, której nikt nie odebrał.
      setSelectedRoleIds(applicationRolesQuery.data?.roleIds ?? [])
      toastApiError(error, "Nie udało się zapisać uprawnień")
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
        return before.length !== after.length || before.some((roleId, index) => roleId !== after[index])
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
      toast.success("Zapisano zakresy")
    } catch (error) {
      // Błąd częściowy (jedna kolumna 409, inna 200) cofa lokalny stan do
      // prawdy serwera dla WSZYSTKICH kolumn, wzorem handleSavePermissions —
      // nie zostawia UI w stanie niespójnym z bazą.
      setScopeGrants(Object.fromEntries(serverGrants.map((grant) => [grant.scopeId, grant.roleIds])))
      toastApiError(error, "Nie udało się zapisać zakresów")
    } finally {
      setIsSavingScopes(false)
    }
  }

  async function handleDelete() {
    if (!application) return
    try {
      await deleteApplication.mutateAsync(application.id)
      toast.success(`Usunięto aplikację ${application.name}`)
      router.push("/system-config/aplikacje")
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć aplikacji")
    } finally {
      setIsDeleteOpen(false)
    }
  }

  return (
    <>
      <PageHeader
        title={application.name}
        description={`Kod uprawnienia: ${code}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/system-config/aplikacje">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Aplikacje
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSelfManaged}
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Usuń
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {isSelfManaged ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>To jest aplikacja, z której właśnie korzystasz</AlertTitle>
            <AlertDescription>
              Nie da się zmienić kodu, typu ani adresu tej aplikacji, ani jej wyłączyć czy usunąć.
              To po tym kodzie bramka sprawdza dostęp do Konfiguracji Systemu, a typ i adres
              opisują sam ten moduł — taka zmiana albo odcięłaby od niego wszystkich
              administratorów (łącznie z Tobą), albo wyprowadziłaby administrację poza tę
              aplikację, i dałoby się to cofnąć tylko ręcznie w bazie danych. Serwer odrzuca te
              operacje niezależnie od tego, co wyśle przeglądarka.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Podstawowe dane</h2>
            <p className="text-xs text-muted-foreground">
              Opis aplikacji w rejestrze instancji.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="code">Kod uprawnienia</Label>
                <Input id="code" value={code} disabled />
                <span className="text-xs text-muted-foreground">
                  Kodu nie da się zmienić po utworzeniu aplikacji.
                </span>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="name">Nazwa</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Opis</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="icon">Ikona</Label>
                {isIconPickerActive ? (
                  <IconPicker id="icon" value={form.icon} onChange={(value) => update("icon", value)} />
                ) : (
                  <IconPickerPlaceholder
                    id="icon"
                    value={form.icon}
                    onActivate={() => setIsIconPickerActive(true)}
                  />
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="category">Kategoria</Label>
                <Combobox
                  id="category"
                  value={form.category}
                  onChange={(value) => update("category", value)}
                  options={existingCategories}
                  placeholder="np. Administracja"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="kind">Typ aplikacji</Label>
              <Select
                value={form.kind}
                disabled={isSelfManaged}
                onValueChange={(value) => update("kind", value as TileKind)}
              >
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TileKindSchema.options.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.kind === "native" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="route">Ścieżka w aplikacji</Label>
                <Input
                  id="route"
                  value={form.route}
                  disabled={isSelfManaged}
                  onChange={(event) => update("route", event.target.value)}
                  placeholder="/raportowanie-tokenow"
                />
                <span className="text-xs text-muted-foreground">
                  Ścieżka wewnątrz tej aplikacji, zaczynająca się od pojedynczego ukośnika.
                </span>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="url">Adres zewnętrzny</Label>
                  <Input
                    id="url"
                    value={form.url}
                    disabled={isSelfManaged}
                    onChange={(event) => update("url", event.target.value)}
                    placeholder="https://chat.example.com"
                  />
                  <span className="text-xs text-muted-foreground">
                    Dozwolone wyłącznie adresy http:// i https://.
                  </span>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="target">Otwieranie</Label>
                  <Select
                    value={form.target}
                    onValueChange={(value) => update("target", value as FormState["target"])}
                  >
                    <SelectTrigger id="target">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TARGET}>Domyślne</SelectItem>
                      <SelectItem value="_self">To samo okno</SelectItem>
                      <SelectItem value="_blank">Nowa karta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sortOrder">Kolejność</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => update("sortOrder", event.target.value)}
                />
              </div>

              <div className="flex items-end gap-2 pb-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  disabled={isSelfManaged}
                  onCheckedChange={(checked) => update("isActive", checked)}
                />
                <Label htmlFor="isActive">Aplikacja aktywna</Label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveDetails} disabled={updateApplication.isPending}>
                Zapisz dane
              </Button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Uprawnienia</h2>
            <p className="text-xs text-muted-foreground">
              Role, które mają dostęp do tej aplikacji. Uprawnienia nadaje się rolom, nie
              użytkownikom.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-border p-4">
            {rolesQuery.isLoading || applicationRolesQuery.isLoading ? (
              <LoadingState label="Wczytywanie uprawnień…" />
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nie zdefiniowano jeszcze żadnej roli, więc nie ma komu nadać dostępu.
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
                  <Button onClick={handleSavePermissions} disabled={setApplicationRoles.isPending}>
                    Zapisz uprawnienia
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Zakresy</h2>
            <p className="text-xs text-muted-foreground">
              Granularne uprawnienia w środku tej aplikacji — konkretne akcje, nie sam dostęp do
              kafelka.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-border p-4">
            {applicationScopesQuery.isLoading ||
            applicationScopeGrantsQuery.isLoading ||
            rolesQuery.isLoading ? (
              <LoadingState label="Wczytywanie zakresów…" />
            ) : scopes.length === 0 ? (
              // D8/D9: świadoma, centralna decyzja tego modułu — katalog zakresów
              // powstaje w kodzie modułu (seed), nie tutaj. Zero create/delete.
              <p className="text-sm text-muted-foreground">
                Ta aplikacja nie definiuje żadnych zakresów granularnych. Zakresy powstają w
                kodzie modułu (razem z sekcją, którą chronią) — nie da się ich dodać z tego
                panelu.
              </p>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nie zdefiniowano jeszcze żadnej roli, więc nie ma komu nadać zakresu.
              </p>
            ) : (
              <>
                <DataTable columns={scopeColumns} data={roles} getRowId={(role) => role.id} bordered />
                <div className="flex justify-end">
                  <Button onClick={handleSaveScopes} disabled={isSavingScopes}>
                    Zapisz zakresy
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć aplikację {application.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Razem z aplikacją znikną wszystkie granty ról do niej. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteApplication.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
