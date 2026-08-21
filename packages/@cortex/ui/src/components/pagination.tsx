"use client"

import { cn } from "@cortex/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"

interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  const { t } = useTranslation("ui")
  return (
    <div
      className={cn("flex items-center justify-between text-xs text-muted-foreground", className)}
    >
      <p>{t("pagination.page", { current: page + 1, total: pageCount })}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("pagination.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page + 1 >= pageCount}
        >
          {t("pagination.next")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
