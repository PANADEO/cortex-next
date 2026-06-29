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
  const [open, setOpen] = useState(false)
  const mutation = useIntrastatDeleteBatch()

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(batchId)
      toast.success("Batch deleted")
      setOpen(false)
      onDeleted?.()
    } catch (error) {
      toast.error(formatIntrastatError(error, "Batch delete failed"))
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
          {compact ? <span className="sr-only">Delete batch</span> : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete batch?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {batchName} and all files stored with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={runDelete}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
