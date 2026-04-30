"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useMemo } from "react"

interface SplitTextProps {
  children: string
  delay?: number
  splitBy?: "word" | "char"
  className?: string
}

export function SplitText({
  children,
  delay = 60,
  splitBy = "word",
  className,
}: SplitTextProps) {
  const reduceMotion = useReducedMotion()

  const parts = useMemo(() => {
    if (splitBy === "char") return Array.from(children)
    return children.split(/(\s+)/)
  }, [children, splitBy])

  if (reduceMotion) {
    return <span className={className}>{children}</span>
  }

  return (
    <span className={className}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="inline-block">
        {parts.map((part, i) => {
          if (/^\s+$/.test(part)) return <span key={`s-${i}`}>{part}</span>
          return (
            <motion.span
              key={`p-${i}`}
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
                delay: (i * delay) / 1000,
              }}
              className="inline-block whitespace-pre will-change-[transform,opacity,filter]"
            >
              {part}
            </motion.span>
          )
        })}
      </span>
    </span>
  )
}
