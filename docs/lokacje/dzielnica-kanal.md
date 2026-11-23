# Stare Miasto (Kanał) (`dzielnica-kanal`)

Dzielnica `kanal` (`DISTRICTS` w `world-map.ts`: „Stare Miasto”): cztery chunki `stare-miasto-0-0`…`stare-miasto-1-1`, x 460..760, z −240..160, i chunk Trasy Podziemnej pod Rynkiem. Od Bramy Krakowskiej na zachodzie (granica z Krakowskim na x = 460) przez Rynek z Trybunałem po Bramę Grodzką i Plac po Farze na wschodzie, od Placu Katedralnego i Podwala na południu po Lubartowską, Rybną i Kowalską na północy (z 160, za nią Podzamcze). Teren Hebi: patrole Rynku, handel pod kładką nad Grodzką, ogródek w Zaułku Panasa (ADR-0048, ADR-0091). Stan gry na `22b1808`.

## Historia
Stare Miasto to Lublin lokowany w 1317 roku na wzgórzu nad Czechówką i Bystrzycą, otoczony murami z bramami Krakowską i Grodzką. Pośrodku Rynek z Trybunałem Koronnym, od 1578 roku najwyższym sądem szlachty Małopolski; na południu dawny kościół jezuitów, dziś Archikatedra, z Wieżą Trynitarską; na wschodzie Dominikanie i Plac po Farze, gdzie stała fara św. Michała. Pod kamienicami biegną piwnice, przez które prowadzi dziś Trasa Podziemna, a Czechówka płynie w rurach pod ulicami. Brama Grodzka, dawniej przejście do żydowskiego miasta pod Zamkiem, jest dziś ośrodkiem Teatr NN.

W 2077 dzielnica nosiła nazwę Ulica Kanałowa (`docs/narrative/lublin-names.md`, stąd id `kanal` i turkus „starego kanału” w palecie). To ulica Hebi: za dnia jeden ich człowiek okrąża Trybunał, a od 21:00 do 5:00 chodzą wszyscy czterej (`KANAL_NIGHT` w `kanal-patrols.ts`). Mieszkają i piją tu ludzie aktu M4: Hideo pod SAKE, Mei w KARAOKE, Tetsu w DENKI (karta `rynek`). Przez bramy i Grodzką idzie droga aktu III na Zamek. Tetsu: „Za dnia nic, tylko wycieczki do Archikatedry. Stare Miasto budzi się dopiero po zmroku, jak Mei zapali KARAOKE” (`m4-ulica.ink`).

## Klimat
- Światło: oszczędna warstwa 2077 Starego Miasta (ADR-0058): 171 latarenek ściennych na wysięgnikach, 43 pastorały, 12 parkowych, 8 reflektorów iluminacji (Brama Krakowska, Wieża Trynitarska, Archikatedra). 7 świateł gry: neony SAKE (#ffb000), KARAOKE (#ff2e88), DENKI (#00e5ff), TRASA PODZIEMNA (#ffcf8a) i lampy przy Bramowej (552; −48, zimna), Grodzkiej (598; −28) i pod kładką (652; 70), obie ciepłe. 77 lokali z szyldami. Paleta dzielnicy (`district-palette.ts`): turkusowa mgła, zimny cyjanowy kontur (#7fe6ff), mokry beton.
- Dźwięk: radio z drzwi SAKE i KARAOKE (Yoru FM) i DENKI (Tessen FM), śpiew Mei nocą, kroki patroli na kocich łbach, dzwony katedry (bez źródła w grze). Neony Starego Miasta nie brzęczą (emitery tylko z `DISTRICT_M0_PROPS`).
- Zapach: sake i szaszłyki z ogródków, mokry kamień, piwnice, kadzidło spod katedry.
- Kontrast: renesansowe attyki i kute szyldy z holo-tarczami; turyści z przewodnikiem AR i chłopak Hebi z tabletem długów w tej samej bramie.
- Ruch: tłum (chunki `stare-miasto-0-0` i `0-1` profil `evening`, `1-0` i `1-1` profil `street` 0,8), patrole Hebi, Hideo, Mei i Tetsu z planami dnia, 24 postacie z mebli.

## Przeznaczenie
- Akt M4 (rozmowy na Rynku, tropy do Hebi i torby pod Bramą), zlecenie Kaito pod kładką (`kanal_bridge`), Trasa Podziemna z kryjówką (`stash:trasa-podziemna`), skrytka pod Bramą Krakowską (`stash:kanal-alley`, (459,5; −99), tuż za granicą w chunku Krakowskiego), droga aktu III do Bramy Grodzkiej i Zamku.
- Terytoria Hebi: `rynek` (4 patrole), `grodzka-bridge` (650; 70, 3 członków), `panasa-lane` (715; 100, 2 członków).
- Metro: stacja Brama Krakowska (`kanal`) ma oba wejścia za granicą dzielnicy, na Placu Łokietka (433; −107) i przy Alchemii (428; 28).
- Pasmo trudności (`district-bands.ts`): 5–14; gracz wychodzi stąd na ok. 16. poziomie.
- Przestępstwa w toku: 7 miejsc (`MICRO_SPOTS` `kanal`), m.in. Bramowa (528; −58), Grodzka przy Ku Farze (623; 32), plac na wschód od Trybunału (640; −10), Podwale (744; 48), Kowalska (594; 144).
- Kryjówka na ciała: jedna, skrzynia pod kładką (655,5; 76,5).
- Główne osie: Bramowa z Bramy Krakowskiej na Rynek, Grodzka z Rynku do Bramy Grodzkiej, Królewska i Jezuicka na Plac Katedralny, Podwale pod murami dookoła wzgórza, Lubartowska na północnym skraju.

## Topografia
- Prawdziwe miejsce: Stare Miasto w Lublinie w obrysie murów i podnóże wzgórza. Teren z NMT ok. 173,1–198,1 m n.p.m. (y −22,7..2,3): Rynek i Plac Katedralny na grzbiecie ok. 195–197 m, skarpy opadają ku Podzamczu na północny wschód.
- Zgodne: 204 budynki, układ uliczek z kocich łbów (OSM `surface=sett`), bramy z przejazdami (`GATE_PASSAGES`), Trybunał, Wieża Trynitarska i Archikatedra w wysokościach z OSM (T-006, T-009).
- Odstępstwa (wybór): wykop Trasy Podziemnej pod Trybunałem (T-004); kryta kładka nad Grodzką z treści gry (ADR-0048, karta `grodzka-kladka`); Trybunał niższy od kamienic (T-254) i bez przepisu zabytku (G-119); fundamenty fary bez lic (T-015, G-053); przejście pod Wieżą Trynitarską poza osią (T-264, G-683); mur i chodnik Podwala przesunięte (T-259, G-649).

## Inwentarz docelowy
Architektura:
- kamienice z attykami i polichromiami, bramy, mury miejskie, schody i mury oporowe skarp (mapa, bariery ADR-0077);
- Trasa Podziemna w piwnicach (`docs/pomieszczenia/trasa-podziemna.md`), kapsuła na Jezuickiej (`docs/pomieszczenia/capsule.md`);
- kryta kładka nad Grodzką (treść gry, `KANAL_SCENERY`).
Duże obiekty:
- ogródki, stragany, ławki, potykacze, kute szyldy (meble uliczne, ADR-0048);
- stolik Tetsu, automat przy DENKI, budka skanera Hebi pod Bramą (treść gry i do zrobienia, karty `rynek`, `brama-krakowska`);
- iluminacja zabytków (reflektory `floodlight`).
Drobiazg w skupiskach:
- przy lokalach Rynku i pod kładką: kieliszki, niedopałki, kwiaty Takumiego, kable Tetsu, chipy (Blender, karty `rynek`, `grodzka-kladka`);
- 78 rzeczy `clutter` na ulicach, tagi Hebi (dziś 0 graffiti w całej dzielnicy, T-123).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: najmocniejsza sekwencja w mieście: przejazd Bramy Krakowskiej (3,6 m), kręta Bramowa, Rynek 62 × 72 m, potem Grodzka w dół pod kładką i przez Bramę Grodzką na otwarty Plac Zamkowy.
- §13 częściowo: latarenki i neony mają źródła, barwy niosą znaczenie (ciepły handel, cyjan techniki u Tetsu). Nawigacja: Trasa Podziemna ma ciepły neon, ale wyjścia na Grodzką, Podwale i schody Zaułka Panasa nie mają światła drogi. 60-30-10 niemierzone; punkt pomiaru: scena budżetu `rynek-tpp` (520; −63, Bramową na Rynek).
- §14 częściowo: makro i mezo z mebli i treści, mikro 78 rzeczy `clutter` i 21 `room-detail` (Trasa); skupisk przy lokalach brak.
- §15 zgodne: mokre kocie łby z odbiciami neonów, szkło witryn, kamień murów.
- §16 zgodne: ulica w zabytkowej oprawie; brak graffiti (T-123: 0 w dzielnicy) jest jedynym odstępstwem od brudu ulicy, uzasadnionym ochroną zabytku.
- §17 częściowo: radia w drzwiach trzech lokali; brak brzęczenia neonów, dzwonów i warsztatu. Ruch: patrole, tłum, NPC z planami.

## Spotkania
- `kanal_flowers`: pod KARAOKE przy Rynku (551; −45), 20:00–3:00, Takumi (`enc_kanal_flowers`). Chłopak trzyma bukiet plastikowych kwiatów, które ktoś starannie podlewa, i od trzydziestu nocy nie umie wejść do Mei. Seki może go namówić, żeby wszedł (wtedy Mei bierze kwiaty, „ładniejsze od prawdziwych, bo nie więdną”), zanieść bukiet sama albo kazać mu dać sobie spokój.
- `kanal_fisherman`: Bramowa przy kratce ściekowej (510; −68), 4:00–9:00, Sabu (`enc_kanal_fisherman`). Staruszek na skrzynce trzyma wędkę spuszczoną w kratkę, bo pod Starym Miastem dalej płynie Czechówka w rurach. Razem z Seki wyciąga mokrą torbę Hebi z dwoma datachipami i gotówką, którą można zabrać albo wrzucić z powrotem do wody.
- `kanal_vending`: przy DENKI na rogu Rynku (590; −10), 10:00–22:00, automat bez postaci (`enc_kanal_vending`). Automat z napojami mruga diodą i prosi o ewakuację, bo rano przyjeżdża ciężarówka z kasacji, a on ma „czterdzieści dwa smaki i jedną świadomość”. Seki może zmienić w jego panelu „złom” na „serwis” i dostać prawie wszystko za darmo albo przyjąć ostatnią zieloną herbatę.
- `kanal_recruit`: pod kładką nad Grodzką (652; 64), 16:00–23:00, Koji (`enc_kanal_recruit`). Chłopak w za dużej kurtce Hebi zastępuje drogę i łamiącym się głosem żąda portfela, „proszę”. Seki może go nauczyć grozić („Ciebie nie ruszymy”) albo odesłać do mamy, która robi lepszy ramen niż Fumiko.

## Scenariusz tła
- Kto tu bywa: wycieczki do Archikatedry i Trybunału za dnia; po zmroku goście SAKE, KARAOKE i DENKI z ludźmi aktu M4 (Hideo, Mei, Tetsu); czterej Hebi z Rynku, trzej spod kładki na Grodzkiej i dwóch z Zaułka Panasa; postacie spotkań: Takumi z bukietem pod KARAOKE, Sabu z wędką w kratce na Bramowej, Koji pod kładką i automat przy DENKI.
- Co się dzieje: za dnia jeden Hebi okrąża Trybunał, a przewodnicy prowadzą grupy („za dnia nic, tylko wycieczki”); o świcie Sabu łowi w Czechówce pod kratką; po zmroku Mei zapala KARAOKE, Takumi stoi pod wejściem, a od 21:00 do 5:00 chodzą wszyscy czterej Hebi.
- Ślad obecności: plastikowe kwiaty pod KARAOKE, skrzynka Sabu przy kratce ściekowej, mrugający automat przy DENKI, kufle na murkach Placu po Farze.

## Dług sceny
- Graffiti i tagi Hebi na Starym Mieście (dziś 0, T-123): kilka tagów tylko w bramach i pod kładką, poza fasadami zabytków (§16 ulicy przy ochronie zabytku): decale ADR-0058 w `tools/osm-import` albo `packages/sim/src/content/district-kanal.ts`, przegląd `topography-curator`.
- Światło drogi przy wyjściach z Rynku i zejściach ze skarpy (Grodzka, Zaułek Panasa, schody Podwala): lampy gry na końcu `KANAL_PROPS` w `packages/sim/src/content/district-kanal.ts`.
- Emitery brzęczenia neonów Rynku i dzwonów katedry: `packages/engine/src/audio/spatial.ts` (`neonEmitters` czyta dziś tylko `DISTRICT_M0_PROPS`).
- Komentarz palety (`district-palette.ts`: „Ulica Kanałowa: the old teal of the canal”) sprzed przenosin; turkus pasuje do Czechówki w rurach, opis do poprawy.
- Karty lokacji dzielnicy: `rynek`, `brama-krakowska`, `grodzka-kladka`, `plac-po-farze`, `plac-katedralny`, `zaulek-panasa`; wnętrza: `trasa-podziemna`, `capsule`. Dług każdej z nich jest w jej karcie.
