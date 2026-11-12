# ADR-0073: Ikony przedmiotów i wygląd ubrań

Status: zaakceptowany (6.11), z decyzjami użytkownika z 6.11 (sekcja „Decyzje użytkownika”). Pozycja stałego slotu assetów „ubrania i ikony przedmiotów” (decyzja użytkownika 1.11, backlog „[plan, 31.10] Assety ubrań i ekwipunku”). Etap 1 jest w tym samym PR-ze co ADR.

## Kontekst
Stan na `origin/main` aca80ad.

**Jak ekwipunek pokazuje przedmioty** (`packages/ui/src/inventory`, `packages/ui/src/shop`):
- Komórka torby (`ItemCell` w `item-grid.tsx`, 52 px na telefonie, 72 px na desktopie) to sam tekst: skrót nazwy (`item.<id>.short` albo 6 pierwszych liter), licznik stosu i skrót rzadkości w rogu („UNCOM.”, „EPIC”, „LEGEND.”). Rzadkość ma też ramkę 1 px w kolorze rzadkości (`.rarity--*` w `styles.css`), a pełną nazwę rzadkości podaje etykieta przycisku i panel szczegółów.
- Sloty pod podglądem (`equipment-slots.tsx`) i lada sklepu (`trade-tabs.tsx`: „Kup”, „Sprzedaj”, „Naprawa”) też pokazują tylko nazwę i opis. Amunicja nie zajmuje komórek: ładownica to tekst w górnym pasku ekranu „Postać” („9 mm 48”), a na ladzie pudełko nabojów ma kartę z nazwą „9 mm × 24”.
- Na telefonie rozróżnienie pistoletu, rewolweru i SMG wymaga czytania skrótów („U-9”, „.44”, „R-12”). Gracz rozpoznaje przedmioty po nazwach z fikcji, których jeszcze nie zna.

**Jak ubrania zmieniają wygląd postaci** (ADR-0015 E7, ADR-0033, ADR-0036):
- `GarmentDefinition.look` (`core/items/catalog.ts`) ma `tint` (klucz palety: `jacket-seki`, `jacket-hebi`, `jacket-tessen`, `cargo`, `kevlar`, `vest`) i dodatki na punktach zaczepienia (`visor`, `helmet`, `vest-plate`). `appearanceOf` w `core` składa z tego `AppearanceDescriptor` (`core/ports/types.ts`), a `RenderPort.setAppearance` przekazuje go do `engine`.
- Engine (`renderer/loadout.ts`, `GARMENT_TINT`) przebarwia materiały „Tops” i „Bottoms” modelu VRoid wariantem `TINT` toon shadera, a na rigu proceduralnym góry i spodnie (`RIG_GARMENT_PRESETS`). Dodatki to proste bryły (kopuła hełmu, łuk wizjera, płyty kamizelki) na kościach głowy i klatki.
- Rzadkość nie zmienia wyglądu ubrania ani broni. Jedyny kolor rzadkości w świecie to pasek na torbie z łupem (`LOOT_STRIP` w `engine/renderer/props.ts`), z tymi samymi odcieniami co ramki w UI, ale zapisanymi drugi raz.
- Kombinezon Tessen ma odcień `cargo`, więc wygląda jak bojówki (ADR-0036). Wszystkie kurtki mają tę samą siatkę modelu, różnią się tylko kolorem.

**Rzadkości** (ADR-0059 etap 4): zwykła, niezwykła, rzadka, epicka, legendarna i unikat; epicka i legendarna mają cechy i wypadają tylko z łupu.

## Cel
- Przedmiot rozpoznawalny na pierwszy rzut oka w komórce 52 px, w slocie, na ladzie i (później) w panelu łupu, z rzadkością widoczną kolorem i nadal podaną tekstem (kolor nigdy nie jest jedynym nośnikiem; ustawienie dla daltonistów `data-palette` dziś rzadkości nie przebarwia).
- Jedna paleta z resztą UI i rysunkiem NPR: neonowa linia na ciemnym panelu.
- Mały koszt: bez nowych żądań sieci, bez nowych tekstur, do kilku KB w paczce.
- Ubrania, które wyglądają różnie na modelu: kolor rzadkości i więcej niż jedna siatka kurtki.
- Kontrakt: `core` zna klucz ikony, nie plik ani rysunek. UI nie zna `engine`, więc ikona nie może pochodzić z renderera w czasie gry.

## Warianty

| | A. Własne ikony SVG z jednej palety | B. Rendery modeli 3D offline | C. Gotowe paczki ikon |
|---|---|---|---|
| Co | Ścieżki SVG rysowane w repo, siatka 32 × 32, kontur w `currentColor` i półprzezroczyste wypełnienie | Skrypt renderuje GLB z `public/weapons` w toonie do atlasu PNG/WebP | Np. game-icons.net, Kenney, OpenGameArt |
| Licencja | Własna, bez atrybucji | Po modelach (Quaternius CC0), bez nowej atrybucji | Kenney CC0; game-icons.net CC BY 3.0 (do 6.11 poza ADR-0063, który dopuszczał CC0 i CC-BY 4.0); OGA mieszane, sprawdzane plik po pliku |
| Rozmiar | ok. 0,3 do 0,6 KB na ikonę, w JS | atlas 12 ikon po 128 px: kilkadziesiąt KB, osobny plik | 1 do 3 KB na SVG |
| Kolor rzadkości | `currentColor`: jedna ikona na każdą rzadkość, później też na paletę dla daltonistów | osobne wersje albo maska koloru | jak A, jeśli SVG jednobarwne |
| Czytelność w 26 px | sylwetka z grubą linią, rysowana pod ten rozmiar | szczegóły modelu znikają, potrzebny kontur | dobra (game-icons), nierówna między autorami |
| Spójność ze stylem | jedna ręka i jedna paleta | zgodna z modelem w ręku | obcy styl, mieszanka autorów |
| Ubrania i wszczepy | do narysowania (etap 2) | ubrania są dziś proceduralne (kolor i bryły), więc render musiałby ubierać rig; wszczepów nie ma w 3D | dużo gotowych sylwetek |
| Potok | brak, dane w repo | przeglądarka albo Babylon w Node w `tools`, odtwarzalność bajt w bajt do pilnowania | `tools/assets/sources.json`, `fetch.mjs`, wpis w `credits` |

## Decyzja
- **Wariant A: własne ikony SVG.** Rozstrzyga czytelność w 26 px, kolor rzadkości przez `currentColor` (jeden rysunek na każdą rzadkość, a później też na paletę dla daltonistów) i brak potoku oraz licencji. B daje wierność modelowi, ale nie rozwiązuje ubrań i wszczepów, kosztuje osobny potok i kilkadziesiąt KB. C odpada przez spójność stylu, nie licencję: Kenney jest na CC0, ale ma płaski, ilustracyjny styl i nie ma sylwetek dla naszych klas broni, a mieszanka paczek różnych autorów nie trzyma jednej grubości linii i palety. Dla wszczepów i zużywalnych C wraca w etapie 2 jako uzupełnienie (game-icons.net, decyzja użytkownika 6.11), przerysowane do tej samej linii i koloru.
- **Kontrakt w `core`** (`core/items/icons.ts`, słownik przedmiotów, nie pliki kontraktów):
  - `ItemIconKey`: zamknięta lista kluczy, np. `pistol`, `revolver`, `smg`, `shotgun`, `rifle`, `dmr`, `baton`, `blade`, `ammo-9mm`, `ammo-44`, `ammo-12g`, `ammo-556`;
  - `WEAPON_ICONS: Record<WeaponId, ItemIconKey>` i `AMMO_ICONS: Record<AmmoId, ItemIconKey>` (kompilator wymusza ikonę dla nowej broni i amunicji);
  - `itemIcon(id: ItemDefId): ItemIconKey | null`: `null` to jawny zamiennik dla rodzajów bez ikon (dziś ubrania, wszczepy, mody, zużywalne, złom), które pokazują dotychczasowy tekst;
  - klucz jest osobny od `WeaponLook`, bo ikona może rozróżniać więcej niż model (Kagero DMR ma model karabinu, a ikonę z lunetą).
- **Rysunek w `ui`** (`packages/ui/src/icons/`): `ICON_PATHS: Record<ItemIconKey, ...>` (tabela danych), komponent `ItemIcon` i `RARITY_INK` (odcienie rzadkości, te same co ramki i pasek torby). Ikona ma `aria-hidden`: nazwę i rzadkość czyta etykieta przycisku, więc nie przybywa tekstów dla gracza.
- **Ramka koloru rzadkości:** komórka z ikoną dostaje ramkę 2 px i kontur ikony w kolorze rzadkości; zwykła ma kolor neutralny. Skrót rzadkości w rogu komórki zostaje (kolor nie jest jedynym nośnikiem).
- **Zaznaczenie komórki z ikoną:** biały pierścień 2 px wewnątrz ramki rzadkości (`SELECT_INK`, kolor, którego nie ma żadna rzadkość) zamiast purpurowego obrysu na ramce. Purpurowy obrys `.inv__cell--on` leżał dokładnie na ramce, więc wybrana rzadka (też purpurowa) nie różniła się od niewybranej, a każda inna wybrana rzadkość wyglądała jak rzadka. Ramka i pierścień idą inline (`iconCellStyle`), bo `.inv__cell` w `styles.css` stoi za `.rarity--*` i nadpisuje kolor ramki (G-410 dla komórek bez ikon i slotów, osobno).
- **Wygląd ubrań (etap 3):** kolor rzadkości jako świecąca lamówka (pasek emisji na krawędzi kurtki albo kamizelki), a nie przebarwienie całego ubrania, bo `tint` niesie rolę przebrania (ADR-0033) i musi zostać czytelny dla graczy i NPC. Wymaga pola rzadkości przy ubraniu w `AppearanceDescriptor` (`core/ports/types.ts`): zmiana kontraktu w tym etapie, z osobnym PR-em i podpisem Architekta. Warianty siatek (kurtka krótka, płaszcz, kombinezon) jako dodatki na kościach albo modele CC0/CC-BY 4.0 przez potok ADR-0058/ADR-0063, z budżetami `npr-perf`.
- **Odcienie rzadkości w jednym miejscu (etap 3):** dziś `LOOT_STRIP` w engine i `RARITY_INK` w ui powtarzają te same wartości. Wspólna tabela danych w `core/items/rarity.ts` (kolor jako dane prezentacji, jak `look`) usuwa rozjazd; do decyzji Architekta przy etapie 3.

## Etapy (osobne PR-y)
1. **Ikony broni i amunicji** (ten PR): klucze w `core`, `ItemIcon` w `ui`; komórka torby, sloty broni pod podglądem (od 1100 × 620 px; na telefonie slot zostaje przy nazwie, bo ma ok. 70 px szerokości), ładownica w górnym pasku, lada („Kup” i „Sprzedaj”). Bez zmian w `sim`, zapisie i rendererze.
2. **Ikony ubrań, wszczepów, modów, zużywalnych i złomu**, panel łupu, pasek broni w HUD z ikonami, na telefonie komórka torby z samą ikoną (nazwa po dotknięciu, w szczegółach). Wszczepy i zużywalne mogą pochodzić z game-icons.net (CC BY 3.0): wymaga zmiany ADR-0063 (dopuszczenie CC BY 3.0), wpisów w `tools/assets/sources.json` i na ekranie „Autorzy”. `itemIcon` przestaje zwracać `null`; test wymaga ikony dla każdego przedmiotu katalogu.
3. **Wygląd ubrań na modelu:** lamówka w kolorze rzadkości tylko na Seki i w podglądzie menu, nie na wrogach (kontrakt `AppearanceDescriptor`), wspólne odcienie rzadkości, osobny wygląd kombinezonu Tessen (zamiast `cargo`), migawka NPR i budżety rysowania.
4. **Warianty siatek ubrań:** nowe dodatki albo modele z licencją z ADR-0063, przegląd budżetów.

## Testy
- **Komponent UI** (`packages/ui/test/item-icons.test.tsx`): każda broń i amunicja z katalogu ma ikonę z narysowaną ścieżką; każdy inny przedmiot ma jawny zamiennik (`null`) i komórkę z nazwą bez ikony; ramka i kolor dla każdej rzadkości, w tym epickiej i legendarnej; ikona na ladzie dla broni i pudełek nabojów; ikona jest ukryta przed czytnikiem, a etykieta komórki bez zmian.
- **Rozmiar paczki:** budżet danych ścieżek w tym samym teście: średnio do 200 znaków na ikonę (nowe ikony przynoszą swój udział) i do 320 na jedną; etap 1 ma 1790 znaków na 12 ikon, najwięcej 248; wzrost to czerwony test, a podniesienie budżetu wymaga uzasadnienia jak w ADR-0046.
- **Kontrast na telefonie:** każdy kolor rzadkości ma co najmniej 3:1 (WCAG 1.4.11, elementy graficzne) na tle komórki, zaznaczonej komórki i karty lady. Kolory ikon test bierze z tych samych stałych co komponent (`RARITY_INK`, `SELECT_INK`); tła (`ICON_BACKGROUNDS`) to ręczne kopie wartości z `styles.css`, spłaszczone na tle menu, więc zmiana tła w CSS wymaga zmiany tabeli.
- **Zaznaczenie:** test komponentu klika każdą broń i sprawdza pierścień, brak obrysu i niezmieniony kolor ramki; pierścień jest w RGB co najmniej 100 od każdego koloru rzadkości i ma 3:1 na tle zaznaczonej komórki.
- **Zrzuty:** ekwipunek i lada na telefonie (800 × 370) i desktopie (1280 × 720) przed i po, przez `pnpm e2e` (ADR-0046: przeglądarka tylko do układu).
- **Złote hashe `sim` i schemat zapisu** bez zmian w etapach 1 i 2.

## Wdrożenie etapu 2 (6.11)
- **Klucze w `core`:** `ItemIconKey` ma 38 kluczy; tabele `GARMENT_ICONS`, `MOD_ICONS`, `CYBERWARE_ICONS` i `STACKABLE_ICONS` (`Record` po id, kompilator wymusza ikonę dla nowego przedmiotu), `itemIcon` zwraca zawsze klucz. Ubrania mają ikonę według rodzaju (kurtka, spodnie, hełm, wizjer, kamizelka, kombinezon), a sztuki odróżnia kolor rzadkości i nazwa.
- **Rysunki:** ubrania, mody (tłumik, celownik holo, magazynek) i złom (płytka, zębatka ze sprężyną, chip) rysowane w repo jak etap 1; wszczepy i zużywalne po game-icons.net (CC BY 3.0, Lorc i Delapouite, ADR-0063: wyjątek licencyjny i wdrożenie), przerysowane automatycznie do siatki 32 × 32, odcinków i konturu w kolorze rzadkości (`ui/src/icons/game-icon-paths.ts`, atrybucja w `README.md` obok i na ekranie „Autorzy”).
- **Budżet rozmiaru bez zmian:** 6444 znaki danych ścieżek na 38 ikon, średnio 169,6 (budżet 200), najwięcej 308 („synapse”, budżet 320). Uproszczenie ikon z game-icons.net ma tolerancję dobraną na ikonę (0,5–1,2 jednostki siatki), żeby zmieścić się w budżecie etapu 1 bez jego podnoszenia.
- **Torba na telefonie** (poniżej 1100 × 620 px, komórka 52 px): sama ikona (60% komórki), skrót rzadkości i licznik stosu w dolnych rogach; nazwa jest w etykiecie przycisku dla czytnika i w szczegółach po dotknięciu (`useWideCells`, ten sam próg co układ desktopu w `styles.css`). Desktop bez zmian: ikona nad skrótem nazwy.
- **Pasek broni w HUD:** `WeaponSlotVm.icon` (app: `weapon-hud.ts`), ikona 30 px w kolorze rzadkości obok klawisza i nazwy, na telefonie (sam aktywny slot) i desktopie; pusty slot bez ikony. Kontrast 3:1 każdej rzadkości także na tle paska (`--panel` spłaszczony na jasnoszarej ulicy, #3e4246).
- **Lada:** każda oferta (broń, ubrania, mody, stosy, pudełka nabojów) i wszczepy w klinice mają ikonę w ramce.
- **Paczka** (build na `origin/main` 11dd80c i po zmianie): CSS settings 82,31 → 82,67 kB (gzip 16,55 → 16,60), JS settings 3589,15 → 3597,30 kB (gzip 1017,64 → 1020,75). Bez nowych żądań sieci i tekstur.
- **Testy:** `ui/test/item-icons.test.tsx` (ikona dla każdego przedmiotu i brak nieużytych rysunków, źródła i atrybucja ikon z game-icons.net, budżet, kontrast z tłem paska HUD, komórka desktopu z nazwą i telefonu z samą ikoną i etykietą, szczegóły po dotknięciu, pasek HUD, lada i klinika), `app/test/credits.test.ts` (atrybucja CC BY 3.0); układ HUD dotykowego `e2e/touch-layout.spec.ts`.
- **Poza etapem:** panel łupu, ikony w kolumnie ubrań przy podglądzie (zostaje przy nazwach) i w zakładce „Naprawa”. Ramki rzadkości komórek bez ikon (G-410): w torbie takich komórek już nie ma, ale reguła CSS i sloty zostają do osobnej poprawki.

## Konsekwencje
- Każda nowa broń i amunicja wymaga ikony (kompilator); nowe ubrania i wszczepy po etapie 2 też.
- Ikony rysuje się ręcznie w repo; ich jakość zależy od autora, ale nie od licencji ani potoku.
- Ikony nie zgadzają się piksel w piksel z modelem w ręku; sylwetka i klasa broni tak.
- Etap 3 zmienia kontrakt renderu (`AppearanceDescriptor`) i wygląd NPR, więc idzie osobno, z migawką.

## Decyzje użytkownika (6.11)
1. Styl neonowego konturu w kolorze rzadkości (wariant A) zostaje.
2. W etapie 2 dla ikon wszczepów i zużywalnych dopuszczona paczka game-icons.net na CC BY 3.0 z atrybucją; zmiana ADR-0063 i wpis w „Autorach” należą do etapu 2.
3. Lamówka rzadkości na ubraniu tylko na Seki i w podglądzie menu, nie na wrogach.
4. Na telefonie komórka torby pokazuje samą ikonę, nazwa po dotknięciu (etap 2).
5. Pasek broni w HUD dostaje ikony w etapie 2.
