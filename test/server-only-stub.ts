// Zaślepka pakietu `server-only` na czas testów.
//
// Ten pakiet istnieje po to, żeby PSUĆ BUDOWANIE, gdy moduł serwerowy trafi do paczki
// klienckiej — jego cała treść to `throw`. W teście jednostkowym nie ma paczek ani
// granicy klient/serwer, więc jedyne, co robi, to przewracanie testów, które chcą
// zawołać trasę wprost. Zaślepka zdejmuje tę przeszkodę i NIE zdejmuje ochrony:
// w prawdziwym budowaniu Next dalej używa prawdziwego pakietu.
export {}
