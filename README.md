# Seki Senshi

Cyberpunkowy sandbox 3D w przeglądarce: FPP z przełączaniem na TPP, cel shading w duchu anime. Bohaterka budzi się po wypadku bez pamięci własnego imienia; fixer Kaito nazywa ją **Seki Senshi**.

Repozytorium realizuje [plan architektury](docs/seki-senshi-plan.md). Obecny stan to **M1, pętla rdzenia** zbudowana na pionowym wycinku M0: jeden dystrykt (Shinsekai, kwartał 7), kontrakty od fixera, klinika z cyberware i zdolność aktywna.

![Kadr referencyjny NPR](e2e/__snapshots__/npr-perf.spec.ts/reference-m0.png)

## Uruchomienie

Wymagania: Node 22+, pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build && pnpm preview   # build produkcyjny, http://localhost:4173
```

Parametry URL: `?seed=123` (stałe ziarno nowej gry), `?reference` (deterministyczny kadr do testów migawkowych).

## Sterowanie

| Klawisz | Akcja |
|---|---|
| WASD / strzałki | ruch |
| Shift | sprint |
| Mysz (kliknij w ekran, żeby przechwycić kursor) | rozglądanie |
| LPM | strzał |
| E | rozmowa |
| 1–6, strzałki góra/dół, kółko myszy, E / Enter / Spacja | wybór kwestii na kole dialogowym |
| V | FPP / TPP |
| Q | zdolność cyberware (po wszczepieniu Akceleratora Kairos) |
| H | apteczka |
| Tab | karta postaci |
| F5 / F9 | szybki zapis / odczyt |
| Esc | pauza (zapis do slotów, wczytywanie) |

Pad (standard mapping): lewa gałka ruch, prawa rozglądanie, RT strzał, A rozmowa, Y kamera, RB zdolność, X apteczka, L3 sprint.

Telefon i tablet (wykrywane automatycznie, na komputerze można wymusić `?touch`): grę obracamy poziomo. Lewa połowa ekranu to pływająca gałka ruchu (pełne wychylenie = sprint), prawa to rozglądanie przeciąganiem. Przycisk strzału też obraca widok, gdy przesuwasz po nim palec. Wokół niego są przeładowanie, skaner, zryw i „więcej” (apteczka, następna broń, kucanie, kamera, chowanie broni), obok celowanie i skok, a „Użyj” pojawia się przy rzeczach, których można użyć. U góry w jednym rzędzie są karta postaci, telefon i pauza.

Dialog na kole ([ADR-0039](docs/adr/0039-dialog-na-kole.md)): kwestie układają się na łuku obok rozmówcy, z ikoną i kolorem rodzaju (◆ złoty wątek główny, ◇ niebieskie pytanie, ✕ wyjście zawsze na dole, ▲ groźba, ◎ perswazja, ⬡ hack, ✦ opcja z przeszłości). Podświetloną wybiera się myszą, cyfrą, strzałkami albo kółkiem i potwierdza E, Enterem lub Spacją, na telefonie tapnięciem. Napisy z przewijaną historią rozmowy zostają na dole.

## Co jest w M0

- Przebudzenie przy wraku, babcia Ume (wspomnienie „ucieczka”), fixer Kaito w barze Neon Koi.
- Zlecenie „Pierwsze zlecenie”: rozmowa z Kaito (ink), starcie z dwoma gangerami Hebi w zaułku (drzewo zachowań), powrót po zapłatę.
- Progresja diegetyczna: zabicie kuriera przywraca wspomnienie „odruch” (+krytyki), co widać jako glitch obrazu.
- Reputacja (Sieć Kaito, Hebi, mieszkańcy), eddies, cyberware w domenie.
- Zapis i odczyt: 3 sloty + szybki zapis w IndexedDB, suma kontrolna, migracje schematu, obsługa uszkodzonych zapisów.
- NPR: toon shading z pasmami światła, rim light, kontury inverted-hull na postaciach, neony z bloomem, deszcz, grading.

## Co doszło w M1

- Po pierwszym zleceniu Kaito oferuje kontrakty proceduralne: 2–4 gangerów Hebi w jednym z czterech miejsc dzielnicy, coraz twardszych z każdym wykonanym zleceniem. Zapłata zależy od reputacji u Kaito.
- Klinika doktora Mori (naprzeciwko baru): cztery implanty do kupienia i wszczepienia oraz apteczki.
- Akcelerator Kairos daje zdolność aktywną: przez 4 sekundy przeciwnicy poruszają się i strzelają w 30% tempa.
- Trafienia w głowę (×1,6), apteczki (+40 HP), karta postaci z cyberware, wspomnieniami i reputacją.
- Zapis v3 z migracją starszych zapisów.

## HUD fali 2

Opis w [ADR-0035](docs/adr/0035-hud-fali-2.md).

- Metro: przy kiosku biletowym mapa linii Kanjō z czterema stacjami i cenami; w drodze panel z linią, stacją docelową, postępem i napisami z ink.
- Radio: B przełącza stacje (Neon Drift 88.1, Yoru FM 76.5, Tessen Info 24, wyłączone), wybór jest też w telefonie i zostaje w ustawieniach. Co jakiś czas toast z wstawką stacji.
- Klinika pokazuje pojemność cyberware i koszt każdego implantu; montaż ponad limit jest zablokowany.
- Ikony buffów z czasem, ikona zrywu (Alt) z odnowieniem, wskaźnik przebrania przy pasku zdrowia i ostrzeżenie o spalonej przykrywce.
- Minimapa oddala się przy sprincie i zrywie, przy ruchu patrzy do przodu (strzałka w dolnej tercji), pokazuje tylko fixerów i przyjęte zlecenia, a cel jako obszar. W ustawieniach jest tryb bez znaczników i przełącznik podświetleń.
- Tracker zlecenia pokazuje odkryte haki, karta podsumowania wariant zlecenia.
- Dotyk: na telefonie widać tylko ogień, celowanie, skok i łuk (przeładowanie, skaner, zryw, „więcej”); „Użyj” pojawia się przy promptcie, a reszta jest pod „więcej”. Nic się nie nakłada przy 800×370 i 667×375 CSS, bez podpowiedzi klawiszy.

## Struktura

```
packages/
  core/         domena (czyste TS): porty, zdarzenia, walka, cyberware, ekonomia, reputacja, questy, model zapisu
  sim/          ECS (miniplex), systemy, pętla fixed-step, RNG z ziarnem, AI (mistreevous), replay
  engine/       adaptery Babylon.js: renderer, NPR, kamera FPP/TPP, wejście, audio, perf
  narrative/    runtime ink + treść (.ink)
  ui/           React + Zustand: HUD, dialogi, menu
  persistence/  IndexedDB, kodek zapisu, migracje
  app/          kompozycja i punkt wejścia
e2e/            Playwright: smoke, migawka NPR, budżety wydajności
docs/adr/       decyzje architektoniczne
tools/          budżety wydajności
```

## Bramki jakości

```bash
pnpm typecheck      # tsc --noEmit we wszystkich pakietach
pnpm lint           # eslint: brak any oraz Math.random/Date.now w core i sim
pnpm depcheck       # dependency-cruiser: kierunek zależności, brak cykli
pnpm test:coverage  # vitest + progi pokrycia (core 95%)
pnpm test:e2e       # Playwright na zbudowanej aplikacji (wymaga pnpm build)
pnpm ci             # wszystko po kolei
pnpm artifact       # build + strona do publikacji jako artefakt claude.ai (katalog artifact/)
```

Testy obejmują m.in. pełną pętlę M0 bez przeglądarki (`packages/app/test/m0-loop.test.ts`), determinizm i złoty hash replayu (`packages/sim/test/determinism.test.ts`), kontrakt `PersistencePort` dla pamięci i IndexedDB oraz migrację zapisu z v1.

## Odstępstwa od planu

- **Havok odłożony do M1** ([ADR-0008](docs/adr/0008-kolizje-deterministyczne-havok-odlozony.md)): kolizje są kinematyczne i deterministyczne w `sim`.
- **Bez XState** ([ADR-0005](docs/adr/0005-automat-questow-reczny.md)): graf questów to dane i czysta funkcja.
- **Assety proceduralne** ([ADR-0006](docs/adr/0006-assety-proceduralne-w-m0.md), [ADR-0009](docs/adr/0009-audio-syntezowane.md)): brak plików glb i audio w M0.
