# Parking P-1 Alchemii (`alchemia-parking`)

Górny poziom parkingu pod placem T0, z rampą z Bajkowskiego, stanowiskami przekazania aut i drzwiami do metra B (ADR-0074 etap 4).

## Historia
P-1 był pierwszą częścią Alchemii oddaną do użytku: parking z czternastoma miejscami i dwiema kabinami, w których kierowca zostawia auto, a robot P-2 odstawia je w głąb. Kabiny działają, ale ludzie wolą parkować sami, więc na P-1 zawsze stoją auta krzywo, na dwóch miejscach. Strażnik z budki przy rampie od dawna nie wychodzi; jego kubek stoi na murku przy kasie.

## Klimat
Niski strop, betonowe słupy z żółto-czarnymi pasami, zielone światło nad wjazdem, czerwone nad zakazem. Kałuże pod autami, zapach spalin i gumy. Ładowarki aut świecą na niebiesko.

## Przeznaczenie
Przejście z ulicy do galerii i metra, miejsce walki z osłonami (słupy, auta), parkowanie auta gracza. Wjazd rampą, wyjścia klatką i drzwiami do metra.

## Inwentarz docelowy
Parking rysuje silnik Alchemii i scenografia (`alchemia/parking.ts`):
- ściany, strop, rampa w wykopie;
- dwie kabiny przekazania z roletą;
- linie miejsc, słupki ładowarek, słupy, kasa i konsola strażnika;
- auta na miejscach (model gry: `vehicle-props.glb`).

Z Blendera (`tools/blender/rooms/alchemia_p1.py`, plik `room-detail-alchemia-props.glb`), tylko rysunek:
- na sześciu słupach: pasy ostrzegawcze żółte i czarne, gumowe odbojnice na narożnikach, tabliczki z numerem i znak gaśnicy (`rd-p1-column`);
- na czterech ładowarkach: ekran z poziomem ładowania, pierścień światła wokół gniazda, wtyczka i gruby kabel zwinięty na haku, naklejka z kodem (`rd-p1-charger`);
- pod stropem alejki: rura tryskaczy z głowicami, koryto kablowe na wieszakach, świetlówki co 4 m, jedna przygaszona (`rd-p1-ceiling`);
- szlaban podniesiony przy stopie rampy (`rd-p1-barrier`);
- ekran z sylwetką auta, sygnalizator i znak nad kabiną wjazdową (`rd-p1-cabin-screen`);
- na konsoli strażnika: kubek z herbatą, plik biletów, telefon, długopis (`rd-p1-guard`);
- przy kasie: pachołek, upuszczone bilety, plama oleju (`rd-p1-floor`).

Z generatora wnętrz (ADR-0099, zestaw `car-park` w `room-kits.ts`, układ `P1_LAYOUT` w `room-dressing-rooms.ts`): gaśnice przy drzwiach do hali, skrzynka rozdzielcza na zachodniej ścianie, kratki odpływu, kałuże i plamy na pustych miejscach, kartony z butelkami i kubkiem w rogu pokładu. Wolne zostają rampa, alejka między rzędami, płyta, na której auta skręcają do kabin, i przejścia do hali, metra B i klatki.

## Frakcja i zasady
Frakcja: ulica.
- §12 dług: 2 z 8 wymiarów na siatce. Niski strop zgodny. Rampa wjazdowa (ciasno) otwiera się na halę parkingu: zgodne.
- §13 dług: w pomiarach 1 widoczne źródło; świetlówki co 4 m są w detalu, ale lampy silnika trzeba powiązać z oprawami. Wyjścia (klatka, drzwi metra) w zieleni nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 58,7%, światło 39,3%, akcenty 2%, poza pasmem: akcenty 2% < 3%; po trybie wnętrza Alchemii (latarnie placu nie zajmują już miejsc lamp przez strop, lampa pokładu 1,4): baza 63,9%, światło 34,1%, akcenty 2%, poza pasmem: akcenty 2% < 3%. Dług: akcent (pasy słupów w świetle, zielone znaki wyjścia).
- §14 zgodne: 13 rzeczy drobiazgu w trzech skupiskach (konsola strażnika, bilety i pachołek przy kasie, kartony z butelkami i kubkiem w rogu pokładu), nic luzem. Dalej: skupisko przy kabinach.
- §15 częściowo: kałuże i plamy na pustych miejscach (generator), połysk lakieru aut. Dług: kałuże pod samymi autami.
- §16 zgodne: beton, pasy ostrzegawcze; dodać migającą świetlówkę.
- §17 do sprawdzenia: szum wentylacji i silników. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): buczenie ładowarek, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-bottles × 1
- blender: rd-c-cartons × 1
- blender: rd-c-cups × 1
- blender: rd-c-drain × 2
- blender: rd-c-extinguisher × 2
- blender: rd-c-fusebox × 1
- blender: rd-c-puddle × 2
- blender: rd-p1-barrier × 1
- blender: rd-p1-cabin-screen × 1
- blender: rd-p1-ceiling × 1
- blender: rd-p1-charger × 4
- blender: rd-p1-column × 6
- blender: rd-p1-floor × 1
- blender: rd-p1-guard × 1
- blender: rd-w3h-exit × 3
- prop: vehicle, rysunek osobno × 10

Pomiary zasad (§12–§16):
- rzut: 4 prostokąty, 573 m², wysokość 2,7 / 4,2 m
- siatka 0,5 m: 2 z 8 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 4
- warstwy wyposażenia: makro 0, mezo 30, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 13 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
