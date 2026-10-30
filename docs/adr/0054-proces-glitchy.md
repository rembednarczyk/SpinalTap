# ADR-0054: Proces glitchy end to end: orkiestrator, łowcy, naprawiacze, weryfikator, rejestr i skan z zapadką

## Kontekst
Glitche mapy naprawiał dotąd jeden agent w przerwach między zadaniami. Szukał ich na oko, zrzutami i jednorazowymi testami `zz-*`, które potem usuwał. Działało to, ale miało słabości:
- wiedza o tym, co już sprawdzone, ginęła razem z sesją;
- jednorazowe pomiary nie chroniły przed powrotem tego samego rodzaju glitcha;
- nie było kolejności (co naprawiać najpierw) ani drugiej pary oczu przed merge;
- czerwone CI bywało mylone z niestabilnością.

Plan (§11–13) przewiduje orkiestratora i specjalistów, ale nie opisuje procesu dla glitchy.

## Decyzja

### Zespół (`.claude/agents/`)
| Agent | Rola | Pisze |
|---|---|---|
| `orchestrator` | prowadzi rejestr, triage, przydział, integrację, PR i merge; główny agent sesji (`claude --agent orchestrator`) | rejestr, ADR, bazę skanu |
| `glitch-hunter` | szuka w jednym obszarze, zgłasza z dowodem | nic poza tymczasowymi `zz-*` |
| `glitch-fixer` | jedna poprawka jednego glitcha, test najpierw, osobny worktree | kod pakietu właściciela |
| `fix-verifier` | niezależna kontrola poprawki, werdykt PRZYJĘTE / NIE PRZYJĘTE | nic |

Specjaliści pakietów z rosteru (plan §12) to role, które przyjmuje naprawiacz według własności z `CLAUDE.md`.

### Triage (umiejętność `glitch-triage`)
- Ważność: S1 blokujący, S2 łamie świat, S3 widoczny, S4 kosmetyczny.
- Priorytet: ważność, zasięg (szeroki, lokalny, rzadki) i koszt (mały, średni, duży).
- Statusy: `zgłoszone` → `przyjęte` → `w naprawie` → `weryfikacja` → `naprawione (#PR)`, albo `odrzucone`, `później`, `duplikat`, zawsze z powodem.

### Rejestr (`docs/glitches.md`)
Jedno miejsce na:
- zgłoszenia z dowodem;
- decyzje triage;
- statusy z numerami PR;
- mapę pokrycia: które obszary i rodzaje sprawdzono, kiedy i czym.

Rejestr przetrwa sesje.

### Skan z zapadką (`tools/glitch-scan/test/glitch-scan.test.ts`)
- Każdy rodzaj glitcha, który da się policzyć w całym mieście, ma kontrolę, np.:
  - trasy aut poza jezdnią;
  - trasy przez budynki;
  - piesi na pasach aut;
  - meble na pasach i w ścianach;
  - auta zaparkowane w meblach;
  - rekwizyty nad i pod gruntem;
  - mosty bez pomostu.
- Liczniki porównuje z `glitch-baseline.json`. Wzrost to czerwony test w zwykłym `pnpm test` (i w CI), spadek obniża bazę w tym samym commicie, więc zapadka działa tylko w dół.
- Miejsca znalezisk trafiają do `reports/glitch-scan.json`.
- Skan trwa około 4 s.

### Zrzuty (`e2e/glitch-shots.spec.ts`)
Spec do oglądania miejsc z gry. Działa tylko z `SHOTS` (katalog) i `GLITCH_SPOTS` (punkty). Pełny zestaw w CI go pomija.

### Cykl (prowadzi orkiestrator)
1. Stan: rejestr, PR-y, CI `main`, skan.
2. Polowanie, gdy brak gotowych pozycji: 1–3 łowców na rozłączne obszary.
3. Triage zgłoszeń.
4. Przydział: najwyżej 3 poprawki naraz w rozłącznych plikach.
5. Naprawa w worktree: test pada → poprawka → test przechodzi → DoD.
6. Weryfikacja: bez PRZYJĘTE nie ma integracji.
7. Integracja po jednej, z testami po każdej. Małe PR-y (1–3 poprawki z jednego obszaru).
8. CI i merge według `CLAUDE.md`. Czerwone CI to praca od razu: przyczyna, nie wyższy limit. Ponowienie zadania tylko raz i tylko po to, by potwierdzić przyczynę spoza PR.
9. Zamknięcie w rejestrze, kontrola do skanu, jeśli rodzaj jest policzalny.

## Konsekwencje
- Każda naprawiona klasa glitcha ma strażnika w CI. Regresja zatrzymuje merge zamiast wracać po cichu.
- Druga para oczu kosztuje jednego agenta na poprawkę. Przy małych zmianach orkiestrator może połączyć weryfikację kilku poprawek z jednego obszaru w jeden przebieg.
- Orkiestrator musi być głównym agentem sesji: agenci rozesłani narzędziem Agent nie rozsyłają dalej.
- Znany dług (ADR-0046): test migawki NPR trwa lokalnie około 60 s przy limicie 90 s. Prawie cały czas to oczekiwanie na kolejkę GPU pod SwiftShaderem po zbudowaniu miasta. Na wolnym runnerze test przekracza limit. To pozycja G-001 w rejestrze.
