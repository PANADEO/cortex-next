/**
 * KATALOG ZATWIERDZONYCH SERWERÓW — czyste dane, bez `server-only`, bo czyta je
 * także ekran przełożonego i testy. Maszyneria połączenia siedzi w `klient.ts`.
 *
 * Docelowo (krok 7) katalog przenosi się na ekran Nadzoru i do bazy. Dziś jest tu,
 * ale rządzą nim już te same reguły, co będą rządzić tamtym ekranem:
 *
 * — zatwierdza się POJEDYNCZE NARZĘDZIE, nigdy całego serwera,
 * — `opis` pisze po polsku człowiek zatwierdzający; tekst przysłany przez serwer
 *   nie ma prawa dotrzeć do modelu (`higiena.oczyscSchemat`),
 * — `odcisk` pochodzi z chwili zatwierdzenia i jest sprawdzany przy każdej rejestracji.
 */

export type ZatwierdzoneNarzedzie = {
  serwer: string
  nazwaZdalna: string
  /**
   * Opis PO POLSKU, napisany przez zatwierdzającego. NIGDY tekst przysłany przez serwer.
   * To jedyny tekst o tym narzędziu, który widzi model — i dlatego wchodzi do odcisku.
   */
  opis: string
  /** Krótka nazwa czynności do przebiegu i dowodu; zdanie dla modelu jest za długie na wiersz. */
  krotko: string
  /** zdolność z katalogu, przez którą to narzędzie przechodzi bramę */
  zdolnoscId: string
  /** odcisk z chwili zatwierdzenia — inny schemat albo inny opis znaczy brak zgody */
  odcisk: string
}

export type SerwerMcp = {
  /** identyfikator techniczny — wchodzi do klucza narzędzia i do odcisku */
  nazwa: string
  /** nazwa dla człowieka; to ją widzi pani Basia w przebiegu, nie slug */
  etykieta: string
  /** wyłącznie https i wyłącznie Streamable HTTP; stdio jest zabronione */
  url: string
  narzedzia: ZatwierdzoneNarzedzie[]
}

/**
 * ZATWIERDZENIA są danymi i nie zależą od tego, czy serwer jest gdziekolwiek podniesiony —
 * inaczej wyłączenie adresu kasowałoby decyzję człowieka.
 *
 * Wykaz podatników VAT Ministerstwa Finansów, wyłącznie do odczytu. Pierwszy konektor
 * u klienta nie jest miejscem na czynności nieodwracalne.
 */
export const NARZEDZIA_BIALEJ_LISTY: ZatwierdzoneNarzedzie[] = [
  {
    serwer: "biala-lista",
    nazwaZdalna: "sprawdz_nip",
    opis: "Sprawdza w wykazie Ministerstwa Finansów, czy firma o podanym NIP jest czynnym podatnikiem VAT, i podaje jej nazwę oraz adres.",
    krotko: "sprawdzenie statusu VAT",
    zdolnoscId: "kontrahent.sprawdz",
    odcisk: "954cf2ea6041bf4ab351016cd51ef24633e21b923c845be68d894217a296b896",
  },
  {
    serwer: "biala-lista",
    nazwaZdalna: "sprawdz_rachunek",
    opis: "Sprawdza w wykazie Ministerstwa Finansów, czy podany numer rachunku był w danym dniu przypisany do firmy o podanym NIP. Zwraca identyfikator zapytania, który jest dowodem sprawdzenia.",
    krotko: "sprawdzenie rachunku w wykazie",
    zdolnoscId: "kontrahent.sprawdz",
    odcisk: "f206a04b898aca436245fb0ad9faa47a95a47ab16b011c37fe04f8c0074ad8e1",
  },
]

/**
 * Adres z konfiguracji, nie z kodu: instancja bez tej zmiennej nie zna żadnego serwera,
 * więc do modelu nie trafia ani jedno narzędzie spoza tego repozytorium.
 */
export const KATALOG_SERWEROW: SerwerMcp[] = process.env.MCP_BIALA_LISTA_URL
  ? [
      {
        nazwa: "biala-lista",
        etykieta: "wykaz podatników VAT",
        url: process.env.MCP_BIALA_LISTA_URL,
        narzedzia: NARZEDZIA_BIALEJ_LISTY,
      },
    ]
  : []
