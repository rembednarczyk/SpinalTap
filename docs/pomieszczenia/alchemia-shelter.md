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
- §13 częściowo: żółte gabloty, zielona lampka wyjścia. Dług: sprzęt Hebi bez zimnego źródła. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 73,3%, światło 26,5%, akcenty 0,1%, poza pasmem: akcenty 0,1% < 3%; po trybie wnętrza Alchemii (lampy przy czterech lampach w koszykach, ciepły bursztyn; wcześniej latarnie placu przez strop): baza 71,1%, światło 28,5%, akcenty 0,4%, poza pasmem: akcenty 0,4% < 3%. Dług: akcent.
- §14 zgodne: 20 rzeczy drobiazgu, 18 w trzech skupiskach (maski, szkło z cegłą, sprzęt Hebi z butelkami i kubkiem), 10% luzem.
- §15 częściowo: kałuża z wilgoci od gruntu przy wschodniej ścianie (generator). Dług: beton matowy wszędzie, zacieki na ścianach.
- §16 zgodne z ulicą; kontrast z elektroniką Hebi to cel.
- §17 do sprawdzenia: cisza z kapaniem jako dźwięk źródła. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): buczenie skrzynki, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Najczęściej od włazu na T2 (441; 96): Seki schodzi w szybie otwartym do nieba biegiem 17 stopni na zachód i wchodzi przez wschodnią ścianę do sali 14,6 × 13 m pod stropem 2,3 m (podłoga −12,2), przy jej północno-wschodnim narożniku. Przed nią ciepłe, słabe lampy awaryjne, gabloty i ławki z czasów wojny. Po prawej, nad ławką przy północnej ścianie, neon Hebi, a w drugim końcu sali, w północno-zachodnim rogu, skrzynie skrytki za osłoną. W czasie odzyskania stoją między nimi ludzie Hebi plecami do włazu, twarzami na zachód, ku przejściu od bramy. Od bramy w korytarzu P−2 (420,3; 69,8) wchodzi się inaczej: podest, 17 stopni w dół na północ, niskie przejście i południowo-zachodni róg sali, twarzą do ludzi zlecenia.

### Postacie i miejsca
Zlecenie `retrieve` Hany (`hebi_stash`, ADR-0074 etap 5d2, `alchemia/market.ts`, `contract-plans.ts`):
- skrzynka Hany w północno-zachodnim rogu (422; −12,2; 95,6), osłona przed nią (424,6; 92,4), skrzynia na ciało przy wentylatorze na korbę (433,6; 88);
- ludzie Hebi (2–4), twarzami na zachód: przy osłonie (423; 90,6), przy schodach włazu (431,6; 94,2), przy ławce (429,2; 86,2), przy skrytce (426,2; 95,2);
- warianty (ADR-0034): dwóch ochroniarzy przy osłonie (422,4; 89,2), (423,8; 90,4); czujka blokady na T2 przy włazie (444,6; 96,2); zasadzka przy obu wyjściach, w korytarzu P−2 przed bramą (418,6; 66) i na T2 (446; 99,6), (439; 101);
- kamera Hebi wysoko w południowo-wschodnim rogu (434,4; 84,6), patrzy na skrytkę; neon nad ławką przy północnej ścianie (428; 96,7); głośnik przy schodach włazu (433,4; 96,6). Cała sala to strefa zakazana na czas odzyskania;
- czujka Hebi (`hebi-lookout`): od 5:00 przy włazie na T2 (443,4; 98,6), twarzą na południowy zachód; od 22:00 obchodzi P−2 tam i z powrotem, obok bramy;
- trzech Hebi terytorium `alchemia-arcades` pod Arkadami (449,5; 105,9), 10 m od włazu.

### Przebieg
1. Zlecenie u Hany przy wózku na T1: „Hebi zabrali mi skrzynkę z towarem” i „Wróć ze skrzynką. Co zrobisz ze strażnikami, to już twoja sprawa”.
2. Haki: bark z sali (`hook_retrieve_1`): po północy Daisuke idzie do Fumiko na ramen, w grze przerwa 0:00–0:15. Czujka powtarza pod nosem kod bramy (`hook_retrieve_2`): 2207.
3. Podejście włazem: skulona Seki schodzi za plecami załogi i idzie wzdłuż północnej ściany pod neonem do skrzynki. Albo bramą z kodem, wzdłuż zachodniej ściany; z kodem kamera bierze ją za swoją.
4. Decyzja: zabrać skrzynkę cicho albo zdjąć strażników (ciało do skrzyni przy wentylatorze). Wyłamanie panelu bramy podnosi alarm.
5. Ucieczka ze skrzynką i nagroda u Hany: „Jest moja skrzynka. Plomby całe, nawet nie zajrzeli do środka”.

### Drogi
- Cicha od T2: właz, schody, północna ściana. Cicha od P−2: brama z kodem 2207, zachodnia ściana. Obie opisuje ADR-0074 5d2 i test `stealth`.
- Głośna: osłona przed skrytką, słupy, gabloty na ladach i skrzynia przy wentylatorze. Trzy wejścia fali: schody włazu, przejście od bramy i, przy pościgu, P−1 → P−2 → schron.
- Ucieczka: właz na T2 i dalej na T1 schodami albo brama do P−2, korytarzem do parkingu. Pułapka: zasadzka wariantu czeka przy obu wyjściach, a czujka blokady stoi przy samym włazie.
- Ślepy zaułek: róg skrytki ma wyjście tylko przez salę.

### Pora i stan świata
- Pod ziemią bez okien, więc wnętrze jest takie samo o każdej porze. Zmienia się czujka: w dzień pilnuje włazu (droga od bramy łatwiejsza), w nocy chodzi po P−2 obok bramy (droga od włazu łatwiejsza). Przerwa z haka to 0:00–0:15.
- Bez zlecenia brama otwiera się tylko Hebi, a do sali da się wejść włazem; skrzynek Hany i ludzi zlecenia nie ma. Po zleceniu Hebi tracą skrzynkę i rośnie uraza w dzielnicy, gdy zginą członkowie terytorium (ludzie zlecenia urazy nie podnoszą, ADR-0091).
- Odzyskanie Hana daje o każdej porze, ochronę Oyajiego tylko od 8:00 do 22:00.

### Wymagania wobec sceny
- Skrytka czytelna od obu wejść: zimne światło sprzętu Hebi (laptop, radio) w rogu, w kontraście z bursztynem lamp muzeum (§13).
- Ślady butów w kurzu od przejścia do skrytki (są) i druga ścieżka od włazu wzdłuż północnej ściany, którą idzie cicha droga.
- Panel bramy po stronie korytarza P−2 widoczny i w barwie zamka (czerwony bez kodu, zielony z kodem).
- Szyb włazu jako próg: światło nieba nocą i deszcz w szybie, sucho pod płytą schronu (ADR-0074 5d1).

## Dług sceny
- Ink i katalog przeczą grze: Hana w `packages/narrative/ink/{pl,en}/m4-targ.ink` (`offer`, `running`) trzyma skrzynkę „w zagłębieniu przy ruinie za straganami”, a `contract.site.hebi_stash` w `packages/ui/src/i18n/{pl,en}/domain.ts` to „skrytka Hebi przy ruinie za straganami Alchemii”. Od etapu 5d2 skrytka jest w schronie pod T2. Propozycja: „w starym schronie pod placem dolnym, właz przy Arkadach albo brama z P−2” (zmiana polskiego katalogu świadoma).
- Zimne źródło przy sprzęcie Hebi (ekran laptopa) jako akcent 10% (§13, dziś akcenty 0,4%): `packages/sim/src/content/alchemia/shelter-detail.ts`, lampa w `packages/engine/src/renderer/rooms/room-lights.ts`.
- Panel bramy z diodą stanu zamka: `packages/sim/src/content/alchemia/shelter.ts` (`SHELTER_GATE.panel`), rysunek w `tools/blender/rooms/alchemia_shelter.py`.
- Ślady butów od włazu wzdłuż północnej ściany (druga cicha droga): `rd-shelter-prints` w `alchemia_shelter.py`, rozstawienie w `shelter-detail.ts`.

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
