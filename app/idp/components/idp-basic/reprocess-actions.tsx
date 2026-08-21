"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import { useIdpBasicReprocessPackage } from "@/lib/idp-basic/hooks"
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
import { Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface ReprocessPackageButtonProps {
  packageId: string
  packageName: string
  disabled?: boolean | undefined
  disabledReason?: string | undefined
}

export function IdpBasicReprocessPackageButton({
  packageId,
  packageName,
  disabled,
  disabledReason,
}: ReprocessPackageButtonProps) {
  const { t } = useTranslation(["idp-basic", "common"])
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicReprocessPackage()

  const runReprocess = async () => {
    try {
      await mutation.mutateAsync(packageId)
      toast.success(t("toast.packageQueuedForReprocess"))
      setOpen(false)
    } catch (error) {
      toast.error(formatIdpBasicError(error, t("errors.packageReprocessFailed")))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || mutation.isPending}
          title={disabledReason}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("reprocess.trigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reprocess.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("reprocess.description", { name: packageName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t("common:actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={runReprocess} disabled={mutation.isPending}>
            {t("reprocess.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
