# Bar Neon Koi (`neon-koi`)

Parter kamienicy po południowej stronie deptaku Krakowskiego Przedmieścia, naprzeciw kliniki (ADR-0038, ADR-0045). Sala z ladą wzdłuż ściany i stolikami.

## Historia
Do 2041 kawiarnia „Pod Karpiem”, której szyld z rybą wisi do dziś, tylko obrośnięty neonem. Kaito przejął lokal po fali bankructw w lokalach gastronomicznych i zrobił z niego bar dla tych, którzy pracują po nocach: kurierów, ochroniarzy Tessenu po służbie, ludzi Hebi. W boksie w głębi Kaito przyjmuje zlecenia. Nad ladą akwarium z żywym koi, jedynym zwierzęciem na deptaku, które nie jest robotem. Ktoś zostawił przy barze niedopite piwo i papierosa tlącego się w popielniczce.

## Klimat
Neony różowe i turkusowe odbite w lakierowanym blacie, lampiony nad boksami, para z czajnika do sake. Muzyka z radia Yoru FM. Ciasno, gwarno, lepkie stoły. Przy wejściu automat z napojami świecący jak latarnia.

## Przeznaczenie
Hub fabularny: rozmowy z Kaito, zlecenia, odpoczynek. Gracz wchodzi z deptaku, siada przy barze albo w boksie. Drugie wyjście przez zaplecze na podwórze.

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/neon_koi.py`, 22.11) albo do zrobienia.

Architektura:
- lada barowa z frontem z desek, blatem, podnóżkiem z rury i różowym paskiem pod blatem (zrobione: `rd-koi-counter`);
- regał z butelkami za barem: cztery półki z różowym brzegiem, butelki pięciu kształtów z przerwami, czajnik do sake, kasetka (zrobione: `rd-koi-shelf`);
- akwarium z koi na regale (zrobione: `rd-koi-aquarium`);
- boksy z kanapami z poprzecieranej ceraty w głębi (do zrobienia: wymaga nowych brył symulacji);
- sufit z rurami wentylacji i girlandą lampionów (do zrobienia).

Duże obiekty:
- stołki barowe, pięć (zrobione: `rd-koi-stool`);
- stoliki z blatem na stalowej nodze i krzesła (zrobione: `rd-koi-table`, `rd-koi-chair`);
- nalewak do piwa z trzema kranami (zrobione: `rd-koi-counter-things`);
- szafa grająca przerobiona na radio (zrobione: `rd-koi-jukebox`);
- automat z napojami przy wejściu (do zrobienia: model gry `vending-machine`).

Drobiazg:
- niedopite piwo, popielniczka z tlącym się papierosem, podkładki, rachunek (zrobione: `rd-koi-counter-things`, `rd-koi-table`);
- kufle do góry dnem pod blatem po stronie barmana (zrobione: `rd-koi-counter`);
- naklejki na lustrze za barem, ulotki zespołów (do zrobienia).

## Frakcja i zasady
Frakcja: ulica (bar).
- §12 dług: 0 z 2 wymiarów na siatce (obrys z kamienicy, §1). Instalacje pod stropem do dodania.
- §13 częściowo: 3 widoczne źródła (neony, lampiony, automat). Dług: Kaito przy ladzie jako cel pierwszego zadania wyróżniony światłem.
- §14 zgodne: 17 rzeczy drobiazgu, 13 w skupiskach (rzeczy na ladzie, butelki za barem), 24% luzem (piwo i popielniczka na stolikach). Dług: zmywak.
- §15 częściowo: lakierowany blat w opisie, do sprawdzenia połysk w grze; lepkie stoły jako wilgoć.
- §16 zgodne: neony, ciepły brudny żółty.
- §17 do sprawdzenia: radio Yoru FM ze źródła.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-koi-aquarium × 1
- blender: rd-koi-chair × 2
- blender: rd-koi-counter × 1
- blender: rd-koi-counter-things × 1
- blender: rd-koi-jukebox × 1
- blender: rd-koi-shelf × 1
- blender: rd-koi-stool × 5
- blender: rd-koi-table × 2
- prop: blok (concrete) × 1
- prop: blok (metal) × 1
- prop: blok (metal), rysunek osobno × 12
- prop: neon × 1
- prop: neon, rysunek osobno × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 169 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 5
- warstwy wyposażenia: makro 2, mezo 20, mikro 17
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 13 rzeczy w nich, 4 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 3
<!-- inwentarz-gry:end -->
