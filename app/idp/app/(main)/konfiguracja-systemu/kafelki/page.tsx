"use client"

import {
  useCreateApplication,
  useKonfiguracjaApplications,
  useUpdateApplication,
} from "@/features/konfiguracja-systemu/hooks"
import type { Application, ApplicationInput } from "@/features/konfiguracja-systemu/types"
import { toastApiError } from "@cortex/api"
import { TileKind } from "@cortex/tile-sdk"
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
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@cortex/ui"
import { LayoutDashboard, Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type FormState = {
  code: string
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

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  icon: "",
  category: "",
  kind: "native",
  route: "",
  url: "",
  isActive: true,
  sortOrder: "0",
}

const KIND_LABELS: Record<TileKind, string> = {
  native: "Natywny (strona w tej aplikacji)",
  "external-link": "Link zewnętrzny (nowa karta)",
  iframe: "Osadzony (iframe)",
}

function toFormState(application: Application): FormState {
  return {
    code: application.code,
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

function toInput(form: FormState): ApplicationInput {
  const isNative = form.kind === "native"
  return {
    code: form.code.trim(),
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

export default function KafelkiPage() {
  const applicationsQuery = useKonfiguracjaApplications()
  const createApplication = useCreateApplication()
  const updateApplication = useUpdateApplication()

  const [isOpen, setIsOpen] = useState(false)
  const [editedId, setEditedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const applications = applicationsQuery.data ?? []
  const isSaving = createApplication.isPending || updateApplication.isPending

  function openCreate() {
    setEditedId(null)
    setForm(EMPTY_FORM)
    setIsOpen(true)
  }

  function openEdit(application: Application) {
    setEditedId(application.id)
    setForm(toFormState(application))
    setIsOpen(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    const body = toInput(form)
    try {
      if (editedId) {
        await updateApplication.mutateAsync({ id: editedId, body })
        toast.success(`Zaktualizowano kafelek ${body.name}`)
      } else {
        await createApplication.mutateAsync(body)
        toast.success(`Dodano kafelek ${body.name}`)
      }
      setIsOpen(false)
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać kafelka")
    }
  }

  return (
    <>
      <PageHeader
        title="Rejestr kafelków"
        description="Kafelki instancji konfigurowane z poziomu UI. Ten sam wpis jest jednocześnie kodem uprawnienia sprawdzanym przy wejściu do modułu."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Dodaj kafelek
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {applicationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie rejestru...</p>
        ) : applicationsQuery.isError ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Nie udało się wczytać rejestru"
            description="Sprawdź połączenie z bazą danych modułu Konfiguracja Systemu."
          />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Rejestr jest pusty"
            description="Dodaj pierwszy kafelek. Hub nadal pokazuje kafelki zaszyte w kodzie — pusty rejestr niczego nie wygasza."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Dodaj kafelek
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kod</th>
                  <th className="px-4 py-2 font-medium">Nazwa</th>
                  <th className="px-4 py-2 font-medium">Kategoria</th>
                  <th className="px-4 py-2 font-medium">Typ</th>
                  <th className="px-4 py-2 font-medium">Cel</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{application.code}</td>
                    <td className="px-4 py-2 font-medium">{application.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {application.category ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{application.kind}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {application.route ?? application.url ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={application.isActive ? "default" : "secondary"}>
                        {application.isActive ? "Aktywny" : "Wyłączony"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(application)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edytuj
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editedId ? "Edytuj kafelek" : "Nowy kafelek"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="code">Kod uprawnienia</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                placeholder="np. raportowanie-tokenow"
                disabled={editedId !== null}
              />
              <span className="text-xs text-muted-foreground">
                Małe litery, cyfry i myślnik. Po utworzeniu nie da się zmienić.
              </span>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">Nazwa</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="np. Raportowanie Tokenów"
              />
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
              <Label htmlFor="kind">Typ kafelka</Label>
              <Select value={form.kind} onValueChange={(value) => update("kind", value as TileKind)}>
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TileKind.options.map((kind) => (
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
                  onCheckedChange={(checked) => update("isActive", checked)}
                />
                <Label htmlFor="isActive">Kafelek aktywny</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
