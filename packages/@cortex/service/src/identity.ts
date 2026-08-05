// Tożsamość zalogowanego użytkownika (code-service) — odczyt OPISOWY na potrzeby
// wyświetlenia "kim jestem", nie bramka uprawnień. Świadomie osobny moduł od
// rbac.ts: tam każda funkcja odpowiada na pytanie "czy wolno" i ma być czytana
// jako kod bezpieczeństwa. Dołożenie do niej funkcji, której wynik NICZEGO nie
// blokuje, zacierałoby tę granicę.

import { getDb, users } from "@cortex/db"
import { eq } from "drizzle-orm"
import { normalizeEmail } from "./rbac"

/**
 * Nazwa wyświetlana użytkownika albo `null`, gdy nie ma go w
 * `system_config.users` lub nie ma uzupełnionego `full_name`. Oba przypadki
 * dają ten sam wynik celowo — powłoka i tak degraduje do samego e-maila, a
 * rozróżnianie ich tworzyłoby stan, którego nikt nie konsumuje.
 *
 * Normalizacja mimo że wołający ma e-mail z getRequestEmail() (a więc już
 * lowercase): to publiczna funkcja przyjmująca gołego stringa, dokładnie jak
 * getGrantedApplicationCodes(), a `users.email` trzyma wyłącznie lowercase —
 * bez tego "Jan@Firma.pl" po cichu nie trafiłby w swój wiersz.
 *
 * BEZ filtra `is_active`, inaczej niż zapytania w rbac-store.ts: to nie jest
 * warstwa dostępu i filtr niczego by tu nie zabezpieczył. Jedynym konsumentem
 * tej nazwy jest menu użytkownika w powłoce (ekran odmowy bierze sam e-mail
 * z /api/me/access i nazwy nie zna), a dezaktywowany użytkownik nie dostanie
 * żadnego grantu — rozstrzyga o tym fail-closed /api/me/access. Filtr dołożyłby
 * więc tylko drugie miejsce, w którym „aktywny" znaczy coś innego.
 *
 * PROPAGUJE błąd bazy — fail-soft egzekwuje kontroler, tym samym podziałem co
 * getGrantedApplicationCodes() / _lib/granted-apps.ts.
 */
export async function getUserDisplayName(email: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))

  return row?.fullName ?? null
}
