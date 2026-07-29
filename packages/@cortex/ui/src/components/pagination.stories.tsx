import type { Story } from "@ladle/react"
import { useState } from "react"
import { Pagination } from "./pagination"

export default {
  title: "Domain / Pagination",
}

export const Interactive: Story = () => {
  const [page, setPage] = useState(0)
  return (
    <div className="p-6">
      <Pagination page={page} pageCount={10} onChange={setPage} />
    </div>
  )
}

export const FirstPage: Story = () => (
  <div className="p-6">
    <Pagination page={0} pageCount={5} onChange={() => {}} />
  </div>
)

export const LastPage: Story = () => (
  <div className="p-6">
    <Pagination page={4} pageCount={5} onChange={() => {}} />
  </div>
)

export const SinglePage: Story = () => (
  <div className="p-6">
    <Pagination page={0} pageCount={1} onChange={() => {}} />
  </div>
)
