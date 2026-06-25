import type {
  AttachRuleRequest,
  AutoClassifyResponse,
  CleanPackageDraft,
  CompileRuleRequest,
  CompileRuleResponse,
  DashboardStatsResponse,
  DeletePackagesRequest,
  DirtyPackageDetailsResponse,
  EmptyOk,
  ExplainRuleRequest,
  ExplainRuleResponse,
  ExportEmailRequest,
  ExportEmailResponse,
  ExportTemplateInfo,
  ExportValidationResponse,
  FeatureFlagSettingsResponse,
  FeatureFlagsResponse,
  GetActionLogsQuery,
  GetDirtyPackagesQuery,
  GetPackagesQuery,
  GetRulesQuery,
  ImportEmailPackageBody,
  ImportMultiplePackagesBody,
  ImportPackageBody,
  ImportPackageResponse,
  PackageActionsResponse,
  PackageDetailsResponse,
  PackageRuleAttachment,
  PackageRuleAttachmentsResponse,
  PackageTransition,
  PackageTransitionsResponse,
  PackageTransportOrdersResponse,
  PaginatedActionLogResponse,
  PaginatedDirtyPackageResponse,
  PaginatedPackageResponse,
  PaginatedRuleResponse,
  PromoteDirtyPackageResponse,
  ReprocessRequest,
  RuleDetailsResponse,
  RulePreviewRequest,
  RulePreviewResponse,
  RuleReadModel,
  RuleTemplateReadModel,
  RuleVersionReadModel,
  SaveRuleVersionRequest,
  SetAdditionalAiContextRequest,
  SetCustomStatusRequest,
  SetUserNotesRequest,
  SetUserPreferencesRequest,
  SourceFileReadModel,
  UpdateDeliveryTermsRequest,
  UpdateDocumentClassificationRequest,
  UpdateFeatureFlagSettingsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateSadContextRequest,
  UpdateTransportInfoRequest,
  UpsertDraftRequest,
  UpsertRuleRequest,
  UserInfoResponse,
  UserPreferencesResponse,
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

export function buildImportForm(
  body: ImportPackageBody | ImportEmailPackageBody | ImportMultiplePackagesBody,
): FormData {
  const form = new FormData()
  if ("file" in body) {
    form.append("file", body.file)
  } else {
    for (const f of body.files) form.append("files", f)
  }
  if (body.fast_processing !== undefined) {
    form.append("fast_processing", String(body.fast_processing))
  }
  if (body.atr_processing_enabled !== undefined) {
    form.append("atr_processing_enabled", String(body.atr_processing_enabled))
  }
  if (body.additional_ai_context_enabled !== undefined) {
    form.append("additional_ai_context_enabled", String(body.additional_ai_context_enabled))
  }
  if (body.additional_ai_context) {
    form.append("additional_ai_context", body.additional_ai_context)
  }
  if (body.package_name) {
    form.append("package_name", body.package_name)
  }
  if (body.notification_email) {
    form.append("notification_email", body.notification_email)
  }
  if (body.notification_export_template) {
    form.append("notification_export_template", body.notification_export_template)
  }
  return form
}

export const endpoints = {
  health: () => apiClient.get<Record<string, string>>("/health"),
  user: {
    me: () => apiClient.get<UserInfoResponse>("/user/me"),
    getPreferences: () => apiClient.get<UserPreferencesResponse>("/user/preferences"),
    setPreferences: (body: SetUserPreferencesRequest) =>
      apiClient.post<UserPreferencesResponse>("/user/preferences", { jsonBody: body }),
  },
  config: {
    featureFlags: () => apiClient.get<FeatureFlagsResponse>("/config"),
    featureFlagSettings: () =>
      apiClient.get<FeatureFlagSettingsResponse>("/config/feature-flags"),
    updateFeatureFlagSettings: (body: UpdateFeatureFlagSettingsRequest) =>
      apiClient.put<FeatureFlagSettingsResponse>("/config/feature-flags", { jsonBody: body }),
    reloadFeatureFlagSettingsFromEnv: () =>
      apiClient.post<FeatureFlagSettingsResponse>("/config/feature-flags/reload-from-env"),
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
      apiClient.post<ImportPackageResponse>("/packages/import", {
        body: buildImportForm(body),
      }),
    importEmail: (body: ImportEmailPackageBody) =>
      apiClient.post<ImportPackageResponse>("/packages/import-email", {
        body: buildImportForm(body),
      }),
    importMultiple: (body: ImportMultiplePackagesBody) =>
      apiClient.post<ImportPackageResponse>("/packages/import-multiple", {
        body: buildImportForm(body),
      }),
    get: (id: string) => apiClient.get<PackageDetailsResponse>(`/packages/${id}`),
    actions: (id: string) => apiClient.get<PackageActionsResponse>(`/packages/${id}/actions`),
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
    exportTemplates: () => apiClient.get<ExportTemplateInfo[]>("/packages/export-templates"),
    validateExport: (id: string, template: string) =>
      apiClient.get<ExportValidationResponse>(`/packages/${id}/export/validate`, {
        params: { template },
      }),
    exportResult: (id: string, template: string) =>
      apiClient.get<Blob>(`/packages/${id}/export`, {
        params: { template },
        parse: "blob",
      }),
    sendExportEmail: (id: string, template: string, body: ExportEmailRequest) =>
      apiClient.post<ExportEmailResponse>(`/packages/${id}/export/email`, {
        params: { template },
        jsonBody: body,
      }),
    startVerification: transitionCall("start_verification"),
    cancelVerification: transitionCall("cancel_verification"),
    unlockVerification: transitionCall("unlock_verification"),
    finishVerification: transitionCall("finish_verification"),
    resetVerification: transitionCall("reset_verification"),
    reprocess: (id: string, body: ReprocessRequest = {}) =>
      apiClient.post<EmptyOk>(`/packages/${id}/reprocess`, { jsonBody: body }),
    setCustomStatus: (id: string, body: SetCustomStatusRequest) =>
      apiClient.post<EmptyOk>(`/packages/${id}/custom-status`, { jsonBody: body }),
    setUserNotes: (id: string, body: SetUserNotesRequest) =>
      apiClient.post<EmptyOk>(`/packages/${id}/user-notes`, { jsonBody: body }),
    setAdditionalAiContext: (id: string, body: SetAdditionalAiContextRequest) =>
      apiClient.post<EmptyOk>(`/packages/${id}/additional-ai-context`, { jsonBody: body }),
    deleteMany: (body: DeletePackagesRequest) =>
      apiClient.post<EmptyOk>("/packages/delete", { jsonBody: body }),
    restore: (id: string) => apiClient.post<EmptyOk>(`/packages/${id}/restore`),
  },
  classification: {
    list: (query: GetDirtyPackagesQuery = {}) =>
      apiClient.get<PaginatedDirtyPackageResponse>("/classification/dirty-packages", {
        params: { ...query },
      }),
    get: (id: string) =>
      apiClient.get<DirtyPackageDetailsResponse>(`/classification/dirty-packages/${id}`),
    documentContent: (id: string, docId: string) =>
      apiClient.get<Blob>(`/classification/dirty-packages/${id}/documents/${docId}/content`, {
        parse: "blob",
      }),
    autoClassify: (id: string) =>
      apiClient.post<AutoClassifyResponse>(`/classification/dirty-packages/${id}/auto-classify`),
    updateDocument: (id: string, docId: string, body: UpdateDocumentClassificationRequest) =>
      apiClient.patch<EmptyOk>(`/classification/dirty-packages/${id}/documents/${docId}`, {
        jsonBody: body,
      }),
    upsertDraft: (id: string, body: UpsertDraftRequest) =>
      apiClient.post<CleanPackageDraft>(`/classification/dirty-packages/${id}/drafts`, {
        jsonBody: body,
      }),
    deleteDraft: (id: string, draftId: string) =>
      apiClient.delete<EmptyOk>(`/classification/dirty-packages/${id}/drafts/${draftId}`),
    promote: (id: string) =>
      apiClient.post<PromoteDirtyPackageResponse>(`/classification/dirty-packages/${id}/promote`),
  },
  rules: {
    list: (query: GetRulesQuery = {}) =>
      apiClient.get<PaginatedRuleResponse>("/rules", { params: { ...query } }),
    templates: () => apiClient.get<RuleTemplateReadModel[]>("/rules/templates"),
    create: (body: UpsertRuleRequest) =>
      apiClient.post<RuleReadModel>("/rules", { jsonBody: body }),
    get: (id: string) => apiClient.get<RuleDetailsResponse>(`/rules/${id}`),
    update: (id: string, body: UpsertRuleRequest) =>
      apiClient.patch<EmptyOk>(`/rules/${id}`, { jsonBody: body }),
    compile: (body: CompileRuleRequest) =>
      apiClient.post<CompileRuleResponse>("/rules/compile", { jsonBody: body }),
    explain: (body: ExplainRuleRequest) =>
      apiClient.post<ExplainRuleResponse>("/rules/explain", { jsonBody: body }),
    preview: (body: RulePreviewRequest) =>
      apiClient.post<RulePreviewResponse>("/rules/preview", { jsonBody: body }),
    saveVersion: (id: string, body: SaveRuleVersionRequest) =>
      apiClient.post<RuleVersionReadModel>(`/rules/${id}/versions`, { jsonBody: body }),
    listAttachments: (packageId: string) =>
      apiClient.get<PackageRuleAttachmentsResponse>(`/packages/${packageId}/rules`),
    attach: (packageId: string, body: AttachRuleRequest) =>
      apiClient.post<PackageRuleAttachment>(`/packages/${packageId}/rules`, {
        jsonBody: body,
      }),
    detach: (packageId: string, attachmentId: string) =>
      apiClient.delete<EmptyOk>(`/packages/${packageId}/rules/${attachmentId}`),
    runAttached: (packageId: string, attachmentId: string) =>
      apiClient.post<EmptyOk>(`/packages/${packageId}/rules/${attachmentId}/run`),
  },
  transportOrders: {
    updateSeller: transportOrderSection<UpdatePartyRequest>("seller"),
    updateBuyer: transportOrderSection<UpdatePartyRequest>("buyer"),
    updateConsignor: transportOrderSection<UpdatePartyRequest>("consignor"),
    updateConsignee: transportOrderSection<UpdatePartyRequest>("consignee"),
    updateTransportInfo: transportOrderSection<UpdateTransportInfoRequest>("transport-info"),
    updateSadContext: transportOrderSection<UpdateSadContextRequest>("sad-context"),
    updateInvoice: (pid: string, oid: string, iid: string, body: UpdateInvoiceRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/invoices/${iid}`, {
        jsonBody: body,
      }),
    updateInvoiceLines: (pid: string, oid: string, iid: string, body: UpdateInvoiceLinesRequest) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/invoices/${iid}/lines`, {
        jsonBody: body,
      }),
    updateInvoiceTotals: (
      pid: string,
      oid: string,
      iid: string,
      body: UpdateInvoiceTotalsRequest,
    ) =>
      apiClient.post<EmptyOk>(`/packages/${pid}/transport-orders/${oid}/invoices/${iid}/totals`, {
        jsonBody: body,
      }),
    updateDeliveryTerms: (
      pid: string,
      oid: string,
      iid: string,
      body: UpdateDeliveryTermsRequest,
    ) =>
      apiClient.post<EmptyOk>(
        `/packages/${pid}/transport-orders/${oid}/invoices/${iid}/delivery-terms`,
        { jsonBody: body },
      ),
  },
}
