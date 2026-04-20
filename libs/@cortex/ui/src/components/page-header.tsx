import { cn } from "@cortex/utils"
import Link from "next/link"
import type { ReactNode } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb"

interface BreadcrumbEntry {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: BreadcrumbEntry[]
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 border-b border-border bg-background px-6 py-4", className)}>
      {breadcrumb && breadcrumb.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumb.map((entry, index) => {
              const isLast = index === breadcrumb.length - 1
              return (
                <BreadcrumbItem key={`${entry.label}-${index}`}>
                  {isLast || !entry.href ? (
                    <BreadcrumbPage>{entry.label}</BreadcrumbPage>
                  ) : (
                    <>
                      <BreadcrumbLink asChild>
                        <Link href={entry.href}>{entry.label}</Link>
                      </BreadcrumbLink>
                      <BreadcrumbSeparator />
                    </>
                  )}
                </BreadcrumbItem>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
