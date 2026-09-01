/**
 * KATALOG ZATWIERDZONYCH SERWERÓW — czyste dane, bez `server-only`, bo czyta je
 * także ekran przełożonego i testy. Maszyneria połączenia siedzi w `klient.ts`.
 *
 * Docelowo (krok 7) katalog przenosi się na ekran Nadzoru i do bazy. Dziś jest tu,
 * ale rządzą nim już te same reguły, co będą rządzić tamtym ekranem:
 *
 * — zatwierdza się POJEDYNCZE NARZĘDZIE, nigdy całego serwera,
 * — `opis` pisze po polsku człowiek zatwierdzający; tekst przysłany przez serwer
 *   nie ma prawa dotrzeć do modelu (`hygiene.sanitiseSchema`),
 * — `fingerprint` pochodzi z chwili zatwierdzenia i jest sprawdzany przy każdej rejestracji.
 */

export type ApprovedTool = {
  server: string
  remoteName: string
  /**
   * Opis PO POLSKU, napisany przez zatwierdzającego. NIGDY tekst przysłany przez serwer.
   * To jedyny tekst o tym narzędziu, który widzi model — i dlatego wchodzi do odcisku.
   */
  description: string
  /** Krótka nazwa czynności do przebiegu i dowodu; zdanie dla modelu jest za długie na wiersz. */
  shortLabel: string
  /** zdolność z katalogu, przez którą to narzędzie przechodzi bramę */
  capabilityId: string
  /** fingerprint z chwili zatwierdzenia — inny schemat albo inny opis znaczy brak zgody */
  fingerprint: string
}

export type McpServer = {
  /** identyfikator techniczny — wchodzi do klucza narzędzia i do odcisku */
  name: string
  /** nazwa dla człowieka; to ją widzi pani Basia w przebiegu, nie slug */
  label: string
  /** wyłącznie https i wyłącznie Streamable HTTP; stdio jest zabronione */
  url: string
  tools: ApprovedTool[]
}

/**
 * ZATWIERDZENIA są danymi i nie zależą od tego, czy serwer jest gdziekolwiek podniesiony —
 * inaczej wyłączenie adresu kasowałoby decyzję człowieka.
 *
 * Wykaz podatników VAT Ministerstwa Finansów, wyłącznie do odczytu. Pierwszy konektor
 * u klienta nie jest miejscem na czynności nieodwracalne.
 */
export const VAT_REGISTRY_TOOLS: ApprovedTool[] = [
  {
    server: "vat-registry",
    remoteName: "vat_status",
    description:
      "Sprawdza w wykazie Ministerstwa Finansów, czy firma o podanym NIP jest czynnym podatnikiem VAT, i podaje jej nazwę oraz adres.",
    shortLabel: "sprawdzenie statusu VAT",
    capabilityId: "counterparty.verify",
    fingerprint: "5c8b05965afd3c3d2994872d4fb9fc70fa20486b30d5edaebb87d882b0ed51e3",
  },
  {
    server: "vat-registry",
    remoteName: "bank_account_check",
    description:
      "Sprawdza w wykazie Ministerstwa Finansów, czy podany numer rachunku był w danym dniu przypisany do firmy o podanym NIP. Zwraca identyfikator zapytania, który jest dowodem sprawdzenia.",
    shortLabel: "sprawdzenie rachunku w wykazie",
    capabilityId: "counterparty.verify",
    fingerprint: "19c8a3199bbd49bac72fdf5db8b254ce1e7e537288971e9f036c893cbcccf693",
  },
]

/**
 * Adres z konfiguracji, nie z kodu: instancja bez tej zmiennej nie zna żadnego serwera,
 * więc do modelu nie trafia ani jedno narzędzie spoza tego repozytorium.
 */
export const SERVER_CATALOGUE: McpServer[] = process.env.MCP_VAT_REGISTRY_URL
  ? [
      {
        name: "vat-registry",
        label: "wykaz podatników VAT",
        url: process.env.MCP_VAT_REGISTRY_URL,
        tools: VAT_REGISTRY_TOOLS,
      },
    ]
  : []
