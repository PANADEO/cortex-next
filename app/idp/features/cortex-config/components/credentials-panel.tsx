"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
} from "@cortex/ui"
import { ChevronDown, ChevronRight, KeyRound, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCredentialPaths, useDeleteCredential, useSetCredential } from "../hooks/use-governance"

// A credential path is "key/subkey[/...]". The tree groups by the first
// segment so related secrets (one provider, one connector) sit together.
interface CredentialTree {
  [key: string]: { leaves: string[]; children: CredentialTree }
}

function buildTree(paths: string[]): CredentialTree {
  const root: CredentialTree = {}
  for (const path of paths) {
    const segments = path.split("/")
    let node = root
    segments.forEach((segment, index) => {
      const entry = (node[segment] ??= { leaves: [], children: {} })
      if (index === segments.length - 1) entry.leaves.push(path)
      else node = entry.children
    })
  }
  return root
}

function TreeNode({
  label,
  node,
  depth,
  onDelete,
}: {
  label: string
  node: CredentialTree[string]
  depth: number
  onDelete: (path: string) => void
}) {
  const { t } = useTranslation("cortex-config")
  const [open, setOpen] = useState(true)
  const childKeys = Object.keys(node.children).sort()
  const hasChildren = childKeys.length > 0
  const leafPath = node.leaves[0]

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className="flex items-center gap-1.5 py-1 text-sm">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="text-muted-foreground"
            aria-label={open ? t("credentials.collapse") : t("credentials.expand")}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={leafPath ? "font-mono" : "font-medium"}>{label}</span>
        {leafPath ? (
          <>
            <Badge variant="secondary" className="ml-1">
              {t("credentials.setBadge")}
            </Badge>
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-destructive"
              aria-label={t("credentials.deleteAria", { path: leafPath })}
              onClick={() => onDelete(leafPath)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
      </div>
      {open && hasChildren
        ? childKeys.map((key) => {
            const child = node.children[key]
            return child ? (
              <TreeNode key={key} label={key} node={child} depth={depth + 1} onDelete={onDelete} />
            ) : null
          })
        : null}
    </div>
  )
}

export function CredentialsPanel() {
  const { t } = useTranslation(["cortex-config", "common"])
  const credentials = useCredentialPaths()
  const setCredential = useSetCredential()
  const deleteCredential = useDeleteCredential()
  const [path, setPath] = useState("")
  const [value, setValue] = useState("")

  const tree = useMemo(() => buildTree(credentials.data?.paths ?? []), [credentials.data?.paths])
  const rootKeys = Object.keys(tree).sort()

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedPath = path.trim().toLowerCase()
    if (!trimmedPath || !value) return
    setCredential.mutate(
      { path: trimmedPath, value },
      {
        onSuccess: () => {
          setPath("")
          setValue("")
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("credentials.title")}</CardTitle>
        <CardDescription>{t("credentials.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credentials.isPending ? (
          <LoadingState label={t("common:state.loading")} />
        ) : rootKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("credentials.empty")}</p>
        ) : (
          <div className="rounded-md border p-2">
            {rootKeys.map((key) => {
              const node = tree[key]
              return node ? (
                <TreeNode
                  key={key}
                  label={key}
                  node={node}
                  depth={0}
                  onDelete={(target) => {
                    if (window.confirm(t("credentials.deleteConfirm", { path: target })))
                      deleteCredential.mutate(target)
                  }}
                />
              ) : null
            })}
          </div>
        )}

        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="cred-path" className="text-xs">
              {t("credentials.pathLabel")}
            </Label>
            <Input
              id="cred-path"
              className="mt-1 font-mono text-xs"
              placeholder="llm/cortex-proxy"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cred-value" className="text-xs">
              {t("credentials.valueLabel")}
            </Label>
            <Input
              id="cred-value"
              type="password"
              className="mt-1 font-mono text-xs"
              placeholder={t("credentials.valuePlaceholder")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={setCredential.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("common:actions.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
