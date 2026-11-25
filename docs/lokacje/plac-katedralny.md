# Plac Katedralny, Archikatedra i Wieża Trynitarska (`plac-katedralny`)

Plac Katedralny na południowym skraju Starego Miasta (x ≈ 560..660, z ≈ −130..−240): Wieża Trynitarska (w66286371, (591,3; −147,3)) z przejściem z Jezuickiej i Gruella, Archikatedra (w66286341, (634,2; −183,8)) z portykiem na plac, pomnik prymasa Wyszyńskiego (656,5; −227,2) przy Królewskiej. Pod wieżą Głaz Katowski (582,7; −135), w wieży muzeum archidiecezji i taras widokowy (590,1; −147). Dzielnica `kanal`, chunki `stare-miasto-0-0` i `stare-miasto-1-0`. Kilka metrów na północ, przy Jezuickiej, kapsuła (`docs/pomieszczenia/capsule.md`, kamienica w66286373 (600,1; −128,2)). Stan gry na `22b1808`.

## Historia
Archikatedra to dawny kościół jezuitów pw. św. Jana Chrzciciela z przełomu XVI i XVII wieku, jeden z pierwszych kościołów barokowych w Polsce. Po kasacie zakonu przejęło go miasto, a od utworzenia diecezji lubelskiej w 1805 roku jest katedrą; klasycystyczny portyk z kolumnami dostał w XIX wieku. Wnętrze ma iluzjonistyczne freski i zakrystię, w której szept słychać w przeciwległym kącie. Wieża Trynitarska z XIX wieku, najwyższa budowla Starego Miasta, była dzwonnicą i bramą na plac; dziś jest w niej muzeum archidiecezji, a z jej szczytu widać całe miasto. Pod wieżą leży Głaz Katowski, kamień, z którym wiąże się legenda o katach. Stefan Wyszyński był biskupem lubelskim przed objęciem prymasostwa; jego pomnik stoi od strony Królewskiej.

W 2077 plac jest jedynym miejscem Starego Miasta, gdzie Hebi nie stoją: katedra i kuria trzymają go jak teren prywatny, a ochrona parafii pilnuje, żeby nikt nie spał pod portykiem. Wieża jest masztem nadawczym (w planie ulic czerwone światło na szczycie, `plac-katedralny.floodlights`). Tetsu mówi o dniu na Starym Mieście: „Za dnia nic, tylko wycieczki do Archikatedry” (`m4-ulica.ink`). Przed chwilą ktoś zapalił znicz LED pod pomnikiem i odszedł Królewską.

## Klimat
- Światło: 4 reflektory iluminacji (m.in. (585; −140), (597,8; −153,8), (602,1; −176,9)) na wieżę i fasadę katedry, 18 latarenek ściennych na pierzejach (wylot Jezuickiej i Gruella), 5 latarni pastorałowych przy Królewskiej (m.in. (580,6; −213,3), (598,4; −214,1)), jedna parkowa. Neony tylko dwóch lokali na pierzei południowo-zachodniej (KSIĘGARNIA PARAFIALNA i IGŁA I TUSZ, #00e5ff). Żadnego światła gry.
- Dźwięk: dzwony, organy przez otwarte drzwi w porze nabożeństw, trolejbus na Królewskiej i Wyszyńskiego, gołębie. Źródeł w grze brak.
- Zapach: kadzidło i wosk od portyku, mokre liście drzew placu, spaliny z Królewskiej.
- Kontrast: barokowa fasada i iluminacja jak z pocztówki, a w bramie wieży holo-kasa muzeum i bankomat z reklamą wszczepów; tatuażysta IGŁA I TUSZ obok księgarni parafialnej.
- Ruch: wycieczki za dnia, tłum (`stare-miasto-0-0` profil `evening`, `stare-miasto-1-0` `street`), trolejbusy. Nocą plac pustoszeje.

## Przeznaczenie
- Przejście ze Starego Miasta na Królewską i Plac Łokietka (przez bramę wieży, Jezuicką i Gruella), droga do kapsuły na Jezuickiej. Plac tła bez zleceń, terytoriów i spotkań.
- Wejścia: przejście pod Wieżą Trynitarską (3,4 m, T-264, T-036), Jezuicka, Królewska od południa, Podwale i Misjonarska od wschodu, schody w dół ku Podwalu.
- Osłony: 18 drzew, 4 ławki, 105 słupków, pomnik, figura Matki Bożej (599,5; −197,9), kolumny portyku. Szeroka otwarta płyta przed katedrą.
- Punkt widokowy: taras przy wieży (590,1; −147) na wschód i południe; szczyt wieży niedostępny.

## Topografia
- Prawdziwe miejsce: Plac Katedralny, Archikatedra w66286341, Wieża Trynitarska w66286371 z częściami w617763431, w618268118, w617763432. Teren z NMT ok. 186,8–197,5 m n.p.m. (y −9..1,7): płyta placu na górze, skarpa ku Podwalu na wschodzie.
- Zgodne: obrys placu i katedry, wysokość wieży z hełmem do 62 m nad stopą (T-006, poprawione), nawa katedry i wieżyczki (T-009, poprawione), dachy z OSM (T-017, T-018 poprawione), przejście Gruella przez wieżę (T-036 poprawione).
- Odstępstwa: wieża stoi ok. 3 m na zachód od LoD2, przejście poza osią (T-264, G-683 do poprawy); hełm i latarnia wieży w miętowym tynku zamiast zielonej blachy (T-143); Archikatedra i Wieża Trynitarska bez przepisu zabytku w `landmarks/recipes.ts` (przepisy mają Brama Krakowska, Brama Grodzka, Ratusz i Zamek), a katedra bez portyku z kolumnami (w `lublin/porticoes.ts` jest tylko Ratusz); wpisu T brak.

## Inwentarz docelowy
Architektura:
- fasada katedry z portykiem, schodami i drzwiami (przepis zabytku w `landmarks/recipes.ts`, portyk z `porticoes.ts`);
- Wieża Trynitarska z przejazdem, hełmem z zielonej blachy i anteną masztu z czerwonym światłem (przepis, Blender do anteny `tools/blender/rooms/plac_katedralny.py`);
- schody i mur oporowy ku Podwalu (mapa).
Duże obiekty:
- pomnik Wyszyńskiego, figura Matki Bożej, Głaz Katowski z terminalem legendy AR (model gry `monument`, `artwork`; terminal: Blender);
- ławki, drzewa, latarnie, reflektory (model gry, meble uliczne);
- budka ochrony parafii przy portyku i holo-kasa w bramie wieży (Blender, `plac_katedralny.py`).
Drobiazg w skupiskach:
- pod pomnikiem: znicze LED, kwiaty, kartki z intencjami (Blender);
- przy ławkach pod drzewami: ulotki wycieczek, butelka wody, bilety muzeum (generator ADR-0096 `litter`);
- w bramie wieży: naklejki, kubek, niedopałki ochroniarza (Blender).

## Frakcja i zasady
Frakcja: korporacja, ulica (kościół jako właściciel placu; ulica na jego skraju).
- §12 zgodne: wąska Jezuicka i przejście pod wieżą (3,4 m) otwierają się na plac szeroki na ok. 60 m z fasadą katedry; to najmocniejsza kompresja i otwarcie Starego Miasta. Dług: przejście poza osią (G-683).
- §13 częściowo: iluminacja ma oprawy (reflektory), latarenki i pastorały też. Brakuje czerwonego światła masztu, które plan ulic daje wieży, i światła drogi przy schodach ku Podwalu. 60-30-10 niemierzone (zrzut nocny z bramy wieży na katedrę). Pomiar nocny 24.11 (22:00, ujęcie `plac-katedralny` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 83,4/15,3/1,3, za ciemno. Po świetle placu (24.11, po K1–K4): reflektory oświetlają wieżę i front jako lampy sceny (`katedralny-lights.ts`), na szczycie iglicy miga czerwone światło przeszkodowe, zegary wieży mają cyjanową obwódkę i wskazówki, a słońce IHS świeci złotem. To samo ujęcie: 69,5/29,7/0,7; z placu na front (545; −188): 76,3/23,5/0,2. Światło w normie, akcenty poniżej 3%, bo Stare Miasto ma przygaszoną warstwę (ADR-0058). Warstwa 2077 na zabytkach (25.11, decyzja użytkownika w `docs/decyzje.md`): cyjanowe pierścienie i diody hełmów wieżyczek, czerwone światła przeszkodowe nad ich latarniami, cyjanowa aureola słońca, kamera nad portalem i cyjanowa bramka muzeum w przejeździe wieży (łuki przy obu wylotach i w środku), czyli punkt nawigacji placu. Pomiar po zmianie (22:00): `plac-katedralny` 68,8/30,5/0,7, z placu na front 75,5/24,2/0,3, przed bramą wieży 42,3/57,3/0,4. Akcenty zostają małe, bo to szlif techniki na kamieniu, a nie neon.
- §14 częściowo: makro i mezo z mebli (18 drzew, 4 ławki, pomnik, figura), mikro brak (0 rzeczy `clutter` w obrysie placu); dla placu kościelnego to dopuszczalne tylko na płycie przed portykiem.
- §15 częściowo: mokry bruk i płyty, szkło drzwi; brak połysku metalu (antena, kasa) i wosku pod pomnikiem.
- §16 częściowo: porządek właściciela jest (pusto, czysto), ale nic nie mówi, kto go pilnuje: brak ochrony, kamery i bramek muzeum.
- §17 dług: dzwonów, organów i trolejbusu nie słychać ze źródeł. Ruch: tłum i trolejbusy; skala: ławki, drzwi katedry, figura.

## Scenariusz tła
- Kto tu bywa: wierni i wycieczki do Archikatedry; księża i pracownicy kurii; ochrona parafii, która pilnuje portyku; przechodnie między Starym Miastem a Królewską. Hebi tu nie stoją.
- Co się dzieje: w dzień przewodnicy prowadzą grupy pod Wieżę Trynitarską i do zakrystii („za dnia nic, tylko wycieczki do Archikatedry”); po mszy wierni rozchodzą się Królewską; nocą ochrona przegania śpiących spod portyku, a na szczycie wieży mruga czerwone światło masztu.
- Ślad obecności: znicz LED pod pomnikiem Wyszyńskiego, bilety do muzeum archidiecezji przy wejściu do wieży, ślady wosku na stopniach portyku.

## Dług sceny
Zrobione 23.11 (znicze LED z kwiatami i intencjami pod pomnikiem, terminal legendy AR przy Głazie Katowskim). Zostaje:
- Przejście pod wieżą w osi (G-683, T-264): `packages/sim/src/content/lublin/gate-passages.ts` albo korekta obrysu w `tools/osm-import`, przegląd `topography-curator`.
- Przepis Archikatedry: bryła z NMPT, portyk z kolumnami, tynk, gzymsy i hełmy wieżyczek zrobione w etapie K1 (24.11, T-349, `landmarks/archikatedra.ts`, `tools/osm-import/src/corrections-katedra.ts`). Zostają K2 (fasada: osie, okna, tarcza IHS we frontonie, drzwi i schody portalu), K3 (lukarny, sygnaturka, kopuły kaplic), K4 (Wieża Trynitarska) i K5 (murki, taras, parking): `docs/plany/archikatedra.md`.
- Budka ochrony parafii z ochroniarzem (plan dnia: obchód placu po 22:00) i kamera nad portykiem: rekwizyt i postać w `packages/sim/src/content/district-kanal.ts`, plan w `packages/sim/src/content/schedules.ts`, kamera w `packages/sim/src/content/devices.ts`.
- Holo-kasa w bramie wieży: model w `tools/blender/rooms/plac_katedralny.py`, rekwizyt w `packages/sim/src/content/katedralny-detail.ts`, klucz na końcu `ROOM_DETAIL_SHAPES`.
- Emitery dzwonów (o pełnych godzinach) i organów przy drzwiach katedry: `packages/engine/src/audio/spatial.ts` i `packages/engine/src/audio/soundscape-clock.ts`.
- Drugi reflektor fasady w południowej połowie portyku (ok. 603; −195), T-355. Kontrole skanu z przeglądu kuratora PR #1032 (`beacon-off-tip`, `scene-lamp-in-solid`, baza 0) są w skanie od 25.11.
