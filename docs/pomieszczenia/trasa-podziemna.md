# Trasa Podziemna (`trasa-podziemna`)

Piwnice pod Rynkiem, wejście z Trybunału Koronnego (ADR-0048). Przedsionek, klatka schodowa, korytarze i loch.

## Historia
Prawdziwa Lubelska Trasa Podziemna łączy kamienicze piwnice pod Starym Miastem. W 2077 trasa jest zamknięta dla turystów od dziesięciu lat: miasto nie ma na konserwację. Zanim ją zamknięto, w lochu śpiewała Mei, za monety wrzucane do futerału. Dziś zagląda tu ochrona Trybunału, bezdomni i ci, którzy czegoś szukają. Ktoś zostawił w lochu torbę.

## Klimat
Kamienne sklepienia, ceglane łuki, wilgotne ściany z wykwitami soli. Stare lampy muzealne, część zgaszona, część zastąpiona przenośnymi LED-ami na kablach. Tablice informacyjne trasy wyblakłe, z naklejkami gangów.

## Przeznaczenie
Miejsce zadania („m4-ulica”): torba w lochu, ślad Mei. Ciasne korytarze, jedno wejście z Trybunału, schronienie przed patrolami.

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/trasa.py`, 22.11) albo do zrobienia.

Architektura:
- łuki ceglane pod sklepieniami korytarzy: klińce na łuku odcinkowym i wypełnienie do stropu, w miejscu sześciu żeber (zrobione: `rd-trasa-arch-24`, `rd-trasa-arch-21`);
- muzealna lampa ścienna na kinkiecie, kabel z taśmą do LED-ów (zrobione: `rd-trasa-lamp`, jedna przy ciepłym pasku w korytarzu południowym);
- barierka muzealna z czerwoną liną na mosiężnych słupkach (zrobione: `rd-trasa-rope`);
- ceglane ściany i kamienne progi zamiast gładkich bloków (do zrobienia: powłoka korytarzy).

Duże obiekty:
- tablice informacyjne trasy na stojakach, wyblakłe, z naklejkami gangów (zrobione: `rd-trasa-board`, dwie);
- scena Mei w lochu: podest z desek, wykładzina, statyw z mikrofonem, otwarty futerał z monetami, skrzynka (zrobione: `rd-trasa-stage`);
- kolumna głośnikowa przy scenie (zrobione: `rd-trasa-speaker`);
- posłanie bezdomnego z kartonów i koca, kurtka zamiast poduszki (zrobione: `rd-trasa-bedding`);
- gabloty z dawnymi znaleziskami (do zrobienia).

Drobiazg:
- monety w futerale (zrobione: `rd-trasa-stage`), puszki i butelki przy posłaniu (zrobione: `rd-trasa-bedding`);
- torba w lochu (skrytka gry, osobny widok), niedopałki, naklejki na ścianach (do zrobienia).

## Frakcja i zasady
Frakcja: ulica (gangi w starych piwnicach); druga: historia (muzeum).
- §12 zgodne: ciasne przejścia i wyższa sala (7,6 m), 3 z 8 wymiarów na siatce (stare piwnice, §1).
- §13 zgodne co do źródeł (7 widocznych: lampy muzealne, LED-y na kablach). Dług: drogi wyjścia w barwie nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 27,4%, światło 69,8%, akcenty 2,9%, poza pasmem: baza 27,4% < 50%; światło 69,8% > 42%; akcenty 2,9% < 3%; po trybie wnętrza (ciemne otoczenie zamiast księżyca, własne lampy zostają): baza 41,4%, światło 55,5%, akcenty 3,1%, poza pasmem: baza 41,4% < 50%; światło 55,5% > 42%. Dług: w małej piwnicy z karaoke szeroki różowy neon oświetla wszystkie ściany z jasnego betonu; kamień i cegła z karty (ciemniejsze) albo mniejszy neon.
- §14 zgodne: 14 rzeczy drobiazgu w czterech skupiskach (legowisko, scena, tablice), nic luzem.
- §15 częściowo: wilgotne ściany w opisie; do sprawdzenia połysk w grze.
- §16 zgodne.
- §17 do sprawdzenia: kapanie i echo.

## Scenariusz

### Pierwszy kadr
Seki wchodzi z Rynku drzwiami w zachodniej ścianie Trybunału Koronnego (około 566; −57), pod neonem TRASA PODZIEMNA, twarzą na wschód. Sklepiony przedsionek szeroki na 2,2 m prowadzi 4,5 m prosto do głowy schodów, a za nią otwiera się wysoka klatka (strop 3,65 m nad drzwiami, 7,6 m nad dnem piwnic): bieg schodów w dół na wschód, ciepły pasek lampy pod stropem, bursztynowy kinkiet na wschodniej ścianie nad podestem. Od podestu na dole korytarz skręca na południe, potem na zachód, pod ceglanymi łukami, i kończy się drzwiami lochu z różowym szyldem KARAOKE. Wzrok ma iść w dół schodów, na ciepłe światło podestu.

### Postacie i miejsca
- W piwnicach nikt nie stoi. Ślady obecności: posłanie bezdomnego z kartonów (`rd-trasa-bedding`), tablice trasy z naklejkami gangów, scena Mei w lochu z otwartym futerałem i monetami.
- Torba w lochu przy scenie (`stash:trasa-podziemna`, (576,3; −3,6; −59,2)): 90 €$, datachip, apteczka. Pojawia się raz (ADR-0026).
- Mei (`mei`) śpiewa w KARAOKE na Rynku od 20:00 do 4:00 (`schedules.ts`). Takumi z kwiatami czeka przed KARAOKE 20–3 (`enc_kanal_flowers`).
- Patrole Hebi (`kanal-patrols.ts`, terytorium `rynek`) obchodzą Trybunał i przechodzą obok jego drzwi zachodnią stroną Rynku, od (561; −64) do (560; −40): w dzień jeden, od 21:00 do 5:00 dwóch w przeciwne strony.

### Przebieg
1. Trop: Mei w rozmowie (`mei.talk`): „Zanim zamknęli piwnice pod Rynkiem, śpiewałam w lochach Trasy Podziemnej za drobne. Akustyka była lepsza”. Nie ma znacznika ani zadania.
2. Wejście: drzwi Trybunału, przedsionek, autozapis przy wejściu (ADR-0061).
3. Zejście: schody, podest, korytarz południowy, korytarz zachodni pod łukami (droga `TRASA_PODZIEMNA_WALK`). Napięcie robi cisza i ciasnota po wysokiej klatce.
4. Nagroda: loch z dawną sceną Mei i torba przy scenie.
5. Powrót tą samą drogą na Rynek, gdzie może czekać patrol.
Zadania, rozmowy ani haka tu nie ma (ADR-0048: „Brak spotkania i haka terminal/shard”).

### Drogi
- Jedno wejście i jedno wyjście, drzwi Trybunału na Rynek. Prawdziwa trasa ciągnie się pod kamienicami do Placu po Farze, w grze są tylko cztery pomieszczenia (T-055).
- Cicha: wejście, gdy patrol jest po drugiej stronie Trybunału. Pętla wokół Trybunału trwa ponad minutę marszu.
- Głośna: w piwnicach nie ma wrogów. Pościg Hebi z Rynku wchodzi za graczem drzwiami i schodami. Osłony: zakręty korytarzy, łuki, scena w lochu.
- Pułapka: loch to ślepy koniec, a jedyna droga z niego prowadzi przez dwa korytarze i schody pod górę.

### Pora i stan świata
- Pod ziemią bez okien, więc wygląda tak samo o każdej porze. Na Rynku nad nim w nocy świeci KARAOKE, gra Mei i chodzą dwa patrole, w dzień jeden patrol i wycieczki (Tetsu: „Stare Miasto budzi się dopiero po zmroku”).
- Przed znalezieniem torba leży przy scenie, po nim loch jest pusty na zawsze. Stan gangu: Rynek to terytorium Hebi w dzielnicy `kanal`, a strzały w piwnicy słychać do patrolu, jeśli stoi przy drzwiach (do sprawdzenia: zasięg alarmu przez strop).

### Wymagania wobec sceny
- Droga w dół jaśniejsza niż ściany: ciepłe światło na podeście i przy drzwiach lochu (jest), zielony albo jaśniejszy znak wyjścia u stopy schodów w drodze powrotnej (§13, dług w audycie).
- Loch czytelny jako dawna scena Mei: podest, mikrofon, futerał z monetami (są) i plakat albo lista piosenek Mei, która łączy loch z jej kwestią.
- Torba widoczna od drzwi lochu, w świetle, a nie w ciemnym kącie.
- Kapanie i echo ze źródła (§17).

## Dług sceny
- Część „Przeznaczenie” tej karty mówi o „miejscu zadania („m4-ulica”)”, a w grze to znalezisko z kwestii Mei, bez zadania (ADR-0048). Poprawka karty.
- Plakat Mei albo lista piosenek przy scenie w lochu: `tools/blender/rooms/trasa.py`, rozstawienie w `packages/sim/src/content/trasa-detail.ts`.
- Znak wyjścia u stopy schodów (zielony, ISO 7010 E001 jak w Alchemii): `trasa-detail.ts` i lampa w `packages/engine/src/renderer/rooms/room-lights.ts`.
- Kapanie i echo jako emitery w lochu i korytarzach: `packages/engine/src/audio/room-sound-map.ts`.
- Szeroki różowy neon KARAOKE oświetla cały loch (dług §13 w audycie): mniejszy neon albo ciemniejsza cegła w `packages/sim/src/content/kanal-underground.ts` (`lights()`; zmiana bryły na końcu listy nie rusza id).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-trasa-arch-21 × 3
- blender: rd-trasa-arch-24 × 3
- blender: rd-trasa-bedding × 1
- blender: rd-trasa-board × 2
- blender: rd-trasa-lamp × 1
- blender: rd-trasa-rope × 1
- blender: rd-trasa-speaker × 1
- blender: rd-trasa-stage × 1
- prop: blok (concrete) × 4
- prop: blok (concrete), rysunek osobno × 6
- prop: blok (concrete, pochyły) × 1
- prop: blok (metal) × 1
- prop: blok (metal), rysunek osobno × 2
- prop: neon × 6

Pomiary zasad (§12–§16):
- rzut: 4 prostokąty, 104 m², wysokość 3,6 / 7,6 / 2,7 m
- siatka 0,5 m: 3 z 8 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 7
- warstwy wyposażenia: makro 11, mezo 11, mikro 14
- drobiazg w skupiskach (≥ 3 w 1,2 m): 4 skupisk, 14 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 7
<!-- inwentarz-gry:end -->
