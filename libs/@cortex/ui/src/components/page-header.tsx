"use client"

import { cn } from "@cortex/utils"
import { Info } from "lucide-react"
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border bg-background px-6 py-2.5",
        className,
      )}
    >
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {description ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Page description"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
