/**
 * BRAMA WSPÓLNEJ PÓŁKI — jedno miejsce, które decyduje, kto może na nią zajrzeć i kto na
 * niej pisać.
 *
 * DLACZEGO ZDOLNOŚĆ, A NIE LISTA DOSTĘPU NA KATALOGU. Lista dostępu byłaby DRUGIM modelem
 * uprawnień obok zdolności — a to jest droga zamknięta w ADR-0001, i to nie z powodów
 * estetycznych: dwa modele znaczą dwa miejsca, w których trzeba pamiętać o odebraniu
 * dostępu, i dwa ekrany, na których człowiek szuka odpowiedzi „dlaczego on to widzi".
 * Zdolność ma już nadawanie przez przełożonego, wiersz na „Co potrafię", prośbę o dostęp
 * i wiersz w dowodzie, gdy jej zabrakło. Wspólna półka nie potrzebuje niczego więcej.
 *
 * DLACZEGO DWIE, A NIE JEDNA. Test rozłączności z ADR-0001: istnieje sytuacja, w której
 * ktoś ma mieć jedno bez drugiego. Księgowa ma czytać firmowe wzory pism i cenniki;
 * nadpisywać ich nie ma. To jest reguła, nie ostrożność — dokument na wspólnej półce
 * czyta cały zespół, więc jego podmiana jest zdarzeniem o zasięgu całej firmy.
 */
import { isShared, SHARED } from "./folder"

export type Mode = "read" | "write"

const NEEDED: Record<Mode, string> = { read: "shared.read", write: "shared.write" }

/**
 * Zwraca `null`, gdy wolno. Gdy nie wolno — zdanie dla modela i dla człowieka, mówiące
 * CO zrobić dalej, a nie tylko że się nie da. Ślepa odmowa produkuje agenta, który
 * próbuje w kółko, i człowieka, który nie wie, kogo poprosić.
 */
export function refuseShared(
  hasCapability: (id: string) => boolean,
  relative: string,
  mode: Mode,
): string | null {
  if (!isShared(relative)) return null
  if (hasCapability(NEEDED[mode])) return null
  return mode === "read"
    ? `Nie mam dostępu do katalogu „${SHARED}”. To wspólna półka firmy — o wgląd trzeba poprosić przełożonego.`
    : `Nie mogę nic odkładać na „${SHARED}”. To wspólna półka firmy i odkładanie na nią nadaje przełożony.`
}

/** Ta sama decyzja dla warstwy HTTP, gdzie liczy się kod odpowiedzi, a nie zdanie. */
export const mayTouchShared = (
  hasCapability: (id: string) => boolean,
  relative: string,
  mode: Mode,
) => refuseShared(hasCapability, relative, mode) === null
