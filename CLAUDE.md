# Cortex Frontend

> **Do not modify this file unless explicitly requested by user.**

## Kontekst

**Prototyp** nowego frontendu platformy **Cortex360** — monorepo modułów ("kafelków"). Pierwszy moduł: **IDP** (Invoice/Document Processing), migrowany ze Streamlita na Next.js. Ten moduł stanowi pierwszą zbudowaną część nowego frontendu — fundament architektoniczny i design-system dla kolejnych modułów Cortex360.

## General principles

- KISS, DRY
- Before implementation, think step by step whether there exists a less elaborate, simpler, more elegant and more reliable solution to the problem
- Focus on delivering the minimal necessary functionality
- Apply minimal diff, maintain contracts and boundaries
- Strict TypeScript typing always
- Reuse utilities; avoid new dependencies unless already present in repo
- NEVER auto-create `.md` files; explicit request only
- Code should be self-documenting, no redundant comments

## Technology stack

- **Framework:** Next.js 15 + React 18 + TypeScript 5.8 (all `"use client"`, no RSC)
- **UI:** shadcn/ui (Radix + Tailwind 3.4) + CSS variables for theming
- **Tables:** TanStack Table v8 + `@tanstack/react-virtual`
- **State:** TanStack Query (server) + Zustand (client)
- **Forms:** React Hook Form + Zod
- **Docs:** `react-pdf` + `pdfjs-dist`, `docx-preview`, `xlsx` (SheetJS)
- **Interaction:** `@dnd-kit`, `sonner`, `framer-motion`, `lucide-react`, `date-fns`
- **Dev/QA:** Ladle (component dev), Vitest + Testing Library + jsdom, MSW (API mocking)
- **Deployment:** self-hosted Docker (Next.js standalone), NextAuth

## Repository layout

```
/app/<tile>/*            → aplikacje (kafelki) — np. /app/idp
/libs/@cortex/ui/*       → shared komponenty
/libs/@cortex/styles/*   → tokens, Tailwind config, themes
/libs/@cortex/api/*      → shared API layer
/libs/@cortex/types/*    → shared TypeScript types
/libs/@cortex/utils/*    → shared utilities
/docs/*                  → dokumentacja architektoniczna
```

Reużywalne → `/libs/@cortex/*`. App-specific → `/app/<tile>/*`.
Brak workspace managera na tym etapie (pnpm/turbo dorzucamy gdy zacznie boleć).

## Required Reading

- **MUST follow:** [architecture_rules.md](architecture_rules.md) — naming/code/testing conventions
- **MUST read:** [docs/frontend-architecture.md](docs/frontend-architecture.md) — decyzje stackowe i uzasadnienia
