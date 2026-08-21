"use client"

import { toastApiError, useReprocessPackage } from "@cortex/api"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cortex/ui"
import { useFeatureFlag } from "@cortex/utils"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ImportOptionsFields, useImportOptions } from "./import-options-fields"

interface ReprocessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId: string
}

export function ReprocessDialog({ open, onOpenChange, packageId }: ReprocessDialogProps) {
  const { t } = useTranslation(["idp", "common"])
  const options = useImportOptions()
  const mutate = useReprocessPackage(packageId)
  const showAdditionalAiContext = useFeatureFlag("idp.additional-ai-context")
  const showPackagingSelectionMode = useFeatureFlag("idp.packaging-selection-mode")

  const handleSubmit = async () => {
    try {
      await mutate.mutateAsync(
        options.serialize({
          additionalAiContextAvailable: showAdditionalAiContext,
          packagingSelectionModeAvailable: showPackagingSelectionMode,
        }),
      )
      toast.success(t("reprocess.started"))
      options.reset()
      onOpenChange(false)
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!mutate.isPending) onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reprocess.title")}</DialogTitle>
          <DialogDescription>{t("reprocess.description")}</DialogDescription>
        </DialogHeader>
        <ImportOptionsFields
          idPrefix={`reprocess-${packageId}`}
          state={options.state}
          onChange={options.update}
          showAdditionalAiContext={showAdditionalAiContext}
          showPackagingSelectionMode={showPackagingSelectionMode}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutate.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={mutate.isPending}>
            {mutate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t("reprocess.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
