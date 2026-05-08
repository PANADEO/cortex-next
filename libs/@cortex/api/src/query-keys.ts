import type {
  GetActionLogsQuery,
  GetDirtyPackagesQuery,
  GetPackagesQuery,
  GetRulesQuery,
} from "@cortex/types"

export const queryKeys = {
  all: ["idp"] as const,
  user: () => [...queryKeys.all, "user", "me"] as const,
  authorizedApps: () => [...queryKeys.all, "user", "authorized-apps"] as const,
  userPreferences: () => [...queryKeys.all, "user", "preferences"] as const,
  dashboardStats: () => [...queryKeys.all, "dashboard-stats"] as const,
  moduleVersion: (endpoint: string) =>
    [...queryKeys.all, "module-version", endpoint] as const,
  featureFlags: () => [...queryKeys.all, "feature-flags"] as const,
  packages: {
    all: () => [...queryKeys.all, "packages"] as const,
    list: (query: GetPackagesQuery) =>
      [...queryKeys.packages.all(), "list", query] as const,
    detail: (id: string) => [...queryKeys.packages.all(), "detail", id] as const,
    actions: (id: string) => [...queryKeys.packages.all(), "actions", id] as const,
    transportOrders: (id: string) =>
      [...queryKeys.packages.all(), "transport-orders", id] as const,
    transitions: (id: string) => [...queryKeys.packages.all(), "transitions", id] as const,
    sourceFiles: (id: string) => [...queryKeys.packages.all(), "source-files", id] as const,
    ruleAttachments: (id: string) =>
      [...queryKeys.packages.all(), "rule-attachments", id] as const,
  },
  exportTemplates: () => [...queryKeys.all, "export-templates"] as const,
  actionLogs: (query: GetActionLogsQuery) =>
    [...queryKeys.all, "action-logs", query] as const,
  classification: {
    all: () => [...queryKeys.all, "classification"] as const,
    list: (query: GetDirtyPackagesQuery) =>
      [...queryKeys.classification.all(), "list", query] as const,
    detail: (id: string) =>
      [...queryKeys.classification.all(), "detail", id] as const,
  },
  rules: {
    all: () => [...queryKeys.all, "rules"] as const,
    list: (query: GetRulesQuery) => [...queryKeys.rules.all(), "list", query] as const,
    detail: (id: string) => [...queryKeys.rules.all(), "detail", id] as const,
    templates: () => [...queryKeys.rules.all(), "templates"] as const,
  },
}
