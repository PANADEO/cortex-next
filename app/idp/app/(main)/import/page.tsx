"use client"

import { toastApiError, useImportMultiplePackages, useImportPackage } from "@cortex/api"
import { Button, Card, CardContent, FileUploader, PageHeader, Switch } from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export default function ImportPage() {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [loose, setLoose] = useState<File[]>([])
  const [zipFast, setZipFast] = useState(false)
  const [looseFast, setLooseFast] = useState(false)

  const importOne = useImportPackage()
  const importMany = useImportMultiplePackages()

  const submitZip = async () => {
    if (!zipFile) return
    try {
      await importOne.mutateAsync(zipFile)
      toast.success(`Imported ${zipFile.name}`)
      setZipFile(null)
    } catch (err) {
      toastApiError(err)
    }
  }

  const submitLoose = async () => {
    if (loose.length === 0) return
    try {
      await importMany.mutateAsync(loose)
      toast.success(`Imported ${loose.length} file(s)`)
      setLoose([])
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <>
      <PageHeader
        title="Import"
        description="Upload a ZIP package or multiple loose files (they will be zipped in the browser)."
      />
      <div className="grid flex-1 gap-6 px-8 py-6 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-sm font-semibold">Import ZIP package</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Single ZIP file containing invoices and transport documents.
              </p>
            </div>
            <FileUploader
              accept=".zip,application/zip"
              onFilesSelected={(files) => setZipFile(files[0] ?? null)}
              description="Max 100 MB"
            />
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-xs font-medium">Fast processing</p>
                <p className="text-[10px] text-muted-foreground">
                  Cheaper Gemini model; lower accuracy.
                </p>
              </div>
              <Switch checked={zipFast} onCheckedChange={setZipFast} />
            </div>
            <Button
              onClick={submitZip}
              disabled={!zipFile || importOne.isPending}
              className="w-full"
            >
              {importOne.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Import ZIP
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-sm font-semibold">Import files</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF / DOCX / XLSX — zipped client-side before upload.
              </p>
            </div>
            <FileUploader
              multiple
              accept=".pdf,.docx,.xlsx"
              onFilesSelected={setLoose}
              description="Select multiple files"
            />
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-xs font-medium">Fast processing</p>
                <p className="text-[10px] text-muted-foreground">
                  Cheaper Gemini model; lower accuracy.
                </p>
              </div>
              <Switch checked={looseFast} onCheckedChange={setLooseFast} />
            </div>
            <Button
              onClick={submitLoose}
              disabled={loose.length === 0 || importMany.isPending}
              className="w-full"
            >
              {importMany.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Import files
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
