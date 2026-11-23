# Plac T2 i Arkady Alchemii (`alchemia-t2-arkady`)

Dolny plac Alchemii na −9,2, na dnie dawnej niecki między Świętoduską a odbudowanymi Arkadami (ADR-0074 etap 2, T-217…T-219). Stoi tu kamień pamięci z nazwą Placu Ofiar Getta, czujka Hebi przy włazie schronu (etap 5d2), grupa terytorium `alchemia-arcades` (ADR-0091) i torba z nocy blokady `stash:targ-overpass` (ADR-0026).

## Historia
Lubartowska była główną ulicą żydowskiej dzielnicy Lublina. W 1941 roku Niemcy utworzyli w tej części miasta getto, a wiosną 1942 roku wywieźli większość jego mieszkańców do obozu zagłady w Bełżcu. Plac przy Lubartowskiej nosi dziś nazwę Placu Ofiar Getta, a w chodnikach okolicy leżą kamienie pamięci Stolpersteine (w danych mapy węzły `memorial=stolperstein`). Oficyna Świętoduska 7 (w66286396), z rytmem przęseł od zachodu, mieściła dawne jatki rzeźnicze, w latach 60. kawiarnię „Pod Arkadami”, potem restaurację, a w końcu stała jako ruina za płotem. Plan inwestora z 2026 roku odbudowuje ją z piętrem „według materiałów międzywojennych”, z wejściem od Lubartowskiej, a w wykopach pod parking archeolodzy znaleźli osadę piastowską, schron z czasów wojny i dawny wąwóz (`docs/plany/alchemia.md`, S5, S6, S13).

W grze Arkady stoją odbudowane na obrysie OSM, z trzema restauracjami za podcieniem (polska, włoska, winiarnia). Zanim plac wyrównano, w niecce przy ruinie Hebi trzymali skrytkę (T-186). W noc blokady (ADR-0026) ktoś zostawił przy ruinie torbę i już po nią nie wrócił. Sachiko mówi o niej każdemu, kto zapyta. Hebi przenieśli skrytkę do schronu pod placem, a ich czujka pilnuje włazu i schodów z T1. Trzech chłopaków Hebi stoi przed łukami i pali, bo stąd widać cały plac (terytorium ADR-0091). Kamień pamięci stoi na zachodniej krawędzi placu w zieleni. Miasto 2077 trzyma neon z dala od niego: żaden szyld ani hologram nie świeci bliżej niż 20 m (ADR-0074 §6, `remembrance.ts`).

Przed chwilą (cel sceny, §5): ktoś położył na kamieniu mały kamyk i zapalił znicz. Czujka zgasił papierosa o balustradę włazu i niedopałek jeszcze się tli.

## Klimat
- **Światło:** ciepłe witryny trzech restauracji za podcieniem (każda w barwie kuchni), lampa nad posterunkiem czujki przy włazie (#ffcf8a, `market.ts`), z góry poświata szkła galerii i lampa wózka Hany na T1. Kamień stoi w półmroku, oświetlony tylko odbitym światłem placu i zniczem (docelowo). Neonu przy kamieniu nie ma z zasady.
- **Dźwięk:** sztućce i rozmowy z restauracji pod podcieniem, kroki na schodach z T1, rozmowy Hebi, ruch Świętoduskiej. W grze plac nie ma własnych źródeł dźwięku (dług).
- **Zapach:** pizza i wino z Arkad, wilgotna ziemia kwietników, dym papierosów Hebi.
- **Kontrast (§3):** odnowione podcienie z restauracjami i chłopcy Hebi pod nimi, a pod placem schron z 1938 roku z elektroniką gangu (`alchemia-shelter`).
- **Ruch i życie:** grupa Hebi pali, telefonuje i rozmawia na zmianę (`territory-groups.ts`), przechodnie przy schodach i na zachodzie placu (433; 107), (436; 106), (440,4; 84,4), czujka na posterunku.

## Przeznaczenie
- **Miejsce pamięci:** kamień z nazwą placu (428,7–430,3; 112,0–112,4) w kwietniku. Przy nim nie ma miejsc zleceń ani spawnów napadu: najbliższe leżą ponad 10 m od niego (ADR-0074 §6, test).
- **Podejście do skrytki Hebi** (zlecenie `retrieve` Hany): właz schronu (441; 96) obok czujki, druga droga to brama schronu w korytarzu P−2 (wejście przez wykop P−2 na zachodzie placu, x 414,4–420,4, z 77–97, T-326).
- **Znalezisko:** torba `stash:targ-overpass` (120 €$, 18 naboi 9 mm, 2 bandaże, chip z danymi) przed łukiem dziewiątego przęsła, 1,2 m od zachodniej ściany, w (452,78; −9,0; 111,82). Trop daje Sachiko (`sachiko_car`).
- **Terytorium Hebi** (`alchemia-arcades`): trzech członków w kręgu 1,4 m wokół (449,5; 105,9), neutralni, dopóki gracz ich nie sprowokuje (ADR-0091).
- **Wejścia:** schody z T1 (x 426–436, z 77,5–92,5), wykop P−2 od zachodu, Świętoduska od północy i zachodu (zachodnia połowa działki zostaje na NMT i opada do ulicy), drzwi piętra Arkad na chodnik Lubartowskiej (od wschodu, przez budynek nie da się przejść).
- **Osłony:** filary podcienia (13 × 0,55 m), kwietniki-siedziska (424,6–429; 93–98) i (432,5–436; 117–120,5), siedziska wzdłuż schodów, balustrada włazu.
- **Punkt widokowy:** z krawędzi T1 nad schodami widać cały plac, czujkę i grupę Hebi.

## Topografia
- Prawdziwe miejsce: Plac Ofiar Getta przy Lubartowskiej, oficyna Świętoduska 7 (w66286396), działka w1559354343 na stanowisku archeologicznym w1559354344.
- W grze: plac T2 na −9,2 (dno niecki, NMT w (442; 93)), dziesięć pasów po 4 m (z 88–128) od x 424…440 do linii 1,2 m w głąb Arkad, ścięcie do 4,12 m, dosypka do 1,1 m (T-217). Arkady na obrysie OSM 49,7 × 5,8 m, 13 filarów z ortofoto, 14 przęseł, podcień 2,4 m, łuki 2,7 m, piętro na −5,6 na poziomie chodnika Lubartowskiej (T-218). Schody z T1 na wierszach siatki 2,5 m, 15 m, 18,7% (T-219). Właz i schron pod placem (T-328).
- Odstępstwa celowe: wyrównany plac i odbudowane Arkady z planu inwestora (T-217, T-218), zniknięcie niecki Hebi (T-186) i ruiny (T-188 poprawione).

## Inwentarz docelowy
- **Architektura:** podcień Arkad z ceglanymi filarami i łukami (jest), piętro z oknami i attyką (jest), schody z siedziskami (są), kwietniki (są), balustrada i szyb włazu schronu (są), zarys osady z ekspozycji archeologicznej w posadzce placu (z tabeli T2 w ADR-0074, nie ma), kratki odpływu i studzienki w kostce.
- **Duże obiekty:** kamień pamięci w kwietniku (jest jako ciemny blok bez napisu, docelowo kamień z wykutą nazwą placu); stoliki restauracji przed witrynami w przęsłach, poza drogą pod łukami (`cafe-garden`, model gry); ławki przy zachodniej krawędzi (`bench`); skuter Hebi przy filarze (pojazd z `vehicle-props`).
- **Drobiazg w skupiskach (§14):**
  - kamień pamięci: kamyki na jego wierzchu, znicz, wstęga przy kwietniku (bez światła poza płomieniem znicza);
  - posterunek czujki: skrzynka po napojach jako siedzisko, niedopałki na kratce włazu, puszka, radio;
  - grupa Hebi: niedopałki, butelki na murku kwietnika, wąż Hebi sprayem na bocznej ścianie pierwszego przęsła (`graffiti`, bez światła, ponad 20 m od kamienia);
  - torba z blokady: torba Hebi zamiast ogólnego pojemnika, przy niej rozmokła ulotka.
  Źródło: Street Asset Pack (ADR-0096), modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: ulica (Hebi pod Arkadami); druga: pamięć miejsca (kamień Placu Ofiar Getta, ADR-0074 §6).
- §12 zgodne: schody z T1 (10 m szerokości, z siedziskami po bokach) to zejście w dół, po którym plac otwiera się szeroko pod łukami Arkad. Podcień (2,4 m głębokości, 2,7 m do łuków) jest ciasnym progiem do restauracji. Wymiary placu idą po siatce terenu 2,5 m, filary po ortofoto (§1).
- §13 dług: brak pomiaru 60-30-10 nocą. Światło motywowane dają witryny Arkad i lampa czujki. Akcentów przy kamieniu ma nie być (zasada), a reszta placu też ich nie ma: neon Hebi wisi w schronie pod placem.
- §14 dług: poza architekturą plac ma kamień i dwa kwietniki. Brak mezo i mikro, brak skupisk przy czujce i przy grupie Hebi.
- §15 dług: kostka i ceglane filary matowe, brak kałuż po deszczu i połysku witryn na posadzce.
- §16 zgodne: ulica pod odnowionym zabytkiem, a pamięć wyłączona z neonu ulicy.
- §17 dług: brak źródeł dźwięku (restauracje, radio czujki). Skalę dają łuki 2,7 m, siedziska i balustrada 1 m. Ruch: grupa Hebi i przechodnie.

## Scenariusz

### Pierwszy kadr
Seki schodzi z T1 schodami na południowym skraju placu (ujęcie `alchemia-t2-tpp`). Na wprost i w prawo ciągną się łuki Arkad z ciepłymi witrynami. Pod nimi, przy dziewiątym przęśle, stoją trzej chłopcy Hebi. Bliżej, na prawo od stóp schodów, przy balustradzie włazu, stoi czujka z lampą nad głową i patrzy prosto na schody. Na lewo, na zachodniej krawędzi placu, w zieleni stoi ciemny kamień bez światła. Wzrok najpierw łapie lampa czujki i witryny (światło motywowane), a ciemność kamienia jest celowa.

### Postacie i miejsca
- **Czujka Hebi** (`hebi-lookout`, ganger): posterunek (443,4; −9,2; 98,6) na północny wschód od włazu (441; 96), twarzą na południowy zachód, na schody z T1 i właz. Od 5:00 na posterunku (pilnuje i pali), od 22:00 obchód: na zachód wzdłuż T2 przez (430; 99,8) i (417,4; 99,8), wykopem do korytarza P−2, obok bramy schronu do rogu magazynu i z powrotem (`schedules.ts`).
- **Grupa Hebi** (`hebi-alchemia-arcades-1..3`): krąg 1,4 m wokół (449,5; 105,9), twarzami do środka, papieros, telefon i rozmowa na zmianę.
- **Torba z blokady:** (452,78; −9,0; 111,82), 6,7 m od grupy.
- **Kamień pamięci:** (428,7–430,3; 112,0–112,4), do 1,6 m nad placem. Czujka stoi ok. 19,5 m od niego, grupa ok. 21 m.
- **Tło:** przechodnie (433; 107), (436; 106), (440,4; 84,4).

### Przebieg
1. **Zejście:** czujka widzi schody z T1. Przy wrogich albo sprowokowanych Hebi plac staje się polem walki, przy neutralnych grupa tylko ostrzega, gdy gracz wyjmie broń (ADR-0091).
2. **Torba:** trop od Sachiko („Za ruiną na końcu placu leży torba”). Torba leży przed łukiem, kilka metrów od grupy Hebi. Napięcie: wziąć ją na ich oczach albo wrócić, gdy grupa patrzy w telefony.
3. **Zlecenie `retrieve`:** droga do skrzynki Hany przez właz, obok czujki, albo dookoła przez wykop P−2 do bramy schronu. Haki: o północy Daisuke idzie do Fumiko na ramen (`hook_retrieve_1`), kod bramy schronu 2207 (`hook_retrieve_2`).
4. **Pamięć:** kamień nie ma interakcji ani zadania. To miejsce zatrzymania przed zejściem pod ziemię: cisza, znicz, nazwa placu.
5. **Po zleceniu:** skrzynka wraca do Hany na T1. Ciała Hebi ze schronu nie wychodzą na plac.

### Drogi
- **Cicha:** od zachodu, z Świętoduskiej albo z wykopu P−2, za plecami czujki, która patrzy na schody. Albo noc: po 22:00 czujka schodzi do P−2, a właz zostaje bez straży, za to obchód mija bramę schronu.
- **Głośna:** walka z czujką i grupą pod łukami. Osłony to filary i kwietniki. Strzały słychać w restauracjach i na T1 (heat).
- **Ucieczka:** schody na T1, Świętoduska na północ i zachód, wykop P−2 w dół.
- **Pułapki:** schody z T1 to linia wzroku czujki. Kwietnik z kamieniem nie jest osłoną do walki: spawny i miejsca zleceń trzymają się ponad 10 m od niego.

### Pora i stan świata
- Dzień: czujka przy włazie, restauracje otwarte, przechodnie. Noc od 22:00: czujka w P−2, plac tylko z grupą Hebi i witrynami.
- Grupa Hebi stoi stale. Jej uraza i prowokacja są wspólne dla dzielnicy `shinsekai-7` (od myjni M0 po Kapucyńską). Po wyczyszczeniu grupa wraca według reguł ADR-0091. Pasmo targu 10–20 (`alchemia-market`).
- Torba znika na zawsze po zabraniu. Przed etapem 2 leżała za ruiną, migracja przeniosła ją przed łuk (`persistence/src/alchemia-rebuild.ts`).

### Wymagania wobec sceny
- Kamień z wykutą nazwą placu, bez neonu, bez reklam, bez miejsc zleceń w 10 m i świecących znaków w 20 m (kontrola `memorial-neon-clear`, baza 0).
- Linia wzroku czujki na schody i właz bez przeszkód. Droga od zachodu za jego plecami z osłonami.
- Torba w zasięgu wzroku grupy Hebi i jako model torby.
- Światło: witryny Arkad i lampa czujki jako światło motywowane; znicz jako jedyne światło przy kamieniu.
- Dźwięk: restauracje pod podcieniem, radio czujki.
- Teksty Sachiko i Hany mają mówić o Arkadach i schronie, a nie o ruinie.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/alchemia/t2-dress.ts`, `tools/blender/rooms/alchemia_t2.py`, test `packages/sim/test/alchemia-t2-scene.test.ts`): wykuta nazwa placu na licu kamienia (czcionka 5×7, twarzą do schodów z T1), kamyki, znicz palący się i zgaszony, wstęga; zarys osady w posadzce; skrzynka z radiem i niedopałki przy czujce; śmieci w kręgu grupy Hebi. Torba łupu jako model torby przychodzi z #960, tekst Sachiko poprawiony w #955. Zostaje:
- Skupisko graffiti: wąż Hebi sprayem na bocznej ścianie pierwszego przęsła (model `rd-pav-hebi` z #960).
- Napis na kamieniu (nazwa placu jako nazwa własna w języku świata, §9) i kamień w prawdziwym kształcie zamiast ciemnego bloku: `packages/engine/src/renderer/alchemia/plaza-geometry.ts` (rysunek), bryła bez zmian w `packages/sim/src/content/alchemia/plaza.ts`.
- Stoliki restauracji przed witrynami, poza drogą pod łukami: meble w treści Arkad (`packages/sim/src/content/alchemia/arkady.ts`), z wolnym grafem podcienia.
- Kałuże po deszczu na kostce placu: `plaza-geometry.ts`.
- Dźwięk restauracji i radia czujki: emitery w `packages/engine/src/audio/`.
- Komentarz terytorium w `packages/core/src/world/territories.ts` („Under Alchemia's arcades, by today's lookout”): grupa stoi 2,3 m przed zachodnią ścianą Arkad, a czujka od etapu 5d2 stoi przy włazie, ok. 10 m dalej. Opis ADR-0074 etapu 2 („czujka w dzień pod łukami dziewiątego przęsła”) jest nieaktualny wobec etapu 5d2.
- Pomiar §13: ujęcie `alchemia-t2-tpp` nocą w `tools/shots/room-spots.json`.
