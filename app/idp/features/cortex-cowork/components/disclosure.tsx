"use client"

import { cn } from "@cortex/utils"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

// Shared disclosure primitives for the cowork surfaces (activity trail,
// floating panels, sidebar "Moje instrukcje"). No shadcn Collapsible exists in
// @cortex/ui, so these small pieces keep the several in-feature disclosures
// from each re-rolling the same chevron + height-collapse.

/** Ease-out curve for the collapse animation - calm, no bounce. */
const EASE_OUT: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

/** Right-pointing chevron that rotates 90° when its section is open. */
export function DisclosureChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronRight
      className={cn(
        "h-3 w-3 shrink-0 transition-transform duration-150 ease-out",
        open && "rotate-90",
        className,
      )}
    />
  )
}

/** Height + opacity collapse for a disclosure body; renders nothing when closed. */
export function CollapseRegion({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
