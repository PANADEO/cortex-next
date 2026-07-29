"use client"

import { cn } from "@cortex/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./ui/button"

interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  return (
    <div className={cn("flex items-center justify-between text-xs text-muted-foreground", className)}>
      <p>
        Page {page + 1} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page + 1 >= pageCount}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
