"use client"

import { JobOutcome } from "@/features/document-parser/components/job-outcome"
import { useCreateJob, useJob } from "@/features/document-parser/hooks"
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_MB,
  validateDocumentFile,
} from "@/lib/document-parser/constraints"
import { toastApiError } from "@cortex/api"
import { Button, Card, CardContent, FileUploader, LoadingState, PageHeader } from "@cortex/ui"
import { RotateCcw, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const UPLOADER_FORMATS = ALLOWED_EXTENSIONS.join(", ").toUpperCase()

export default function DocumentParserUploadPage() {
  const { t } = useTranslation("document-parser")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const createJob = useCreateJob()
  const jobQuery = useJob(activeJobId)

  // D1: walidacja typu/rozmiaru PO STRONIE KLIENTA przed wysyłką, nie
  // dopiero błąd z serwera — ten sam validateDocumentFile() co BFF
  // (constraints.ts, jedno źródło prawdy dla obu stron).
  function handleFilesSelected(files: File[]) {
    const file = files[0]
    if (!file) return

    const validation = validateDocumentFile({ name: file.name, size: file.size })
    if (!validation.ok) {
      setPendingFile(null)
      setFileError(validation.message)
      return
    }

    setPendingFile(file)
    setFileError(null)
  }

  async function handleSubmit() {
    if (!pendingFile) return
    try {
      const response = await createJob.mutateAsync(pendingFile)
      setActiveJobId(response.jobId)
      setPendingFile(null)
    } catch (error) {
      toastApiError(error, t("upload.errors.submitFailed"))
    }
  }

  function reset() {
    setActiveJobId(null)
    setPendingFile(null)
    setFileError(null)
  }

  const job = jobQuery.data
  const isFinished = job?.status === "done" || job?.status === "error"

  return (
    <>
      <PageHeader title={t("upload.title")} description={t("upload.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!activeJobId ? (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <FileUploader
                accept={ACCEPT_ATTRIBUTE}
                description={t("upload.uploaderDescription", {
                  formats: UPLOADER_FORMATS,
                  maxMb: MAX_UPLOAD_MB,
                })}
                onFilesSelected={handleFilesSelected}
              />
              {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}
              <Button
                type="button"
                className="self-start"
                disabled={!pendingFile || createJob.isPending}
                onClick={handleSubmit}
              >
                <Upload className="mr-2 h-4 w-4" />
                {createJob.isPending ? t("upload.submitting") : t("upload.submitButton")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {jobQuery.isLoading && !job ? (
                <LoadingState label={t("upload.loadingJob")} />
              ) : job ? (
                <JobOutcome
                  job={job}
                  detailsHref={`/document-parser/history/${job.id}`}
                  previewOnly
                />
              ) : null}

              {isFinished ? (
                <Button type="button" variant="outline" className="self-start" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("upload.uploadAnother")}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
