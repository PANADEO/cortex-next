"use client"

import { toastApiError } from "@cortex/api"
import { formatAbsolute } from "@cortex/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  CortexDataGrid,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  Textarea,
} from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight, Copy, Download, MoreHorizontal, Plus, Sparkles, Trash2, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  useContentGuruConfig,
  useCreateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  useTemplates,
  useTestTemplateGeneration,
  useUpdateTemplate,
} from "@/features/content-guru/hooks"
import type { TemplateDto, TemplateInputDto } from "@/features/content-guru/types"

const NEW_TEMPLATE_SENTINEL = "__new__"
const ALL_CATEGORIES = "__all__"
const EMPTY_DRAFT: TemplateInputDto = { name: "", category: "Główne", content: "" }
// Referencja stabilna między renderami — inaczej `templatesQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższe useMemo.
const EMPTY_TEMPLATES: TemplateDto[] = []

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function templateExportShape(template: TemplateDto | TemplateInputDto) {
  return { name: template.name, category: template.category, content: template.content }
}

export default function ContentGuruTemplatesPage() {
  const templatesQuery = useTemplates()
  const configQuery = useContentGuruConfig()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const duplicateTemplate = useDuplicateTemplate()
  const testGeneration = useTestTemplateGeneration()

  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES)
  const [editedId, setEditedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateInputDto>(EMPTY_DRAFT)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateDto | null>(null)
  const [testTopic, setTestTopic] = useState("")
  const [testModel, setTestModel] = useState("")
  const importInputRef = useRef<HTMLInputElement>(null)

  const templates = templatesQuery.data ?? EMPTY_TEMPLATES
  const models = useMemo(() => configQuery.data?.models ?? [], [configQuery.data])

  const categories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))).sort(),
    [templates],
  )
  const filtered = useMemo(
    () =>
      categoryFilter === ALL_CATEGORIES
        ? templates
        : templates.filter((template) => template.category === categoryFilter),
    [templates, categoryFilter],
  )

  const editorOpen = editedId !== null
  const isNew = editedId === NEW_TEMPLATE_SENTINEL

  function openNew() {
    setDraft(EMPTY_DRAFT)
    testGeneration.reset()
    setTestTopic("")
    setTestModel(models[0] ?? "")
    setEditedId(NEW_TEMPLATE_SENTINEL)
  }

  function openEdit(template: TemplateDto) {
    setDraft({ name: template.name, category: template.category, content: template.content })
    testGeneration.reset()
    setTestTopic("")
    setTestModel(models[0] ?? "")
    setEditedId(template.id)
  }

  function closeEditor() {
    setEditedId(null)
  }

  async function handleSave() {
    try {
      if (isNew) {
        await createTemplate.mutateAsync(draft)
        toast.success(`Utworzono szablon "${draft.name}"`)
      } else if (editedId) {
        await updateTemplate.mutateAsync({ id: editedId, body: draft })
        toast.success("Zapisano zmiany w szablonie")
      }
      closeEditor()
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać szablonu")
    }
  }

  async function handleDelete() {
    if (!templateToDelete) return
    try {
      await deleteTemplate.mutateAsync(templateToDelete.id)
      toast.success(`Usunięto szablon "${templateToDelete.name}"`)
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć szablonu")
    } finally {
      setTemplateToDelete(null)
    }
  }

  async function handleDuplicate(template: TemplateDto) {
    try {
      const copy = await duplicateTemplate.mutateAsync(template.id)
      toast.success(`Utworzono kopię: "${copy.name}"`)
    } catch (error) {
      toastApiError(error, "Nie udało się zduplikować szablonu")
    }
  }

  async function handleTestGeneration() {
    if (!testModel) return
    try {
      const result = await testGeneration.mutateAsync({
        category: draft.category,
        name: draft.name,
        content: draft.content,
        // Klucz POMINIĘTY (nie `undefined`) gdy brak tematu testowego —
        // exactOptionalPropertyTypes rozróżnia "nieobecny klucz" od "klucz z
        // wartością undefined".
        ...(testTopic.trim() ? { topic: testTopic.trim() } : {}),
        model: testModel,
      })
      if (result.status === "done-with-warnings") {
        toast.warning("Testowa generacja zawiera zakazane frazy z Twojej listy")
      }
    } catch (error) {
      toastApiError(error, "Nie udało się przeprowadzić testowej generacji")
    }
  }

  function importFromFile(files: File[]) {
    const file = files[0]
    if (!file) return

    file
      .text()
      .then(async (text) => {
        const parsed: unknown = JSON.parse(text)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        const valid = items.filter(
          (item): item is TemplateInputDto =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as TemplateInputDto).name === "string" &&
            typeof (item as TemplateInputDto).category === "string" &&
            typeof (item as TemplateInputDto).content === "string",
        )

        if (valid.length === 0) {
          toast.error("Plik nie zawiera poprawnych szablonów (wymagane pola: name, category, content)")
          return
        }

        let succeeded = 0
        for (const item of valid) {
          try {
            await createTemplate.mutateAsync(item)
            succeeded += 1
          } catch {
            // Kontynuuj import reszty — pojedynczy błąd (np. duplikat nazwy)
            // nie ma blokować całej paczki.
          }
        }
        toast.success(`Zaimportowano ${succeeded} z ${valid.length} szablonów`)
      })
      .catch(() => toast.error("Nie udało się odczytać pliku JSON"))
  }

  // Świadomie BEZ useMemo — cell renderery domykają się nad handlerami
  // zmieniającymi się co render (openEdit/handleDuplicate/setTemplateToDelete
  // nie są tu owinięte w useCallback), więc memoizacja z poprawnymi deps i
  // tak przeliczałaby się co render; CortexDataGrid stabilizuje TYLKO nagłówki
  // sortowalne (meta-swap w withSortableHeaders), nie wymaga stabilnej
  // referencji `columns` żeby `cell` renderery działały poprawnie.
  const columns: ColumnDef<TemplateDto, unknown>[] = [
    { accessorKey: "category", header: "Kategoria", enableSorting: true },
    { accessorKey: "name", header: "Nazwa", enableSorting: true },
    {
      accessorKey: "updatedAt",
      header: "Data edycji",
      enableSorting: true,
      cell: ({ row }) => formatAbsolute(row.original.updatedAt),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => openEdit(row.original)}
            aria-label={`Edytuj szablon ${row.original.name}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Więcej akcji dla ${row.original.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDuplicate(row.original)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Duplikuj
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  downloadJson(
                    `${row.original.category}-${row.original.name}.json`,
                    templateExportShape(row.original),
                  )
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Eksportuj JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTemplateToDelete(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Usuń
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Szablony"
        description="Prompty treści współdzielone przez wszystkich użytkowników Content Guru."
        actions={
          <div className="flex gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => {
                const files = event.target.files
                if (files && files.length > 0) importFromFile(Array.from(files))
                event.target.value = ""
              }}
            />
            <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Importuj JSON
            </Button>
            {categoryFilter !== ALL_CATEGORIES ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadJson(
                    `${categoryFilter}.json`,
                    filtered.map(templateExportShape),
                  )
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Eksportuj kategorię
              </Button>
            ) : null}
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nowy szablon
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="content-guru-templates-category" className="text-xs text-muted-foreground">
            Kategoria
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="content-guru-templates-category" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Wszystkie kategorie</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {templatesQuery.isLoading ? (
          <LoadingState label="Wczytywanie szablonów…" />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder="Szukaj po nazwie…"
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={Sparkles}
                title="Brak szablonów"
                description="Dodaj pierwszy szablon, żeby można go było wybrać na ekranie generowania."
              />
            }
          />
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nowy szablon" : `Edycja: ${draft.name}`}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-name">Nazwa</Label>
                <Input
                  id="template-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-category">Kategoria</Label>
                <Input
                  id="template-category"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-content">Treść promptu</Label>
              <Textarea
                id="template-content"
                rows={10}
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <Label>Testuj generację</Label>
              <p className="text-xs text-muted-foreground">
                Jednorazowe wywołanie modelu z bieżącą (możliwie niezapisaną) treścią szablonu i
                przykładowym tematem. Nic nie zapisuje się w archiwum ani na liście szablonów.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="template-test-topic" className="text-xs">
                    Temat testowy (opcjonalnie)
                  </Label>
                  <Input
                    id="template-test-topic"
                    placeholder="Przykładowy temat testowy"
                    value={testTopic}
                    onChange={(event) => setTestTopic(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="template-test-model" className="text-xs">
                    Model
                  </Label>
                  <Select value={testModel} onValueChange={setTestModel}>
                    <SelectTrigger id="template-test-model">
                      <SelectValue placeholder="Wybierz model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestGeneration}
                disabled={!draft.content.trim() || !testModel || testGeneration.isPending}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {testGeneration.isPending ? "Generowanie…" : "Testuj generację"}
              </Button>

              {testGeneration.data ? (
                <div className="flex flex-col gap-2">
                  {testGeneration.data.status === "done-with-warnings" ? (
                    <Badge
                      variant="outline"
                      className="w-fit border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    >
                      Zawiera zakazane frazy
                    </Badge>
                  ) : null}
                  <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                    {testGeneration.data.content}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !draft.name.trim() ||
                !draft.category.trim() ||
                !draft.content.trim() ||
                createTemplate.isPending ||
                updateTemplate.isPending
              }
            >
              Zapisz szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={templateToDelete !== null} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć szablon {templateToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Szablon zniknie z listy wyboru na ekranie generowania. Treści wygenerowane z jego użyciem
              w przeszłości zostają w archiwum bez zmian. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteTemplate.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
