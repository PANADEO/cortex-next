import { Loading } from "@cortex/desk-ui/components/loading"
import { Shell } from "@cortex/desk-ui/components/shell"

/**
 * Ekran przejściowy tej trasy. Bez niego App Router trzyma poprzedni widok albo pokazuje
 * pustkę, dopóki komponent serwerowy nie skończy sięgać do bazy i na dysk — a człowiek
 * odczytuje to jako „nic tu nie ma", nie jako „czekaj".
 *
 * Ramka `Shell` zostaje, żeby nawigacja nie mrugała: zmienia się TREŚĆ, nie cała strona.
 */
export default function Loading_() {
  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <Loading rows={5} />
      </div>
    </Shell>
  )
}

/**
 * UWAGA — tego pliku NIE WOLNO dołożyć do trasy, która DECYDUJE O DOSTĘPIE
 * (`notFound()` albo `redirect()` po sprawdzeniu roli).
 *
 * Ekran przejściowy strumieniuje się, ZANIM komponent serwerowy zdąży odmówić, więc
 * status odpowiedzi jest przesądzony na 200, zanim padnie decyzja. Zmierzone: po dodaniu
 * `loading.tsx` do `/supervision` ekran przełożonego zaczął zwracać pracownicy 200
 * zamiast 404 — treści dalej nie było, ale kod odpowiedzi kłamał. Dlatego `supervision`
 * i `case/[id]` świadomie NIE mają tego pliku.
 */
