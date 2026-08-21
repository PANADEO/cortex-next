"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatDeleteBatch } from "@/lib/intrastat/hooks"
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
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface Props {
  batchId: string
  batchName: string
  compact?: boolean | undefined
  disabled?: boolean | undefined
  onDeleted?: (() => void) | undefined
}

export function IntrastatDeleteBatchButton({
  batchId,
  batchName,
  compact,
  disabled,
  onDeleted,
}: Props) {
  const { t } = useTranslation(["intrastat", "common"])
  const [open, setOpen] = useState(false)
  const mutation = useIntrastatDeleteBatch()

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(batchId)
      toast.success(t("deleteBatch.success"))
      setOpen(false)
      onDeleted?.()
    } catch (error) {
      toast.error(formatIntrastatError(error, t("deleteBatch.failed")))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={compact ? "ghost" : "destructive"}
          size={compact ? "icon" : "sm"}
          className={compact ? "h-8 w-8 text-destructive hover:text-destructive" : undefined}
          disabled={disabled || mutation.isPending}
          onClick={(event) => event.stopPropagation()}
        >
          {mutation.isPending ? (
            <Loader2 className={compact ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
          ) : (
            <Trash2 className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          )}
          {compact ? (
            <span className="sr-only">{t("deleteBatch.srLabel")}</span>
          ) : (
            t("common:actions.delete")
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteBatch.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteBatch.description", { name: batchName })}
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
