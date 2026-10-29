# Lublin 2077: ulice i place, plan wypełnienia rekwizytami

Research wyglądu ulic i placów w czterech dystryktach (ADR-0042) i lista TODO obiektów do dobrania assetów. Renderer z ADR-0044 rysuje już budynki, teren, nawierzchnie (jezdnia, chodnik, granit placu, bruk, trawa, woda, tory), krawężniki, neony na fasadach i tablice nazw landmarków. Nie rysuje drzew, latarni, ławek, pomników, fontann, mostów ani niczego, co stoi na ulicy. Ten dokument opisuje, co tam stoi.

Maszynowa wersja listy: [`lublin-props.todo.json`](lublin-props.todo.json) (480 pozycji, około 4000 sztuk). Ten plik opisuje miejsca i najważniejsze pozycje; pełne listy punktów (każda ławka, drzewo, słupek z OSM) są tylko w JSON.

## Jak czytać

- **Współrzędne** to świat gry: x na wschód, z na północ, metry od kotwicy na Placu Litewskim (`LUBLIN_ANCHOR`), przeliczone `geoToWorld` z `tools/osm-import/src/project.ts`. Wysokość brać z terenu chunka (`terrainHeightAt`). Zapis `(x, z)` to punkt, `[x1..x2, z1..z2]` to prostokąt, w którym leży grupa.
- **Priorytet:** P1 rozpoznawalność miejsca (bez tego gracz nie pozna Lublina), P2 klimat, P3 detal.
- **Asset:** „proceduralny” (generator w engine, jak fasady), „city kit” (ADR-0022, `city-kit.glb`), CC0 z paczki (Kenney, Quaternius, Poly Haven, Neon Town) albo „model do zrobienia”.
- **id** w tabelach to `id` pozycji w JSON.
- Pola JSON: `id`, `kind` (słownik `kinds` w pliku), `area` (`district`, `chunk`, `place`, `zone`), położenie jako `position` `{x,z}`, `points` (lista dokładnych pozycji grupy), `line`/`lines` (linie, obiekty co `spacing` m) albo `polygon` (obszar), `count`, `yaw`, `priority`, `osm` (id węzłów `n…`, dróg `w…`), `inOsm`, `look`, `cyberpunk`, `asset`, `refs`, `note`.

## Źródła i stan danych

- **OSM:** świeży wyciąg `api.openstreetmap.org/api/0.6/map` (29.10.2026) dla prostokątów z `tools/osm-import/src/config.ts` z marginesem 40 m, 6 kafli, User-Agent importera, pauzy 3 s. Surowych danych nie ma w repo; `data/osm/*.json` importera nie trzyma części tagów (ławki bez `backrest`, drzewa bez gatunku), dlatego pobrałem je jeszcze raz. Licencja ODbL, atrybucja jak w `data/osm/ATTRIBUTION.md`.
- **Zdjęcia:** Wikimedia Commons (lista z licencjami na końcu), opisy z pl.wikipedia, radio.lublin.pl, lublin.eu, fotopolska.eu. Zdjęć nie ma w repo.

Co OSM ma, a czego nie ma (cztery prostokąty razem):

| Obiekt | Krakowskie | Stare Miasto | Podzamcze | Nabrzeże | Uwagi |
|---|---|---|---|---|---|
| ławki | 286 | 37 | 7 | 3 | Plac Litewski zmapowany prawie co do sztuki (134) |
| drzewa | 303 | 105 | 110 | 68 | gatunek tylko przy kilku |
| słupki | 325 | 24 | 1 | 3 | plus 70 granitowych bloków na Placu Litewskim |
| latarnie | 0 | 2 | 5 | 0 | **prawie brak**: latarnie trzeba rozstawiać regułą |
| kosze | 7 | 1 | 10 | 1 | niedoszacowane |
| przejścia | 37 | 20 | 45 | 23 | |
| przystanki | 5 | 3 | 8 | 2 | z wiatą, ławką, koszem, tablicą DIP w tagach |
| sieć trolejbusowa | 0,4 km | 0,3 km | 1,6 km | 2,3 km | drogi z `trolley_wire=yes` i trasami 150, 154, 156, 160, 950 |
| pomniki, rzeźby, tablice | 49 | 46 | 19 | 1 | w tym 17 Koziołków Lubelskich |
| fontanny | 12 | 0 | 0 | 0 | multimedialna, kaskadowa, 8 suchych, Syrenka, wieża ciśnień |
| ogródki gastronomiczne | 4 | 4 | 0 | 0 | sezonowych prawie nie ma |

## 1. Krakowskie Przedmieście, Plac Litewski, Plac Łokietka (`shinsekai-7`)

Oś dystryktu to Krakowskie Przedmieście: od 3 Maja (x = -105) przez Plac Litewski (x = -100 do 135) i deptak (x = 135 do 440, z = -55 do -98) do Placu Łokietka i Bramy Krakowskiej (x = 470, z = -91). Na zachód od Placu Litewskiego to ulica z jezdnią i trakcją, od Placu Litewskiego na wschód deptak z płyt (OSM: `surface=paving_stones`).

### Plac Litewski (x -100..135, z -55..70)

Wygląd dziś (po rewitalizacji 2017):
- wielka jasna posadzka z płyt granitowych w siatce, przecięta ciemnymi liniowymi odwodnieniami;
- zieleń w rabatach z granitowym obrzeżem, na obrzeżach długie ławy z drewnianych listew po łukach; dojrzałe lipy, klony (bordowy klon 'Crimson King' za Pomnikiem 3 Maja), dęby, młode drzewa w rabatach;
- fontanna multimedialna w płytkiej niecce w kształcie liścia: setki dysz w posadzce, w środku czasza z kutą ażurową balustradą i wysokim strumieniem; 227 dysz i 319 reflektorów, latem pokazy w piątki i soboty o 21:00, obraz rzucany na fasadę Poczty Głównej;
- obok fontanna kaskadowa i rząd suchych fontann w posadzce przy deptaku, gdzie latem biegają dzieci;
- smukłe grafitowe słupy oświetlenia z poprzeczką i płaskimi oprawami, iluminacja pomników i fasad;
- 13 masztów z flagami i długimi czerwonymi banerami miejskimi, stojaki wystaw plenerowych, granitowe kostki-siedziska (70 w OSM), słupy ogłoszeniowe;
- pomniki: Unii Lubelskiej (żeliwny obelisk około 13 m na granitowym cokole z płaskorzeźbą), konny Piłsudskiego (około 7,3 m), Konstytucji 3 Maja (kuty piaskowiec z białym orłem), Grób Nieznanego Żołnierza, Czechowicza;
- drewniany parkiet do tańca w części placu, place zabaw, stoliki piknikowe, poidełka, napis „I love Lublin”, Portal Wilno-Lublin (okrągły ekran łączący z Wilnem).

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Fontanna multimedialna | 1 | obrys w OSM, środek (-24, 57) | P1 | ściana wody jako ekran holo, lasery, legendy Lublina w pokazie | model do zrobienia (niecka z obrysu + dysze jako cząsteczki) | `plac-litewski.fountain-multimedia` |
| Fontanna kaskadowa | 1 | (-10, -4) | P1 | przelewy podświetlone od spodu, świecąca mgła | proceduralny z obrysu | `plac-litewski.fountain-cascade` |
| Suche fontanny | 10 | [-67..128, -50..57] | P1 | mgła z dysz w neonie | proceduralny (kratki + cząsteczki) | `plac-litewski.fountain-jets` |
| Pomnik Unii Lubelskiej | 1 | (47.8, -25.7) | P1 | holo-pierścienie 1569/2077, nadajnik na szczycie | proceduralny (obelisk) | `plac-litewski.pomnik-unii` |
| Pomnik Piłsudskiego (konny) | 1 | (-45.9, -13.3) | P1 | kontur konia w neonie, graffiti AR na cokole | model do zrobienia | `plac-litewski.pomnik-pilsudskiego` |
| Pomnik Konstytucji 3 Maja | 1 | (-87.1, -22.6) | P1 | orzeł jako migocząca projekcja | model do zrobienia (mały) | `plac-litewski.pomnik-3-maja` |
| Grób Nieznanego Żołnierza | 1 | (-57.5, -21.4) | P1 | plazmowy znicz, warta dronów | proceduralny + cząsteczki | `plac-litewski.grob-nieznanego` |
| Latarnie nowoczesne | 36 | alejki placu i deptak przy placu | P1 | paski LED, holo-flagi, kamery | proceduralny (łatwy) | `lamps.plac-litewski` |
| Ławki i ławy na obrzeżach | 134 | punkty z OSM | P2 | listwy podświetlone od spodu, port ładowania | proceduralny (łuk z obrysu rabaty) | `plac-litewski.bench` |
| Granitowe bloki | 70 | punkty z OSM | P2 | panel świetlny w górnej ścianie | proceduralny | `plac-litewski.granite-block` |
| Maszty flagowe | 13 | [-73..-43, -21..-6] | P2 | holo-flagi | proceduralny + shader wiatru | `plac-litewski.flagpole` |
| Drzewa | 96 | punkty z OSM | P2 | opaski czujników, część drzew-filtrów | Quaternius Stylized Nature MegaKit | `plac-litewski.tree` |
| Słupy ogłoszeniowe | 5 | [-99..101, -49..51] | P2 | holo-kolumny | proceduralny | `plac-litewski.advertising-column` |
| „I love Lublin”, Portal Wilno-Lublin | 2 | (69.7, -27.8), (14.8, -65.6) | P2 | neon „I ♥ LUBLIN 2077”, działający portal wideo | atlas szyldów; model obręczy | `plac-litewski.i-love-lublin`, `plac-litewski.portal-wilno-lublin` |
| Scena plenerowa | 1 | (60, 5) | P2 | scena Lubelskiego Festiwalu (idolka z `enc_targ_idol`) | proceduralny | `plac-litewski.event-stage` |
| Wystawy plenerowe | 16 | linia z = -38, x -60..80 | P3 | holo-gabloty, część zhakowana | proceduralny | `plac-litewski.exhibition-boards` |
| Parkiet do tańca | 1 | około (-25, 30), do potwierdzenia | P3 | diody pod deskami | wzór w shaderze nawierzchni | `plac-litewski.dance-deck` |
| Place zabaw, stoliki, poidełka, słupki, kamery | 4 + 6 + 2 + 20 + 5 | z OSM | P3 | | proceduralne | `plac-litewski.*` |

### Deptak Krakowskiego (x 135..440, z -40..-105)

- Deptak od 1996 r.: płyty, po bokach kamienice z witrynami (budynki z `shopfront` w danych), kościół Kapucynów, Galeria Centrum, kościół św. Ducha na końcu.
- Latarnie stylizowane „pastorałowe” (czarne, żeliwne, z wygiętym ramieniem i zawieszoną latarenką), na nich latem podwójne kosze z kwiatami (miasto: 180 donic na 90 latarniach w centrum) i piętrowe konstrukcje kwiatowe (15 szt.).
- Ławki z drewnianych listew (OSM: 32, większość bez oparcia), drzewa w rytmie ławek, wodopój z Koziołkiem (287, -90).
- Latem sezonowe ogródki kawiarni pod dużymi parasolami z logo browarów. W OSM jest ich tylko kilka.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Latarnie pastorałowe | 34 | oś deptaka, obie strony co 25 m | P1 | holo-pierścień pod latarenką, kamera w ramieniu | **model do zrobienia** (latarnia lubelska) | `lamps.kp-deptak` |
| Ogródki kawiarniane | 18 | wzdłuż fasad, x 130..405 | P2 | parasole świecące od spodu, holo-menu, grzałki IR | Kenney Furniture Kit + parasol proceduralny | `kp-deptak.cafe-gardens` |
| Ławki | 32 | punkty z OSM | P2 | pas neonu pod siedziskiem | proceduralny | `kp-deptak.bench` |
| Donice i konstrukcje kwiatowe | 15 | oś deptaka | P2 | hydroponika z fioletowymi lampami | proceduralny | `kp-deptak.planters` |
| Kosze z kwiatami na latarniach | 90 (wszystkie dystrykty) | deptak, Królewska, Plac Zamkowy | P2 | plastikowe kwiaty UV | proceduralny | `street.hanging-baskets` |
| Drzewa | 17 + 4 | punkty z OSM | P2 | | Quaternius | `kp-deptak.tree`, `kp-wschod.tree` |
| Wodopój „Koziołek” | 1 | (287.3, -90.3) | P2 | woda za kredyty | model koziołka | `kp-deptak.wodopoj-koziolek` |
| Automaty z napojami | 4 | x 180..440 | P2 | rzędy japońskich automatów (klimat Kabuki) | proceduralny | `street.vending-machines` |

### Plac Łokietka i Nowy Ratusz (x 380..470, z -70..-125)

- Mały plac między Nowym Ratuszem (416, -70), Bramą Krakowską i kościołem św. Ducha.
- Posadzka w szachownicę: jasne płyty w polach obramowanych ciemną kostką; od jezdni granitowe słupki połączone łańcuchami.
- Latarnie pastorałowe także na Królewskiej i Lubartowskiej, nad jezdnią sieć trolejbusowa z linkami poprzecznymi (trolejbusy 156, 160).
- Brązowa makieta Lublina z XVI/XVII w. (437.6, -123.4), zabytkowa żeliwna pompa wodna (451, -115), Koziołki Onufry i Jan, tablice na Ratuszu.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Latarnie pastorałowe | 24 | Królewska, Lubartowska | P1 | jak na deptaku | model latarni lubelskiej | `lamps.plac-lokietka` |
| Sieć trolejbusowa | 7 + 7 zawieszeń | Lubartowska (442, -94 do 473, 88), Królewska | P2 | iskry na stykach, neonowe markery | proceduralny | `trolley.krakowskie-2-0.lubartowska`, `trolley.stare-miasto-0-0.krolewska` |
| Słupki z łańcuchami | 4 (OSM) + więcej wzdłuż jezdni | (439, -100..-92) | P2 | laserowa linia barierowa | proceduralny | `plac-lokietka.bollard` |
| Makieta i pompa | 2 | (437.6, -123.4), (451, -114.9) | P2 | holo-warstwa 2077 nad brązem; pompa z filtrem i kolejką | modele do zrobienia (małe) | `plac-lokietka.makieta`, `plac-lokietka.pompa` |
| Ławki, drzewa, Koziołki | 12 + 9 + 3 | z OSM | P2 | | | `plac-lokietka.*` |

Na końcu dystryktu leżą też Plac Wolności (x 230..380, z -140..-200: 108 stalowych słupków wokół parkingu, fontanna z miedzianym modelem wieży ciśnień, stacja roweru miejskiego, przystanki) i ulice boczne. Są w JSON (`plac-wolnosci.*`, `krakowskie-reszta.*`).

## 2. Stare Miasto (`kanal`)

Gotycko-renesansowe kamienice na planie średniowiecznym, uliczki z kocich łbów (OSM: `surface=sett` na Rynku, Bramowej, Grodzkiej, Złotej, Jezuickiej, Olejnej), teren opada na północ i wschód ku Podzamczu.

### Brama Krakowska (472.6, -91.2)

Ceglana gotycka wieża bramna z barokowym hełmem, zegarem i blankami, od wschodu fragment murów (w OSM: `w609951474`). Bramowa prowadzi z niej do Rynku. Nocą oświetlona ciepłym światłem od dołu.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Iluminacja bramy | 4 | wokół (472, -91) | P1 | reflektory w kolorze rimu, zegar odliczający do godziny policyjnej | proceduralny reflektor | `brama-krakowska.floodlights` |
| Mur miejski przy bramie | 1 (12 m) | (472..476, -84..-72) | P1 | iluminacja od dołu | proceduralny mur | `brama-krakowska.city-wall` |
| Koziołek Kazik | 1 | (481.8, -83.3) | P2 | znajdźka | model koziołka | `brama-krakowska.artwork` |
| Kontener pod Bramą (narracja `m4-ulica.ink`) | 1 | od strony deptaka, około (462, -100) | P2 | | city kit `dumpster` | do dodania przez treść |

### Rynek z Trybunałem (Trybunał w (582.4, -61.2), Rynek x 530..610, z -28..-108)

- Trapezowy rynek (62 × 72 m), pośrodku klasycystyczny Trybunał Koronny. Kamienice w pastelach (żółć, róż, błękit, ochra) z renesansowymi attykami i polichromiami.
- Bruk z kocich łbów.
- Latarenki stylizowane na gazowe na kutych wysięgnikach z fasad. Obok nich kute szyldy-tarcze na wysięgnikach i ławki.
- Latem pierścień ogródków pod parasolami browarów (Tyskie, Pilsner Urquell, Perła), potykacze z menu, donice z tujami, zamrażarki z lodami. Na jarmarkach drewniane domki i namioty.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Latarenki ścienne | 236 (całe Stare Miasto) | fasady wzdłuż Rynku i uliczek, co 15 m | P1 | zimny LED albo neonowa żarówka w starej latarence | **model do zrobienia** (latarenka na wysięgniku) | `lamps.stare-miasto-wall` |
| Ogródki | 14 | obrys Rynku | P2 | świetlny wieniec parasoli wokół Trybunału, drony-kelnerzy | Kenney Furniture Kit + parasol | `rynek.cafe-gardens` |
| Szyldy na wysięgnikach | 40 | Bramowa, Rynek, Grodzka, Złota | P2 | neonowe tarcze, kanji z atlasu MapSign | proceduralny + atlas | `stare-miasto.hanging-shop-signs` |
| Potykacze | 30 | Rynek, Grodzka, Bramowa | P3 | e-papier | proceduralny | `stare-miasto.a-frames` |
| Stragany jarmarczne | 10 | Rynek (sezonowo) | P3 | cebularze i części, girlandy | proceduralny domek | `rynek.seasonal-stalls` |
| Tablice pamiątkowe i stolpersteine | 7 | fasady wokół Rynku | P3 | holo-portrety, tagi AR | proceduralny | `rynek.plaque` |
| Ławki | 4 | punkty z OSM | P2 | | | `rynek.bench` |

### Grodzka, Plac po Farze, Brama Grodzka (x 560..740, z -35..160)

- Grodzka biegnie z Rynku na północny wschód do Bramy Grodzkiej (714, 141). Brukowana, wąska, z latarenkami i szyldami, z rzeźbą „Sztukmistrz z Lublina”: linoskoczek na linie nad ulicą (617, 26).
- Plac po Farze (687, 35): fundamenty kościoła św. Michała odtworzone niskim murkiem na żwirze, brązowy model fary, taras widokowy na Zamek i Podzamcze, mury oporowe i schody w dół ku Podwalu.
- Przy Bramie Grodzkiej (Teatr NN) stoi Latarnia Pamięci (754.5, 146.1). Od bramy wiadukt Zamkowej prowadzi ku Zamkowi.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Fundamenty fary | 1 | obrys w OSM (650..696, 24..60) | P1 | murki świecą, holo-rekonstrukcja kościoła | proceduralny | `po-farze.fundamenty-fary` |
| Sztukmistrz z Lublina | 1 | (617.1, 25.8) | P1 | linoskoczek z neonowym drążkiem | model do zrobienia + lina | `stare-miasto.sztukmistrz` |
| Latarnia Pamięci | 1 | (754.5, 146.1) | P1 | jedyna latarnia bez neonu, ciepłe światło | model do zrobienia (przedwojenna latarnia) | `grodzka.latarnia-pamieci` |
| Mur miejski przy Podwalu | 1 (57 m) | (701..716, 61..113) | P1 | | proceduralny | `grodzka.city-wall` |
| Schody i mury oporowe | 11 + 3 | z OSM | P2 | podświetlone stopnice | proceduralny | `grodzka.steps`, `grodzka.retaining-wall` |
| Model fary, Koziołki, rzeźby | 1 + 10 | z OSM | P2 | znajdźki z holo-aurą | modele małe | `po-farze.model-fary`, `grodzka.artwork` |
| Ogródki (patio Warsztatów Kultury, Rozmaryn, Cleopatra) | 4 | obrysy z OSM | P2 | | | `grodzka.cafe-garden` |
| Drzewa | 28 | z OSM | P2 | | | `grodzka.tree` |

### Wieża Trynitarska i Archikatedra (Plac Katedralny, x 560..660, z -140..-240)

Wieża Trynitarska (591, -147, 40 m) to brama z przejściem na Plac Katedralny. Pod nią Głaz Katowski (582.7, -135), obok taras widokowy. Archikatedra (634, -184) ma klasycystyczny portyk. Na placu drzewa, ławki, pomnik prymasa Wyszyńskiego (656.5, -227.2) i figura Matki Bożej.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Iluminacja wieży i katedry | 4 | (585..620, -140..-190) | P2 | wieża jako maszt nadawczy, czerwone światło na szczycie | reflektor | `plac-katedralny.floodlights` |
| Głaz Katowski | 1 | (582.7, -135) | P2 | terminal z legendą AR | Quaternius (skała) | `plac-katedralny.glaz-katowski` |
| Pomnik Wyszyńskiego | 1 | (656.5, -227.2) | P2 | znicze LED | model do zrobienia | `plac-katedralny.pomnik-wyszynskiego` |
| Drzewa, schody, mur oporowy | 13 + 3 + 1 | z OSM | P2 | | | `plac-katedralny.*` |
| Sieć trolejbusowa na Królewskiej i Wyszyńskiego | 8 | (443..617, -94..-237) | P2 | | proceduralny | `trolley.stare-miasto-*` |

## 3. Podzamcze (`targ`)

Niżej (Plac Zamkowy 175,5 m n.p.m., około 20 m pod Placem Litewskim), między Zamkiem a aleją Tysiąclecia. Socrealistyczny łuk kamienic z arkadami na Placu Zamkowym, dalej ruchliwa dwujezdniowa aleja, dworzec PKS, targi przy Ruskiej i Nowym Placu Targowym.

### Plac Zamkowy (x 700..830, z 160..300)

- Owalny plac, który na co dzień jest parkingiem (parkomaty w OSM), zamknięty od zachodu łukiem dziesięciu kamienic z arkadami z lat 50. W niedziele giełda staroci.
- Ozdobne kandelabry z kilkoma kloszami i koszami kwiatów, żółty słup ogłoszeniowy z kopułą (712, 195).
- Od wschodu monumentalne schody z granitu strzegomskiego na Wzgórze Zamkowe: pięć podestów, wzdłuż balustrad 10 pojedynczych latarni, u dołu 6 podwójnych kandelabrów na murkach (pl.wikipedia).
- Wiadukt Zamkowej z arkadami łączy Bramę Grodzką z placem. Przy placu stoją pomnik AK-WiN (744, 183) i Lew Lwowski (774, 303).

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Schody na Wzgórze Zamkowe | 7 biegów | [760..829, 211..293] | P1 | amfiteatr nocnego miasta, budki na podestach | proceduralny + balustrada | `plac-zamkowy.steps` |
| Latarnie przy schodach | 16 (10 + 6 podwójnych) | wzdłuż schodów | P1 | holo-pierścienie, strzałki na stopniach | **model do zrobienia** (kandelabr) | `zamek.stairs-lamps` |
| Kandelabry placu | 22 | ulica Plac Zamkowy | P1 | klosze w różnych kolorach, kable do straganów | model kandelabru | `lamps.plac-zamkowy` |
| Wiadukt Zamkowej | 1 | (730..761, 154..186) | P1 | kable i markery, pod arkadami nocny targ | proceduralny most | `zamek.wiadukt-zamkowa` |
| Pchli targ (niedziela) / nocny targ | 25 stanowisk | obszar parkingu | P2 | koce z elektroniką i wszczepami | proceduralny + Kenney Food/Furniture | `plac-zamkowy.flea-market` |
| Słup ogłoszeniowy | 1 | (712, 195) | P2 | holo-kolumna | proceduralny | `plac-zamkowy.advertising-column` |
| Pomniki AK-WiN, Lwa | 2 | (744.4, 183.4), (774.1, 302.9) | P2 | | | `plac-zamkowy.pomnik-ak`, `tysiaclecia.pomnik-lwa` |
| Drzewa | 25 | skarpa i plac | P2 | | | `plac-zamkowy.tree` |

### Zamek (x 830..940, z 180..300)

Neogotycki gmach (1823-1826) z krenelażem i ostrołuczną bramą na osi schodów, romański donżon (893, 215, 26 m), gotycka kaplica Trójcy Świętej (941, 215). Przed wejściem cztery armaty w rzędzie (853, 246..249), na dziedzińcu studnia (861, 228), kamienie młyńskie, rzeźby, ruiny Baszty Żydowskiej (876, 282). Nocą oświetlony.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Iluminacja fasady | 6 | fasada zachodnia x = 846, z 205..258 | P1 | mapping na fasadzie, radar na donżonie | reflektor | `zamek.floodlights` |
| Armaty | 4 | (853, 246..249) | P3 | instalacja z działkiem szynowym | Quaternius Pirate Kit (do sprawdzenia) | `zamek.cannon` |
| Studnia, kamienie młyńskie, rzeźby | 1 + 1 + 3 | z OSM | P2/P3 | | modele małe | `zamek.studnia`, `zamek.artwork`, `zamek.millstone.*` |

### Aleja Tysiąclecia z kładkami (x 560..1120, z 300..370)

- Dwujezdniowa aleja pod Zamkiem: sygnalizacje, przystanki z wiatami „Muzeum Narodowe - Zamek” (703, 339), (793, 363), (829, 355), barierki, żywopłoty, wysokie latarnie drogowe.
- Trolejbusy linii 150 jadą tu bez sieci (`trolley_wire=no`): przewodów nie stawiać.
- W rzeczywistości nie ma tu kładki. Przejścia są naziemne z sygnalizacją: (730.7, 357.9), (728.9, 347), (741, 325).
- Narracja ma „wiadukt nad aleją Tysiąclecia”, więc kładkę trzeba zaprojektować jako obiekt fikcyjny na osi Plac Zamkowy i dworzec. Przy rondzie Dmowskiego stoi 35-metrowy Maszt Niepodległości (1081, 307).

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Wiadukt (kładka) nad aleją | 1 | linia x = 735, z 305..380 | P1 | betonowa kładka z siatkami, reklamami i kioskami, schody po obu stronach | **model do zrobienia** (moduły kładki) | `tysiaclecia.footbridge` |
| Druga kładka (opcjonalna) | 1 | x = 1040, z 315..360 | P2 | siatka, graffiti | jak wyżej | `tysiaclecia.footbridge-east` |
| Maszt Niepodległości | 1 | (1081, 306.8) | P1 | holo-flaga 30 m, światło lotnicze | proceduralny | `podzamcze.maszt-niepodleglosci` |
| Latarnie drogowe | 56 | obie jezdnie co 35 m | P2 | banery i kamery ANPR | Kenney City Kit Roads (latarnia) | `lamps.tysiaclecia` |
| Przystanki i wiaty | 3 + 4 | z OSM | P2 | holo-rozkład, reklama | proceduralna wiata | `tysiaclecia.bus-stop.*`, `tysiaclecia.bus-shelter.*` |
| Sygnalizacje, przejścia | 5 + 10 | z OSM | P2 | holo-licznik | Kenney City Kit Roads / Neon Town | `tysiaclecia.traffic-signal`, `tysiaclecia.crossing` |
| Barierki w pasie dzielącym | 1 linia (około 500 m) | oś alei | P3 | bariery z reklamami i kolcami | proceduralny | `tysiaclecia.median-railing` |

### Dworzec autobusowy, Nowy Plac Targowy, Ruska (x 600..1120, z 370..580)

- Dworzec PKS (789, 396): niski modernistyczny budynek z zadaszonymi peronami (806..868, 379..394), kiosk, automat z kawą, szalet.
- Targ „Bazar” (666, 428) z pawilonami i budkami. Targ na Ruskiej (808, 558): hala i rzędy straganów pod daszkami.
- Ruska z cerkwią Przemienienia Pańskiego (992, 429). Na Lubartowskiej i Lwowskiej sieć trolejbusowa.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Dworzec PKS: zadaszenia, tablice | 1 + peron | (789, 396) | P1 | dworzec autobusów nocnych, holo-tablica, ramen u Fumiko | proceduralny | `dworzec.dworzec-pks`, `dworzec.bus-platform.*` |
| Targ na Ruskiej | obszar | obrys w OSM | P1 | nocny targ: ramen, części, wszczepy, girlandy | proceduralne stragany + Kenney Food Kit | `ruska.targ-na-ruskiej` |
| Targ „Bazar” | obszar | obrys w OSM | P1 | pancerne rolety, lombardy | proceduralne pawilony | `nowy-plac-targowy.bazar` |
| Kiosk | 1 | (839, 372) | P2 | kiosk-automat z ramieniem robota, neon 24H | proceduralny | `dworzec.kiosk.*` |
| Sieć trolejbusowa | około 40 zawieszeń | Lubartowska, Lwowska, Podzamcze, Unii Lubelskiej | P2 | | proceduralny | `trolley.podzamcze-*` |
| Przystanki „Ruska”, „Probostwo”, „Plac Singera” | 5 | z OSM | P2 | | | `ruska.bus-stop.*` |
| Latarnie uliczne | według długości ulic | | P3 | | Kenney City Kit Roads | `lamps.podzamcze-streets` |

## 4. Nabrzeże Bystrzycy (`doki`, x 2300..2700, z 60..480)

- Bystrzyca płynie przez prostokąt z południowego zachodu na północ, oś od (2360, 50) do (2500, 473). Uregulowane koryto, trawiaste skarpy i wały, wierzby nad wodą, ścieżka rowerowa.
- Przez rzekę przechodzą para mostów Mełgiewskiej z trakcją trolejbusową (2428, 264) i (2439, 310) oraz dwie kładki obok nich.
- Na północy most inż. Mariana Lutosławskiego (2462, 422): żelbetowy, neogotycki, pieszo-rowerowy, z 1908-1909 r.
- Na zachodnim brzegu Giełda na Kresowej, wielki plac targowy z blaszanymi budami. Na wschodzie Dworek Grafa (2513, 177), rondo Cybulskiego, ulica Turystyczna z przystankami „Turystyczna - Leclerc” i kapliczka (2610, 309).
- Sieć trolejbusowa (linia 150) na Mełgiewskiej i Andersa, 2,3 km.

| Obiekt | Szt. | Gdzie | Prio | Lublin 2077 | Asset | id |
|---|---|---|---|---|---|---|
| Brzegi i umocnienia | 2 brzegi | oś rzeki (linia w JSON), skarpy 12..18 m od osi | P1 | betonowe umocnienia, rury zrzutowe, pomosty, łodzie przemytników | proceduralny + Quaternius (kamienie) | `nabrzeze.river-banks` |
| Most Lutosławskiego | 1 | (2438..2486, 405..438) | P1 | graffiti, holo-latarnie, obozowisko pod przęsłem | model do zrobienia | `nabrzeze.most-lutoslawskiego` |
| Mosty Mełgiewskiej + kładki | 2 + 2 | (2404..2464, 238..332) | P1 | betonowe bariery z plakatami, druty trakcji | proceduralny most | `nabrzeze.most-melgiewska-*`, `nabrzeze.bridge.*` |
| Giełda na Kresowej | obszar (1,1 km obwodu) | obrys w OSM, środek (2343, 206) | P1 | pchli targ wszczepów i dronów, kontenery Tessen | proceduralne budy + Quaternius Cyberpunk Game Kit | `nabrzeze.gielda-kresowa` |
| Sieć trolejbusowa | 36 zawieszeń | Mełgiewska, Andersa, rondo | P2 | | proceduralny | `trolley.nabrzeze-*` |
| Latarnie drogowe | 148 | Mełgiewska, Andersa, Turystyczna, Grafa | P2 | sodowe, mgła znad rzeki | Kenney City Kit Roads | `lamps.nabrzeze-roads` |
| Latarnie i ławki nad rzeką | 12 | ścieżka po zachodnim brzegu | P2 | połowa nie działa, koksownik pod mostem | Kenney City Kit Roads | `nabrzeze.riverside-path` |
| Drzewa, szpalery | 68 + 4 | z OSM | P2 | | Quaternius | `nabrzeze.tree`, `nabrzeze.tree-row` |
| Przejścia, sygnalizacje | 23 + 6 | z OSM | P2 | | | `nabrzeze.crossing`, `nabrzeze.traffic-signal` |

Dźwig i magazyny Tessen to treść gry (ADR-0042), nie OSM. Ich miejsce warto uzgodnić z brzegiem z tej listy.

## 5. Typy latarń (wspólne)

W OSM latarni prawie nie ma (7 węzłów), więc JSON podaje je jako linie ulic z rozstawem (`lamps.*`, `inOsm: false`). Rozpoznawalność dają cztery typy:

| Typ (`kind`) | Gdzie | Wygląd | Lublin 2077 | Szt. |
|---|---|---|---|---|
| `lamp-pastoral` | deptak, Plac Łokietka, Królewska, Zamkowa | czarny żeliwny słup, ramię wygięte jak pastorał, zawieszona latarenka, latem kosze z kwiatami | holo-pierścień pod latarenką, kamera i głośnik | 76 |
| `lamp-modern-pole` | Plac Litewski | smukły grafitowy słup około 8 m z poprzeczką i płaskimi oprawami LED | paski LED, holo-flagi | 36 |
| `lamp-wall-lantern` | Rynek i uliczki Starego Miasta | czterościenna latarenka „gazowa” na kutym wysięgniku z fasady | zimny LED albo neon w starej latarence | 236 |
| `lamp-candelabra` | Plac Zamkowy, schody na Zamek | wieloramienny kandelabr z kloszami, kosze kwiatów | klosze w różnych kolorach neonu | 38 |
| `lamp-road` | jezdnie, Tysiąclecia, Nabrzeże | wysoki stalowy słup z wysięgnikiem | sodowe światło, banery, kamery | według długości ulic |
| `lamp-memorial` | Latarnia Pamięci | przedwojenna latarnia świecąca bez przerwy | jedyna bez neonu | 1 |

Jeden model latarenki (klosz czterościenny) obsłuży pastorał, kinkiet i Latarnię Pamięci.

## 6. Sieć trolejbusowa (wspólne)

Lublin ma trolejbusy (MPK, Solaris Trollino, biało-zielone z czerwonym dachem). Z OSM (`trolley_wire=yes` i relacje `route=trolleybus`) sieć leży nad:
- Lubartowską od Placu Łokietka na północ (x = 442..473, z = -94..88, dalej przez Podzamcze do Ruskiej);
- Królewską i Wyszyńskiego (Stare Miasto, przy Archikatedrze);
- Lwowską, Unii Lubelskiej, Podzamczem i rondami przy Dmowskiego;
- Mełgiewską, Andersa i rondem Cybulskiego na Nabrzeżu.

Bez sieci (trolejbusy na bateriach): al. Tysiąclecia, Krakowskie przy 3 Maja, Narutowicza, Plac Wolności (`trolley.battery-sections`).

Na zdjęciach z Placu Łokietka widać dwa przewody na kierunek, wieszaki na linkach poprzecznych między słupami albo rozetami na fasadach i krzyżowania przewodów. JSON podaje linie z `count` jako liczbą zawieszeń co 30 m (razem około 90). Renderer może rysować przewody jak szyldy, jedną siatką na komórkę.

## 7. Brakujące w danych

Rzeczy widoczne na zdjęciach albo opisane w źródłach, których OSM nie ma (w JSON z `inOsm: false`):

- **Latarnie** prawie wszędzie (patrz rozdział 5) i **kosze z kwiatami** na latarniach (180 donic na 90 latarniach według miasta).
- **Ogródki sezonowe:** parasole z logo browarów, podesty, płotki, donice, grzybki grzewcze. Na deptaku i Rynku stoją od wiosny do jesieni, w OSM jest 8 obrysów.
- **Neony i szyldy lokali:** szyldy na wysięgnikach na Starym Mieście, kasetony na Krakowskim, potykacze kredowe. Fasady ADR-0044 mają już tablice nad witrynami; brakuje wysięgników i potykaczy.
- **Wystawy plenerowe** na Placu Litewskim, **scena** na wydarzenia, **jarmarki** na Rynku i **pchli targ** na Placu Zamkowym. Wszystkie są tymczasowe, warto je włączać na wydarzenia.
- **Drewniany parkiet do tańca** na Placu Litewskim (pl.wikipedia), bez obrysu w OSM.
- **Latarnie i balustrady przy schodach na Zamek** (10 + 6 według pl.wikipedia).
- **Iluminacja zabytków:** Brama Krakowska, Wieża Trynitarska, Archikatedra, Zamek, pomniki Placu Litewskiego.
- **Tymczasowe ogrodzenia i rusztowania** przy remontowanych kamienicach, banery reklamowe na całych ścianach szczytowych (widoczne przy Krakowskim 59-61).
- **Szafki techniczne**, **tablice z nazwami ulic** (miejski system informacji), **włazy i kratki** (liniowe odwodnienia na Placu Litewskim), **barierki U-12** przy jezdniach.
- **Kosze na śmieci:** w OSM 19 na cztery dystrykty, w rzeczywistości są przy każdej grupie ławek i przystanku.
- **Kładka nad al. Tysiąclecia:** nie istnieje, ale wymaga jej narracja.
- **Trolejbusy** jako pojazdy tła.
- **Dla klimatu 2077 (wymyślone):** rzędy automatów z napojami jak w Kabuki, budki-terminale netrunnerów w miejscu dawnych budek telefonicznych, drony i ich stacje.

## 8. Pakiety assetów

Znane paczki z `docs/assets-research.md` i ADR-0022 pokrywają tylko część listy. Większość rekwizytów Lublina to proste bryły (słupki, bloki, kosze, wiaty, maszty, słupy ogłoszeniowe, schody, murki, płoty), które lepiej robić proceduralnie, tak jak fasady: wtedy pasują do shadera toon i do budżetów.

| Paczka | Licencja | Co pokryje | Pozycje |
|---|---|---|---|
| Quaternius **Stylized Nature MegaKit** (116 modeli, 40 drzew z wymiennymi liśćmi) | CC0 | drzewa, krzewy, kamienie (Głaz Katowski) | około 590 drzew, krzewy |
| Kenney **City Kit Roads** (część jest już w `city-kit.glb`) | CC0 | latarnie drogowe, sygnalizatory, znaki, przewody, dumpstery | latarnie drogowe (około 420), sygnalizacje, kontenery |
| **Neon Town** (już w `city-kit.glb`) | CC0 | latarnia, sygnalizator, kontener, płot, stół i krzesło | zapas dla latarni i ogródków |
| Kenney **Furniture Kit** | CC0 | stoliki i krzesła do ogródków, być może ławka (do sprawdzenia) | ogródki i lokale (około 75) |
| Kenney **Food Kit**, **Holiday Kit** | CC0 | towar na straganach, dekoracje jarmarczne | targi, jarmark |
| Kenney **Car Kit** (już w `city-kit.glb`) | CC0 | auta na parkingach (Plac Zamkowy, Wolności) | parkingi |
| Quaternius **Cyberpunk Game Kit** | CC0 | skrzynie, kontenery, ekrany, szyldy, AC dla Giełdy, targów i automatów | klimat 2077 |
| Quaternius **Ultimate Modular Men** (baza) | CC0 | figury pomników (Wyszyński, jeździec Piłsudskiego) po scaleniu i materiale brązu | 2 do 3 pomniki |
| Poly Haven `street_lamp_01/02`, `utility_box_*` | CC0 | zapasowe latarnie i szafki | P3 |

**Do zrobienia samodzielnie** (żadna paczka CC0 tego nie ma, a bez tego miejsca są nierozpoznawalne):
1. **Latarnia lubelska „pastorał”** z latarenką i wariantem z koszem kwiatów (76 szt.) oraz **latarenka ścienna** na kutym wysięgniku (236 szt.), ze wspólnym kloszem. To największy zysk z jednego modelu.
2. **Kandelabr Placu Zamkowego** (38 szt. z latarniami przy schodach).
3. **Fontanna multimedialna**: niecka z obrysu OSM, balustrada czaszy, system cząsteczek dysz (227) i świateł. Do tego fontanna kaskadowa i suche fontanny.
4. **Pomniki Placu Litewskiego:** obelisk Unii (prosty), pomnik konny Piłsudskiego (najtrudniejszy), orzeł 3 Maja, Grób Nieznanego Żołnierza.
5. **Koziołek Lubelski** (jeden model z wariantami pozy, 17 sztuk w OSM, jako znajdźki) i wodopój.
6. **Mosty:** wiadukt Zamkowej z arkadami, most Lutosławskiego (neogotycki), kładka nad Tysiąclecia (fikcyjna, modułowa). ADR-0044 odkłada mosty na później; tu są trzy konkretne.
7. **Trolejbus** i **sieć trakcyjna** (proceduralna).
8. **Stragany i budy targowe**, **wiata przystankowa** lubelska, **słup ogłoszeniowy** z kopułą, **parasol ogródkowy** z logo z atlasu: proste, proceduralnie.
9. Małe: Sztukmistrz na linie, Portal Wilno-Lublin, makieta Lublina, pompa z Placu Łokietka, model fary, Latarnia Pamięci.

## 9. Zdjęcia referencyjne

Obejrzane (pobrane do katalogu roboczego, nie do repo):

| Zdjęcie | Co widać | Autor, licencja |
|---|---|---|
| [PLLITLBN.jpg](https://commons.wikimedia.org/wiki/File:PLLITLBN.jpg), [PLLITLBN3.jpg](https://commons.wikimedia.org/wiki/File:PLLITLBN3.jpg), [PLLITLBN6.jpg](https://commons.wikimedia.org/wiki/File:PLLITLBN6.jpg) | Plac Litewski: granitowa posadzka z odwodnieniami, rabaty z ławami z listew, słupy oświetlenia, wystawy, fontanna z dziećmi | CC BY-SA 4.0 |
| [Plac Litewski w Lublinie (SZ-2017-07-09) 03.jpg](https://commons.wikimedia.org/wiki/File:Plac_Litewski_w_Lublinie_(SZ-2017-07-09)_03.jpg), [… 05.jpg](https://commons.wikimedia.org/wiki/File:Plac_Litewski_w_Lublinie_(SZ-2017-07-09)_05.jpg) | panorama placu z czerwonymi banerami; fontanna multimedialna z balustradą czaszy i Pocztą w tle | CC BY-SA 4.0 |
| [Pomnik Konstytucji Trzeciego Maja w Lublinie.jpg](https://commons.wikimedia.org/wiki/File:Pomnik_Konstytucji_Trzeciego_Maja_w_Lublinie.jpg) | pomnik z białym orłem, bordowy klon, słup z poprzeczką | CC BY-SA 4.0 |
| [Lublin Market Square 2015 (1).jpg](https://commons.wikimedia.org/wiki/File:Lublin_Market_Square_2015_(1).jpg), [(3).jpg](https://commons.wikimedia.org/wiki/File:Lublin_Market_Square_2015_(3).jpg) | Rynek: kamienice z attykami, bruk, parasole, potykacze, drewniane stragany, latarenki na kutych wysięgnikach, Brama Krakowska od środka | Radosław Botev (Fundacja Nomos), CC BY 3.0 PL |
| [Lublin night.JPG](https://commons.wikimedia.org/wiki/File:Lublin_night.JPG) | Rynek o zmierzchu: ogródki, polichromie, szyldy, latarenki | Alicja zak, CC BY 3.0 |
| [Lublin, Stare Miasto - Brama Krakowska i Plac Łokietka (2009-06-12).jpg](https://commons.wikimedia.org/wiki/File:Lublin,_Stare_Miasto_-_Brama_Krakowska_i_Plac_%C5%81okietka_(2009-06-12).jpg) | Brama Krakowska, posadzka w szachownicę, słupki z łańcuchami, latarnie pastorałowe, przewody | Szater, CC BY-SA 3.0 / GFDL |
| [Solaris trolleybus, Plac Łokietka, Lublin, Poland 01.jpg](https://commons.wikimedia.org/wiki/File:Solaris_trolleybus,_Plac_%C5%81okietka,_Lublin,_Poland_01.jpg) | trolejbus, sieć trakcyjna z wieszakami, latarnia pastorałowa, słupki | Szater, CC BY-SA 3.0 |
| [Łokietek Square in Lublin 2015.jpg](https://commons.wikimedia.org/wiki/File:%C5%81okietek_Square_in_Lublin_2015.jpg) | Nowy Ratusz, latarnia z koszem kwiatów, przewody nad placem, jarmark | Radosław Botev (Fundacja Nomos), CC BY 3.0 PL |
| [Lublin. Plac Zamkowy (3).jpg](https://commons.wikimedia.org/wiki/File:Lublin._Plac_Zamkowy_(3).jpg) | Plac Zamkowy: parking, łuk kamienic, żółty słup ogłoszeniowy, kandelabr z kwiatami | Gorofil, CC BY-SA 4.0 |
| [PL Lublin KrakPrz59 61.jpg](https://commons.wikimedia.org/wiki/File:PL_Lublin_KrakPrz59_61.jpg) | zachodnie Krakowskie: dwuramienna latarnia, słupki z łańcuchami, baner na ścianie szczytowej | Nutaj, CC BY-SA 3.0 PL |

Do obejrzenia (linki w `refs`, nie udało się pobrać, licencji nie sprawdzałem):
- [Krakowskie Przedmieście (SZ-2017-07-09)](https://commons.wikimedia.org/wiki/File:Krakowskie_Przedmie%C5%9Bcie_w_Lublinie_(SZ-2017-07-09).jpg), [Grodzka 2015](https://commons.wikimedia.org/wiki/File:Grodzka_Street_in_Lublin_2015.jpg), [Plac Po Farze 01](https://commons.wikimedia.org/wiki/File:Lublin_Plac_Po_Farze_01.JPG);
- [schody Zamku](https://commons.wikimedia.org/wiki/File:Lublin,_Zamkowa_9,_zamek,_schody.jpg), [Zamek nocą](https://commons.wikimedia.org/wiki/File:Alians_PL,LublinCastleAtNight,WitcherAllegory,2012,P9300013.jpg), [most na Bystrzycy](https://commons.wikimedia.org/wiki/File:Lublin,_Most_na_Bystrzycy_(05).jpg);
- [trakcja trolejbusowa](https://commons.wikimedia.org/wiki/File:Lublin-trakcja_trolejbusowa.jpg), [fontanna nocą](https://commons.wikimedia.org/wiki/File:Litewski_Square_in_Lublin_-_Fountain_in_Night.jpg);
- kategorie Commons: [Street lights in Lublin](https://commons.wikimedia.org/wiki/Category:Street_lights_in_Lublin), [Bus shelters in Lublin](https://commons.wikimedia.org/wiki/Category:Bus_shelters_in_Lublin), [Hanging baskets in Lublin](https://commons.wikimedia.org/wiki/Category:Hanging_baskets_in_Lublin), [Trolleybus overhead lines in Lublin](https://commons.wikimedia.org/wiki/Category:Trolleybus_overhead_lines_in_Lublin), [Flea market at Zamkowy Square](https://commons.wikimedia.org/wiki/Category:Flea_market_at_Zamkowy_Square_in_Lublin);
- zdjęcia Placu Litewskiego z lat 2023-2025 na fotopolska.eu (licencja na stronie nie jest podana): [plac w stronę 3 Maja](https://fotopolska.eu/2175575,foto.html), [iluminacja świąteczna](https://fotopolska.eu/2384607,foto.html), [„I love Lublin” wieczorem](https://fotopolska.eu/2695514,foto.html).

Opisy: [pl.wikipedia: Plac Zamkowy w Lublinie](https://pl.wikipedia.org/wiki/Plac_Zamkowy_w_Lublinie) (schody, latarnie), [pl.wikipedia: Plac Litewski](https://pl.wikipedia.org/wiki/Plac_Litewski_w_Lublinie) (parkiet, fontanna z obrazem na fasadzie Poczty), [radio.lublin.pl: pokazy fontanny](https://radio.lublin.pl/2024/05/widowisko-na-fontannie-wieczorem-warto-zajrzec-na-plac-litewski-zdjecia), [lublin.eu: zieleń 2016](https://lublin.eu/download/gfx/lublin/userfiles/_public/mieszkancy/srodowisko/aktualnosci/lublin_wiosna_-_prezentacja_maz_2016.pdf) (donice na latarniach, latarnie pastorałowe), [fotopolska: Pomnik Unii Lubelskiej](https://fotopolska.eu/Lublin/b3559,Pomnik_Unii_Lubelskiej.html), [equestrianstatue.org: Piłsudski](https://equestrianstatue.org/pilsudski-josef-2/), [wmuzeach.pl: most na Bystrzycy](https://wmuzeach.pl/all-objects/1Uda8J7iXE1wKXqHgjar_bridge-on-the-bystrzyca-river-).

## 10. Czego nie sprawdzono

- **Zdjęcia.** Commons i API pl.wikipedia szybko zaczęły zwracać 429 (limit zapytań). Pobrałem i obejrzałem 14 zdjęć (tabela powyżej), głównie z Placu Litewskiego, Placu Łokietka, Rynku i Placu Zamkowego. Pobieranie zdjęć z fotopolska.eu zostało zablokowane.
- **Bez zdjęcia, z opisów i ogólnej wiedzy:** wygląd Grodzkiej, Placu po Farze, Zamku, al. Tysiąclecia, dworca, Ruskiej, targów i całego Nabrzeża (brzegi Bystrzycy, Giełda na Kresowej, most Lutosławskiego). Te pozycje warto potwierdzić zdjęciami przed modelowaniem. W JSON mają notatkę „do potwierdzenia”.
- **Pozycje przybliżone:** parkiet do tańca, scena i wystawy na Placu Litewskim, reflektory iluminacji, automaty i budki (wymyślone), kładki nad Tysiąclecia (fikcyjne).
- **Latarnie:** typ dla każdej ulicy przypisany ze zdjęć kilku miejsc i z opisu miasta. Rozstaw (15 do 35 m) to szacunek, nie pomiar.
- **Dworzec PKS** może być już nieczynny lub przebudowywany, bo w 2023 r. otwarto Dworzec Metropolitalny. Nie sprawdzałem.
- **Gatunki drzew:** w OSM prawie nie ma tagów, więc lista gatunków jest ogólna.
- **Latarnia Pamięci:** nazwa i położenie z OSM, wygląd z opisu, bez zdjęcia.
