"use client"

import { downloadBlob } from "@/lib/download"
import {
  loadExportEmailRecipients,
  rememberExportEmailRecipient,
} from "@/lib/export/email-recipients"
import { endpoints, toastApiError, useExportTemplates, useMe } from "@cortex/api"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Textarea,
} from "@cortex/ui"
import { Download, FileDown, Loader2, Paperclip, Send } from "lucide-react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
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

const DEFAULT_EMAIL_BODY = "W załączniku eksport."

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

export function ExportMenu({ packageId, fileName }: ExportMenuProps) {
  const templates = useExportTemplates()
  const me = useMe()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [mailMode, setMailMode] = useState(false)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [savedEmailRecipients, setSavedEmailRecipients] = useState<string[]>([])
  const emailRecipientListId = useId()
  const mailModeRef = useRef(mailMode)

  useEffect(() => {
    setSavedEmailRecipients(loadExportEmailRecipients())
  }, [])

  const setMailModeValue = (value: boolean) => {
    mailModeRef.current = value
    setMailMode(value)
  }

  const handleExport = async (templateName: string, displayName: string, format: string) => {
    if (mailModeRef.current) {
      setEmailDraft({
        templateName,
        displayName,
        format,
        toEmail: me.data?.email ?? "",
        subject: `Export ${displayName}`,
        body: DEFAULT_EMAIL_BODY,
      })
      return
    }

    setDownloading(templateName)
    try {
      const blob = await endpoints.packages.exportResult(packageId, templateName)
      const exportFileName = deriveFileName(fileName, templateName, format)
      downloadBlob(blob, exportFileName)
      toast.success(`Exported as ${templateName}`)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      toastApiError(err)
    } finally {
      setDownloading(null)
    }
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
      setSavedEmailRecipients(rememberExportEmailRecipient(toEmail))
      toast.success(`Export emailed to ${result.sent_to}`)
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
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Export
      </Button>
    )
  }

  const items = templates.data ?? []
  if (items.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileDown className="mr-1.5 h-4 w-4" /> No templates
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
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuCheckboxItem
            checked={mailMode}
            onSelect={(event) => {
              event.preventDefault()
              setMailModeValue(!mailModeRef.current)
            }}
          >
            Email
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {items.map((t) => (
            <DropdownMenuItem
              key={t.name}
              onClick={() => handleExport(t.name, t.display_name, t.format)}
              disabled={downloading !== null}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm">{t.display_name}</p>
                <p className="truncate text-[10px] uppercase text-muted-foreground">{t.format}</p>
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
              <DialogTitle>Email export</DialogTitle>
              <DialogDescription className="sr-only">
                Send selected export as an email attachment.
              </DialogDescription>
            </DialogHeader>

            {emailDraft ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`export-email-to-${packageId}`} className="text-xs">
                    To
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
                    Subject
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
                    Message
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

                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate">{emailDraft.displayName}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {emailDraft.format}
                    </p>
                  </div>
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
                Cancel
              </Button>
              <Button type="submit" disabled={!canSendEmail || isSendingEmail}>
                {isSendingEmail ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
