"use client"

import { motion, useReducedMotion } from "framer-motion"

const GRAIN_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"

interface OrbConfig {
  className: string
  size: string
  position: string
  hideMobile?: boolean
  motion: {
    x: number[]
    y: number[]
    scale: number[]
    duration: number
    delay: number
  }
}

const ORBS: ReadonlyArray<OrbConfig> = [
  {
    className: "bg-cortex/40",
    size: "h-[36rem] w-[36rem]",
    position: "-top-40 -left-40",
    motion: {
      x: [0, 80, -40, 0],
      y: [0, 60, 100, 0],
      scale: [1, 1.1, 0.95, 1],
      duration: 18,
      delay: 0,
    },
  },
  {
    className: "bg-violet-500/30",
    size: "h-[32rem] w-[32rem]",
    position: "-top-32 -right-32",
    motion: {
      x: [0, -90, -30, 0],
      y: [0, 80, 40, 0],
      scale: [1, 1.15, 1.05, 1],
      duration: 22,
      delay: 2,
    },
  },
  {
    className: "bg-sky-400/30",
    size: "h-[28rem] w-[28rem]",
    position: "-bottom-40 -left-24",
    hideMobile: true,
    motion: {
      x: [0, 120, 60, 0],
      y: [0, -80, -40, 0],
      scale: [1, 1.05, 1.1, 1],
      duration: 16,
      delay: 4,
    },
  },
  {
    className: "bg-fuchsia-500/20",
    size: "h-[40rem] w-[40rem]",
    position: "-bottom-48 -right-40",
    hideMobile: true,
    motion: {
      x: [0, -100, -60, 0],
      y: [0, -60, -100, 0],
      scale: [1, 1.2, 1.05, 1],
      duration: 20,
      delay: 1,
    },
  },
]

export function AnimatedAuroraBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-background"
    >
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl mix-blend-screen dark:mix-blend-lighten ${orb.className} ${orb.size} ${orb.position} ${
            orb.hideMobile ? "hidden md:block" : ""
          }`}
          {...(reduce
            ? {}
            : {
                animate: {
                  x: orb.motion.x,
                  y: orb.motion.y,
                  scale: orb.motion.scale,
                },
                transition: {
                  duration: orb.motion.duration,
                  delay: orb.motion.delay,
                  repeat: Infinity,
                  ease: "easeInOut" as const,
                },
              })}
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: `url("${GRAIN_SVG}")` }}
      />
    </div>
  )
}
