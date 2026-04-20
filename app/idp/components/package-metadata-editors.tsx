"use client"

import {
  toastApiError,
  useSetCustomStatus,
  useSetUserNotes,
} from "@cortex/api"
import { Button, Input, Label, Textarea } from "@cortex/ui"
import { Check, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface PackageMetadataEditorsProps {
  packageId: string
  customStatus: string | null
  userNotes: string | null
}

export function PackageMetadataEditors({
  packageId,
  customStatus,
  userNotes,
}: PackageMetadataEditorsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CustomStatusField packageId={packageId} initial={customStatus} />
      <UserNotesField packageId={packageId} initial={userNotes} />
    </div>
  )
}

function CustomStatusField({
  packageId,
  initial,
}: {
  packageId: string
  initial: string | null
}) {
  const [value, setValue] = useState(initial ?? "")
  const mutate = useSetCustomStatus(packageId)

  useEffect(() => {
    setValue(initial ?? "")
  }, [initial])

  const dirty = value !== (initial ?? "")
  const normalized = value.trim() === "" ? null : value.trim()

  const handleSave = async () => {
    try {
      await mutate.mutateAsync({ custom_status: normalized })
      toast.success("Custom status saved")
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`custom-status-${packageId}`} className="text-xs">
        Custom status
      </Label>
      <div className="flex gap-2">
        <Input
          id={`custom-status-${packageId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. manual-review"
          maxLength={120}
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={handleSave} disabled={!dirty || mutate.isPending}>
          {mutate.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function UserNotesField({
  packageId,
  initial,
}: {
  packageId: string
  initial: string | null
}) {
  const [value, setValue] = useState(initial ?? "")
  const mutate = useSetUserNotes(packageId)

  useEffect(() => {
    setValue(initial ?? "")
  }, [initial])

  const dirty = value !== (initial ?? "")
  const normalized = value.trim() === "" ? null : value

  const handleSave = async () => {
    try {
      await mutate.mutateAsync({ user_notes: normalized })
      toast.success("Notes saved")
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`user-notes-${packageId}`} className="text-xs">
        Notes
      </Label>
      <Textarea
        id={`user-notes-${packageId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Private notes about this package…"
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!dirty || mutate.isPending}>
          {mutate.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save notes
        </Button>
      </div>
    </div>
  )
}
