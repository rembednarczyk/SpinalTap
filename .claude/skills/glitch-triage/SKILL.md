---
name: glitch-triage
description: Triage glitchy Seki Senshi (ADR-0054). Daje definicję glitcha, skalę ważności S1–S4, priorytet z ważności, zasięgu i kosztu, statusy rejestru, szablon zgłoszenia i kryteria przyjęcia poprawki. Używaj przy zgłaszaniu, ocenianiu, przydzielaniu i zamykaniu glitchy w docs/glitches.md.
---

# Triage glitchy (ADR-0054)

## Co jest glitchem
Rozjazd między tym, co gra pokazuje lub symuluje, a tym, co gracz uzna za realne Lublin 2077. Celowa stylizacja (neony, nadbudowy, megawieże tła) glitchem nie jest. Brak funkcji też nie jest glitchem, tylko pozycją backlogu (`docs/backlog.md`).

## Ważność
| Klasa | Znaczenie | Przykłady z historii |
|---|---|---|
| **S1 blokujący** | awaria, utrata zapisu, zablokowany wątek, czerwone CI na `main` | crash przeglądarki, migracja zapisu gubi stan |
| **S2 łamie świat** | gracz albo NPC przenika, utyka, spada; ruch wbrew fizyce w miejscu, które każdy zobaczy | auta przez hale targu, jezdnia w korycie rzeki, dostawczak przez ścianę |
| **S3 widoczny** | obiekt w złym miejscu, zła wysokość, warstwy w złej kolejności, czytelne w zwykłej grze | sygnalizator na środku skrzyżowania, rzeźba w ścianie, wrak w ziemi |
| **S4 kosmetyczny** | widać tylko z bliska albo w rzadkim kadrze | krzew na schodach, nakładka 26 m² dwóch budynków |

## Priorytet
`P = ważność × zasięg × 1/koszt`, porządkowo:
- **zasięg:**
  - *szeroki*: wiele miejsc albo trasa główna gracza (deptak, Rynek, Aleja Tysiąclecia, miejsca zleceń);
  - *lokalny*: jedno miejsce;
  - *rzadki*: kadr, którego gracz zwykle nie widzi.
- **koszt:**
  - *mały*: jedna funkcja lub dane, jeden pakiet;
  - *średni*: kilka plików w jednym pakiecie;
  - *duży*: kontrakt, ADR, kilka pakietów.

Kolejka: S1 zawsze pierwsze, potem S2 szerokie, a potem reszta wg priorytetu. Pozycje S4 o koszcie dużym idą do „później” z uzasadnieniem.

## Statusy w `docs/glitches.md`
`zgłoszone` → `przyjęte` (ma ważność i właściciela) → `w naprawie` (przydzielone, worktree) → `weryfikacja` → `naprawione (#PR)`. Albo `odrzucone (powód)` / `później (powód)` / `duplikat (ID)`.

## Szablon zgłoszenia
```
### G-NNN Tytuł w jednym zdaniu
- Status: zgłoszone
- Ważność: S2 (proponowana) · Zasięg: szeroki · Koszt: mały
- Gdzie: (x, z) świata, dzielnica/ulica; ile w mieście: N
- Dowód: licznik skanu / pomiar / zrzut <ścieżka> / tag OSM
- Przyczyna (przypuszczalna): ...
- Pakiet właściciela: tools/osm-import | packages/sim | packages/engine | ...
- Test przyjęcia: co musi przejść, a dziś pada
```

## Kryteria przyjęcia poprawki
1. Test (albo kontrola skanu) pada bez poprawki i przechodzi z nią.
2. Licznik skanu dla tego rodzaju spada, a pozostałe nie rosną. Baza skanu obniżona w tym samym commicie.
3. DoD z `CLAUDE.md` w zakresie zmiany.
4. Złote hashe, migawka NPR i budżety bez zmian albo zmienione z uzasadnieniem w commicie.
5. Werdykt `change-verifier`: PRZYJĘTE.

## Rodzaj powtarzalny = kontrola w skanie
Jeśli glitch należy do rodzaju, który da się policzyć w całym mieście, poprawka dopisuje kontrolę do `tools/glitch-scan/test/glitch-scan.test.ts`. Regresja tego rodzaju zatrzyma wtedy CI.
