"""Default word lists — 1:1 port of geo_calc/app/backend/constants.py
(DEFAULT_ACTION_VERBS / DEFAULT_SUBJECTIVE_WORDS / DEFAULT_FALSE_POSITIVES /
DEFAULT_BULLET_PATTERNS). GRADE_COLORS/PRIMARY_COLOR from the original file
are UI-only (Streamlit) and have no home here.

Used ONLY as the default-argument fallback inside individual analyzer
functions (mirroring the original module) and by this service's own test
suite. On the real /analyze runtime path Next.js always sends a full config
snapshot (D3 — the service is stateless), so these constants never influence
a production result; they exist for parity with geo_calc and for tests that
exercise an analyzer in isolation.
"""

DEFAULT_ACTION_VERBS = [
    "wdrożył", "uruchomił", "zwiększył", "zmniejszył", "osiągnął",
    "zrealizował", "wprowadził", "zakończył", "rozpoczął", "podpisał",
    "ogłosił", "przedstawił", "zaprezentował", "zainwestował", "sfinansował",
    "opracował", "stworzył", "zbudował", "rozwinął", "ulepszył",
    "zmodernizował", "zoptymalizował", "przekształcił", "zautomatyzował",
    "nawiązał", "połączył", "zintegrował", "skonsolidował", "przejął",
    "wzrósł", "spadł", "przekroczył", "podwoił", "potroił",
    "zaoszczędził", "wygenerował", "wypracował",
    "wdraża", "uruchamia", "zwiększa", "realizuje", "wprowadza",
    "rozwija", "buduje", "inwestuje", "generuje", "osiąga",
]

DEFAULT_SUBJECTIVE_WORDS = [
    "najlepszy", "najlepsza", "najlepsze", "największy", "największa",
    "najważniejszy", "najważniejsza", "najpopularniejszy", "najnowocześniejszy",
    "wyjątkowy", "wyjątkowa", "wyjątkowe", "niesamowity", "niesamowita",
    "doskonały", "doskonała", "perfekcyjny", "idealny", "idealna",
    "rewolucyjny", "rewolucyjna", "przełomowy", "przełomowa",
    "innowacyjny", "innowacyjna", "nowoczesny", "nowoczesna",
    "niezwykły", "niezwykła", "fantastyczny", "fantastyczna",
    "cudowny", "cudowna", "wspaniały", "wspaniała",
    "absolutnie", "całkowicie", "niezwykle", "niesamowicie",
    "wyjątkowo", "nadzwyczaj", "szczególnie", "bardzo",
    "lider", "liderka", "czołowy", "czołowa", "wiodący", "wiodąca",
    "premium", "ekskluzywny", "ekskluzywna", "prestiżowy", "prestiżowa",
    "unikalny", "unikalna", "jedyny", "jedyna",
]

DEFAULT_FALSE_POSITIVES = [
    "rozwiązania", "rozwiązanie", "rozwiązań",
    "przedmioty", "przedmiot", "przedmiotów",
    "osiągnięcia", "osiągnięcie", "osiągnięć",
    "inwestycja", "inwestycji", "inwestycje",
    "uruchomienie", "uruchomienia",
    "wdrożenie", "wdrożenia", "wdrożeń",
    "zwiększenie", "zwiększenia",
    "zmniejszenie", "zmniejszenia",
    "wprowadzenie", "wprowadzenia",
    "zakończenie", "rozpoczęcie",
    "przedstawienie", "ogłoszenie",
    "połączenie", "przekształcenie",
    "ulepszenie", "usprawnienie",
]

DEFAULT_BULLET_PATTERNS = [
    r"^[\s]*[-•●○◦▪▸►]\s+",
    r"^[\s]*\d+[.\)]\s+",
    r"^[\s]*[a-z][.\)]\s+",
]
