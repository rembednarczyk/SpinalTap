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
- §13 zgodne: tryb wnętrza z lampami przy oprawach (`room-lights.ts`, od 22.11): różowy neon regału, turkus akwarium, bursztyn szafy grającej, róż sceny, każda przycięta do baru. Dług: Kaito przy ladzie jako cel pierwszego zadania wyróżniony światłem. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 74,9%, światło 20,4%, akcenty 4,7% (wcześniej 97,4 / 2,2 / 0,4).
- §14 zgodne: 17 rzeczy drobiazgu, 13 w skupiskach (rzeczy na ladzie, butelki za barem), 24% luzem (piwo i popielniczka na stolikach). Zmywak za północnym końcem lady (partia 2 ADR-0099, `rd-k-bar-sink`: stalowy zlew z dwiema komorami, bateria ze spryskiwaczem, szklanki na suszarce, gąbka, płyn, skrzynka pustych butelek).
- §15 częściowo: lakierowany blat w opisie, do sprawdzenia połysk w grze; lepkie stoły jako wilgoć.
- §16 zgodne: neony, ciepły brudny żółty.
- §17 do sprawdzenia: radio Yoru FM ze źródła. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): pompa akwarium, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Seki przechodzi z kliniki na drugą stronę deptaka i wchodzi pod różowym neonem NEON KOI przez drzwi dwuskrzydłowe 2,2 m (315; −94,2), twarzą na południe. Sześć metrów przed nią lada przez całą salę, za nią barman i regał z butelkami w różowym neonie (#ff2e88) z turkusowym akwarium. Przy ladzie, między stołkami, na lewo od osi drzwi stoi Kaito i patrzy na wejście. Po lewej i prawej przy oknach dwa stoliki z bywalcami, w głębi po lewej niska scena z napisem KOI LIVE i bursztynowa szafa grająca w narożniku. Ink `fixer.first_meeting`: „Różowy neon nad ladą brzęczy jak mucha. Pachnie piwem ryżowym i przypalonym chromem”. Wzrok ma iść na Kaito (cel M0), a dziś łapie go neon regału (dług §13 w audycie).

### Postacie i miejsca
- Kaito (`fixer`, frakcja `fixers`, rozmowa `fixer`) przy ladzie między stołkami (317; −99,8), twarzą ku drzwiom (`FIXER_BAR_SPAWN`). Jest tu od nowej gry, zawsze, bez planu dnia (G-034).
- Barman (`koi-barman`, rozmowa `koi_barman`) za ladą (315; −102,3), twarzą na salę.
- Dwóch bywalców (`koi_regular`) przy stolikach pod oknami: (309,4; −95,6) i (320,8; −97,7), twarzami do swoich stolików.
- Tłum mieszkańców (ADR-0041) przy ladzie: (310,9; −99,9), (312,8; −99,9), (319,2; −99,9) twarzami do lady i jeden przy zachodniej ścianie (307,4; −98,5).
- Pod oknem na zewnątrz, przy (328; −91), od 1:00 do 6:00 śpi na chodniku salaryman (`enc_s7_salaryman`).

### Przebieg
1. M0 `find_fixer`: Kaito nogą odsuwa stołek, nadaje imię (Seki Senshi), mówi o długu za łatanie i daje pierwsze zlecenie: kurier Hebi za myjnią. „Potem wróć tutaj, do Neon Koi. Będę przy ladzie” (flaga `met_fixer`). Barman w tym kroku mówi, że Kaito „całą noc czekał u Moriego”.
2. `report_back`: „Słyszałem strzały. I ciszę po nich”. Przelew 500, fixerzy +10, Hebi −15 i ostrzeżenie: „Ktoś już pytał o kobietę z wraku”. Bywalec po `reported_back`: „To ty zdjęłaś tego kuriera spod myjni?”.
3. Zlecenia Kaito (`contract_offer`, `contract_menu`): likwidacja, kurs z chłodzonymi modułami dla Hany, rada o Morim i Hanie. Wypłata przy ladzie (`contract_payday`). Akt I `echo_contract`: przy wypłacie Kaito widzi, że Seki „odpłynęła”.
4. Akt II `kaito_job` (`fixer.ren_job`): Kaito siada z Seki, puszcza nagranie głosu Rena i daje zlecenie Kagami na Rena. Decyzja: odmowa (fixerzy −3) albo przyjęcie (fixerzy +3). Retrospekcja `recall_last_call` kończy się w tym samym miejscu: „Stoisz przy barze Neon Koi. Kaito patrzy na ciebie i czeka, aż wrócisz”.
5. Po akcie II i w epilogu: Kaito komentuje zakończenie, a w epilogu „stawia ci sake i o nic nie pyta” albo wypłaca premię (`m3-zrodlo.ink`).
6. Wariant zlecenia „pijak” (ADR-0034): cel z miejsc Kaito idzie o 22:00 pić pod drzwi Neon Koi (`BAR_SPOT` (316,5; −92,6), na deptaku) i wraca o 2:00.

### Drogi
- Jedno wejście z deptaku (`door:neon-koi`). Drugiego wyjścia w grze nie ma, choć karta i podwórko `koi_back` za barem (kontenery około 9 m za tylną ścianą, skrytka `stash:s7-koi-back`) go wymagają.
- Bar nie jest miejscem walki: postacie są `bystander`, barman prosi, żeby nie strzelać tu do Hebi, gdy są wrogo nastawieni. Osłony na wypadek walki: lada 1,1 m i szafa grająca.
- Ucieczka deptakiem na zachód i na wschód, a na podwórko `koi_back` tylko dookoła kamienicy.

### Pora i stan świata
- Bar jest otwarty zawsze. Wnętrze bez okien do sprawdzenia (ADR-0061), więc wygląda tak samo w dzień i w nocy. W nocy przed drzwiami pijak wariantu (22–2) i śpiący salaryman (1–6), wieczorem i w nocy Nobu przed PACHINKO (19–4, `enc_s7_pachinko`).
- Przed M0 bar to cel pierwszego kroku. Po M0 Kaito daje zlecenia i rozmowy zależą od postawy Hebi (`hebi_stance`) i fixerów. Po akcie II Kaito mówi o Kagami albo o zerwanej umowie (`kaito_after_act2`).

### Wymagania wobec sceny
- Kaito wyróżniony światłem nad swoim miejscem przy ladzie (§13, kontrast funkcjonalny), tak żeby od drzwi czytał się przed neonem regału.
- Stołek do odsunięcia przy Kaito i boks w głębi, w którym Kaito „przyjmuje zlecenia” (historia karty) i w którym siada z Seki przy `ren_job`: boksy są w karcie „do zrobienia”.
- Drzwi zaplecza na podwórko `koi_back`, z którego wychodzi kontener na ciało i skrytka (§9, karta: „Drugie wyjście przez zaplecze na podwórze”).
- Radio Yoru FM w szafie grającej jako źródło dźwięku (§17) i przyśpiewka Motoru z kwestii bywalca.

## Dług sceny
- Drzwi zaplecza w tylnej ścianie (z −104) ku podwórku `koi_back` z kontenerami, bez przecinania grafu nawigacji kamienicy: `packages/sim/src/content/interiors.ts` (`koi()`, `S7_DOORS`, `S7_NAV`; nowe bryły na końcu, świadoma zmiana złotego hasha), przegląd `topography-curator` (obrys w66330644).
- Światło nad miejscem Kaito przy ladzie: lampa w oprawie nad ladą w `packages/engine/src/renderer/rooms/room-lights.ts`, oprawa w `tools/blender/rooms/neon_koi.py`.
- Boksy z kanapami w głębi sali (bryły i rysunek): `interiors.ts`, `tools/blender/rooms/neon_koi.py`, `packages/sim/src/content/koi-detail.ts`.
- Martwy punkt: `KOI_BAR_SPOT` w `interiors.ts` (pijak przy ladzie przy drzwiach) nie jest nigdzie używany, a pijak wariantu pije na deptaku w `BAR_SPOT` z `contract-plans.ts` („at the street counter”), gdzie w `district-m0.ts` nie ma lady. Propozycja: pijak przy ladzie w środku (`KOI_BAR_SPOT`) albo lada uliczna przy drzwiach w `district-m0.ts`, a nieużywany punkt usunąć.
- Mail haka `hook_delivery_1` w `packages/narrative/ink/{pl,en}/hooks.ink` przychodzi „Od: chłodnia Neon Koi”, a bar nie ma chłodni. Propozycja: chłodziarka z modułami na zapleczu (`tools/blender/rooms/neon_koi.py`) albo nadawca „Kaito”.
- Radio Yoru FM jako emiter w szafie grającej (`rd-koi-jukebox`): `packages/engine/src/audio/room-sound-map.ts`.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-k-bar-sink × 1
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
- warstwy wyposażenia: makro 2, mezo 21, mikro 17
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 13 rzeczy w nich, 4 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 3
<!-- inwentarz-gry:end -->
