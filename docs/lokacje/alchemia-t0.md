# Taras T0 Alchemii (`alchemia-t0`)

Poziom T0 (−1,9…−2,2, parter galerii od Bajkowskiego) po zabudowie frontu (ADR-0074 B1, ADR-0093 O2b): zadaszony pas pod płytą L2 między skrzydłami L1, od podium placu i arkad (z ok. 1) do drzwi głównych P1 (z 32). Składa się z trzech równoległych pasm: przejścia pod L2 na zachód od rampy (x 404–409,7), otwartego wykopu rampy P−1 z grządkami na parapetach (x 409,7–418,3, otwarty do z 11) i osi wejścia głównego z pasami LED (x 419,2–422,8). Plac T0 z pergolami z etapu 7 zniknął pod frontem; z niego zostały grządki (`square.ts`). Północny koniec pasażu przy windzie, drzwiach P1 i pawilonie metra B opisuje karta `alchemia-parking-kiosk` (scena Kurosawy). Stan gry na `22b1808`.

## Historia
Był tu naziemny parking w173531008 (w OSM Przystankowa) z alejkami w177513189 i w173567309: wjazd od Bajkowskiego przy (414; −7), wyjazd na Lubartowską przy przystanku Brama Krakowska 01. Parking zajmował skraj działki Alchemii przez dwie dekady sporu miasta ze spółką Arkady. Plan inwestora z 2026 roku chowa auta pod ziemię, na dwa poziomy z funkcją schronu, a na górze daje „zielony plac z placem zabaw, schodkami i miejscem na wydarzenia” (`docs/plany/alchemia.md`, S5, S13). W grze plac powstał w etapie 7 (pergole, girlandy, trawniki, ławki deptaku), a po decyzji użytkownika z 19.11 przykrył go cały front galerii: podium L1, płyta L2 na słupach i L3 z napisem (T-327).

W 2077 roku T0 jest pasażem pod galerią: przejściem dla ludzi z Bajkowskiego i spod arkad do drzwi P1, do metra i do windy. Auta zjeżdżają rampą na P−1 tuż obok pieszych, za parapetami z grządkami kwiatów, które ochrona galerii podlewa raz w tygodniu, a ludzie z deptaku używają jako ławek i popielniczek. Oś wejścia dostała zielony portal i przerywane pasy LED, bo wcześniej klienci błądzili między domkiem klatki a pawilonem na rogu (ADR-0093 O2b).

Przed chwilą (cel sceny, §5, w grze brak): na grządce przy zachodnim parapecie ktoś zostawił do połowy zjedzony karton z jedzeniem z kiosku placu, a obok tli się niedopałek.

## Klimat
- **Światło:** zielony portal wylotu rampy (pasy wzdłuż ścian metr nad jezdnią i pas nad wylotem pod L2, `front-dress.ts`), przerywane pasy LED w posadzce po krawędziach osi i pas w podsufitce L2 nad nią, przerywany pas w poprzek nad zakrytą częścią rampy (z 12,4), zielone ościeża drzwi głównych (O2b); latarnia pastorał z planu (422,8; 3,5) na wschodnim skraju osi; od zachodu witryny sklepów L1 (pasaż L1, FARMA PLUS, BLACK LOTUS), od południa lampiony podcienia arkad i światło placu. Pod płytą jest ciemniej niż na placu i na deptaku, a światło prowadzi zielenią (§4).
- **Dźwięk (cel):** silniki aut na rampie odbite od ścian wykopu, pogłos kroków pod płytą, szum wentylacji P−1, muzyka z lokali L1. W grze pas nie ma własnych źródeł (dług).
- **Zapach:** spaliny z rampy, mokry beton, ziemia grządek, kadzidło ze studia tatuażu BLACK LOTUS.
- **Pogoda:** deszcz pada tylko na otwarty wykop rampy (do z 11) i na skraj pasa przy Bajkowskiego; pod płytą jest sucho.
- **Kontrast (§3):** auta galerii na rampie obok ludzi, którzy siadają na grządkach z piwem; zielony portal z planszy nad betonem wykopu.
- **Ruch i życie:** auta rampy P−1 (po dwa na trasę, porą i gęstością ruchu, `parking-traffic.ts`), przechodnie na osi i w przejściu, postać na ławce planu (427; 7,9). Miejsc tłumu na samym T0 nie ma (trzy z bliskiego obszaru należą do placu C5).

## Przeznaczenie
- Przejście z Bajkowskiego i z placu do galerii (drzwi P1, 4,4 m, x 418,8–423,2), na parking (rampa, domek klatki P−1 x 424,3–427,7, z 12,4–22,6, drzwi od południa), do windy i metra B.
- **Wejścia:** oś od chodnika Bajkowskiego (z −11,3), trzy stopnie w dół z podium do przejścia na zachód od rampy, pasaż L1 zachód (x 400,2–403,8) od arkad, rampa od Bajkowskiego (dla aut), deptak od wschodu, drzwi P1 od północy.
- **Osłony:** parapety wykopu z grządkami (0,45 m nad gruntem, zachodnia 0,8 m, wschodnia 0,5 m), słupy przejścia pod L2 (środek x 418,6, z 11,8 i 24,5), domek klatki P−1, ściany skrzydeł L1.
- **Ucieczka:** rampą w dół na P−1 i dalej na P−2 i do schronu, klatką P−1, do galerii, na deptak, na Bajkowskiego.
- **Punkt widokowy:** z przejścia nad zakrytą rampą (z 12,4) widać obie strony: wykop do Bajkowskiego na południu i drzwi P1 na północy.

## Topografia
- Prawdziwe miejsce: parking w173531008 (Przystankowa) i jego alejki w177513189, w173567309; teren według NMT −2,5…−0,5, spada na zachód i północ.
- W grze: posadzka pasa na NMT, bez `PADS`; płyta L2 nad pasem (spód ok. 1,95, prześwit ≥ 2,9 m), skrzydła L1 (T-327); rampa x 409,7–418,3 od krawędzi chodnika Bajkowskiego (z −8,8), 33,3 m, 16,4%, otwarta do z 11 (T-237); P−1 i przejście do klatki pod T0 (T-236, T-238); plac T0 etapu 7 i jego meble (T-241); pawilon metra B (T-157).
- Odstępstwa celowe: front galerii na całej działce (T-327), parking pod ziemią zamiast naziemnego (T-236, T-241). Meble planu zdjęte przez bryły frontu: ławki bench-west#1–3 i pastorały (388,5; 12), (406,6; 25), (412,5; 27,8), (435,4; 14), (429; 23,6) (G-947).

## Inwentarz docelowy
- **Architektura:** płyta L2 na słupach z podsufitką i pasem LED (jest), parapety wykopu z grządkami (są, `square.ts`), zielony portal rampy (jest, `front-dress.ts`), domek klatki P−1 (jest); do zrobienia linia instalacji pod płytą L2 (korytka kablowe, rury odwodnienia płyty, kratki wentylacji P−1, §12), kratka odpływu na dnie wykopu przy wylocie.
- **Duże obiekty:** latarnia pastorał (422,8; 3,5) i ławka (427; 7,9) z planu (są); do zrobienia ławki i kosze w przejściu na zachód od rampy (`bench`, `waste-bin`), szlaban i szafka sterowania wjazdu na rampę (`street-cabinet`), tablica kierunkowa galerii (ekran z grafiką, bez tekstu dla gracza), kamera nad wylotem rampy (`cctv`).
- **Drobiazg w skupiskach (§14):** na grządkach niedopałki, puszki, karton po jedzeniu z kiosku; przy szafce rampy bilet parkingowy i zgnieciony kubek; w przejściu ulotki sklepów L1. Źródło: Street Asset Pack (ADR-0096), wzór `roof-dress.ts`.

## Frakcja i zasady
Frakcja: korporacja, ulica (pasaż galerii inwestora i ludzie z deptaku na jego grządkach).
- §12 zgodne: z otwartego placu i ulicy wchodzi się pod niską płytę L2 (pasaż), a za drzwiami P1 otwiera się hol i atrium galerii; próg zmienia strop i światło. Brak linii instalacji pod płytą, choć przestrzeń jest wyższa niż 2,6 m.
- §13 częściowo: światło prowadzące O2b i zielony portal rampy mają oprawy. Przejście do klatki P−1 na wschód od x 422 jest ciemniejsze niż fartuch (otwarte po O2b). Pomiar 60-30-10 nocą nie istnieje.
- §14 dług: architektura i grządki są, mezo to jedna ławka i latarnia, mikro brak.
- §15 częściowo: mokry wykop rampy pod deszczem, szkło witryn L1; posadzka pod płytą sucha i matowa, bez wilgoci zniesionej z ulicy.
- §16 zgodne: zimne, czyste światło galerii i portal z planszy, a obok ulica na grządkach.
- §17 częściowo: skalę dają drzwi P1, stopnie, parapety (1 m) i auta. Ruch: auta rampy i przechodnie. Dźwięku ze źródła brak.

## Dług sceny
- Linia instalacji pod płytą L2 (korytka, rury odwodnienia, kratki wentylacji P−1): rysunek w `packages/engine/src/renderer/alchemia/` (siatka kondygnacji, bez nowego wywołania), dane w `packages/sim/src/content/alchemia/front-dress.ts`.
- Ławki, kosze, szafka i szlaban wjazdu, tablica kierunkowa, kamera: modele gry w treści frontu (`front-dress.ts` albo nowy `t0-dress.ts`), bryły na końcu `ALCHEMIA_PROPS`, z dala od grafu (`parking-nav.ts`, `nav.ts`) i osi O2b (`alchemia-entrance.test.ts`).
- Drobiazg na grządkach i przy wjeździe: nowy plik w `packages/sim/src/content/alchemia/` (wzór `roof-dress.ts`).
- Światło przejścia do klatki P−1 na wschód od x 422 (otwarte po O2b): lampa przycięta do przejścia w `packages/engine/src/renderer/alchemia/parking-geometry.ts` albo oprawa w sklepieniu `P1_LINK_VAULT`.
- Meble planu zdjęte przez bryły frontu (G-947): nowe punkty w `docs/world/lublin-props.todo.json`, import w `tools/osm-import`, przegląd `topography-curator`.
- Słupek planu w osi wejścia przy (421,0; −11,8) (otwarte po O2b): przesunięcie w planie mebli (`lublin-props.todo.json`).
- Plac zabaw z planu inwestora (S13: „zielony plac z placem zabaw”) zniknął razem z placem T0 i nie wrócił na tarasach ani na dachu; propozycja w karcie `alchemia-zielony-dach`.
- Źródła dźwięku: auta rampy w wykopie, wentylacja P−1, pogłos pod L2: mapa źródeł na zewnątrz w `packages/engine/src/audio/`.
- Pomiar §13: ujęcie nocne z przejścia nad zakrytą rampą (ok. (414; 12,4)) w `tools/shots/room-spots.json`.
