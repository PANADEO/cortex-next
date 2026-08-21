"use client"

import { useEffect, useRef } from "react"

export interface DotGridProps {
  animate?: boolean
  gap?: number
  dotSize?: number
  proximity?: number
  baseAlpha?: number
  hoverAlpha?: number
  className?: string
}

interface Dot {
  cx: number
  cy: number
}

export function DotGrid({
  animate = true,
  gap = 18,
  dotSize = 1,
  proximity = 120,
  baseAlpha = 0.06,
  hoverAlpha = 0.35,
  className,
}: DotGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<Dot[]>([])
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1e6,
    y: -1e6,
    active: false,
  })
  const rgbRef = useRef<{ r: number; g: number; b: number }>({ r: 0, g: 0, b: 0 })

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const shouldAnimate = animate && !reduceMotion

    let rafId: number | null = null
    let dpr = 1
    let width = 0
    let height = 0

    const readColor = () => {
      const computed = window.getComputedStyle(wrapper).color
      const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
      if (m) {
        rgbRef.current = {
          r: Number(m[1]),
          g: Number(m[2]),
          b: Number(m[3]),
        }
      }
    }

    const buildGrid = () => {
      const rect = wrapper.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = window.devicePixelRatio || 1

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cellSize = dotSize + gap
      const cols = Math.ceil(width / cellSize) + 1
      const rows = Math.ceil(height / cellSize) + 1

      const dots: Dot[] = []
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          dots.push({
            cx: x * cellSize + cellSize / 2,
            cy: y * cellSize + cellSize / 2,
          })
        }
      }
      dotsRef.current = dots
    }

    const drawStatic = () => {
      const { r, g, b } = rgbRef.current
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha})`
      const radius = dotSize
      for (const dot of dotsRef.current) {
        ctx.beginPath()
        ctx.arc(dot.cx, dot.cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawAnimated = () => {
      const { r, g, b } = rgbRef.current
      const { x: px, y: py, active } = pointerRef.current
      const proxSq = proximity * proximity
      const radius = dotSize
      ctx.clearRect(0, 0, width, height)
      for (const dot of dotsRef.current) {
        let alpha = baseAlpha
        if (active) {
          const dx = dot.cx - px
          const dy = dot.cy - py
          const dsq = dx * dx + dy * dy
          if (dsq <= proxSq) {
            const t = 1 - Math.sqrt(dsq) / proximity
            alpha = baseAlpha + (hoverAlpha - baseAlpha) * t
          }
        }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.beginPath()
        ctx.arc(dot.cx, dot.cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      rafId = requestAnimationFrame(drawAnimated)
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerRef.current.x = e.clientX - rect.left
      pointerRef.current.y = e.clientY - rect.top
      pointerRef.current.active = true
    }

    const onPointerLeave = () => {
      pointerRef.current.active = false
    }

    readColor()
    buildGrid()

    if (shouldAnimate) {
      window.addEventListener("pointermove", onPointerMove, { passive: true })
      window.addEventListener("pointerleave", onPointerLeave)
      rafId = requestAnimationFrame(drawAnimated)
    } else {
      drawStatic()
    }

    const ro = new ResizeObserver(() => {
      readColor()
      buildGrid()
      if (!shouldAnimate) drawStatic()
    })
    ro.observe(wrapper)

    let mo: MutationObserver | null = null
    if (typeof document !== "undefined") {
      mo = new MutationObserver(() => {
        readColor()
        if (!shouldAnimate) drawStatic()
      })
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      })
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro.disconnect()
      mo?.disconnect()
      if (shouldAnimate) {
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerleave", onPointerLeave)
      }
    }
  }, [animate, gap, dotSize, proximity, baseAlpha, hoverAlpha])

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  )
}
