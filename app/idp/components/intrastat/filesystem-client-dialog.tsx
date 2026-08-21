"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import {
  useIntrastatCreateFilesystemClient,
  useIntrastatUpdateFilesystemClient,
} from "@/lib/intrastat/hooks"
import type { IntrastatFilesystemClient } from "@/lib/intrastat/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface Props {
  client: IntrastatFilesystemClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (client: IntrastatFilesystemClient) => void
}

export function FilesystemClientDialog({ client, open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation(["intrastat", "common"])
  const createClient = useIntrastatCreateFilesystemClient()
  const updateClient = useIntrastatUpdateFilesystemClient()
  const [clientName, setClientName] = useState("")
  const [folderName, setFolderName] = useState("")
  const isSaving = createClient.isPending || updateClient.isPending

  useEffect(() => {
    if (!open) return
    setClientName(client?.client_name ?? "")
    setFolderName(client?.folder_name ?? "")
  }, [client, open])

  const handleSave = async () => {
    const payload = {
      client_name: clientName.trim(),
      folder_name: folderName.trim(),
    }
    if (!payload.client_name) {
      toast.error(t("filesystemClient.nameRequired"))
      return
    }
    if (!isValidFolderName(payload.folder_name)) {
      toast.error(t("filesystemClient.folderInvalid"))
      return
    }

    try {
      const saved = client
        ? await updateClient.mutateAsync({ clientId: client.id, payload })
        : await createClient.mutateAsync(payload)
      toast.success(client ? t("filesystemClient.updated") : t("filesystemClient.added"))
      onSaved(saved)
      onOpenChange(false)
    } catch (error) {
      toast.error(formatIntrastatError(error, t("filesystemClient.saveFailed")))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {client ? t("filesystemClient.editTitle") : t("filesystemClient.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("filesystemClient.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="intrastat-filesystem-client-name">
              {t("filesystemClient.clientLabel")}
            </Label>
            <Input
              id="intrastat-filesystem-client-name"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder={t("filesystemClient.clientExample")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intrastat-filesystem-folder-name">
              {t("filesystemClient.folderLabel")}
            </Label>
            <Input
              id="intrastat-filesystem-folder-name"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder={t("filesystemClient.folderExample")}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{t("filesystemClient.folderHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isValidFolderName(value: string): boolean {
  return Boolean(
    value && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\"),
  )
}
