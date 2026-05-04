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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ImportOptionsFields, useImportOptions } from "./import-options-fields"

interface ReprocessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId: string
}

export function ReprocessDialog({
  open,
  onOpenChange,
  packageId,
}: ReprocessDialogProps) {
  const options = useImportOptions()
  const mutate = useReprocessPackage(packageId)

  const handleSubmit = async () => {
    try {
      await mutate.mutateAsync(options.serialize())
      toast.success("Reprocess started")
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
          <DialogTitle>Reprocess package</DialogTitle>
          <DialogDescription>
            Reset analysis and run extraction again. Optionally pass extra hints to the model.
          </DialogDescription>
        </DialogHeader>
        <ImportOptionsFields
          idPrefix={`reprocess-${packageId}`}
          state={options.state}
          onChange={options.update}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutate.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutate.isPending}>
            {mutate.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Reprocess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
