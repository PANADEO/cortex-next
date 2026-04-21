"use client"

import {
  toastApiError,
  useAttachRule,
  useDetachRule,
  usePackageRuleAttachments,
  useRunAttachedRule,
  useRules,
} from "@cortex/api"
import {
  RULE_TRIGGER,
  type PackageRuleAttachment,
  type RuleTrigger,
} from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  PlayCircle,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  manual: "Manual",
  auto_on_extraction: "Auto on extraction",
}

function StatusIcon({ status }: { status: PackageRuleAttachment["last_status"] }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
  if (status === "pending") return <Clock className="h-3.5 w-3.5 text-amber-600" />
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

interface PackageRulesPanelProps {
  packageId: string
  canEdit: boolean
}

export function PackageRulesPanel({ packageId, canEdit }: PackageRulesPanelProps) {
  const attachments = usePackageRuleAttachments(packageId)
  const attach = useAttachRule(packageId)
  const detach = useDetachRule(packageId)
  const runRule = useRunAttachedRule(packageId)
  const ruleList = useRules({ status: "active", limit: 50 })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedRuleId, setPickedRuleId] = useState("")
  const [pickedTrigger, setPickedTrigger] = useState<RuleTrigger>("manual")

  const items = attachments.data?.attachments ?? []
  const attachedRuleIds = new Set(items.map((a) => a.rule_id))
  const availableRules = (ruleList.data?.items ?? []).filter(
    (r) => !attachedRuleIds.has(r.id),
  )

  const onAttach = () => {
    if (!pickedRuleId) {
      toast.error("Pick a rule first.")
      return
    }
    attach.mutate(
      { rule_id: pickedRuleId, trigger: pickedTrigger },
      {
        onSuccess: () => {
          toast.success("Rule attached")
          setPickerOpen(false)
          setPickedRuleId("")
        },
        onError: (err) => toastApiError(err),
      },
    )
  }

  if (attachments.isLoading) return <LoadingState variant="skeleton" rows={3} />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Rules transform extracted data after analysis. Auto-triggered rules run on every
          extraction; manual rules require explicit run.
        </p>
        {canEdit ? (
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Attach rule
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Attach a rule</DialogTitle>
                <DialogDescription>
                  Pick from active rules. Manual triggers require explicit run; auto runs on
                  every extraction.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Rule
                  </Label>
                  <Select value={pickedRuleId} onValueChange={setPickedRuleId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Pick a rule…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRules.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No more active rules to attach
                        </SelectItem>
                      ) : (
                        availableRules.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} (v{r.current_version})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Trigger
                  </Label>
                  <Select
                    value={pickedTrigger}
                    onValueChange={(v) => setPickedTrigger(v as RuleTrigger)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TRIGGER.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TRIGGER_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPickerOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={onAttach} disabled={attach.isPending || !pickedRuleId}>
                  {attach.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Attach
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No rules attached"
          description="Attach a rule to transform extracted data — allocations, aggregations, lookups."
        />
      ) : (
        <div className="space-y-2">
          {items.map((att) => (
            <Card key={att.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-start gap-3">
                  <StatusIcon status={att.last_status} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/rules/${att.rule_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {att.rule_name}
                      </Link>
                      <Badge variant="outline">v{att.rule_version}</Badge>
                      <Badge variant={att.trigger === "auto_on_extraction" ? "default" : "secondary"}>
                        {TRIGGER_LABEL[att.trigger]}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Attached {new Date(att.attached_at).toLocaleDateString()} · last run{" "}
                      {att.last_executed_at
                        ? new Date(att.last_executed_at).toLocaleString()
                        : "never"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/rules/${att.rule_id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          runRule.mutate(att.id, {
                            onSuccess: () => toast.success(`Ran ${att.rule_name}`),
                            onError: (err) => toastApiError(err),
                          })
                        }}
                        disabled={runRule.isPending}
                      >
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          detach.mutate(att.id, {
                            onSuccess: () => toast.success("Detached"),
                            onError: (err) => toastApiError(err),
                          })
                        }}
                        disabled={detach.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
