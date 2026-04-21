"use client"

import {
  toastApiError,
  useDeleteDraft,
  useUpsertDraft,
} from "@cortex/api"
import type { CleanPackageDraft, DirtyDocument } from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  ScrollArea,
} from "@cortex/ui"
import { Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { DOC_TYPE_LABEL } from "./labels"

interface DraftListProps {
  dirtyPackageId: string
  drafts: CleanPackageDraft[]
  documents: DirtyDocument[]
}

export function DraftList({ dirtyPackageId, drafts, documents }: DraftListProps) {
  const upsert = useUpsertDraft(dirtyPackageId)
  const remove = useDeleteDraft(dirtyPackageId)
  const [newName, setNewName] = useState("")

  const docsById = useMemo(
    () => new Map(documents.map((d) => [d.id, d])),
    [documents],
  )

  const addDraft = () => {
    const name = newName.trim() || `Clean package ${String.fromCharCode(65 + drafts.length)}`
    upsert.mutate(
      { name, customer_tag: null, notes: null },
      {
        onSuccess: () => setNewName(""),
        onError: (err) => toastApiError(err),
      },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Clean package drafts · {drafts.length}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {drafts.map((draft) => {
            const docs = draft.document_ids
              .map((id) => docsById.get(id))
              .filter((d): d is DirtyDocument => Boolean(d))
            return (
              <Card key={draft.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{draft.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {docs.length} doc{docs.length === 1 ? "" : "s"}
                        {draft.customer_tag ? ` · ${draft.customer_tag}` : ""}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        remove.mutate(draft.id, {
                          onError: (err) => toastApiError(err),
                        })
                      }}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {docs.length > 0 ? (
                    <ul className="space-y-1">
                      {docs.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs"
                        >
                          <span className="truncate">{d.file_name}</span>
                          <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                            {DOC_TYPE_LABEL[d.doc_type]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-2 py-2 text-center text-[10px] text-muted-foreground">
                      Drag documents here or assign via the Target dropdown.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
          <div className="space-y-1.5 rounded-md border border-dashed border-border p-3">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              New draft
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Clean package ${String.fromCharCode(65 + drafts.length)}`}
                className="h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addDraft}
                disabled={upsert.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
