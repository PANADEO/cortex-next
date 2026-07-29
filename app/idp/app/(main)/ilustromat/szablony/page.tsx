"use client"

import {
  useCreateTemplate,
  useDuplicateTemplate,
  useFrameTemplates,
  useSetTemplateActive,
  useTemplatePreview,
  useUpdateTemplate,
  useUploadTemplateAsset,
} from "@/features/ilustromat/hooks"
import type { FrameTemplateDto, FrameTemplateInputDto } from "@/features/ilustromat/types"
import { useObjectUrl } from "@/features/ilustromat/use-object-url"
import { contrastRatio, parseHexColor, WCAG_AA_NORMAL_TEXT } from "@/lib/ilustromat/color"
import { fontLibraryOptions } from "@/lib/ilustromat/font-catalog"
import {
  CORNER_RADIUS_RANGE,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_MIN_IMAGE_AREA_RATIO,
  MIN_IMAGE_AREA_RATIO_RANGE,
} from "@/lib/ilustromat/presets"
import { FRAME_LAYOUT_LABELS, LOGO_POSITION_LABELS, TEXT_ALIGN_LABELS } from "@/lib/ilustromat/types"
import { toastApiError } from "@cortex/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  ColorInput,
  FileUploader,
  Input,
  Label,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@cortex/ui"
import { AlertTriangle, Copy, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

/** Sentinel dla szablonu, który jeszcze nie istnieje w bazie — musi zgadzać
 *  się z NEW_TEMPLATE_ID w route preview. */
const NEW_TEMPLATE_ID = "nowy"
const PREVIEW_DEBOUNCE_MS = 350

const EMPTY_DRAFT: FrameTemplateInputDto = {
  name: "Nowy szablon",
  colorBg: "#5B3DA8",
  colorText: "#FFFFFF",
  colorAccent: "#FF8C42",
  fontSource: "library",
  fontLibraryId: "noto-sans",
  logoPosition: "bottom-right",
  cornerRadius: DEFAULT_CORNER_RADIUS,
  minImageAreaRatio: DEFAULT_MIN_IMAGE_AREA_RATIO,
  websiteText: "",
  layout: "image-top",
  textAlign: "left",
  isActive: true,
}

function toDraft(template: FrameTemplateDto): FrameTemplateInputDto {
  return {
    name: template.name,
    colorBg: template.colorBg,
    colorText: template.colorText,
    colorAccent: template.colorAccent,
    fontSource: template.fontSource,
    fontLibraryId: template.fontLibraryId,
    logoPosition: template.logoPosition,
    cornerRadius: template.cornerRadius,
    minImageAreaRatio: template.minImageAreaRatio,
    websiteText: template.websiteText ?? "",
    layout: template.layout,
    textAlign: template.textAlign,
    isActive: template.isActive,
  }
}

export default function SzablonyPage() {
  const templatesQuery = useFrameTemplates()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const setActive = useSetTemplateActive()
  const duplicate = useDuplicateTemplate()
  const preview = useTemplatePreview()
  const uploadTemplateAsset = useUploadTemplateAsset()

  const [editedId, setEditedId] = useState<string>(NEW_TEMPLATE_ID)
  const [draft, setDraft] = useState<FrameTemplateInputDto>(EMPTY_DRAFT)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)

  const templates = templatesQuery.data ?? []
  const previewUrl = useObjectUrl(previewBlob)
  const fonts = useMemo(() => fontLibraryOptions(), [])

  const contrast = useMemo(() => {
    try {
      return contrastRatio(parseHexColor(draft.colorText), parseHexColor(draft.colorBg))
    } catch {
      return null
    }
  }, [draft.colorText, draft.colorBg])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live preview leci TĄ SAMĄ funkcją compose() co generacja produkcyjna —
  // dlatego nie da się dostać rozjazdu "w kreatorze wyglądało inaczej".
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      preview
        .mutateAsync({
          id: editedId,
          body: { template: { ...draft, websiteText: draft.websiteText || null } },
        })
        .then(setPreviewBlob)
        .catch(() => setPreviewBlob(null))
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, editedId])

  function startNew() {
    setEditedId(NEW_TEMPLATE_ID)
    setDraft(EMPTY_DRAFT)
  }

  function edit(template: FrameTemplateDto) {
    setEditedId(template.id)
    setDraft(toDraft(template))
  }

  async function uploadAsset(kind: string, files: File[]) {
    const file = files[0]
    if (!file) return
    try {
      const result = await uploadTemplateAsset.mutateAsync({ id: editedId, kind, file })
      // Wgranie własnego fontu przełącza szablon na font_source="custom" —
      // inaczej pliki leżałyby w bazie nieużywane, a render dalej szedłby
      // fontem z biblioteki.
      if (kind !== "logo") {
        setDraft((current) => ({ ...current, fontSource: "custom", fontLibraryId: null }))
      }
      toast.success(
        result.fontFamily ? `Wgrano font: ${result.fontFamily}` : "Wgrano plik do szablonu",
      )
      setPreviewBlob(null)
    } catch (error) {
      toastApiError(error, "Nie udało się wgrać pliku")
    }
  }

  async function save() {
    const body: FrameTemplateInputDto = { ...draft, websiteText: draft.websiteText || null }
    try {
      if (editedId === NEW_TEMPLATE_ID) {
        const created = await createTemplate.mutateAsync(body)
        setEditedId(created.id)
        toast.success(`Utworzono szablon ${created.name}`)
      } else {
        await updateTemplate.mutateAsync({ id: editedId, body })
        toast.success("Zapisano zmiany w szablonie")
      }
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać szablonu")
    }
  }

  return (
    <>
      <PageHeader
        title="Szablony marki"
        description="Font, kolory, logo i geometria ramki. Podgląd renderuje się tą samą funkcją co gotowy kafelek."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between">
                <Label>{editedId === NEW_TEMPLATE_ID ? "Nowy szablon" : `Edycja: ${editedId}`}</Label>
                <Button type="button" variant="outline" size="sm" onClick={startNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nowy
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-name">Nazwa</Label>
                <Input
                  id="template-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-color-bg">Kolor tła</Label>
                <ColorInput
                  id="template-color-bg"
                  aria-label="Kolor tła"
                  value={draft.colorBg}
                  onChange={(colorBg) => setDraft({ ...draft, colorBg })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-color-text">Kolor tekstu</Label>
                <ColorInput
                  id="template-color-text"
                  aria-label="Kolor tekstu"
                  value={draft.colorText}
                  onChange={(colorText) => setDraft({ ...draft, colorText })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-color-accent">Kolor akcentu</Label>
                <ColorInput
                  id="template-color-accent"
                  aria-label="Kolor akcentu"
                  value={draft.colorAccent}
                  onChange={(colorAccent) => setDraft({ ...draft, colorAccent })}
                />
              </div>

              {contrast !== null && contrast < WCAG_AA_NORMAL_TEXT ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Niski kontrast</AlertTitle>
                  <AlertDescription>
                    Kontrast tekstu do tła wynosi {contrast.toFixed(2)}:1, poniżej progu WCAG AA
                    (4.5:1). Tekst może być nieczytelny.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-font">Font</Label>
                <Select
                  value={draft.fontLibraryId ?? "noto-sans"}
                  onValueChange={(fontLibraryId) =>
                    setDraft({ ...draft, fontSource: "library", fontLibraryId })
                  }
                >
                  <SelectTrigger id="template-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fonts.map((font) => (
                      <SelectItem key={font.id} value={font.id}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-website">Tekst strony w pasku</Label>
                <Input
                  id="template-website"
                  value={draft.websiteText ?? ""}
                  placeholder="crido.pl"
                  onChange={(event) => setDraft({ ...draft, websiteText: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Pozycja logo</Label>
                <RadioGroup
                  value={draft.logoPosition}
                  onValueChange={(logoPosition) =>
                    setDraft({ ...draft, logoPosition: logoPosition as FrameTemplateDto["logoPosition"] })
                  }
                >
                  {Object.entries(LOGO_POSITION_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem id={`logo-${value}`} value={value} />
                      <Label htmlFor={`logo-${value}`} className="font-normal">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Układ</Label>
                <RadioGroup
                  value={draft.layout}
                  onValueChange={(layout) =>
                    setDraft({ ...draft, layout: layout as FrameTemplateDto["layout"] })
                  }
                >
                  {Object.entries(FRAME_LAYOUT_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem id={`layout-${value}`} value={value} />
                      <Label htmlFor={`layout-${value}`} className="font-normal">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Wyrównanie tekstu</Label>
                <RadioGroup
                  value={draft.textAlign}
                  onValueChange={(textAlign) =>
                    setDraft({ ...draft, textAlign: textAlign as FrameTemplateDto["textAlign"] })
                  }
                >
                  {Object.entries(TEXT_ALIGN_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem id={`align-${value}`} value={value} />
                      <Label htmlFor={`align-${value}`} className="font-normal">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-radius">
                  Zaokrąglenie rogów: {draft.cornerRadius} px
                </Label>
                <Slider
                  id="template-radius"
                  min={CORNER_RADIUS_RANGE[0]}
                  max={CORNER_RADIUS_RANGE[1]}
                  step={1}
                  value={[draft.cornerRadius]}
                  onValueChange={([cornerRadius]) =>
                    setDraft({ ...draft, cornerRadius: cornerRadius ?? DEFAULT_CORNER_RADIUS })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-ratio">
                  Minimalna wysokość pola obrazu: {Math.round(draft.minImageAreaRatio * 100)}%
                </Label>
                <Slider
                  id="template-ratio"
                  min={MIN_IMAGE_AREA_RATIO_RANGE[0]}
                  max={MIN_IMAGE_AREA_RATIO_RANGE[1]}
                  step={0.01}
                  value={[draft.minImageAreaRatio]}
                  onValueChange={([minImageAreaRatio]) =>
                    setDraft({
                      ...draft,
                      minImageAreaRatio: minImageAreaRatio ?? DEFAULT_MIN_IMAGE_AREA_RATIO,
                    })
                  }
                />
              </div>

              <Button
                type="button"
                onClick={save}
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                Zapisz szablon
              </Button>

              {/* Assety wgrywa się dopiero do ISTNIEJĄCEGO szablonu — muszą
                  mieć do czego się dowiązać (template_assets.template_id). */}
              {editedId === NEW_TEMPLATE_ID ? (
                <p className="text-xs text-muted-foreground">
                  Własny font i logo wgrasz po zapisaniu szablonu.
                </p>
              ) : (
                <div className="flex flex-col gap-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-2">
                    <Label>Własny font (regular)</Label>
                    <FileUploader
                      accept=".ttf,.otf"
                      description="Plik TTF/OTF. Font bez kompletu polskich znaków zostanie odrzucony."
                      onFilesSelected={(files) => uploadAsset("font-regular", files)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Własny font (bold)</Label>
                    <FileUploader
                      accept=".ttf,.otf"
                      description="Odmiana pogrubiona — używana w tytule kafelka."
                      onFilesSelected={(files) => uploadAsset("font-bold", files)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Logo</Label>
                    <FileUploader
                      accept=".png,.jpg,.jpeg,.svg"
                      description="PNG, JPG lub SVG — normalizowane do PNG z przezroczystością."
                      onFilesSelected={(files) => uploadAsset("logo", files)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label>Podgląd na żywo</Label>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Podgląd szablonu"
                    className="h-auto w-full rounded-md border border-border"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Przeliczanie podglądu...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label>Istniejące szablony</Label>
                <ul className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <li
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{template.name}</span>
                        {template.isActive ? (
                          <Badge variant="secondary">Aktywny</Badge>
                        ) : (
                          <Badge variant="outline">Wyłączony</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => edit(template)}>
                          Edytuj
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicate.mutate(template.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplikuj
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActive.mutate({ id: template.id, isActive: !template.isActive })
                          }
                        >
                          {template.isActive ? "Wyłącz" : "Włącz"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
