"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import { useIdpBasicDeleteDocument, useIdpBasicDeletePackage } from "@/lib/idp-basic/hooks"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface DeletePackageButtonProps {
  packageId: string
  packageName: string
  redirectTo: string
  disabled?: boolean | undefined
}

interface DeleteDocumentButtonProps {
  packageId: string
  documentId: string
  fileName: string
  disabled?: boolean | undefined
  compact?: boolean | undefined
  className?: string | undefined
}

export function IdpBasicDeletePackageButton({
  packageId,
  packageName,
  redirectTo,
  disabled,
}: DeletePackageButtonProps) {
  const { t } = useTranslation(["idp-basic", "common"])
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicDeletePackage()

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(packageId)
      toast.success(t("toast.packageDeleted"))
      setOpen(false)
      router.push(redirectTo)
    } catch (error) {
      toast.error(formatIdpBasicError(error, t("errors.packageDeleteFailed")))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled || mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t("delete.packageTrigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete.packageTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("delete.packageDescription", { name: packageName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t("common:actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={runDelete}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("common:actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function IdpBasicDeleteDocumentButton({
  packageId,
  documentId,
  fileName,
  disabled,
  compact,
  className,
}: DeleteDocumentButtonProps) {
  const { t } = useTranslation(["idp-basic", "common"])
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicDeleteDocument(packageId)

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(documentId)
      toast.success(t("toast.fileDeleted"))
      setOpen(false)
    } catch (error) {
      toast.error(formatIdpBasicError(error, t("errors.fileDeleteFailed")))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={cn("text-destructive hover:text-destructive", className)}
          disabled={disabled || mutation.isPending}
          onClick={(event) => event.stopPropagation()}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {compact ? (
            <span className="sr-only">{t("delete.fileSrLabel")}</span>
          ) : (
            t("common:actions.delete")
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete.fileTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("delete.fileDescription", { name: fileName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t("common:actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={runDelete}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("common:actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
