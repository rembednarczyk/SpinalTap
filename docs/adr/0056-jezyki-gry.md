# ADR-0056: Języki gry: angielski domyślny, polski w opcjach

## Kontekst
Cała gra mówi dziś po polsku. Teksty siedzą w kodzie:
- komponenty UI (`packages/ui`);
- teksty HUD i komunikaty sesji (`packages/app`);
- definicje zadań, przedmiotów i kontraktów (`packages/core`);
- podpowiedzi interakcji i nazwy postaci w treści (`packages/sim/src/content`);
- dialogi w 16 plikach ink (`packages/narrative/ink`, ok. 1900 linii).

Użytkownik zdecydował: angielski ma być językiem domyślnym, polski zostaje i można go wybrać w opcjach.

## Decyzja
- **Język to ustawienie gracza, nie stan świata.**
  - `SettingsVm` dostaje `locale: "en" | "pl"`, domyślnie `"en"`.
  - Ustawienie zapisuje się razem z resztą ustawień (localStorage przez `SettingsHost`), nie w zapisie gry. Schemat zapisu się nie zmienia.
  - Zmiana języka działa od razu w UI. W dialogu działa od następnej linii.
- **Symulacja nie zna języka.**
  - `core` i `sim` trzymają klucze tekstów albo dane strukturalne zamiast gotowych zdań. Dotyczy to m.in. podpowiedzi „Rozmawiaj z Kaito”, celów zadań, nazw przedmiotów i opisów kontraktów.
  - Tekst powstaje dopiero w prezentacji, czyli w `app` i `ui`. Dzięki temu determinizm i złote hashe nie zależą od języka.
  - Jeśli zamiana tekstu na klucz zmienia hash, aktualizuje się go raz, z uzasadnieniem w commicie.
- **Katalogi tekstów.**
  - Każdy pakiet z tekstami ma `src/i18n/{en,pl}.ts`.
  - Katalog angielski jest źródłem kluczy, a polski musi mieć dokładnie te same klucze. Pilnuje tego typ (`satisfies Record<keyof typeof en, …>`) i test kompletności.
  - Parametry są nazwane: `t("contract.reward", { amount })`. Liczba mnoga idzie przez `Intl.PluralRules`.
  - Bez zewnętrznej biblioteki.
- **Narracja.**
  - Pliki ink rozdzielają się na `ink/pl/*.ink` (obecne) i `ink/en/*.ink` (tłumaczenie).
  - Obie wersje mają identyczną strukturę: te same knoty, stitche, wybory, zmienne, flagi, tagi i wywołania funkcji zewnętrznych. Różni się tylko tekst.
  - Test strukturalny porównuje obie wersje. Dzięki temu stan ink z zapisu wczytuje się w każdym języku.
  - Runtime ładuje wersję według ustawienia.
- **Co zostaje po polsku w obu językach:**
  - nazwy własne Lublina: ulice, place, dzielnice, Neon Koi, Hebi;
  - imiona postaci;
  - napisy w świecie gry, czyli szyldy, neony i tabliczki ulic.

  Miasto pozostaje Lublinem. Rozpoznawalne polskie zwroty w ustach postaci tłumacz decyduje w kontekście.
- **Zapadka.**
  - Skan `tools/i18n-scan` liczy polskie literały tekstowe poza katalogami `i18n`, plikami `ink/pl` i danymi nazw własnych.
  - Baza tylko spada, tak jak w skanie glitchy (ADR-0054). Na końcu migracji wynosi 0.
- **Testy e2e.** Używają domyślnego angielskiego. Selektory z polskimi napisami (np. „Nowa gra”) przechodzą na angielskie w tej samej zmianie, w której tłumaczony jest dany ekran.

## Etapy (osobne PR-y)
1. Infrastruktura: typy, `useT()` w UI, ustawienie języka w opcjach, skan-zapadka. Ekrany menu i opcji po angielsku.
2. Pozostałe UI i HUD (`packages/ui`, `packages/app`).
3. Teksty domeny (`packages/core`: zadania, przedmioty, kontrakty, frakcje) jako klucze.
4. Treść symulacji (`packages/sim/src/content`: podpowiedzi, nazwy ról) jako klucze.
5. Narracja: `ink/en`, plik po pliku, z testem strukturalnym.

## Konsekwencje
- Każdy nowy tekst trafia do katalogów w obu językach. Skan i test kompletności zatrzymają tekst wpisany na sztywno.
- Tłumaczenie narracji to praca na wiele zmian. Do jej końca dialogi bez wersji `en` wyświetlają się po polsku, a skan pokazuje, ile jeszcze zostało.
- Długie angielskie albo polskie napisy mogą nie mieścić się w HUD na telefonie. Układ sprawdzają testy komponentów i e2e na telefonie.
