import type {
  DashboardStatsResponse,
  DeletePackagesRequest,
  EmptyOk,
  ExportTemplateInfo,
  ExportValidationResponse,
  GetActionLogsQuery,
  GetPackagesQuery,
  ImportMultiplePackagesBody,
  ImportPackageBody,
  PackageActionsResponse,
  PackageDetailsResponse,
  PackageTransition,
  PackageTransitionsResponse,
  PackageTransportOrdersResponse,
  PaginatedActionLogResponse,
  PaginatedPackageResponse,
  ReprocessRequest,
  SetCustomStatusRequest,
  SetUserNotesRequest,
  SourceFileReadModel,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateTransportInfoRequest,
  UserInfoResponse,
} from "@cortex/types"
import { apiClient } from "./client"

const transitionCall = (t: PackageTransition) => (id: string) =>
  apiClient.post<EmptyOk>(`/packages/${id}/${t.replace(/_/g, "-")}`)

const transportOrderSection =
  <TBody>(section: string) =>
  (pid: string, oid: string, body: TBody) =>
    apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/${section}`, {
      jsonBody: body,
    })

function buildImportForm(body: ImportPackageBody | ImportMultiplePackagesBody): FormData {
  const form = new FormData()
  if ("file" in body) {
    form.append("file", body.file)
  } else {
    for (const f of body.files) form.append("files", f)
  }
  if (body.fast_processing !== undefined) {
    form.append("fast_processing", String(body.fast_processing))
  }
  if (body.additional_ai_context_enabled !== undefined) {
    form.append(
      "additional_ai_context_enabled",
      String(body.additional_ai_context_enabled),
    )
  }
  if (body.additional_ai_context) {
    form.append("additional_ai_context", body.additional_ai_context)
  }
  return form
}

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
    dashboardStats: () => apiClient.get<DashboardStatsResponse>("/packages/dashboard-stats"),
    import: (body: ImportPackageBody) =>
      apiClient.post<EmptyOk>("/packages/import", { body: buildImportForm(body) }),
    importMultiple: (body: ImportMultiplePackagesBody) =>
      apiClient.post<EmptyOk>("/packages/import-multiple", { body: buildImportForm(body) }),
    get: (id: string) => apiClient.get<PackageDetailsResponse>(`/packages/${id}`),
    actions: (id: string) =>
      apiClient.get<PackageActionsResponse>(`/packages/${id}/actions`),
    transportOrders: (id: string) =>
      apiClient.get<PackageTransportOrdersResponse>(`/packages/${id}/transport-orders`),
    transitions: (id: string) =>
      apiClient.get<PackageTransitionsResponse>(`/packages/${id}/transitions`),
    sourceFiles: (id: string) =>
      apiClient.get<SourceFileReadModel[]>(`/packages/${id}/source-files`),
    sourceFileContent: (id: string, path: string) =>
      apiClient.get<Blob>(`/packages/${id}/source-files/content`, {
        params: { path },
        parse: "blob",
      }),
    download: (id: string) => apiClient.get<Blob>(`/packages/${id}/download`, { parse: "blob" }),
    downloadResult: (id: string) =>
      apiClient.get<Blob>(`/packages/${id}/download-result`, { parse: "blob" }),
    exportTemplates: () =>
      apiClient.get<ExportTemplateInfo[]>("/packages/export-templates"),
    validateExport: (id: string, template: string) =>
      apiClient.get<ExportValidationResponse>(`/packages/${id}/export/validate`, {
        params: { template },
      }),
    exportResult: (id: string, template: string) =>
      apiClient.get<Blob>(`/packages/${id}/export`, {
        params: { template },
        parse: "blob",
      }),
    startVerification: transitionCall("start_verification"),
    cancelVerification: transitionCall("cancel_verification"),
    finishVerification: transitionCall("finish_verification"),
    resetVerification: transitionCall("reset_verification"),
    reprocess: (id: string, body: ReprocessRequest = {}) =>
      apiClient.post<EmptyOk>(`/packages/${id}/reprocess`, { jsonBody: body }),
    setCustomStatus: (id: string, body: SetCustomStatusRequest) =>
      apiClient.post<EmptyOk>(`/packages/${id}/custom-status`, { jsonBody: body }),
    setUserNotes: (id: string, body: SetUserNotesRequest) =>
      apiClient.post<EmptyOk>(`/packages/${id}/user-notes`, { jsonBody: body }),
    deleteMany: (body: DeletePackagesRequest) =>
      apiClient.post<EmptyOk>("/packages/delete", { jsonBody: body }),
    restore: (id: string) => apiClient.post<EmptyOk>(`/packages/${id}/restore`),
  },
  transportOrders: {
    updateSeller: transportOrderSection<UpdatePartyRequest>("seller"),
    updateBuyer: transportOrderSection<UpdatePartyRequest>("buyer"),
    updateConsignor: transportOrderSection<UpdatePartyRequest>("consignor"),
    updateConsignee: transportOrderSection<UpdatePartyRequest>("consignee"),
    updateTransportInfo: transportOrderSection<UpdateTransportInfoRequest>("transport-info"),
    updateInvoice: (pid: string, oid: string, iid: string, body: UpdateInvoiceRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/invoices/${iid}`, {
        jsonBody: body,
      }),
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
