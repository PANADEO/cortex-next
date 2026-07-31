"use client"

import { useCreateApplication, useKonfiguracjaApplications } from "@/features/system-config/hooks"
import { KIND_LABELS, KIND_SHORT_LABELS } from "@/features/system-config/kinds"
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
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { LayoutDashboard, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface NewApplicationForm {
  code: string
  name: string
  kind: TileKind
  route: string
  url: string
}

const EMPTY_FORM: NewApplicationForm = {
  code: "",
  name: "",
  kind: "native",
  route: "",
  url: "",
}

export default function AplikacjePage() {
  const router = useRouter()
  const applicationsQuery = useKonfiguracjaApplications()
  const createApplication = useCreateApplication()

  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<NewApplicationForm>(EMPTY_FORM)

  const applications = applicationsQuery.data ?? []

  function openCreate() {
    setForm(EMPTY_FORM)
    setIsOpen(true)
  }

  function update<K extends keyof NewApplicationForm>(key: K, value: NewApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Po utworzeniu wchodzimy od razu w szczegóły — tam jest sekcja Uprawnienia,
  // bez której nowa aplikacja jest niedostępna dla nikogo.
  async function handleCreate() {
    const isNative = form.kind === "native"
    try {
      const created = await createApplication.mutateAsync({
        code: form.code.trim(),
        name: form.name.trim(),
        kind: form.kind,
        route: isNative ? form.route.trim() : null,
        url: isNative ? null : form.url.trim(),
      })
      setIsOpen(false)
      toast.success(`Dodano aplikację ${created.name}`)
      router.push(`/system-config/aplikacje/${created.code}`)
    } catch (error) {
      toastApiError(error, "Nie udało się dodać aplikacji")
    }
  }

  return (
    <>
      <PageHeader
        title="Aplikacje"
        description="Aplikacje instancji. Kod aplikacji jest jednocześnie kodem uprawnienia sprawdzanym przy wejściu do modułu."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Dodaj aplikację
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {applicationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie aplikacji...</p>
        ) : applicationsQuery.isError ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Nie udało się wczytać aplikacji"
            description="Sprawdź połączenie z bazą danych modułu Konfiguracja Systemu."
          />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Brak aplikacji"
            description="Dodaj pierwszą aplikację. Hub nadal pokazuje kafelki zaszyte w kodzie — pusta lista niczego nie wygasza."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Dodaj aplikację
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
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr
                    key={application.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Szczegóły aplikacji ${application.name}`}
                    className="cursor-pointer border-t border-border outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
                    onClick={() => router.push(`/system-config/aplikacje/${application.code}`)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return
                      event.preventDefault()
                      router.push(`/system-config/aplikacje/${application.code}`)
                    }}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{application.code}</td>
                    <td className="px-4 py-2 font-medium">{application.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {application.category ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{KIND_SHORT_LABELS[application.kind]}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={application.isActive ? "default" : "secondary"}>
                        {application.isActive ? "Aktywna" : "Wyłączona"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa aplikacja</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="code">Kod uprawnienia</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                placeholder="np. raportowanie-tokenow"
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
              <Label htmlFor="kind">Typ</Label>
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

            <p className="text-xs text-muted-foreground">
              Pozostałe pola i uprawnienia ról ustawisz na stronie szczegółów, zaraz po utworzeniu.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleCreate} disabled={createApplication.isPending}>
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
