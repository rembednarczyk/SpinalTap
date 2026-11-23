# Peron metra Targ (`metro-targ`)

Peron stacji metra Targ pod targowiskiem, najgłębsza z czterech (ADR-0071 etap 4). Drugi bieg schodów w dół i peron przy torze.

## Historia
Lubelskie metro zaczęto kopać w 2058 jako jedną linię z czterema stacjami. Skończono tunel i perony, nie skończono wykończeń: płytki są tylko do wysokości ręki, wyżej goły beton z numerami szalunków. Stacja Targ ma własny charakter po dzielnicy nad nią: ludzie z góry przynoszą tu swoje naklejki, swoje śmieci i swoje zapachy. Na ławce ktoś zostawił gazetę otwartą na rozkładzie, który od roku nie jest aktualny.

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
- §12 zgodne co do kontrastu: zejście drugim biegiem na peron. 1 z 4 wymiarów na siatce.
- §13 częściowo: lampy peronu mają oprawy w geometrii silnika (pasy świetlne w stropie, sprawdzone 22.11); dług: wejście do wagonu wyróżnione. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 33,6%, światło 65,5%, akcenty 0,9%, poza pasmem: baza 33,6% < 50%; światło 65,5% > 42%; akcenty 0,9% < 3%; po trybie wnętrza peronu (ciemne otoczenie zamiast księżyca, lampy świetlówek z plamami 8,5 m, ściany w średnim tonie, posadzka z ciemnego granitu, jaśniejszy pas linii): baza 53,1%, światło 41,7%, akcenty 5,2%, zgodne.
- §14 zgodne: 19 rzeczy drobiazgu, 11% luzem; ręcznie gazeta, plakat i kosz, a generator wnętrz (ADR-0099, zestaw `platform`) dokłada worki śmieci pod ścianą z przewróconymi kubkami obok i gazety z kubkami na ławkach.
- §15 dług: połysk płytek, mokre od skrzyń z rybą.
- §16 zgodne.
- §17 do sprawdzenia: gwar targu z góry schodów.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-capsule-trash × 2
- blender: rd-fh-cup × 1
- blender: rd-fh-spilled × 2
- blender: rd-metro-camera × 1
- blender: rd-metro-litter × 3
- blender: rd-metro-poster-a × 1
- blender: rd-metro-timetable × 1
- blender: rd-metro-validator × 1
- blender: rd-metro-vent × 1
- model: waste-bin × 1

Pomiary zasad (§12–§16):
- rzut: 2 prostokąty, 149 m², wysokość 7,5 / 4,2 m
- siatka 0,5 m: 1 z 4 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 0
- warstwy wyposażenia: makro 0, mezo 5, mikro 19
- drobiazg w skupiskach (≥ 3 w 1,2 m): 5 skupisk, 17 rzeczy w nich, 2 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 2
<!-- inwentarz-gry:end -->
