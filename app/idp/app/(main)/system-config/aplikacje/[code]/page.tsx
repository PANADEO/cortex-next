"use client"

import { ScopeNote } from "@/features/system-config/components/scope-note"
import {
  useApplicationRoles,
  useDeleteApplication,
  useKonfiguracjaApplications,
  useKonfiguracjaRoles,
  useSetApplicationRoles,
  useUpdateApplication,
} from "@/features/system-config/hooks"
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
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@cortex/ui"
import { ArrowLeft, LayoutDashboard, ShieldAlert, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { systemConfigTile } from "../../manifest"

interface FormState {
  name: string
  description: string
  icon: string
  category: string
  kind: TileKind
  route: string
  url: string
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
    isActive: application.isActive,
    sortOrder: String(application.sortOrder),
  }
}

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

  const rolesQuery = useKonfiguracjaRoles()
  const applicationRolesQuery = useApplicationRoles(application?.id)

  const updateApplication = useUpdateApplication()
  const deleteApplication = useDeleteApplication()
  const setApplicationRoles = useSetApplicationRoles()

  const [form, setForm] = useState<FormState | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[] | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Wiersz, którego uprawnieniem chroniony jest ten moduł — tę samą regułę
  // egzekwuje serwer (SelfLockoutError), UI tylko ją tłumaczy.
  const isSelfManaged = code === systemConfigTile.entitlementCode

  useEffect(() => {
    if (application) setForm(toFormState(application))
  }, [application])

  useEffect(() => {
    if (applicationRolesQuery.data) setSelectedRoleIds(applicationRolesQuery.data.roleIds)
  }, [applicationRolesQuery.data])

  if (applicationsQuery.isLoading) {
    return (
      <>
        <PageHeader title="Aplikacja" />
        <div className="px-8 py-6">
          <p className="text-sm text-muted-foreground">Wczytywanie aplikacji...</p>
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
      toastApiError(error, "Nie udało się zapisać uprawnień")
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
        <ScopeNote />

        {isSelfManaged ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>To jest aplikacja, z której właśnie korzystasz</AlertTitle>
            <AlertDescription>
              Kodu tej aplikacji nie da się zmienić, a jej samej wyłączyć ani usunąć. To po tym
              kodzie bramka sprawdza dostęp do Konfiguracji Systemu, więc taka zmiana odcięłaby od
              niej wszystkich administratorów — łącznie z Tobą — i dałoby się to cofnąć tylko
              ręcznie w bazie danych. Serwer odrzuca te operacje niezależnie od tego, co wyśle
              przeglądarka.
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
                <Input
                  id="icon"
                  value={form.icon}
                  onChange={(event) => update("icon", event.target.value)}
                  placeholder="nazwa z lucide-react, np. Settings"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="category">Kategoria</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(event) => update("category", event.target.value)}
                  placeholder="np. Administracja"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="kind">Typ aplikacji</Label>
              <Select value={form.kind} onValueChange={(value) => update("kind", value as TileKind)}>
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
                  onChange={(event) => update("route", event.target.value)}
                  placeholder="/raportowanie-tokenow"
                />
                <span className="text-xs text-muted-foreground">
                  Ścieżka wewnątrz tej aplikacji, zaczynająca się od pojedynczego ukośnika.
                </span>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="url">Adres zewnętrzny</Label>
                <Input
                  id="url"
                  value={form.url}
                  onChange={(event) => update("url", event.target.value)}
                  placeholder="https://chat.example.com"
                />
                <span className="text-xs text-muted-foreground">
                  Dozwolone wyłącznie adresy http:// i https://.
                </span>
              </div>
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
              <p className="text-sm text-muted-foreground">Wczytywanie uprawnień...</p>
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
