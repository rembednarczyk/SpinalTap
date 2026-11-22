# Schron pod T2 (`alchemia-shelter`)

Schron przeciwlotniczy znaleziony przez archeologów pod placem T2, przy północnym końcu P-2 (ADR-0074 etap 5d1). Sala z ekspozycją, przejście i dwa biegi schodów.

## Historia
Schron zbudowano w 1938 dla mieszkańców kamienic przy Lubartowskiej. Po wojnie zasypany, odkryty w 2059 przy wykopie pod Alchemię. Inwestor zachował go jako salę pamięci z gablotami: maski gazowe, lampy naftowe, listy lokatorów. Od kiedy Hebi znalazł drogę przez P-2, w północno-zachodnim kącie stoi jego skrytka, a w gablocie ktoś zbił szybę.

## Klimat
Niski strop z betonu, ślady szalunku, żółte światło gablot, zielona lampka wyjścia nad włazem. Cisza, chłód, kurz. Kontrast: zabytkowe gabloty i nowa elektronika Hebi.

## Przeznaczenie
Miejsce zadania (skrytka Hebi, etap 5d2) i pamięci. Dwa wejścia: brama w korytarzu P-2 i właz na T2.

## Inwentarz docelowy
Salę rysuje silnik Alchemii z jej kawałków (`alchemia/shelter.ts`): ściany, strop, ławki z czasów wojny, dwa słupy, gabloty na ladach, panele ze zdjęciami, wentylator na korbę, lampki awaryjne. Skrzynie Hebi są bryłami (`market.ts`). Gabloty są nieprzezroczyste, więc znaleziska wiszą przy nich.

Z Blendera (`tools/blender/rooms/alchemia_shelter.py`, plik `room-detail-alchemia-props.glb`), tylko rysunek:
- drzwi pancerne z 1938 otwarte płasko na ścianie przy przejściu: nitowane skrzydło, koło z czterema ryglami, trzy zawiasy, numer szablonem (`rd-shelter-door`);
- maski gazowe na wieszaku i hełm (`rd-shelter-masks`);
- lampy naftowe na słupach (`rd-shelter-oil-lamp`);
- lista lokatorów z 1939 w ramce z opisem muzealnym nad ławką (`rd-shelter-list`);
- przewody w rurkach pod stropem z puszkami i oprawą w kratce (`rd-shelter-conduit`);
- szkło zbitej gabloty i cegła na posadzce (`rd-shelter-shards`);
- ślady butów w kurzu od przejścia do skrytki (`rd-shelter-prints`);
- sprzęt Hebi na skrzyni: laptop z zielonym ekranem, radio, energetyk, kabel do akumulatora na posadzce (`rd-shelter-hebi`).

Odłożone: prycze z desek; bez bryły stałyby na drodze.

Z generatora wnętrz (ADR-0099, zestaw `shelter` w `room-kits.ts`, układ `SHELTER_LAYOUT` w `room-dressing-rooms.ts`): gaśnica muzeum przy włazie, skrzynka rozdzielcza na wschodniej ścianie obok skrzyni, kałuża z wilgoci od gruntu, kartony Hebi, butelki i kubek na skrzyni Hebi obok laptopa. Wolne zostają przejście od bramy, ścieżka śladów butów wzdłuż zachodniej ściany, róg skrytki i podest włazu.

## Frakcja i zasady
Frakcja: ulica (Hebi); druga: historia (zabytkowe gabloty).
- §12 dług: 0 z 8 wymiarów na siatce (stary schron). Właz i biegi schodów (ciasno) przed salą: zgodne.
- §13 częściowo: żółte gabloty, zielona lampka wyjścia. Dług: sprzęt Hebi bez zimnego źródła. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 73,3%, światło 26,5%, akcenty 0,1%, poza pasmem: akcenty 0,1% < 3%.
- §14 zgodne: 20 rzeczy drobiazgu, 18 w trzech skupiskach (maski, szkło z cegłą, sprzęt Hebi z butelkami i kubkiem), 10% luzem.
- §15 częściowo: kałuża z wilgoci od gruntu przy wschodniej ścianie (generator). Dług: beton matowy wszędzie, zacieki na ścianach.
- §16 zgodne z ulicą; kontrast z elektroniką Hebi to cel.
- §17 do sprawdzenia: cisza z kapaniem jako dźwięk źródła. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): buczenie skrzynki, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-bottles × 1
- blender: rd-c-cartons × 1
- blender: rd-c-cups × 1
- blender: rd-c-extinguisher × 1
- blender: rd-c-fusebox × 1
- blender: rd-c-puddle × 1
- blender: rd-shelter-conduit × 2
- blender: rd-shelter-door × 1
- blender: rd-shelter-hebi × 1
- blender: rd-shelter-list × 1
- blender: rd-shelter-masks × 1
- blender: rd-shelter-oil-lamp × 2
- blender: rd-shelter-prints × 1
- blender: rd-shelter-shards × 1
- blender: rd-w3h-exit × 2
- prop: blok (metal) × 2

Pomiary zasad (§12–§16):
- rzut: 4 prostokąty, 220 m², wysokość 2,3 / 5,3 / 2,8 m
- siatka 0,5 m: 0 z 8 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 3
- warstwy wyposażenia: makro 2, mezo 8, mikro 20
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 18 rzeczy w nich, 2 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 2
<!-- inwentarz-gry:end -->
