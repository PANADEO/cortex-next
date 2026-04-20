"use client"

import { toastApiError, useImportMultiplePackages, useImportPackage } from "@cortex/api"
import {
  Button,
  Card,
  CardContent,
  FileUploader,
  PageHeader,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  ImportOptionsFields,
  useImportOptions,
} from "@/components/import-options-fields"

export default function ImportPage() {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [loose, setLoose] = useState<File[]>([])
  const zipOptions = useImportOptions()
  const looseOptions = useImportOptions()

  const importOne = useImportPackage()
  const importMany = useImportMultiplePackages()

  const submitZip = async () => {
    if (!zipFile) return
    if (!zipOptions.isValid) {
      toast.error("Additional AI context is enabled but empty")
      return
    }
    try {
      await importOne.mutateAsync({ file: zipFile, ...zipOptions.serialize() })
      toast.success(`Imported ${zipFile.name}`)
      setZipFile(null)
      zipOptions.reset()
    } catch (err) {
      toastApiError(err)
    }
  }

  const submitLoose = async () => {
    if (loose.length === 0) return
    if (!looseOptions.isValid) {
      toast.error("Additional AI context is enabled but empty")
      return
    }
    try {
      await importMany.mutateAsync({ files: loose, ...looseOptions.serialize() })
      toast.success(`Imported ${loose.length} file(s)`)
      setLoose([])
      looseOptions.reset()
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
              value={zipFile ? [zipFile] : []}
              onChange={(files) => setZipFile(files[0] ?? null)}
              description="Max 100 MB"
            />
            <ImportOptionsFields
              idPrefix="zip"
              state={zipOptions.state}
              onChange={zipOptions.update}
            />
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
              value={loose}
              onChange={setLoose}
              description="Select multiple files"
            />
            <ImportOptionsFields
              idPrefix="loose"
              state={looseOptions.state}
              onChange={looseOptions.update}
            />
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
