# Peron metra Doki (`metro-doki`)

Peron stacji metra Doki pod Nabrzeżem, przy zakładzie W-3 (ADR-0071 etap 4). Drugi bieg schodów w dół i peron przy torze.

## Historia
Lubelskie metro zaczęto kopać w 2058 jako jedną linię z czterema stacjami. Skończono tunel i perony, nie skończono wykończeń: płytki są tylko do wysokości ręki, wyżej goły beton z numerami szalunków. Stacja Doki ma własny charakter po dzielnicy nad nią: ludzie z góry przynoszą tu swoje naklejki, swoje śmieci i swoje zapachy. Na ławce ktoś zostawił gazetę otwartą na rozkładzie, który od roku nie jest aktualny.

## Klimat
Zimne świetlówki w osłonach z kratki, migający ekran z rozkładem, żółta linia bezpieczeństwa przy krawędzi. Przeciąg z tunelu, szum wentylatorów, echo kroków.

## Przeznaczenie
Szybka podróż między dzielnicami (ADR-0071): gracz schodzi na peron i wsiada do składu. Bez walki; jedno zejście z ulicy.

## Inwentarz docelowy
Peron rysuje silnik z układu symulacji (`renderer/metro/platform-plan.ts`, `metro-platform.ts`):
- drugi bieg schodów z poręczami;
- granitowa posadzka z żółtą linią;
- płytki w kolorze stacji, ciemny strop ze świetlówkami;
- szklane drzwi peronowe, tor i skład dwóch wagonów;
- ławki, biletomat, tablica odjazdów i tablice z nazwą stacji.

Z Blendera (`tools/blender/rooms/metro.py`, plik `room-detail-metro-props.glb`), ten sam zestaw na czterech stacjach, ustawiony z układu peronu (`packages/sim/src/content/metro-detail.ts`):
- krata wentylacji z żaluzjami nad tablicą z nazwą, z zaciekami kurzu (`rd-metro-vent`);
- ekran rozkładu na dwóch prętach ze stropu, dwustronny, jedna minuta miga na czerwono (`rd-metro-timetable`);
- kasownik przy stopach schodów (`rd-metro-validator`);
- gazeta otwarta na nieaktualnym rozkładzie, kubek i zgnieciony bilet na pierwszej ławce (`rd-metro-litter`);
- plakat koncertu z oderwanym rogiem i naklejki dzielnicy wokół (`rd-metro-poster-a`, `rd-metro-poster-b`, na zmianę stacjami);
- kamera na wysięgniku nad schodami (`rd-metro-camera`; model gry `cctv` stoi na 4,3 m słupie, a peron ma 4,2 m);
- kosz z modeli gry (`waste-bin`).

Odłożone:
- automat z napojami bez bryły stałby na drodze, więc czeka na bryłę;
- beton z numerami szalunków nad płytkami.

## Frakcja i zasady
Frakcja: ulica (transport miejski).
- §12 zgodne co do kontrastu: zejście drugim biegiem (ciasno) na peron. 1 z 4 wymiarów na siatce.
- §13 dług: w pomiarach 0 źródeł w bryłach; świetlówki i ekran rozkładu rysuje silnik. Wejście do wagonu wyróżnione. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 30,7%, światło 42,2%, akcenty 27%, poza pasmem: baza 30,7% < 50%; światło 42,2% > 42%; akcenty 27% > 15%.
- §14 dług: 4 rzeczy drobiazgu, skupisko na ławce (gazeta, kubek, bilet), plakat luzem (25%). Za mało drobiazgu jak na peron; dalej skupiska przy ławce i koszu.
- §15 dług: mokry peron przy krawędzi, połysk płytek.
- §16 zgodne: migający ekran, zimne świetlówki.
- §17 do sprawdzenia: przeciąg z tunelu ze źródła.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-metro-camera × 1
- blender: rd-metro-litter × 1
- blender: rd-metro-poster-b × 1
- blender: rd-metro-timetable × 1
- blender: rd-metro-validator × 1
- blender: rd-metro-vent × 1
- model: waste-bin × 1

Pomiary zasad (§12–§16):
- rzut: 2 prostokąty, 149 m², wysokość 7,9 / 4,2 m
- siatka 0,5 m: 1 z 4 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 0
- warstwy wyposażenia: makro 0, mezo 5, mikro 4
- drobiazg w skupiskach (≥ 3 w 1,2 m): 1 skupisk, 3 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
