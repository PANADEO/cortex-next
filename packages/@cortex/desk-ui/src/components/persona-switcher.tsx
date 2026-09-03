"use client"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import type { User } from "@cortex/desk-core/types"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { useDeskT } from "../i18n/client"
import { t as route } from "../routes"
import { Icon } from "./icon"

export function Avatar({ u, px = 36 }: { u: User; px?: number }) {
  return (
    <span
      style={{ width: px, height: px }}
      className="grid shrink-0 place-items-center rounded-desk-pill border border-desk-accent-soft-line bg-desk-accent-soft text-[13px] font-semibold text-desk-accent-soft-ink"
    >
      {u.firstName[0]}
      {u.lastName[0]}
    </span>
  )
}

/**
 * WIZYTÓWKA PROWADZI DO WŁASNEGO EKRANU. Nie jest już menu.
 *
 * CO TU BYŁO DO 03.09.2026 i dlaczego wyleciało. Ten sam element trzymał TRZY różne
 * rzeczy pod jedną strzałką w dół: przełączanie osób (funkcja pokazu, u klienta
 * nieobecna), język i wygląd (ustawienia). Trzy rodzaje decyzji w jednym rozwijanym
 * menu to element bez pierwowzoru w Outlooku, Excelu ani w banku — a każdy element bez
 * pierwowzoru pani Basia musi ODKRYĆ, zamiast rozpoznać.
 *
 * Skutki były dwa, oba mierzalne. Ustawienia dało się otworzyć wyłącznie z paska
 * bocznego, którego poniżej 768 px nie ma — czyli u klienta na telefonie języka nie
 * dało się zmienić w ogóle. A przełączanie osób renderowało się pod warunkiem
 * `switchable`, więc menu u klienta wyglądało na zepsute: strzałka jest, po kliknięciu
 * prawie nic.
 *
 * Teraz: wizytówka to LINK do „Ja" (wzorzec, który ten użytkownik zna z każdego telefonu
 * i z każdego banku), ustawienia mają własne okno osiągalne z „Ja" bezwarunkowo
 * (`settings-dialog.tsx`), a przełączanie osób ma własny pasek widoczny tylko na pokazie
 * (`demo-bar.tsx`). Jedna rzecz, jedno miejsce.
 */
export function Persona({ me }: { me: User }) {
  const translate = useDeskT()
  return (
    <Link
      href={route("/me")}
      className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-desk-raised/70"
    >
      <Avatar u={me} />
      <span className="min-w-0 flex-1">
        <span className="t-body-m block truncate">
          {me.firstName} {me.lastName}
        </span>
        <span className="t-meta block truncate">{departmentLabel(translate, me.department)}</span>
      </span>
      <Icon as={ChevronRight} px={16} className="shrink-0 text-desk-muted" />
    </Link>
  )
}
