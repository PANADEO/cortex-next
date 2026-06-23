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
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicReprocessPackage()

  const runReprocess = async () => {
    try {
      await mutation.mutateAsync(packageId)
      toast.success("Package queued for reprocessing")
      setOpen(false)
    } catch (error) {
      toast.error(formatIdpBasicError(error, "Package reprocess failed"))
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
          Reprocess
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reprocess package?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear the current analysis for {packageName} and send the same stored files
            through the worker again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={runReprocess} disabled={mutation.isPending}>
            Reprocess
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
