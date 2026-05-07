"use client"

import { Button, ThemeToggle } from "@cortex/ui"
import { ArrowRight, ShieldCheck, Sparkles, Workflow } from "lucide-react"
import Image from "next/image"
import { useThemeStore } from "@/lib/stores/theme-store"
import { DotGrid } from "./dot-grid"
import { ShellFooter } from "./shell-footer"
import { SplitText } from "./split-text"

export function LandingHero() {
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)

  const handleSignIn = () => {
    const rd = `${window.location.origin}/`
    window.location.assign(`/oauth2/start?rd=${encodeURIComponent(rd)}`)
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate />

      <header className="relative z-10 flex items-center justify-between gap-2.5 px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <Image
            src="/cortex-logo.png"
            alt="Cortex360"
            width={28}
            height={28}
            className="dark:invert dark:hue-rotate-180"
            priority
          />
          <span className="text-sm font-semibold tracking-tight">Cortex360</span>
        </div>
        <ThemeToggle mode={themeMode} onModeChange={setThemeMode} />
      </header>

      <main className="relative z-10 flex flex-1 items-center px-6 py-10 md:px-10 md:py-16">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div className="flex flex-col space-y-7">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cortex/60 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cortex" />
              </span>
              Enterprise AI Platform
            </div>

            <h1 className="text-[2.75rem] font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-[4rem]">
              <SplitText delay={45} splitBy="char">
                Cortex360
              </SplitText>
            </h1>

            <p className="max-w-xl text-lg font-medium leading-snug text-foreground/85 md:text-xl">
              <SplitText delay={35}>
                Zintegrowany hub modułów AI dla operacji enterprise.
              </SplitText>
            </p>

            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
              Od ekstrakcji dokumentów po automatyzację procesów — jedna platforma, wspólny
              design system, jeden punkt logowania.
            </p>

            <ul className="space-y-3 pt-2">
              <li className="flex items-center gap-3 text-sm text-foreground/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Sparkles className="h-3.5 w-3.5 text-cortex" />
                </span>
                Automatyczna ekstrakcja danych z dokumentów
              </li>
              <li className="flex items-center gap-3 text-sm text-foreground/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Workflow className="h-3.5 w-3.5 text-cortex" />
                </span>
                Pipeline AI dla powtarzalnych operacji
              </li>
              <li className="flex items-center gap-3 text-sm text-foreground/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <ShieldCheck className="h-3.5 w-3.5 text-cortex" />
                </span>
                Bezpieczeństwo i audyt klasy enterprise
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="group relative w-full max-w-sm">
              <div
                aria-hidden="true"
                className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cortex/40 via-cortex/0 to-cortex/20 opacity-60 blur-md transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="relative rounded-2xl border border-cortex/30 bg-card/80 p-8 shadow-xl shadow-cortex/10 backdrop-blur-md transition-all duration-300 hover:border-cortex hover:shadow-cortex/20">
                <div className="flex flex-col items-center space-y-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background">
                    <Image
                      src="/cortex-logo.png"
                      alt=""
                      width={28}
                      height={28}
                      className="dark:invert dark:hue-rotate-180"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold tracking-tight">Zaloguj się</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Uzyskaj dostęp do swoich modułów Cortex360
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleSignIn}
                    className="group/btn w-full gap-2 text-sm font-medium"
                  >
                    Kontynuuj
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Button>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Logowanie SSO przez Auth0
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ShellFooter />
    </div>
  )
}
