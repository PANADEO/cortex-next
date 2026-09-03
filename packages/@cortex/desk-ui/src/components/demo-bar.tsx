"use client"
import type { User } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useDeskT } from "../i18n/client"
import { api, t as route } from "../routes"
import { Icon } from "./icon"
import { Avatar } from "./persona-switcher"

/**
 * PRZEŁĄCZANIE OSÓB TO FUNKCJA POKAZU, WIĘC WYGLĄDA JAK POKAZ.
 *
 * DLACZEGO OSOBNO. Do 03.09.2026 stało w tym samym menu co język i wygląd, na dole paska
 * bocznego — czyli funkcja, której u klienta NIE MA, siedziała wymieszana z ustawieniami,
 * których u klienta brakowało. Pierwsze mylnie sugerowało pracownicy, że może „być kimś
 * innym"; drugie było przez to nieosiągalne na telefonie (patrz `settings-dialog.tsx`).
 *
 * Pasek stoi WYŁĄCZNIE, gdy `identity().switchable` — a to znaczy: tożsamości nie ustala
 * brama logowania, tylko my, na pokaz. Warunek czytamy z `identity()`, a nie drugim
 * odczytem zmiennej środowiskowej: dwa źródła tej samej prawdy rozjeżdżają się zawsze.
 *
 * Mówi wprost „POKAZ", bo pomyłka w drugą stronę jest droga: człowiek przekonany, że
 * ogląda własne biurko, podczas gdy patrzy na cudze, wyciąga wnioski o cudzych plikach.
 */
export function DemoBar({ me, everyone }: { me: User; everyone: User[] }) {
  const router = useRouter()
  const translate = useDeskT()

  async function switchTo(id: string) {
    await fetch(api("/persona"), { method: "POST", body: JSON.stringify({ id }) })
    router.push(route("/"))
    router.refresh()
  }

  return (
    <div className="flex h-desk-demo shrink-0 items-center gap-2 border-b border-desk-warn/40 bg-desk-warn/10 px-3">
      <span className="t-micro rounded-desk-pill bg-desk-warn/20 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-desk-warn">
        {translate("demo.badge")}
      </span>
      <span className="t-meta">{translate("demo.viewingAs")}</span>
      <Menu.Root>
        <Menu.Trigger className="t-body-m flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-desk-raised/70">
          <Avatar u={me} px={20} />
          {me.firstName} {me.lastName}
          <Icon as={ChevronDown} px={14} className="text-desk-muted" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={4}
            className="z-50 min-w-[220px] rounded-md border bg-desk-surface py-1 shadow-desk-pop"
          >
            {everyone.map((one) => (
              <Menu.Item
                key={one.id}
                onSelect={() => switchTo(one.id)}
                className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
              >
                <Avatar u={one} px={24} />
                <span className="flex-1">
                  {one.firstName} {one.lastName}
                </span>
                {one.id === me.id && <Icon as={Check} px={16} className="text-desk-accent" />}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
