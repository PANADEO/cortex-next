"use client"

import { downloadBlob } from "@/lib/download"
import {
  loadExportEmailRecipients,
  loadImportNotificationExportTemplate,
  normalizeExportEmailRecipient,
  rememberExportEmailRecipient,
  rememberImportNotificationExportTemplate,
} from "@/lib/export/email-recipients"
import { endpoints, toastApiError, useExportTemplates, useMe } from "@cortex/api"
import type { ExportTemplateInfo } from "@cortex/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cortex/ui"
import { Download, FileDown, Loader2, Send } from "lucide-react"
import { type FormEvent, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface ExportMenuProps {
  packageId: string
  fileName: string
}

const FORMAT_EXTENSION: Record<string, string> = {
  csv: "csv",
  zip: "zip",
  xml: "xml",
  json: "json",
}

interface EmailDraft {
  templateName: string
  displayName: string
  format: string
  toEmail: string
  subject: string
  body: string
}

function deriveFileName(baseName: string, templateName: string, format: string): string {
  const stripped = baseName.replace(/\.(zip|pdf|docx|xlsx)$/i, "")
  const ext = FORMAT_EXTENSION[format] ?? format
  return `${stripped}_${templateName}.${ext}`
}

function getEmailTemplate(
  templates: readonly ExportTemplateInfo[],
  templateName: string,
): ExportTemplateInfo | null {
  return templates.find((template) => template.name === templateName) ?? null
}

function getDefaultEmailTemplate(
  templates: readonly ExportTemplateInfo[],
  userEmail: string,
): ExportTemplateInfo | null {
  const savedTemplateName = loadImportNotificationExportTemplate(userEmail)
  return getEmailTemplate(templates, savedTemplateName) ?? templates[0] ?? null
}

export function ExportMenu({ packageId, fileName }: ExportMenuProps) {
  const { t } = useTranslation(["idp", "common"])
  const templates = useExportTemplates()
  const me = useMe()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [savedEmailRecipients, setSavedEmailRecipients] = useState<string[]>([])
  const emailRecipientListId = useId()
  const userEmail = me.data?.email ?? ""
  const defaultEmailRecipient =
    savedEmailRecipients[0] ?? normalizeExportEmailRecipient(userEmail) ?? ""

  useEffect(() => {
    setSavedEmailRecipients(loadExportEmailRecipients(userEmail))
  }, [userEmail])

  const handleExport = async (templateName: string, displayName: string, format: string) => {
    setDownloading(templateName)
    try {
      const blob = await endpoints.packages.exportResult(packageId, templateName)
      const exportFileName = deriveFileName(fileName, templateName, format)
      downloadBlob(blob, exportFileName)
      toast.success(t("export.menu.exported", { template: templateName }))
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      toastApiError(err)
    } finally {
      setDownloading(null)
    }
  }

  const handleOpenEmailDialog = (items: readonly ExportTemplateInfo[]) => {
    const template = getDefaultEmailTemplate(items, userEmail)
    if (!template) return
    setEmailDraft({
      templateName: template.name,
      displayName: template.display_name,
      format: template.format,
      toEmail: defaultEmailRecipient,
      subject: t("export.menu.subject", { template: template.display_name }),
      body: t("common:export.emailDefaultBody"),
    })
  }

  const handleEmailTemplateChange = (
    templateName: string,
    items: readonly ExportTemplateInfo[],
  ) => {
    const template = getEmailTemplate(items, templateName)
    if (!template || !emailDraft) return
    setEmailDraft({
      ...emailDraft,
      templateName: template.name,
      displayName: template.display_name,
      format: template.format,
      subject: t("export.menu.subject", { template: template.display_name }),
    })
  }

  const handleSendEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!emailDraft) return

    const toEmail = emailDraft.toEmail.trim()
    const subject = emailDraft.subject.trim()
    if (!toEmail || !subject) return

    setDownloading(emailDraft.templateName)
    try {
      const result = await endpoints.packages.sendExportEmail(packageId, emailDraft.templateName, {
        to_email: toEmail,
        subject,
        body: emailDraft.body,
      })
      setSavedEmailRecipients(rememberExportEmailRecipient(toEmail, userEmail))
      rememberImportNotificationExportTemplate(emailDraft.templateName, userEmail)
      toast.success(t("export.menu.emailed", { email: result.sent_to }))
      setEmailDraft(null)
    } catch (err) {
      toastApiError(err)
    } finally {
      setDownloading(null)
    }
  }

  if (templates.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {t("export.menu.trigger")}
      </Button>
    )
  }

  const items = templates.data ?? []
  if (items.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileDown className="mr-1.5 h-4 w-4" /> {t("export.menu.noTemplates")}
      </Button>
    )
  }

  const isSendingEmail = emailDraft !== null && downloading === emailDraft.templateName
  const suggestedEmailRecipients = savedEmailRecipients.filter(
    (email) => email !== emailDraft?.toEmail.trim().toLowerCase(),
  )
  const canSendEmail =
    emailDraft !== null &&
    emailDraft.toEmail.trim().length > 0 &&
    emailDraft.subject.trim().length > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={downloading !== null}>
            {downloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            {t("export.menu.trigger")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => handleOpenEmailDialog(items)}
            disabled={downloading !== null}
          >
            <Send className="mr-2 h-4 w-4 text-muted-foreground" />
            {t("export.menu.sendByEmail")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {items.map((template) => (
            <DropdownMenuItem
              key={template.name}
              onClick={() => handleExport(template.name, template.display_name, template.format)}
              disabled={downloading !== null}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm">{template.display_name}</p>
                <p className="truncate text-[10px] uppercase text-muted-foreground">
                  {template.format}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={emailDraft !== null}
        onOpenChange={(open) => {
          if (!open && !isSendingEmail) setEmailDraft(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form className="space-y-4" onSubmit={handleSendEmail}>
            <DialogHeader>
              <DialogTitle>{t("export.menu.dialogTitle")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("export.menu.dialogDescription")}
              </DialogDescription>
            </DialogHeader>

            {emailDraft ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`export-email-template-${packageId}`} className="text-xs">
                    {t("export.menu.templateLabel")}
                  </Label>
                  <Select
                    value={emailDraft.templateName}
                    onValueChange={(templateName) => handleEmailTemplateChange(templateName, items)}
                    disabled={isSendingEmail}
                  >
                    <SelectTrigger id={`export-email-template-${packageId}`} className="h-9">
                      <SelectValue placeholder={t("export.menu.templateLabel")} />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((template) => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`export-email-to-${packageId}`} className="text-xs">
                    {t("export.menu.to")}
                  </Label>
                  <Input
                    id={`export-email-to-${packageId}`}
                    type="email"
                    list={emailRecipientListId}
                    autoComplete="email"
                    value={emailDraft.toEmail}
                    onChange={(event) =>
                      setEmailDraft({ ...emailDraft, toEmail: event.target.value })
                    }
                    maxLength={254}
                    required
                    disabled={isSendingEmail}
                  />
                  <datalist id={emailRecipientListId}>
                    {savedEmailRecipients.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                  {suggestedEmailRecipients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestedEmailRecipients.slice(0, 5).map((email) => (
                        <Button
                          key={email}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 max-w-full justify-start px-2 text-[11px]"
                          onClick={() => setEmailDraft({ ...emailDraft, toEmail: email })}
                          disabled={isSendingEmail}
                        >
                          <span className="max-w-[260px] truncate">{email}</span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`export-email-subject-${packageId}`} className="text-xs">
                    {t("export.menu.subjectLabel")}
                  </Label>
                  <Input
                    id={`export-email-subject-${packageId}`}
                    value={emailDraft.subject}
                    onChange={(event) =>
                      setEmailDraft({ ...emailDraft, subject: event.target.value })
                    }
                    maxLength={200}
                    required
                    disabled={isSendingEmail}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`export-email-body-${packageId}`} className="text-xs">
                    {t("export.menu.message")}
                  </Label>
                  <Textarea
                    id={`export-email-body-${packageId}`}
                    value={emailDraft.body}
                    onChange={(event) => setEmailDraft({ ...emailDraft, body: event.target.value })}
                    rows={5}
                    maxLength={5000}
                    className="resize-none"
                    disabled={isSendingEmail}
                  />
                </div>
              </>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailDraft(null)}
                disabled={isSendingEmail}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={!canSendEmail || isSendingEmail}>
                {isSendingEmail ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                {t("export.menu.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
