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
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicDeletePackage()

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(packageId)
      toast.success("Package deleted")
      setOpen(false)
      router.push(redirectTo)
    } catch (error) {
      toast.error(formatIdpBasicError(error, "Package delete failed"))
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
          Delete package
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete package?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {packageName} and all files stored with it.
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

export function IdpBasicDeleteDocumentButton({
  packageId,
  documentId,
  fileName,
  disabled,
  compact,
  className,
}: DeleteDocumentButtonProps) {
  const [open, setOpen] = useState(false)
  const mutation = useIdpBasicDeleteDocument(packageId)

  const runDelete = async () => {
    try {
      await mutation.mutateAsync(documentId)
      toast.success("File deleted")
      setOpen(false)
    } catch (error) {
      toast.error(formatIdpBasicError(error, "File delete failed"))
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
          {compact ? <span className="sr-only">Delete file</span> : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete file?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {fileName} from the package.
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
