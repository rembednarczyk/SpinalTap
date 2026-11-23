# Dom z arkadami w osi frontu Alchemii (`alchemia-dom-z-arkadami`)

Jasny, dwukondygnacyjny dom z planszy, stojący za fontanną placu przed frontem, między zielonym stokiem a wykopem rampy (ADR-0074 etap C3, decyzja użytkownika z 19.11: „budynek z arkadami może przejść od frontu”). Obrys x 394–409, z −2…3,7 (`ARCADE_FRONT` w `arcade-front.ts`); na parterze pięć łuków na sześciu filarach (0,75 × 0,8 m), podcień głęboki na 3 m z witrynami skrzydła zachodniego L1 w głębi, piętro od stropu podcienia (2,3) do dachu na poziomie L2 (6,5), a dach to część tarasu L2. Stan gry na `22b1808`.

## Historia
W tym miejscu nie było nigdy domu: stał tu parking w173531008 przy Bajkowskiego (karta `alchemia-t0`). Dom jest odstępstwem z planszy koncepcyjnej i nawiązuje do dwóch prawdziwych podcieni Lublina: kamienic Starego Miasta z przejściem pod piętrem i Arkad przy Świętoduskiej 7, dawnych jatek rzeźniczych, które plan inwestora z 2026 roku odbudowuje z piętrem (`docs/plany/alchemia.md`, S5, S6). Wzorzec to podcień domu targowego: przejście za rzędem filarów, nad którym mieszka albo pracuje piętro.

W 2077 roku dom jest wizytówką galerii: kremowy tynk, ciepły napis ALCHEMIA nad środkowym łukiem, papierowy lampion w każdym przęśle (ADR-0093 O5). Pod podcieniem świecą witryny butiku NIGHT SILK (x 395,8–400,2) i wejście do pasażu L1 zachód. Inwestor postawił go „po staremu”, żeby galeria nie wyglądała z Bajkowskiego jak kolejna szklana skrzynia; ludzie z Shinsekai-7 i tak mówią na niego „atrapa”, bo piętro z ciepłymi oknami nie ma klatki schodowej od ulicy. Na dachu, przy południowej balustradzie nad fontanną, stoją ludzie z kawiarni L3 i palą (postacie `TERRACE_PEOPLE`).

Przed chwilą (cel sceny, §5, w grze brak): pod środkowym łukiem ktoś zostawił na parapecie witryny NIGHT SILK papierowy kubek i torbę z zakupami, a lampion w drugim przęśle kołysze się od przeciągu.

## Klimat
- **Światło:** pięć papierowych lampionów w przęsłach podcienia (na kablach ze stropu), ciepły pas świetlny nad witrynami skrzydła L1 w głębi podcienia (lightbox, O5), witryny NIGHT SILK i pasażu, ciepły napis ALCHEMIA nad środkowym łukiem, okna piętra świecące ciepło albo ciemne (z hasza), pas światła wzdłuż gzymsu pod dachem. Od placu przed domem obręcz i hologram fontanny, od góry holo-ekrany tarasu L2.
- **Dźwięk (cel):** echo kroków w podcieniu, muzyka z butiku, szum fontanny przed łukami, głosy z tarasu nad gzymsem. W grze brak własnych źródeł (dług).
- **Zapach:** perfumy i nowe tkaniny z NIGHT SILK, mokry tynk, smażone z kiosków placu.
- **Pogoda:** podcień jest suchy, deszcz pada przed filarami na podium.
- **Kontrast (§3):** tynk „jak przed wojną” na budynku postawionym kilka lat temu, a pod nim butik z neonowym szyldem i kabel lampionu przeciągnięty przez strop.
- **Ruch i życie:** przechodnie między placem a pasażem L1, trzy postacie na dachu (dwie przy balustradzie nad fontanną, jedna pali), lampiony. Pod samym podcieniem nie ma miejsc tłumu.

## Przeznaczenie
- Punkt orientacyjny frontu od Bajkowskiego (ciepły napis i łuki widać z chodnika i z Placu Łokietka), brama z placu do sklepów L1 i dalej do galerii.
- **Wejścia:** pięć przęseł od podium placu (posadzka podcienia na wierzchu podium, −0,64), pasaż L1 zachód (1,8 m) i drzwi NIGHT SILK (1,5 m), w obu trzy stopnie w dół od podium (O5), przejście za filarami na wschód do przejścia pod L2.
- **Osłony:** sześć filarów (bryły), donice przy filarach (dziś bez bryły, G-957).
- **Ucieczka:** na plac i schody do Bajkowskiego, pasażem L1 na T0 i do galerii, przejściem pod L2 do osi wejścia.
- **Punkt widokowy:** dach domu (część tarasu L2 na 6,5, wejście z L3, `front-nav.ts`) widzi cały plac, fontannę i Bajkowskiego.

## Topografia
- Prawdziwe miejsce: południowo-zachodnia część parkingu w173531008 przy Bajkowskiego; teren według NMT −2,0…−1,1.
- W grze: dom w obrysie frontu (T-327), podcień na podium placu C5 (T-241). Bez wpisu T własnego: dom wchodzi w odstępstwo frontu galerii z planszy. Wysokość 6,5 nad terenem ok. −1,5, czyli ok. 8 m, poniżej okapów kamienic Świętoduskiej.
- Odstępstwo celowe: budynek z planszy (§1: budynek z planszy koncepcyjnej to odstępstwo celowe z odnośnikiem do planszy). Plansza pokazuje nad gzymsem taras z cyjanową krawędzią i zielenią; w grze to pas światła w gzymsie, krzewy z gry i balustrada (C3).

## Inwentarz docelowy
- **Architektura:** filary, łuki z licem i podniebiem, piętro z oknami z ramą, słupkiem i ślemieniem, gzyms z pasem światła, dach-taras z balustradą (są, `arcade-front.ts`, `arcade-front-geometry.ts`); do zrobienia rynny i rura spustowa przy narożniku (woda z tarasu ma skąd spływać), kratka wentylacji butiku nad witryną.
- **Duże obiekty:** lampiony w przęsłach (są), witryny i szyld NIGHT SILK (są, O5), donice przy filarach (są, bez bryły); do zrobienia ławka pod podcieniem przy ścianie pasażu (`bench`), stojak z ulotkami galerii.
- **Drobiazg w skupiskach (§14):** przy wejściu do pasażu ulotki, niedopałki przy filarze, kubek na parapecie witryny, torba z zakupami (Street Asset Pack, ADR-0096); na dachu popielniczka i kubki przy palących.

## Frakcja i zasady
Frakcja: korporacja, ulica (wizytówka galerii, pod którą przechodzi deptak).
- §12 zgodne: z otwartego placu wchodzi się pod niski podcień (ok. 2,9 m nad podium, głębokość 3 m), a z niego trzema stopniami w dół do pasażu L1; próg zmienia strop, światło (lampiony i witryny zamiast nieba) i materiał podłogi. Moduł przęseł wynika z obrysu (15 m na pięć łuków), nie z siatki 0,5 m.
- §13 częściowo: lampiony, pas nad witrynami i napis mają oprawy; łuki są jaśniejsze od ściany, więc wejście czyta się samo. Okna piętra świecą bez pomieszczeń za nimi (to rysunek fasady, nie wnętrze). Brak pomiaru 60-30-10.
- §14 dług: makro (filary) i mezo (lampiony, donice) są, mikro brak.
- §15 częściowo: szkło witryn daje połysk przy matowym tynku; podcień suchy zgodnie z deszczem, posadzka przed filarami bez kałuż.
- §16 częściowo: tynk i łuki to „historyczna” fasada inwestora, a nie materiały korporacji z matrycy (szkło, stal); celowe, bo dom ma udawać stary.
- §17 częściowo: skalę dają drzwi (1,5 m szerokości), stopnie i filary. Ruch: przechodnie, postacie na dachu. Dźwięku ze źródła brak, lampiony nie kołyszą się.

## Scenariusz tła
- Kto tu bywa: klienci butiku NIGHT SILK i pasażu L1 zachód; przechodnie z Bajkowskiego, dla których ciepły napis i łuki są punktem orientacyjnym; goście kawiarni L3, którzy palą na dachu przy balustradzie nad fontanną.
- Co się dzieje: w dzień podcień prowadzi z placu do sklepów L1, a witryny NIGHT SILK świecą pod łukami; wieczorem zapalają się papierowe lampiony w przęsłach i napis ALCHEMIA, a na dachu zbierają się palacze z kawiarni.
- Ślad obecności: papierowy kubek i torba z zakupami na parapecie witryny NIGHT SILK pod środkowym łukiem, lampion kołyszący się od przeciągu w drugim przęśle, niedopałki przy balustradzie dachu.

## Dług sceny
- Bryły donic przy filarach i donica stojąca na filarze 2 (G-957): `planterSolids` w `packages/sim/src/content/alchemia/front-plaza-cafe.ts`.
- Drobiazg pod podcieniem i na tarasie dachu: części na końcu listy w `packages/sim/src/content/alchemia/arcade-front.ts` (rysunek w `packages/engine/src/renderer/alchemia/arcade-front-geometry.ts`).
- Rynny i rura spustowa, kratka wentylacji butiku (§9 komiksowy realizm, prawdziwe części): `arcade-front-geometry.ts`.
- Ruch lampionów (kołysanie w shaderze z czasu materiału, bez losowości) i ich dźwięk na wietrze: `arcade-front-geometry.ts`, emiter w `packages/engine/src/audio/`.
- Okna piętra bez wnętrza: zasłony albo rolety w części okien i jedna sylwetka za szybą, żeby piętro nie było „atrapą” z bliska: `arcade-front-geometry.ts` (rysunek, bez wnętrza w `INTERIORS`).
- Pomiar §13: ujęcie nocne z obręczy fontanny na łuki (ok. (399,5; −7)) w `tools/shots/room-spots.json`.
