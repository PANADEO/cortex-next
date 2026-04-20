import type { GetActionLogsQuery, GetPackagesQuery } from "@cortex/types"

export const queryKeys = {
  all: ["idp"] as const,
  user: () => [...queryKeys.all, "user", "me"] as const,
  dashboardStats: () => [...queryKeys.all, "dashboard-stats"] as const,
  packages: {
    all: () => [...queryKeys.all, "packages"] as const,
    list: (query: GetPackagesQuery) =>
      [...queryKeys.packages.all(), "list", query] as const,
    detail: (id: string) => [...queryKeys.packages.all(), "detail", id] as const,
    actions: (id: string) => [...queryKeys.packages.all(), "actions", id] as const,
    transportOrders: (id: string) =>
      [...queryKeys.packages.all(), "transport-orders", id] as const,
    transitions: (id: string) => [...queryKeys.packages.all(), "transitions", id] as const,
  },
  actionLogs: (query: GetActionLogsQuery) =>
    [...queryKeys.all, "action-logs", query] as const,
}
