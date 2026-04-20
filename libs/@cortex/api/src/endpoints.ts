import type {
  DashboardStatsResponse,
  EmptyOk,
  GetActionLogsQuery,
  GetPackagesQuery,
  PackageActionsResponse,
  PackageDetailsResponse,
  PackageTransitionsResponse,
  PackageTransportOrdersResponse,
  PaginatedActionLogResponse,
  PaginatedPackageResponse,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateTransportInfoRequest,
  UserInfoResponse,
} from "@cortex/types"
import { apiClient } from "./client"

export const endpoints = {
  health: () => apiClient.get<Record<string, string>>("/health"),
  user: {
    me: () => apiClient.get<UserInfoResponse>("/user/me"),
  },
  packages: {
    list: (query: GetPackagesQuery = {}) =>
      apiClient.get<PaginatedPackageResponse>("/packages/get_all", {
        params: { ...query },
      }),
    actionLogs: (query: GetActionLogsQuery = {}) =>
      apiClient.get<PaginatedActionLogResponse>("/packages/action_logs", {
        params: { ...query },
      }),
    dashboardStats: () =>
      apiClient.get<DashboardStatsResponse>("/packages/dashboard-stats"),
    import: (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return apiClient.post<EmptyOk>("/packages/import", { body: form })
    },
    importMultiple: (files: File[]) => {
      const form = new FormData()
      for (const f of files) form.append("files", f)
      return apiClient.post<EmptyOk>("/packages/import-multiple", { body: form })
    },
    get: (id: string) => apiClient.get<PackageDetailsResponse>(`/packages/${id}`),
    actions: (id: string) =>
      apiClient.get<PackageActionsResponse>(`/packages/${id}/actions`),
    transportOrders: (id: string) =>
      apiClient.get<PackageTransportOrdersResponse>(`/packages/${id}/transport-orders`),
    transitions: (id: string) =>
      apiClient.get<PackageTransitionsResponse>(`/packages/${id}/transitions`),
    download: (id: string) =>
      apiClient.get<Blob>(`/packages/${id}/download`, { parse: "blob" }),
    downloadResult: (id: string) =>
      apiClient.get<Blob>(`/packages/${id}/download-result`, { parse: "blob" }),
    exportCsv: (id: string) =>
      apiClient.get<Blob>(`/packages/${id}/export-csv`, { parse: "blob" }),
    exportXml: (id: string) =>
      apiClient.get<Blob>(`/packages/${id}/export-xml`, { parse: "blob" }),
    startVerification: (id: string) =>
      apiClient.post<EmptyOk>(`/packages/${id}/start-verification`),
    cancelVerification: (id: string) =>
      apiClient.post<EmptyOk>(`/packages/${id}/cancel-verification`),
    finishVerification: (id: string) =>
      apiClient.post<EmptyOk>(`/packages/${id}/finish-verification`),
    resetVerification: (id: string) =>
      apiClient.post<EmptyOk>(`/packages/${id}/reset-verification`),
    reprocess: (id: string) => apiClient.post<EmptyOk>(`/packages/${id}/reprocess`),
  },
  transportOrders: {
    updateSeller: (pid: string, oid: string, body: UpdatePartyRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/seller`, { jsonBody: body }),
    updateBuyer: (pid: string, oid: string, body: UpdatePartyRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/buyer`, { jsonBody: body }),
    updateConsignor: (pid: string, oid: string, body: UpdatePartyRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/consignor`, { jsonBody: body }),
    updateConsignee: (pid: string, oid: string, body: UpdatePartyRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/consignee`, { jsonBody: body }),
    updateTransportInfo: (pid: string, oid: string, body: UpdateTransportInfoRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/transport-info`, { jsonBody: body }),
    updateInvoice: (pid: string, oid: string, iid: string, body: UpdateInvoiceRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/invoices/${iid}`, { jsonBody: body }),
    updateInvoiceLines: (pid: string, oid: string, iid: string, body: UpdateInvoiceLinesRequest) =>
      apiClient.post<EmptyOk>(
        `/packages/${pid}/transport-orders/${oid}/invoices/${iid}/lines`,
        { jsonBody: body },
      ),
    updateInvoiceTotals: (pid: string, oid: string, iid: string, body: UpdateInvoiceTotalsRequest) =>
      apiClient.post<EmptyOk>(
        `/packages/${pid}/transport-orders/${oid}/invoices/${iid}/totals`,
        { jsonBody: body },
      ),
    updateDeliveryTerms: (pid: string, oid: string, iid: string, body: UpdateDeliveryTermsRequest) =>
      apiClient.post<EmptyOk>(
        `/packages/${pid}/transport-orders/${oid}/invoices/${iid}/delivery-terms`,
        { jsonBody: body },
      ),
  },
}
