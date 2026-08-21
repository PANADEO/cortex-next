"use client"

import type { CoworkGovernanceConfig, CoworkRole } from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  LoadingState,
} from "@cortex/ui"
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { AccessDeniedState } from "./config-screen"

// Governance overview: roles and user assignments are edited on dedicated
// screens under /cortex-config/governance/*; admins inline (a plain email list).

function EntityRow({
  name,
  badges,
  editHref,
  editAriaLabel,
  onDelete,
  deleteAriaLabel,
}: {
  name: string
  badges: string[]
  editHref: string
  editAriaLabel: string
  onDelete: () => void
  deleteAriaLabel: string
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{name}</span>
        {badges.map((badge) => (
          <Badge key={badge} variant="secondary">
            {badge}
          </Badge>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm" aria-label={editAriaLabel}>
          <Link href={editHref}>
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={deleteAriaLabel}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function GovernancePanel() {
  const { t } = useTranslation("cortex-config")
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const [adminInput, setAdminInput] = useState("")

  if (governance.isPending) return <LoadingState label={t("state.loadingConfig")} />
  if (governance.isError) return <AccessDeniedState />

  const config: CoworkGovernanceConfig = governance.data
  const openMode = Object.keys(config.userAssignments).length === 0

  // Fire-and-forget: .mutate() (not .mutateAsync()) so a rejection is
  // handled entirely by the mutation's onError toast, with no unhandled
  // promise rejection to also worry about here.
  const saveRoles = (roles: CoworkRole[]) => updateGovernance.mutate({ roles })
  const saveAssignments = (assignments: Record<string, string[]>) =>
    updateGovernance.mutate({ userAssignments: assignments })

  return (
    <div className="space-y-4">
      {openMode ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>{t("governance.openModeTitle")}</strong> {t("governance.openModeBody")}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("governance.rolesTitle")}</CardTitle>
                <CardDescription>{t("governance.rolesDescription")}</CardDescription>
              </div>
              <Button asChild size="sm">
                <Link href="/cortex-config/governance/roles/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t("governance.addRole")}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("governance.rolesEmpty")}</p>
            ) : (
              config.roles.map((role) => (
                <EntityRow
                  key={role.id}
                  name={role.name}
                  badges={[role.id]}
                  editHref={`/cortex-config/governance/roles/${encodeURIComponent(role.id)}`}
                  editAriaLabel={t("governance.editRoleAria", { name: role.name })}
                  onDelete={() => saveRoles(config.roles.filter((r) => r.id !== role.id))}
                  deleteAriaLabel={t("governance.deleteRoleAria", { name: role.name })}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("governance.usersTitle")}</CardTitle>
                <CardDescription>{t("governance.usersDescription")}</CardDescription>
              </div>
              <Button asChild size="sm">
                <Link href="/cortex-config/governance/users/new">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  {t("governance.addAssignment")}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(config.userAssignments).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("governance.usersEmpty")}</p>
            ) : (
              Object.entries(config.userAssignments).map(([email, roleIds]) => (
                <EntityRow
                  key={email}
                  name={email}
                  badges={roleIds}
                  editHref={`/cortex-config/governance/users/${encodeURIComponent(email)}`}
                  editAriaLabel={t("governance.editAssignmentAria", { email })}
                  onDelete={() => {
                    const next = { ...config.userAssignments }
                    delete next[email]
                    saveAssignments(next)
                  }}
                  deleteAriaLabel={t("governance.deleteAssignmentAria", { email })}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base">{t("governance.adminsTitle")}</CardTitle>
              <CardDescription>{t("governance.adminsDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {config.adminEmails.length === 0 ? (
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {t("governance.bootstrapBadge")}
                </Badge>
              ) : (
                config.adminEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      aria-label={t("governance.deleteAdminAria", { email })}
                      onClick={() =>
                        updateGovernance.mutate({
                          adminEmails: config.adminEmails.filter((admin) => admin !== email),
                        })
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const email = adminInput.trim().toLowerCase()
                if (!email || config.adminEmails.includes(email)) return
                updateGovernance.mutate(
                  { adminEmails: [...config.adminEmails, email] },
                  { onSuccess: () => setAdminInput("") },
                )
              }}
            >
              <Input
                value={adminInput}
                onChange={(event) => setAdminInput(event.target.value)}
                placeholder={t("governance.adminPlaceholder")}
                type="email"
              />
              <Button type="submit" variant="outline" disabled={updateGovernance.isPending}>
                {t("governance.add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
