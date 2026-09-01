"use client"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import type { User } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useDeskAppearance, useDeskLocale, useDeskT, useSetDeskLocale } from "../i18n/client"
import { DESK_LOCALES, DESK_LOCALE_NAMES } from "../i18n/locale"
import { api, t as route } from "../routes"
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
 * Menu osoby — i JEDYNE miejsce z ustawieniami widoku.
 *
 * Język i wygląd stoją tutaj, a nie w pasku u góry, bo Biurko jest ekranem rozmowy:
 * pasek zabrałby wysokość dokładnie tam, gdzie potrzebna jest treść. Wszystko „o mnie"
 * — kim jestem, w jakim języku czytam, jak to ma wyglądać — siedzi więc w jednym
 * miejscu na dole kolumny, tym samym, które w Cortex Coworku trzyma tożsamość.
 *
 * Sekcja osób renderuje się WYŁĄCZNIE wtedy, gdy przełączenie naprawdę zmieni
 * tożsamość (`identity().switchable`). Pod bramą logowania tożsamość jest ustalona
 * z zewnątrz, więc menu wybierałoby osobę i nic by się nie działo: wygląda to na
 * awarię Biurka, a jest konfiguracją.
 */
export function Persona({ me, everyone }: { me: User; everyone: User[] }) {
  const router = useRouter()
  const translate = useDeskT()
  const locale = useDeskLocale()
  const setLocale = useSetDeskLocale()
  const appearance = useDeskAppearance()

  async function toggle(id: string) {
    await fetch(api("/persona"), { method: "POST", body: JSON.stringify({ id }) })
    router.push(route("/"))
    router.refresh()
  }

  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-desk-raised/70">
        <Avatar u={me} />
        <span className="min-w-0 flex-1">
          <span className="t-body-m block truncate">
            {me.firstName} {me.lastName}
          </span>
          <span className="t-meta block truncate">{departmentLabel(translate, me.department)}</span>
        </span>
        <Icon as={ChevronDown} px={16} className="shrink-0 text-desk-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[220px] rounded-md border bg-desk-surface py-1 shadow-desk-pop"
        >
          {everyone.length > 1 && (
            <>
              <Menu.Label className="t-micro px-3 py-1">{translate("persona.switch")}</Menu.Label>
              {everyone.map((u) => (
                <Menu.Item
                  key={u.id}
                  onSelect={() => toggle(u.id)}
                  className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
                >
                  <Avatar u={u} px={24} />
                  <span className="flex-1">
                    {u.firstName} {u.lastName}
                  </span>
                  {u.id === me.id && <Icon as={Check} px={16} className="text-desk-accent" />}
                </Menu.Item>
              ))}
              <Menu.Separator className="my-1 h-px bg-desk-line" />
            </>
          )}

          <Menu.Label className="t-micro px-3 py-1">{translate("persona.language")}</Menu.Label>
          {DESK_LOCALES.map((code) => (
            <Menu.Item
              key={code}
              onSelect={() => setLocale(code)}
              className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
            >
              <span className="flex-1">{DESK_LOCALE_NAMES[code]}</span>
              {code === locale && <Icon as={Check} px={16} className="text-desk-accent" />}
            </Menu.Item>
          ))}

          {appearance && (
            <>
              <Menu.Separator className="my-1 h-px bg-desk-line" />
              <Menu.Label className="t-micro px-3 py-1">
                {translate("persona.appearance")}
              </Menu.Label>
              {appearance.choices.map((choice) => (
                <Menu.Item
                  key={choice.id}
                  onSelect={() => appearance.set(choice.id)}
                  className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
                >
                  <span className="flex-1">{choice.label}</span>
                  {choice.id === appearance.current && (
                    <Icon as={Check} px={16} className="text-desk-accent" />
                  )}
                </Menu.Item>
              ))}
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
