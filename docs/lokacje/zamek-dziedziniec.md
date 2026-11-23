# Dziedziniec Zamku Lubelskiego, Kaplica Trójcy i Donżon (`zamek-dziedziniec`)

Dziedziniec Zamku (OSM w383162808, środek (910; 223), poziom y −7,3) w podkowie neogotyckiego gmachu w48500136, z Donżonem w450180469 (893,1; 214,6) i Kaplicą Trójcy Świętej w66258167 (941; 214,6) od wschodu. Scena aktu III „Źródło” (ADR-0095): rdzeń archiwum Kagami za zachodnimi drzwiami Kaplicy (929,5; 215,5), archiwistka przy nich, ochrona Kagami na dziedzińcu, Kurosawa po zakończeniu aktu II `kagami`. Stan gry na `1de4702`.

## Historia
Na wzgórzu zamkowym stał gród, od którego wzięła się Grodzka. Najstarszą budowlą Lublina jest okrągły Donżon z XIII wieku, kamienny u dołu i ceglany wyżej. W XIV wieku powstała gotycka Kaplica Trójcy Świętej ze sklepieniem opartym na jednym filarze; w 1418 roku z fundacji Władysława Jagiełły jej wnętrze pokryły freski rusko-bizantyjskie, podpisane cyrylicą przez mistrza Andrzeja. Przez wieki freski leżały pod tynkiem i odsłonięto je dopiero pod koniec XIX wieku. W 1569 roku w Lublinie zawarto unię z Litwą. Dzisiejszy gmach z blankami i ostrołukami zbudowano w latach 1824–1826 jako więzienie i był nim do 1954 roku, przez zabory, dwudziestolecie, okupację niemiecką i pierwsze lata powojenne. Potem wzgórze zajęło muzeum.

W 2077 nad bramą dalej wisi napis MUZEUM, ale Zamek jest siedzibą Kagami Biotech pod ochroną dronów (ADR-0068, ADR-0095). Kagami ustawiło rdzeń archiwum w Kaplicy, bo grube mury i freski nie przepuszczają sygnału: „zero zasięgu, idealne miejsce na serwer” (`kurosawa_castle`). Pod freskami stoją szafy serwerów jak ławki, a w nich zapis pięćdziesięciu tysięcy ludzi i oryginał Ayi, zapis zero serii (`kagami_core`). W ostatnich dniach z deptaka znikają ludzie, którym oddano chipy; sąsiedzi widzieli białą furgonetkę bez tablic, która pojechała Zamkową pod górę (`zrodlo_ume`). Przed chwilą archiwistka wyszła z Kaplicy sprawdzić kable, bo rdzeń się przegrzewa, i zostawiła uchylone drzwi.

## Klimat
- Światło: kremowy gmach w oszczędnej warstwie 2077 (`landmarks/recipes.ts` `ZAMEK`): ciepłe linie pod blankami (#ffc98a), reflektory (pięć w 60 m, dwa świecą na dziedziniec zamiast na fasadę od placu, G-206), latarenki ścienne (19). Docelowo: zimny cyjan diod rdzenia w szparze drzwi Kaplicy, czerwone diody kamer i dronów nad dziedzińcem, ciepłe okna muzeum.
- Dźwięk: dziś tylko deszcz i ruch miasta z dołu. Docelowo: szum chłodzenia szaf za drzwiami Kaplicy, buczenie kabli, kroki ochrony po płytach, dron nad wzgórzem.
- Zapach: mokry kamień, ozon z chłodzenia, wosk z Kaplicy (wspomnienie `recall_chapel`).
- Kontrast: freski z 1418 roku i szafy serwerów; więzienna podkowa gmachu i sterylna ochrona korporacji.
- Ruch: ochrona na dziedzińcu (stoi), archiwistka przy drzwiach; brak tłumu i zwiedzających.

## Przeznaczenie
- Scena finału aktu III: krok `chapel` (rozmowa z archiwistką, flaga `core_reached`, wspomnienie `chapel`) i `core_choice` (wybór `erase`, `release` albo `keep`, flaga `act3_ending`). Przy zakończeniu aktu II `kagami` tu zaczyna się też krok `source_lead` (Kurosawa).
- Wejścia: brama w zachodnim skrzydle (przejście w652347355 od (835,6; 238,5) do (852; 237,2), dziś 2,4 × 3,4 m, G-078), otwarcie dziedzińca na wschód między Kaplicą a północnym skrzydłem (pomiar `inBuilding`: x ok. 950, z 222..246), podniesione wejście Donżonu po metalowych schodach (886; 218) bez otworu w grze.
- Osłony: Donżon (walec 15,5 m), pawilon wystaw (872,4; 224,3), dwie rzeźby (914,6; 218,4) i (925,3; 218,6), granitowy blok (905,8; 215,2); studni i armat z OSM w grze nie ma (T-025).
- Punkty widokowe: brama z osią dziedzińca na Kaplicę (ok. 80 m); taras Donżonu bez dostępu.

## Topografia
- Prawdziwe miejsce: Dziedziniec Zamkowy w383162808, Zamek w48500136, Donżon w450180469, Kaplica Trójcy w66258167. Dziedziniec ok. 188,5 m n.p.m. (y −7,3), przedpole bramy y −8,7..−7,3, Plac Zamkowy ok. 175,8 m n.p.m. (y −20); trzy poziomy zgadzają się z NMT co do 0,1 m (`docs/plany/zamek-lubelski.md`).
- Zgodne: położenie i obrysy, wysokości Kaplicy i Donżonu po korekcie (T-114), proceduralna wieża Kaplicy usunięta (T-119), przepis Zamku z attyką, ryzalitem i wieżyczkami (G-841, etap Z2).
- Odstępstwa: brama 2,4 × 3,4 m zamiast ok. 3,8 × 5,8 m (T-040, G-078); reflektory fasady po stronie dziedzińca (T-116, G-206); pawilon wystaw jako sklep z daszkiem (T-118); studnia `building=roof` pominięta (T-025); dziedziniec bez nazwy na mapie (T-048); brak przepisu Kaplicy i Donżonu (etap Z3 ADR-0068); rdzeń Kagami w Kaplicy to przyszłe odstępstwo celowe, wpis T przy etapie 3 ADR-0095.

## Inwentarz docelowy
Architektura:
- Kaplica z przepisem: cegła, szkarpy, wysokie okna ostrołukowe, niższe prezbiterium z absydą, szczyt zachodni z drzwiami jako prawdziwym otworem (do zrobienia, ADR-0068 Z3, `landmarks/recipes.ts`);
- Donżon z kamiennym cokołem, ceglaną górą, strzelnicami i balustradą tarasu, metalowe schody do wejścia (do zrobienia, Z3);
- brama w wymiarze portalu (G-078), studnia z daszkiem (T-025), pawilon muzeum (T-118).
Duże obiekty:
- rdzeń archiwum przy drzwiach Kaplicy, dopóki wnętrza nie ma: szafa z chłodzeniem, terminal ze złączem, wiązki kabli wchodzące w drzwi (do zrobienia: Blender `tools/blender/rooms/zamek_dziedziniec.py`; zestaw ma już `rd-k-control-cabinet`, `rd-c-cable`);
- maszt z anteną albo radar na Donżonie, kamery na murach, stanowisko ochrony przy bramie z bramką i skanerem (ADR-0068 warstwa 2077; do zrobienia, etap Z6);
- biała furgonetka bez tablic na przedpolu bramy w akcie III (ślad z `zrodlo_ume`; pojazd `vehicle-props` w kolorze bieli);
- cztery armaty przy bramie (OSM n13624909112..115, T-025).
Drobiazg w skupiskach:
- przy drzwiach Kaplicy: kubek archiwistki, tablet, rolka taśmy, zapasowe złącze, tabliczka na drzwiach (Blender `zamek_dziedziniec.py`);
- przy stanowisku ochrony: kubki z automatu, niedopałki, opakowania po racjach (generator ADR-0096 `litter`);
- na płytach: ślady opon furgonetki, kałuże (Blender `rd-c-puddle`).

## Frakcja i zasady
Frakcja: korporacja, technika (rdzeń archiwum w zabytku).
- §12 zgodne: brama 16 m długości i 2,4 m szerokości (ciasno, nawet za ciasno, G-078) otwiera się na dziedziniec ok. 100 × 27 m z Donżonem i Kaplicą; oś dziedzińca prowadzi do celu.
- §13 dług: cel aktu (drzwi Kaplicy z rdzeniem) nie ma żadnego światła ani barwy; nocą dziedziniec oświetlają przypadkowe reflektory (G-206) i latarenki. Brak akcentu korporacji (zimna biel, cyjan). 60-30-10 niemierzone.
- §14 dług: zero rekwizytów gry; makro to bryły zabytków, mezo dwie rzeźby i blok, mikro zero. Korporacja może być czysta (§16), ale rdzeń, kable i stanowisko ochrony to treść sceny.
- §15 częściowo: płyty dziedzińca mokre w deszczu; brak szkła, stali i połysku techniki Kagami przy kremowym tynku.
- §16 częściowo: gmach czyta się jako muzeum (napis MUZEUM, ciepłe linie, bez kamer i dronów); korporację zdradzają tylko postacie.
- §17 dług: żadnego dźwięku ze źródła (rdzeń milczy, choć ink mówi „szumią szafy serwerów”); brak ruchu poza postaciami; brak przedmiotów skali przy drzwiach Kaplicy.

## Scenariusz

### Pierwszy kadr
Gracz wchodzi z przedpola przez bramę w zachodnim skrzydle: 16 m ciasnego przejazdu pod kremowym gmachem i nagle dziedziniec. Na wprost, ok. 80 m dalej, zachodni szczyt Kaplicy z drzwiami i archiwistką przy nich, po prawej okrągły Donżon, po lewej ostrołuki północnego skrzydła, na środku czterech ludzi ochrony Kagami. Wzrok ma iść na drzwi Kaplicy; docelowo przez szparę świeci cyjan diod i biegną po płytach kable.

### Postacie i miejsca
- Archiwistka (`archivist`, frakcja Kagami) przy drzwiach Kaplicy (927,6; 215,5), twarzą ku środkowi dziedzińca (912; 228); od flagi `castle_lead` na zawsze, także po epilogu.
- Kurosawa (`kurosawa-castle`) na środku dziedzińca (912; 228), twarzą do drzwi Kaplicy; tylko po zakończeniu aktu II `kagami`, do `act3_ending`.
- Czterech strażników Kagami (`kagami-guard-1..4`, przeciwnik `kagami_cleaner`) przy (918; 222,5), (916; 236), (904; 230), (922; 229), wszyscy twarzami na wschód ku (940; 230), czyli ku otwarciu dziedzińca za Kaplicą; od `castle_lead` do `act3_ending`. Wrodzy po zakończeniach `street` i `hebi` (Kagami −20 po akcie II), przyjaźni po `kagami`.
- Brak harmonogramów: wszyscy stoją o każdej porze.

### Przebieg
1. Wezwanie (akt III): po `street` Ume na deptaku mówi o furgonetce, która pojechała Zamkową pod górę; po `hebi` Ren pokazuje na dłoni kropkę nad Kaplicą; po `kagami` Kurosawa wzywa na kalibrację, „Proszę przyjść sama”, i czeka na dziedzińcu (`kurosawa_castle.invite`: dziura w zapisie, dwa dni, kiedy Aya miała siedem lat). Flaga `castle_lead`.
2. Dojście: Grodzka, Brama Grodzka, Zamkowa, Plac Zamkowy, schody na wzgórze, przedpole, brama. Po `street` i `hebi` za bramą stoi wroga ochrona: walka albo przemknięcie do drzwi Kaplicy. Po `kagami` ochrona przepuszcza.
3. Rdzeń (`chapel`): archiwistka mówi „Nie strzelaj. Ja tylko pilnuję, żeby się nie przegrzał” albo, po `kagami`, „Proszę usiąść, złącze jest zimne”. Złącze dotyka karku, flaga `core_reached`, retrospekcja `recall_chapel`: siedmioletnia Aya z matką przed freskami, dwa dni bez zasięgu, jedyne wspomnienie, którego nikt nie nagrał. Nagroda: wspomnienie `chapel`.
4. Wybór (`core_choice`): rozmowa z archiwistką (`kagami_core.decide`), trzy zakończenia: `erase` (diody gasną szafa po szafie, od ołtarza do drzwi), `release` (nad Lublinem zapalają się okna), `keep` (Seki siada pod freskiem z aniołem). Flaga `act3_ending`, ochrona i Kurosawa znikają.
5. Epilog sam po retrospekcji i wyborze (`act3_epilogue`), potem ekran końca i wolna gra.

### Drogi
- Cicha: strażnicy patrzą na wschód, plecami do bramy, więc wejście przez bramę i wzdłuż południowej ściany za Donżonem i pawilonem prowadzi do drzwi Kaplicy z tyłu ochrony; strażnik (904; 230) stoi 11 m od Donżonu, jedyny blisko tej drogi.
- Głośna: od bramy przez otwarte płyty; osłony to Donżon, pawilon, rzeźby i blok; czterech na dystansie 15–30 m.
- Ucieczka: z powrotem przez bramę na przedpole i schodami na Plac Zamkowy (metro A (722; 286)); przez otwarcie na wschód za Kaplicą (do sprawdzenia, czy teren i graf nawigacji przechodzą na skarpę).
- Pułapki: przejazd bramy 2,4 m bez osłon (przy wrogiej ochronie to korytarz pod ostrzałem, jeśli ktoś się odwróci).

### Pora i stan świata
- Dzień i noc wyglądają tak samo poza światłem; brak zwiedzających za dnia i ochrony z latarkami nocą.
- Przed aktem III: dziedziniec pusty, muzeum. Od `castle_lead`: archiwistka, ochrona, ewentualnie Kurosawa. Po `act3_ending`: zostaje archiwistka („Kaplica znowu jest cicha” albo „Rdzeń słucha teraz ciebie”). Epilog: po `erase` Kagami zwija biuro, „zostają freski i ślady po szafach na posadzce”; po `keep` na drzwiach Kaplicy wisi tabliczka „Archiwum. Wstęp za zgodą”.
- Frakcje: Hebi nie przychodzą pod Zamek („za drogo”, `zrodlo_ren`); to teren Kagami, poza terytoriami ADR-0091.

### Wymagania wobec sceny
- Rdzeń przy drzwiach Kaplicy, dopóki nie ma wnętrza (etap 3 ADR-0095): szafa, kable wchodzące w drzwi, terminal ze złączem, światło diod i szum chłodzenia. Dziś archiwistka stoi przy gołej ścianie.
- Drzwi Kaplicy jako otwór w bryle z uchylonym skrzydłem (ADR-0068: etap bryły przygotowuje wejścia pod akt III; Z3 niezrobiony).
- Stan sceny zależny od zakończenia: diody i szum gasną po `erase`, zostają po `keep` (tabliczka na drzwiach), znikają szafy po epilogu `erase`.
- Warstwa korporacji widoczna z dziedzińca: kamery, stanowisko ochrony przy bramie, antena na Donżonie, dron nad wzgórzem.
- Ochrona ustawiona przodem do bramy, którą przychodzi gracz, albo z obchodem.
- Brama w wymiarze portalu (G-078), żeby kamera TPP i walka w przejeździe działały.

## Dług sceny
- Rdzeń archiwum przy drzwiach Kaplicy: szafa z chłodzeniem, terminal, kable po płytach i w drzwiach, diody w cyjanie (źródło światła rdzenia): modele w nowym `tools/blender/rooms/zamek_dziedziniec.py`, rekwizyty i lampa w `packages/sim/src/content/castle-act3.ts` (nowa lista rekwizytów dopisana na końcu `GAME_PROPS` w `packages/sim/src/content/street-props.ts`).
- Szum chłodzenia rdzenia i buczenie kabli jako emiter, wyciszany po zakończeniu `erase`: `packages/engine/src/audio/spatial.ts`, `packages/engine/src/audio/ambience.ts`.
- Drzwi zachodnie Kaplicy jako otwór i przepis Kaplicy i Donżonu (etap Z3 ADR-0068): `packages/engine/src/renderer/mapcity/landmarks/recipes.ts`.
- Sprzeczność ADR i gry: ADR-0068 i ADR-0095 mówią, że Zamek jest siedzibą korporacji pod ochroną dronów, a przepis `ZAMEK` ma napis „MUZEUM” i warstwę stonowaną bez kamer, anteny i stanowiska ochrony. Propozycja: muzeum zostaje fasadą od placu (decyzja użytkownika z 1.11), a od dziedzińca i dworca dochodzi znak Kagami, kamery i antena na Donżonie (etap Z6): `packages/engine/src/renderer/mapcity/landmarks/recipes.ts`.
- Sprzeczność ADR z ADR: ADR-0068 każe dać korporacji nazwę generyczną, a ADR-0095 i ink (`m3-zrodlo.ink`) umieszczają tu Kagami Biotech. Propozycja: dopisek w `docs/adr/0068-zespol-zamkowy.md`, że korporacją Zamku jest Kagami.
- Strażnicy patrzą na wschód (940; 230), plecami do bramy: obrócić dwóch ku bramie (845; 238) albo dać obchód: `packages/sim/src/content/castle-act3.ts` (`GUARD_SPOTS`, `facing`).
- Tabliczka na drzwiach Kaplicy zależna od zakończenia (`keep`: „Archiwum. Wstęp za zgodą”) i ślady po szafach po `erase`: rekwizyty z warunkiem `when` w `packages/sim/src/content/castle-act3.ts`, tekst szyldu w języku świata (ADR-0056).
- Biała furgonetka bez tablic na przedpolu bramy od `castle_lead` po zakończeniu `street`: `packages/sim/src/content/castle-act3.ts` (pojazd zaparkowany, `parked-cars.ts`).
- Brama 3,8 × 5,8 m (G-078, T-040): korekta w `tools/osm-import`.
- Reflektory fasady na przedpole (G-206) i dolne kandelabry schodów (G-205): plan mebli `tools/osm-import`.
- Studnia z daszkiem i cztery armaty (T-025), pawilon muzeum (T-118): `tools/osm-import` i `packages/engine`.
- Zwiedzający za dnia (tłum na dziedzińcu, dziś pasy tłumu tylko w Krakowskim i na Starym Mieście): `packages/sim/src/content/crowd.ts`.
- Zmierzyć 60-30-10 nocą od bramy na Kaplicę po dodaniu światła rdzenia.
