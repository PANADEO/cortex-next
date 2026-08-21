"use client"

import {
  toastApiError,
  useAttachRule,
  useDetachRule,
  usePackageRuleAttachments,
  useRules,
  useRunAttachedRule,
} from "@cortex/api"
import { RULE_TRIGGER, type PackageRuleAttachment, type RuleTrigger } from "@cortex/types"
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
import { formatAbsolute } from "@cortex/utils"
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
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { RULE_TRIGGER_LABEL_KEY } from "./labels"

const TRIGGER_AUTO: RuleTrigger = "auto_on_extraction"

const STATUS_ICON: Record<
  NonNullable<PackageRuleAttachment["last_status"]> | "unknown",
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-emerald-600" },
  failed: { icon: AlertCircle, className: "text-rose-600" },
  pending: { icon: Clock, className: "text-amber-600" },
  unknown: { icon: Clock, className: "text-muted-foreground" },
}

function StatusIcon({ status }: { status: PackageRuleAttachment["last_status"] }) {
  const { icon: Icon, className } = STATUS_ICON[status ?? "unknown"]
  return <Icon className={`h-3.5 w-3.5 ${className}`} />
}

interface PackageRulesPanelProps {
  packageId: string
  canEdit: boolean
}

export function PackageRulesPanel({ packageId, canEdit }: PackageRulesPanelProps) {
  const { t } = useTranslation(["idp", "common"])
  const attachments = usePackageRuleAttachments(packageId)
  const attach = useAttachRule(packageId)
  const detach = useDetachRule(packageId)
  const runRule = useRunAttachedRule(packageId)
  const ruleList = useRules({ status: "active", limit: 50 })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedRuleId, setPickedRuleId] = useState("")
  const [pickedTrigger, setPickedTrigger] = useState<RuleTrigger>("manual")

  const items = attachments.data?.attachments
  const availableRules = useMemo(() => {
    const attached = new Set((items ?? []).map((a) => a.rule_id))
    return (ruleList.data?.items ?? []).filter((r) => !attached.has(r.id))
  }, [items, ruleList.data?.items])

  const onAttach = () => {
    if (!pickedRuleId) {
      toast.error(t("rules.attachments.toasts.pickFirst"))
      return
    }
    attach.mutate(
      { rule_id: pickedRuleId, trigger: pickedTrigger },
      {
        onSuccess: () => {
          toast.success(t("rules.attachments.toasts.attached"))
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
        <p className="text-xs text-muted-foreground">{t("rules.attachments.intro")}</p>
        {canEdit ? (
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("rules.attachments.attach")}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("rules.attachments.dialogTitle")}</DialogTitle>
                <DialogDescription>{t("rules.attachments.dialogDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("rules.attachments.ruleLabel")}
                  </Label>
                  <Select value={pickedRuleId} onValueChange={setPickedRuleId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("rules.attachments.rulePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRules.length === 0 ? (
                        <SelectItem value="none" disabled>
                          {t("rules.attachments.noneAvailable")}
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
                    {t("rules.attachments.triggerLabel")}
                  </Label>
                  <Select
                    value={pickedTrigger}
                    onValueChange={(v) => setPickedTrigger(v as RuleTrigger)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TRIGGER.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(RULE_TRIGGER_LABEL_KEY[option])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPickerOpen(false)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={onAttach} disabled={attach.isPending || !pickedRuleId}>
                  {attach.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t("rules.attachments.confirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {(items ?? []).length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t("rules.attachments.emptyTitle")}
          description={t("rules.attachments.emptyDescription")}
        />
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((att) => (
            <Card key={att.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-start gap-3">
                  <StatusIcon status={att.last_status} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/idp/rules/${att.rule_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {att.rule_name}
                      </Link>
                      <Badge variant="outline">v{att.rule_version}</Badge>
                      <Badge variant={att.trigger === TRIGGER_AUTO ? "default" : "secondary"}>
                        {t(RULE_TRIGGER_LABEL_KEY[att.trigger])}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t("rules.attachments.attachedAt", {
                        date: formatAbsolute(att.attached_at, "yyyy-MM-dd"),
                        lastRun: att.last_executed_at
                          ? formatAbsolute(att.last_executed_at)
                          : t("rules.attachments.never"),
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/idp/rules/${att.rule_id}`}>
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
                            onSuccess: () =>
                              toast.success(
                                t("rules.attachments.toasts.ran", { name: att.rule_name }),
                              ),
                            onError: (err) => toastApiError(err),
                          })
                        }}
                        disabled={runRule.isPending}
                      >
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        {t("rules.attachments.run")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          detach.mutate(att.id, {
                            onSuccess: () => toast.success(t("rules.attachments.toasts.detached")),
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
