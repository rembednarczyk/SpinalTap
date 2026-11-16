# Audyt miejsca W-3 przed etapem 1 ADR-0082 (wariant A) — szczegóły

Dane: origin/main 6e54043 (data/osm/nabrzeze.json, data/terrain/nabrzeze.{json,bin} = NMT 1 m, nabrzeze.generated.ts, props.generated.ts, data/gugik/lod1), ortofoto z cache /root/.cache/seki-orto (2025-04 HighResolution, 2024-06). Wysokości względem W3_Y = −28,6 (dodatnie = wyżej).

Nakładki (ta sama ramka x 2420..2620, z 370..490, 0,2 m/px):
- topo-w3-orto-2025.png / -raw.png: ortofoto 2025-04, OSM (woda niebieska, most żółty, ścieżki białe, las zielony, rów cyjan, w1354195809 czerwony), prostokąty ADR, drzewa/latarnie/słupki gry.
- topo-w3-orto-2024.png / -raw.png: to samo na ortofoto 2024-06 (liście: zwarty łęg w całej strefie).
- topo-w3-korekty.png: odcień NMT (woda < −1,6, ława −1,6..−0,6, dno doliny ±0,5, skarpa, taras > +1,5), cienkie różowe = ADR, grube = korekty P1–P11.
Liczby: topo-w3-pady.txt (pady wobec NMT), topo-w3-widok.txt (widoki, LoD1). Skrypty: topo_lib.py, topo_gen.py, topo_props.py, topo-overlay*.py, topo-pads.py, topo-view.py, topo-horizon.py.

## Teren (NMT)
- Dno doliny w strefie: −0,3..+0,3 (W3_Y dobrane dobrze). Rów w995914397: w NMT ~1 m głęboki, (2581; 385) → (2562; 480), ujście do koryta przy (2564; 500).
- Taras/nasyp SW: +1,8..+3,3, krawędź (stopa +0,5) (2490; 418) → (2506; 410) → (2518; 401) → (2530; 393) → (2541; 382). Na nim ścieżki w307943890 (czerwony asfalt, lit) i w972606056 (lit, paved), węzeł (2489,2; 405,8) z łącznikiem w1551242473 do końca mostu (2484; 409).
- Woda Bystrzycy: NMT mediana −2,0 (p10 −2,1) przy moście i w zakolu = −30,6 bezwzgl. ADR zakłada −1,3.
- Brzeg wschodni z 380..412: woda kończy się na x 2453..2463, dalej naturalna ława −0,8..−1,3 (x 2456..2466), skarpa 17–25° do tarasu +2 na x 2470..2476.
- Brzeg z 418..439: woda do x 2472,5..2474,5, ława −1,1..−1,5 do x ~2480, potem dno doliny.
- Brzeg skośny: krawędź wody OSM (2472,5; 433,8) → (2499,3; 462,9); ława −0,5..−1,2; ADR (2483; 446) → (2500; 463) leży ~1,5 m w głąb lądu, zgodnie.

## Most inż. Mariana Lutosławskiego w834402001 (w ADR „kładka OSM”)
- Zabytek: żelbetowy most z 1908–1909 (T-023, T-177), dziś pieszo-rowerowy (w58643325, width 9, lit).
- Pokład gry: oś (2439,4; 435,6) → (2484; 409), obrys (2437,1; 431,7) (2481,7; 405,2) (2486,3; 412,9) (2441,7; 439,4). ya −26,74, yb −26,83 (raw), czyli +1,8 nad W3_Y, 3,8 m nad wodą. Spód ~+0,9: nad ławą pod mostem (x 2470..2476, NMT −0,7..−1,4) 1,6–2,3 m prześwitu.
- Przyczółek wschodni na tarasie (NMT +2,1). Pad ADR {x 2479..2486, z 392..452} i blend 6 strefy obniżają teren pod nim o ~2 m przy niezmienionym pokładzie (makeDeck z rawHeight): uskok 1,8 m na końcu mostu, łącznik w1551242473 i węzeł ścieżek pod płotem.
- Krawędź płn. pokładu: z = 439,4 − 0,594·(x − 2441,7): z 425,0 przy x 2466, 417,2 przy x 2479, 414,1 przy x 2484.

## Korekty prostokątów
P1. Płot i strefa przy ścieżce: W3_ZONE zawiera węzeł (2489,2; 405,8), ~24 m ścieżki w972606056 i słupek (2486,6; 410,9). Hala (2500; 396) wchodzi 2 m za oś ścieżki. Płot ma iść 3 m na NE od osi: (2487,6; 413) → (2503; 400,2) → (2515; 392), dalej z 392. Hala ze ściętym narożnikiem SW (2500; 402,2)–(2509; 396), ściana = płot, albo hala +10 m na wschód (x 2510..2582).
P2. PADS: bez padu na pasie publicznym z 380..392. ADR obniża go nawet o 3,2 m (870 m² ponad 1 m), w tym metro A (2527; 388) o 1,6 m i latarnię (2512,3; 391,1). Pad strefy w obrysie P1, blend ≤ 1 od strony tarasu z murem oporowym 1,8–2,0 m pod płotem, blend do 6 tylko na E i N. Po korekcie obniżenie maks. −2,2, |Δ| > 1 m na 486 m² (ADR: 1646 + 244), 0 m² w wodzie OSM (ADR: ok. 200 m²).
P3. Pas nabrzeża x 2479..2486: z 418,5..440 zamiast 414..452. Dziś nachodzi na pokład (trójkąt x 2479..2484, z 414..417,2) i na 51 m² koryta (z > 440,9..448,5). Pad z blendem ≤ 1.
P4. Ściana nabrzeża x 2477..2479 tylko na z 418,5..438,5, od ławy (−1,1..−1,5) do 0, czyli ok. 1,3 m, a nie od −3,2. Na z 380..412 nie ma nabrzeża: tam jest taras +1,5..+3,3, a woda leży 15–20 m na zachód.
P5. Półka x 2475,6..2477, z 380..412 na −1,0 to rów 2,5–4,1 m w tarasie. Zamiast niej naturalna ława x 2457..2466, z 384..412 (NMT −0,8..−1,3, 0,7–1,2 m nad wodą), bez padu. Zejście z w307943890 skarpą przy z 384..392.
P6. Kolektor x 2466..2514, z 399,5..401,5 (48 m) z wylotem u stopy skarpy (2466; 400,5): ława −1,1, podłoga −1,6, czyli 0,4 m nad wodą. Pod koroną tarasu 2,2 m przykrycia, pod ścieżką w972606056 przy x ≈ 2498. Jeśli 48 m kucania to za dużo: otwarty wylot x 2466..2472 i 42 m kanału. Fabularnie kolektor to skanalizowany rów w995914397.
P7. Pomost: z 426..438 zamiast 424..436, bo róg SW wchodzi w pokład (x 2466..2467,6). Most w grze nie ma balustrad (T-023), więc z pokładu (+1,8) da się zeskoczyć na pomost lub pas nabrzeża. Potrzebny płot ≥ 2,7 m nad pokładem (do +4,5) wzdłuż płn. krawędzi pokładu x 2466..2486 albo balustrada mostu z 1908 r. i płot strefy.
P8. Rurociąg x 2442..2486, z 442..444: bez zmian. Leży 2,6 m od pokładu, 8,2 m nad nim. Kozioł 2444 stoi na brzegu zach. (+1,6, 2,7 m od w291214372), 2465 w wodzie, 2484 na lądzie 3 m od wody.
P9. Woda na −2,0 (−30,6), nie −1,3, bo inaczej będzie 0,7 m uskoku wobec drapowanej rzeki. Basen x 2520..2592 styka się z korytem tylko na 8 m (x 2520..2528, brzeg z 474,8..478,2). Proponuję x 2508..2592 z ujściem ~20 m wzdłuż brzegu (2508; 468) → (2528; 478). Pad −3 nie może wchodzić w wielokąt wody poza ujściem. Test: lustro basenu = NMT wody przy (2518; 474) ±0,1.
P10. Wieża: z 436..446 zamiast 438..448, bo róg NW jest 0,5 m od wody (2486; 448,5). Rurociąg dalej trafia w wieżę. Północna krawędź strefy dla x 2486..2493 na z 446, bo 6 m² koryta leży w strefie.
P11. Brzeg skośny: skarpa z płotem (uzasadnienie niżej).
P12. CLEARED_BUILDINGS pasa publicznego tylko x 2586..2606, z 380..395 (w1354195809). Pełny pas zdejmuje 13 drzew i latarnię przy oświetlonej ścieżce. CROWN_CLEARED (crown-grid.ts) i FILL_CLEARED (bare-cover.ts) w tools/osm-import powielają prostokąty, więc trzeba je zmienić razem i przegenerować props: zniknie 31 + 1 drzew w strefie.
P13. Opis ADR „reszta to trawa i ścieżki” jest nieprawdziwy. Strefa to łęg (natural=wood w230881219, ortofoto 2024-06 zwarte korony nad całą strefą i nad wschodnią połową mostu). Wycięcie jest celowe (T-002), ale drzewa na ławie, skarpie i pasie publicznym zostają.

## Brzeg skośny przy wieży: rekomendacja
Skarpa z płotem 2,7 m:
- w Lublinie ten odcinek ma brzeg ziemny, zadrzewiony: krawędź lasu OSM to krawędź wody, a ławę −0,5..−1,2 widać w NMT;
- pad z krawędzią ≥ 3 m od wody i blendem 3 m daje skarpę ~1:1,5 bez dotykania koryta;
- trzy bryły schodkowe w rzucie wzdłuż linii pod 45° wystają do 2,8 m w wodę albo zostawiają dziury, a każda krawędź bryły nad wodą to ryzyko „woda pod płytą” (Ryzyka ADR);
- schodkowe nabrzeże nie ma tu pierwowzoru.

## Widoki (LoD1 GUGiK 2024 jako przesłony, bez drzew)
Oko V1 na pokładzie (2462; 421) 170,6 m n.p.m.; V2 na pomoście (2470; 430) 168,8 m.
- Zamek/Donżon: 1,58 km, az 263°, szczyty 1,14°/1,52°. Horyzont zabudowy: 0,96–1,08° (zabudowa 10 m w 820 m) dla Zamku; dla Donżonu z V1 2,40° (zabudowa 11 m w 340 m). Z V1 Donżon jest zasłonięty, a Zamek wystaje o ~0,2°. Z V2 widać górę Zamku i Donżonu.
- Kaplica 1,54 km, az 262°.
- Katedra 1,93 km, az 252°, szczyt 1,33°, horyzont 2,0–2,5°: zasłonięta.
- Wieża Trynitarska 1,96 km, az 253°, szczyt 1,94°, horyzont 2,07–2,19°: zasłonięta.
- Brama Krakowska 2,05 km, az 256°, szczyt 1,00°, horyzont 1,87–2,03°: zasłonięta.
- Przesłony: zabudowa 8–12 m w 340–430 m (x 2040..2140, z 285..370). W grze to luka T-022 (x 1120..2300), więc widok byłby otwarty.
- Mgła 0,0115: e^(−0,0115·1580) ≈ 10⁻⁸, więc w nocy sylwetki i tak znikają.
- Rekomendacja: sylwetki tylko grupy zamkowej (Zamek, Donżon, Kaplica) w prawdziwym azymucie 262–263° i rozmiarze kątowym 1,1–1,6° nad okiem, z pasem niskiej zabudowy przed nimi. Stare Miasto (Katedra, Trynitarska, Brama) tylko jako licencja z wpisem T, jeśli użytkownik chce kompozycji z grafiki 01.
- Z V1 punkt perf ADR patrzy na wschód (brama), panorama jest za plecami. Z V2 kierunek „zachód i SW” trzeba zawęzić do 252–263°.

## Latarnie w rzece (znalezisko poboczne)
Trzy lamp-park w wielokącie wody w949475137 na terenie koryta (y −30,46/−30,59): (2441,0; 344,7), (2444,1; 374,5), (2450,1; 404,1), ok. 20 m od najbliższej drogi.

## Kontrole skanu (propozycje)
- `pad-in-water`: m² PADS (prostokąt z blendem) w wielokątach natural=water z OSM, poza listą ujść. Baza main: 43 m² w siatce (basen T-002). Po W-3 tylko ujście basenu.
- `prop-in-water`: mebel w wielokącie wody na wysokości terenu (y < teren + 0,5, bez pomostów). Baza main (Nabrzeże): 3. Pozostałe dzielnice nie były liczone.
- `path-cut-by-cleared`: odcinek highway z OSM przecięty przez CLEARED albo płot strefy bez furtki. Baza main: 1 (w609533494 pod basenem, T-002 celowe). Wariant A w obecnym kształcie dodaje w972606056 i łącznik w1551242473.
- `deck-end-pad`: pad zmieniający teren o ponad 0,3 m w promieniu 3 m od końca osi pomostu. Baza main nieliczona. Wariant A w obecnym kształcie: przyczółek wschodni mostu Lutosławskiego.
