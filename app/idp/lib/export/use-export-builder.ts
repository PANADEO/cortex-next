"use client"

import { useCallback, useMemo, useState } from "react"
import { defaultSelectedFieldIds, type ExportFormat } from "./fields"

export type ExportDestination = "download" | "network"
export type PackagingKind = "individual" | "zip"

export interface ExportBuilderState {
  selectedPackageIds: Set<string>
  togglePackage: (id: string) => void
  setSelectedPackageIds: (ids: Iterable<string>) => void
  clearPackages: () => void

  format: ExportFormat
  setFormat: (value: ExportFormat) => void

  selectedFields: Set<string>
  toggleField: (id: string) => void
  setGroupFields: (ids: readonly string[], on: boolean) => void
  resetFields: () => void

  includeSources: boolean
  setIncludeSources: (value: boolean) => void
  packaging: PackagingKind
  setPackaging: (value: PackagingKind) => void

  destination: ExportDestination
  setDestination: (value: ExportDestination) => void
  networkPath: string
  setNetworkPath: (value: string) => void
}

export function useExportBuilder(): ExportBuilderState {
  const [selectedPackageIds, setSelected] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() =>
    defaultSelectedFieldIds(),
  )
  const [includeSources, setIncludeSources] = useState(false)
  const [packaging, setPackaging] = useState<PackagingKind>("zip")
  const [destination, setDestination] = useState<ExportDestination>("download")
  const [networkPath, setNetworkPath] = useState("\\\\fileserver\\customs\\exports\\")

  const togglePackage = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setSelectedPackageIds = useCallback((ids: Iterable<string>) => {
    setSelected(new Set(ids))
  }, [])

  const clearPackages = useCallback(() => setSelected(new Set()), [])

  const toggleField = useCallback((id: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setGroupFields = useCallback((ids: readonly string[], on: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const resetFields = useCallback(() => {
    setSelectedFields(defaultSelectedFieldIds())
  }, [])

  return useMemo(
    () => ({
      selectedPackageIds,
      togglePackage,
      setSelectedPackageIds,
      clearPackages,
      format,
      setFormat,
      selectedFields,
      toggleField,
      setGroupFields,
      resetFields,
      includeSources,
      setIncludeSources,
      packaging,
      setPackaging,
      destination,
      setDestination,
      networkPath,
      setNetworkPath,
    }),
    [
      selectedPackageIds,
      togglePackage,
      setSelectedPackageIds,
      clearPackages,
      format,
      selectedFields,
      toggleField,
      setGroupFields,
      resetFields,
      includeSources,
      packaging,
      destination,
      networkPath,
    ],
  )
}
