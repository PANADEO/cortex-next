"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import { useIdpBasicUploadPackage } from "@/lib/idp-basic/hooks"
import { Button } from "@cortex/ui"
import { Loader2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ChangeEvent } from "react"
import { useRef } from "react"
import { toast } from "sonner"

interface IdpBasicUploadPackageButtonProps {
  redirectToPackage?: boolean
  redirectToResult?: boolean
}

export function IdpBasicUploadPackageButton({
  redirectToPackage = false,
  redirectToResult = false,
}: IdpBasicUploadPackageButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const uploadPackage = useIdpBasicUploadPackage()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Choose a ZIP file")
      return
    }

    try {
      const uploaded = await uploadPackage.mutateAsync(file)
      toast.success(`Uploaded ${uploaded.document_count} document(s)`)
      if (redirectToResult) {
        router.push(`/idp-basic/results/${uploaded.id}`)
      } else if (redirectToPackage) {
        router.push(`/idp-basic/packages/${uploaded.id}`)
      }
    } catch (error) {
      toast.error(formatIdpBasicError(error, "ZIP upload failed"))
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="sr-only"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={uploadPackage.isPending}
      >
        {uploadPackage.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload ZIP
      </Button>
    </>
  )
}
