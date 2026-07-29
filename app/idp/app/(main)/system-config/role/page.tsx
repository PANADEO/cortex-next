"use client"

import { ScopeNote } from "@/features/system-config/components/scope-note"
import { useKonfiguracjaRoles } from "@/features/system-config/hooks"
import { Badge, EmptyState, PageHeader } from "@cortex/ui"
import { KeyRound } from "lucide-react"

export default function RolePage() {
  const rolesQuery = useKonfiguracjaRoles()
  const roles = rolesQuery.data ?? []

  return (
    <>
      <PageHeader
        title="Role"
        description="Role są jedynym nośnikiem uprawnień. Rola systemowa jest chroniona przed usunięciem."
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <ScopeNote />

        {rolesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie ról...</p>
        ) : rolesQuery.isError ? (
          <EmptyState
            icon={KeyRound}
            title="Nie udało się wczytać ról"
            description="Sprawdź połączenie z bazą danych modułu Konfiguracja Systemu."
          />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Brak ról"
            description="Uruchom seed bootstrapowy, aby utworzyć rolę administratora."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kod</th>
                  <th className="px-4 py-2 font-medium">Nazwa</th>
                  <th className="px-4 py-2 font-medium">Opis</th>
                  <th className="px-4 py-2 font-medium">Typ</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{role.code}</td>
                    <td className="px-4 py-2 font-medium">{role.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{role.description ?? "-"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={role.isSystem ? "default" : "outline"}>
                        {role.isSystem ? "Systemowa" : "Zwykła"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
