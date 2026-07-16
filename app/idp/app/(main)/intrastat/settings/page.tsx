"use client"

import { FilesystemClientDialog } from "@/components/intrastat/filesystem-client-dialog"
import { formatIntrastatError } from "@/lib/intrastat/api"
import {
  useIntrastatDeleteFilesystemClient,
  useIntrastatDeleteFilesystemFile,
  useIntrastatDownloadFilesystemFile,
  useIntrastatFilesystemClients,
  useIntrastatFilesystemPreview,
  useIntrastatPollFilesystem,
  useIntrastatSettings,
} from "@/lib/intrastat/hooks"
import type {
  IntrastatFilesystemClient,
  IntrastatFilesystemPreviewEntry,
  IntrastatFilesystemPreviewResponse,
} from "@/lib/intrastat/types"
import { useAuthorizedApps } from "@cortex/api"
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
  Badge,
  Button,
  Card,
  CardContent,
  DataCard,
  LoadingState,
  PageHeader,
  Pagination,
} from "@cortex/ui"
import {
  ArrowUp,
  Download,
  Eye,
  FileText,
  Folder,
  FolderInput,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const FILE_BROWSER_PAGE_SIZE = 10
const CONFIG_EDITOR_APP_CODE = "intrastat-config-editor"

export default function IntrastatSettingsPage() {
  const access = useAuthorizedApps()
  const canEditClients = access.apps.includes(CONFIG_EDITOR_APP_CODE)
  const settings = useIntrastatSettings()
  const filesystemClients = useIntrastatFilesystemClients()
  const [browserPath, setBrowserPath] = useState("")
  const [browserPage, setBrowserPage] = useState(0)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<IntrastatFilesystemClient | null>(null)
  const clients = filesystemClients.data?.items ?? []
  const hasClientMappings = clients.length > 0
  const availableClientCount = clients.filter((client) => client.available).length
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null
  const canPreview =
    Boolean(settings.data?.intrastat_watch_dir) && (!hasClientMappings || Boolean(selectedClient))
  const filesystemPreview = useIntrastatFilesystemPreview(
    {
      ...(selectedClient ? { client_id: selectedClient.id } : {}),
      path: browserPath,
      limit: FILE_BROWSER_PAGE_SIZE,
      offset: browserPage * FILE_BROWSER_PAGE_SIZE,
    },
    canPreview,
  )
  const pollFilesystem = useIntrastatPollFilesystem()

  const handlePoll = async () => {
    try {
      const result = await pollFilesystem.mutateAsync()
      toast.success(`Imported ${result.imported} batch(es)`)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Filesystem poll failed"))
    }
  }

  if (settings.isLoading || filesystemClients.isLoading) {
    return <LoadingState label="Loading Intrastat settings..." />
  }

  const filesystemReady = hasClientMappings
    ? availableClientCount > 0
    : Boolean(settings.data?.filesystem_configured)
  const filesystemValue = hasClientMappings
    ? `${availableClientCount}/${clients.length} ready`
    : settings.data?.filesystem_configured
      ? "Legacy mode"
      : "Missing folder"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Intrastat Settings"
        description="Operational status for filesystem intake, worker processing, and Gemini extraction."
        actions={
          <Button
            size="sm"
            onClick={handlePoll}
            disabled={
              pollFilesystem.isPending ||
              !settings.data?.filesystem_configured ||
              (hasClientMappings && availableClientCount === 0)
            }
          >
            {pollFilesystem.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Poll folders
          </Button>
        }
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-3">
        <DataCard
          label="Filesystem"
          value={filesystemValue}
          description={settings.data?.intrastat_watch_dir ?? "Set INTRASTAT_WATCH_DIR"}
          icon={FolderInput}
          tone={filesystemReady ? "success" : "warning"}
        />
        <DataCard
          label="Poll interval"
          value={`${settings.data?.filesystem_poll_interval_seconds ?? 10}s`}
          description="[Month]/[WNT|WDT] inside each client folder"
        />
        <DataCard
          label="Gemini"
          value={settings.data?.gemini_configured ? "Configured" : "Fallback"}
          description={settings.data?.gemini_model ?? "No model"}
          icon={Sparkles}
          tone={settings.data?.gemini_configured ? "success" : "warning"}
        />

        <Card className="lg:col-span-3">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={settings.data?.worker_enabled ? "secondary" : "outline"}>
                Worker {settings.data?.worker_enabled ? "enabled" : "disabled"}
              </Badge>
              <Badge
                variant={
                  settings.data?.filesystem_enabled && filesystemReady ? "secondary" : "outline"
                }
              >
                Filesystem{" "}
                {settings.data?.filesystem_enabled && filesystemReady ? "watching" : "disabled"}
              </Badge>
              <Badge variant={hasClientMappings ? "secondary" : "outline"}>
                {hasClientMappings ? "Mapped clients" : "Legacy layout"}
              </Badge>
              <Badge variant={settings.data?.gemini_configured ? "secondary" : "outline"}>
                Gemini {settings.data?.gemini_configured ? "live" : "heuristic fallback"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Each configured client folder expects `[Month]/[WNT|WDT]`. The previous
              `[Client]/[Month]/[WNT|WDT]` layout is used only while no client mappings exist.
              Removing a mapping never removes its folder or files.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Client folders</h2>
                <p className="text-xs text-muted-foreground">
                  Map each Intrastat client to a mounted folder directly below the filesystem root.
                </p>
              </div>
              {canEditClients ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingClient(null)
                    setClientDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add client
                </Button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Mounted folder</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-8 text-center text-sm text-muted-foreground"
                        colSpan={4}
                      >
                        No client folders configured. The legacy folder layout is active.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id}>
                        <td className="px-3 py-2 font-medium">{client.client_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{client.folder_name}</td>
                        <td className="px-3 py-2">
                          <Badge variant={client.available ? "secondary" : "outline"}>
                            {client.available ? "Ready" : "Missing"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <FilesystemClientActions
                            client={client}
                            canEdit={canEditClients}
                            onBrowse={() => {
                              setSelectedClientId(client.id)
                              setBrowserPath("")
                              setBrowserPage(0)
                            }}
                            onEdit={() => {
                              setEditingClient(client)
                              setClientDialogOpen(true)
                            }}
                            onDeleted={() => {
                              if (selectedClient?.id === client.id) {
                                setSelectedClientId(null)
                                setBrowserPath("")
                                setBrowserPage(0)
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Watch folder preview</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedClient
                    ? `${selectedClient.client_name} — ${selectedClient.folder_name}`
                    : (filesystemPreview.data?.root ??
                      settings.data?.intrastat_watch_dir ??
                      "INTRASTAT_WATCH_DIR is not set")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void filesystemPreview.refetch()}
                disabled={!canPreview || filesystemPreview.isFetching}
              >
                {filesystemPreview.isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh preview
              </Button>
            </div>

            <FilesystemPreviewContent
              preview={filesystemPreview.data}
              page={browserPage}
              isLoading={filesystemPreview.isLoading}
              isConfigured={
                filesystemPreview.data?.configured ??
                (!hasClientMappings && Boolean(settings.data?.filesystem_configured))
              }
              clientId={selectedClient?.id}
              missingMessage={
                selectedClient
                  ? `${selectedClient.client_name}'s mounted folder is not available.`
                  : undefined
              }
              onOpenFolder={(path) => {
                setBrowserPath(path)
                setBrowserPage(0)
              }}
              onPageChange={setBrowserPage}
              onDeleted={() => void filesystemPreview.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      {canEditClients ? (
        <FilesystemClientDialog
          client={editingClient}
          open={clientDialogOpen}
          onOpenChange={setClientDialogOpen}
          onSaved={(savedClient) => {
            setSelectedClientId(savedClient.id)
            setBrowserPath("")
            setBrowserPage(0)
          }}
        />
      ) : null}
    </div>
  )
}

function FilesystemClientActions({
  client,
  canEdit,
  onBrowse,
  onEdit,
  onDeleted,
}: {
  client: IntrastatFilesystemClient
  canEdit: boolean
  onBrowse: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const deleteClient = useIntrastatDeleteFilesystemClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const runDelete = async () => {
    try {
      await deleteClient.mutateAsync(client.id)
      toast.success("Client folder mapping deleted")
      setConfirmOpen(false)
      onDeleted()
    } catch (error) {
      toast.error(formatIntrastatError(error, "Client folder mapping could not be deleted"))
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={onBrowse}>
        <Eye className="mr-2 h-4 w-4" />
        Browse
      </Button>
      {canEdit ? (
        <>
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={deleteClient.isPending}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={deleteClient.isPending}
              >
                {deleteClient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="sr-only">Delete client folder mapping</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete client folder mapping?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes only the mapping for {client.client_name}. The mounted folder and all
                  files inside it remain unchanged.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteClient.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={runDelete}
                  disabled={deleteClient.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete mapping
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

function FilesystemPreviewContent({
  preview,
  page,
  isLoading,
  isConfigured,
  clientId,
  missingMessage,
  onOpenFolder,
  onPageChange,
  onDeleted,
}: {
  preview: IntrastatFilesystemPreviewResponse | undefined
  page: number
  isLoading: boolean
  isConfigured: boolean
  clientId: string | undefined
  missingMessage: string | undefined
  onOpenFolder: (path: string) => void
  onPageChange: (page: number) => void
  onDeleted: () => void
}) {
  const entries = preview?.entries ?? []
  const total = preview?.total ?? 0
  const currentPath = preview?.current_path ?? ""
  const parentPath = preview?.parent_path ?? null
  const pageCount = Math.max(1, Math.ceil(total / FILE_BROWSER_PAGE_SIZE))

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading folder preview...</p>
  }

  if (!isConfigured) {
    return (
      <p className="text-sm text-muted-foreground">
        {missingMessage ??
          "Configure `INTRASTAT_WATCH_DIR` and make sure the folder exists to preview files."}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={parentPath === null}
          onClick={() => {
            onOpenFolder(parentPath ?? "")
          }}
        >
          <ArrowUp className="h-4 w-4" />
          <span className="sr-only">Go to parent folder</span>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs">{currentPath ? `/${currentPath}` : "/"}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="px-3 py-2 text-left font-medium">State</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={4}>
                  This folder is empty.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.relative_path}>
                  <td className="max-w-[520px] px-3 py-2">
                    <FileBrowserName entry={entry} onOpenFolder={onOpenFolder} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {entry.size_bytes === null ? (
                      <span className="text-xs text-muted-foreground">Folder</span>
                    ) : (
                      formatBytes(entry.size_bytes)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={entry.stable ? "secondary" : "outline"}>
                      {entry.stable ? "Stable" : "Changing"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <FileBrowserActions entry={entry} clientId={clientId} onDeleted={onDeleted} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
    </div>
  )
}

function FileBrowserName({
  entry,
  onOpenFolder,
}: {
  entry: IntrastatFilesystemPreviewEntry
  onOpenFolder: (path: string) => void
}) {
  if (entry.kind === "directory") {
    return (
      <Button
        variant="ghost"
        className="h-auto max-w-full justify-start px-2 py-1 text-left"
        onClick={() => onOpenFolder(entry.relative_path)}
      >
        <Folder className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{entry.name}</span>
      </Button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-2 py-1">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{entry.name}</span>
    </div>
  )
}

function FileBrowserActions({
  entry,
  clientId,
  onDeleted,
}: {
  entry: IntrastatFilesystemPreviewEntry
  clientId: string | undefined
  onDeleted: () => void
}) {
  const downloadFile = useIntrastatDownloadFilesystemFile()
  const deleteFile = useIntrastatDeleteFilesystemFile()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (entry.kind === "directory") {
    return <div className="flex justify-end" />
  }

  const runDownload = async () => {
    try {
      const download = await downloadFile.mutateAsync({
        path: entry.relative_path,
        ...(clientId ? { clientId } : {}),
      })
      const url = URL.createObjectURL(download.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = download.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      toast.error(formatIntrastatError(error, "File download failed"))
    }
  }

  const runDelete = async () => {
    try {
      await deleteFile.mutateAsync({
        path: entry.relative_path,
        ...(clientId ? { clientId } : {}),
      })
      toast.success("File deleted")
      setConfirmOpen(false)
      onDeleted()
    } catch (error) {
      toast.error(formatIntrastatError(error, "File delete failed"))
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={runDownload}
        disabled={downloadFile.isPending || deleteFile.isPending}
      >
        {downloadFile.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="sr-only">Download file</span>
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={downloadFile.isPending || deleteFile.isPending}
          >
            {deleteFile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Delete file</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {entry.name} from the watch folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFile.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runDelete}
              disabled={deleteFile.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
