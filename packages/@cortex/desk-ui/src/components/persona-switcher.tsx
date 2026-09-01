"use client"
import type { User } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { api, t } from "../routes"
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

export function Persona({ ja, everyone }: { ja: User; everyone: User[] }) {
  const router = useRouter()
  async function toggle(id: string) {
    await fetch(api("/persona"), { method: "POST", body: JSON.stringify({ id }) })
    router.push(t("/"))
    router.refresh()
  }
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-desk-raised/70">
        <Avatar u={ja} />
        <span className="min-w-0 flex-1">
          <span className="t-body-m block truncate">
            {ja.firstName} {ja.lastName}
          </span>
          <span className="t-meta block truncate">{ja.department}</span>
        </span>
        <Icon as={ChevronDown} px={16} className="shrink-0 text-desk-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[220px] rounded-md border bg-desk-surface py-1 shadow-desk-pop"
        >
          <Menu.Label className="t-micro px-3 py-1">Przełącz osobę (pokaz)</Menu.Label>
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
              {u.id === ja.id && <Icon as={Check} px={16} className="text-desk-accent" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
