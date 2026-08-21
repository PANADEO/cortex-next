/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import IntrastatResourcesPage from "./page"

const mocks = vi.hoisted(() => ({
  apps: ["intrastat"] as string[],
}))

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => ({ apps: mocks.apps, isLoading: false }),
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatCnResource: () => ({
    data: {
      id: "resource-1",
      file_name: "cn.xlsx",
      row_count: 1,
      created_at: "2026-07-14T10:00:00Z",
    },
  }),
  useIntrastatCnResourceRows: () => ({
    data: {
      items: [
        {
          id: "row-1",
          index_value: "VA10363N",
          cn8: "85444290",
          cn: "85444290",
          description: "Electrical cables",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    },
    isFetching: false,
    isPending: false,
  }),
}))

vi.mock("@/components/intrastat/resource-download-button", () => ({
  IntrastatResourceDownloadButton: () => <button type="button">Download CN XLSX</button>,
}))

vi.mock("@/components/intrastat/resource-upload-button", () => ({
  IntrastatResourceUploadButton: () => <button type="button">Upload CN XLSX</button>,
}))

vi.mock("@/components/intrastat/cn-resource-row-dialog", () => ({
  IntrastatCnResourceRowDialog: () => null,
}))

describe("IntrastatResourcesPage", () => {
  beforeEach(() => {
    mocks.apps = ["intrastat"]
  })

  afterEach(() => cleanup())

  it("shows the CN database to every Intrastat user without edit actions", () => {
    render(<IntrastatResourcesPage />)

    expect(screen.getByText("VA10363N")).toBeInTheDocument()
    expect(screen.getByText(/Ręczne zmiany może nadpisać/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Dodaj kod CN" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Upload CN XLSX" })).not.toBeInTheDocument()
  })

  it("shows add, edit and upload actions to a CN editor", () => {
    mocks.apps = ["intrastat", "intrastat-cn-editor"]

    render(<IntrastatResourcesPage />)

    expect(screen.getByRole("button", { name: "Dodaj kod CN" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upload CN XLSX" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edytuj" })).toBeInTheDocument()
  })
})
