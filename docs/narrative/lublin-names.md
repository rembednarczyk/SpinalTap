# Lublin 2077: nazwy miejsc w narracji

Lista zmian nazw w tekstach ink (`packages/narrative/ink/`) po przeniesieniu świata do centrum Lublina (ADR-0042). Służy agentom, którzy zmieniają nazwy dystryktów, toasty, cele zadań i opisy w `core`, `sim`, `app` i `ui`, żeby teksty mówiły o tych samych miejscach.

Identyfikatory w kodzie zostają: dystrykty (`shinsekai-7`, `kanal`, `targ`, `doki`), knoty (`enc_s7_*`, `enc_kanal_*`, `enc_targ_*`, `enc_doki_*`, `metro_ride_*`, `radio_*`, `hook_*`, `phone_*`), zmienne, flagi (np. `kenta_overpass`, `hideo_bridge`) i tagi `#tone:`. Postacie i frakcje bez zmian.

## Dystrykty

| Stara nazwa | Nowa nazwa | Id dystryktu | Uwagi |
|---|---|---|---|
| Shinsekai 7, Shinsekai, „Siódma” | Krakowskie Przedmieście, „Krakowskie”, deptak | `shinsekai-7` | od Placu Litewskiego do Bramy Krakowskiej |
| Ulica Kanałowa, Kanałowa | Stare Miasto | `kanal` | Rynek, Trybunał, Grodzka, Brama Grodzka, Archikatedra, Wieża Trynitarska; teren Hebi |
| Targ pod estakadą, targ | Podzamcze, targ na Podzamczu, Nowy Plac Targowy | `targ` | Plac Zamkowy, Zamek, ul. Ruska, hala targowa, dworzec autobusowy |
| Doki Tessen, Doki, port | Nabrzeże Bystrzycy, nabrzeże | `doki` | sektor W-3 Tessen nad rzeką (hale dronów, wieża kontrolna, ADR-0082), dojazd metrem |

## Miejsca w dystryktach

| Stare | Nowe | Gdzie w ink |
|---|---|---|
| wrak na Siódmej | wrak na Krakowskim (przy Placu Litewskim) | `m0.ink` `fixer.first_meeting`, `m3-echo.ink` `recall_crash_night`, `m3-lustro.ink` `recall_last_call` |
| zaułek za myjnią, na północnym końcu ulicy | podwórko za myjnią, przy Placu Łokietka, na końcu deptaka | `m0.ink` (cel M0, `car_wash`) |
| Neon Koi „po drugiej stronie ulicy” | Neon Koi po drugiej stronie deptaka, naprzeciwko kliniki | `m0.ink` |
| klinika Mori „po lewej stronie ulicy” | klinika po lewej stronie deptaka, bliżej Placu Litewskiego | `m0.ink` `ume` |
| „na ulicy w Shinsekai” | na Krakowskim Przedmieściu | `m3-echo.ink` |
| latarnia (poeta Shiro) | latarnia na Placu Litewskim | `enc-shinsekai.ink` |
| kładka nad Kanałową, „pod kładką” | kryta kładka nad Grodzką, pod kładką na Grodzkiej | `hooks.ink`, `enc-kanal.ink`, `m4-ulica.ink` |
| kontener na śmieci przy przejściu do Shinsekai | kontener na śmieci pod Bramą Krakowską, od strony deptaka | `m4-ulica.ink` `tetsu` |
| zabetonowany kanał (pod kratką) | Czechówka w rurach pod Starym Miastem | `enc-kanal.ink` `enc_kanal_fisherman` |
| „pod mostem” (Mei) | lochy Trasy Podziemnej pod Rynkiem | `m4-ulica.ink` `mei` |
| KARAOKE, DENKI | KARAOKE przy Rynku, DENKI na rogu Rynku | `enc-kanal.ink` |
| estakada, estakada nad targiem, pokład estakady | wiadukt nad aleją Tysiąclecia tylko jako wspomnienie targu (Goro: „pod wiaduktem, a teraz tu, w Alchemii”); pokładu nie ma od T-021, a Kurosawa czeka w pasażu T0 pod frontem Alchemii, przy windzie (ADR-0074 B1) | `m4-ulica.ink` `goro`; Kurosawa: `m0.ink` `fixer`, `m3-lustro.ink` `ren_odagiri.waiting`, cele `quest.m3_lustro.overpass` i `.ambush` w `ui` |
| auto na estakadzie z nocy blokady | torba z nocy blokady przed łukami Arkad, na dolnym placu Alchemii (ADR-0074 etap 2) | `m4-ulica.ink` `sachiko`, `radio.ink` `radio_drift_5` |
| dach nad targiem pod estakadą (Ren) | dach szklanego pawilonu na rogu Alchemii, drabina od zaplecza (ADR-0074 etap 3) | `m0.ink` `ume.ren_trail`, `m3-echo.ink` `mori.ren_trail` |
| wschodnia ściana targu | chodnik alei przy dworcu (`enc_targ_debt`); skrytka Hebi w schronie pod Alchemią (`m4-targ.ink`, ADR-0074 etap 5d2) | `enc-targ.ink`, `m4-targ.ink` |
| widok z estakady „na miasto” | taras na dachu galerii Alchemii, z widokiem na Ratusz i Stare Miasto | `m4-ulica.ink` `kenta` |
| ramen u Fumiko na targu pod estakadą | ramen u Fumiko w Alchemii | `radio.ink` |
| rampa za magazynem w porcie | rampa za magazynem nad Bystrzycą | `m3-echo.ink` |
| kuchnia z oknem na port | kuchnia z oknem na Bystrzycę | `m3-lustro.ink` `recall_mirror` |
| walizka z portu | walizka z nabrzeża | `m3-lustro.ink` `recall_rooftop` |
| terminal portowy pod dźwigiem | terminal Tessen na nabrzeżu przy pomoście, strzelec na dachu hali (ADR-0082) | `m4-doki.ink`, `hooks.ink` |
| administracja Doków | administracja Nabrzeża | `hooks.ink` |
| „po drugiej stronie zatoki”, „nad zatoką mgła” | po drugiej stronie Zalewu Zemborzyckiego, mgła nad Zalewem Zemborzyckim | `m4-doki.ink`, `radio.ink` |
| „W porcie słucha się Kaito”, „Port jest ich, woda jest moja” | „Na nabrzeżu słucha się Kaito”, „Nabrzeże jest ich, Bystrzyca jest moja” | `m4-doki.ink` |

## Metro (`metro.ink`)

| Knot | Stara stacja | Nowa stacja |
|---|---|---|
| `metro_ride_1` | Shinsekai | Plac Litewski (Krakowskie Przedmieście) |
| `metro_ride_2` | Ulica Kanałowa (Kanaru-dōri) | Brama Krakowska (Stare Miasto) |
| `metro_ride_3` | Targ pod estakadą (Kōka-shita Ichiba), przesiadka na autobusy nocne | Plac Zamkowy (Podzamcze), przesiadka na dworzec autobusowy i linie nocne |
| `metro_ride_4` | Doki Tessen (Tessen Dokku), przepustka portowa | Nabrzeże Bystrzycy, strefa Tessen, przepustka Tessen |

Zapowiedzi zostają dwujęzyczne: japońskie „Tsugi wa … desu” z polską nazwą stacji, potem polska zapowiedź.

## Koloryt dopisany w tekstach

- cebularz w wagonie metra (`metro_ride_7`) i wczorajsze cebularze w kiosku Sachiko, zapiekanki spod Bramy (`m4-ulica.ink`);
- Lubelski Festiwal na Placu Litewskim (idolka z `enc_targ_idol`);
- Motor Lublin: przyśpiewka na szafie grającej w Neon Koi (`koi_regular`);
- UMCS Corp jako korpo-uczelnia (sarariman z `enc_s7_salaryman` śni o dziekanie);
- Trybunał, Archikatedra, Wieża Trynitarska, Trasa Podziemna, Czechówka, Zalew Zemborzycki.

## Celowo bez zmian

- „morze”, które obiecuje Ren (`recall_rooftop`, finał aktu II): to marzenie o ucieczce z miasta, nie miejsce w Lublinie; test `m3-lustro.test.ts` go sprawdza.
- „siedzę na kanale” (Ren): kanał radiowy, nie wodny.
- wiadukt z nocy wypadku (`recall_crash_night`, „Jedź prosto do wiaduktu”): cel pułapki przed Seki na Krakowskim Przedmieściu, do którego nie dojechała; nie jest wiaduktem nad Tysiąclecia.
- „ulica”, „ta ulica” w znaczeniu ludzi z okolicy i półświatka.
- nazwy lokali i szyldów (Neon Koi, PACHINKO, KARAOKE, DENKI, SAKE, OKONOMI), imiona postaci i frakcje.

## Do zrobienia poza narracją (inni właściciele)

Teksty spoza ink, które dalej używają starych nazw (stan przy tej zmianie):
- nazwy dystryktów, toasty i stacje metra w `packages/sim/src/content/` i `packages/app/src/metro.ts` (testy `m2-streaming`, `wave2`, `wave2-hud`, `hud-ui` w `packages/app/test`, `docks`);
- cele zadań aktu II są w katalogach `ui` (ADR-0056) i mówią o pasażu pod frontem Alchemii (`quest.m3_lustro.overpass`, `.ambush`); identyfikatory `overpass`, `kenta_overpass` i `stash:targ-overpass` zostają dla zapisów;
- frakcja „Mieszkańcy Shinsekai” w skanerze (`app`, `ui`), menu tytułowe i panel sklepu w `ui`;
- etykiety miejsc zleceń (`contract_site`, np. „parking przy furgonetce”) przychodzą z domeny, nie z ink.
