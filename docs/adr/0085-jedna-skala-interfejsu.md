# ADR-0085: Jedna skala interfejsu i strefy ekranu

## Status
Zaakceptowany (15.11, prośba użytkownika: „Jeśli HUD jest przeskalowany np. do 80%, to reszta przycisków i wiadomości też ma się równomiernie skalować i nie nachodzić na siebie. Zamknijmy to jako ogólny fix skalowania interfejsu”).

## Kontekst
- Ustawienie „Skala HUD” (`settings.hudScale`, zakres 0,8–1,4, ADR-0028) trafiało na korzeń dokumentu jako `--hud-scale`. Skalowały się z nim tylko dwie warstwy, każda po swojemu: `.hud` (`transform: scale` z odwrotną szerokością i wysokością) i `.dialogue` (własne `--s`, na telefonie z limitem 1,1). Pad dotykowy i karta podsumowania zlecenia nie skalowały się wcale.
- Inwentarz na main (sonda e2e, 844x390, 667x375, 1280x720, 1920x1080, 1024x600, 390x844):
  - telefon przy 0,8: rząd przycisków pada (menu, telefon, pauza) nachodzi na portfel, zegar i minimapę, bo odstępy HUD od pada (152 px, 52 px) skalowały się z HUD-em, a pad nie;
  - telefon przy 1,4: kilkanaście przecięć (skok i „Użyj” na komunikacie, przeładowanie na minimapie, celowanie na pasku broni), komunikat poza ekranem na 667x375;
  - desktop przy 1,4 na 1024x600: pasek zdrowia na pasku broni, minimapa na podpowiedzi;
  - desktop przy każdej skali: zegar pod komunikatami (zegar doszedł 13.11 między portfelem a komunikatami, komunikaty zostały na 84 px);
  - przy każdej skali komunikaty przecinają opcje koła dialogu (telefon i desktop);
  - w warstwach z `transform: scale` `env(safe-area-inset-*)` i `vw` rosły razem ze skalą.

## Wzorzec
Skalowanie interfejsu w grach (Unity `CanvasScaler`, Unreal DPI Scale Rule): jedna reguła liczy skalę z ustawienia i rozdzielczości, a widżety kotwiczą się do krawędzi i stref ekranu (anchors), zamiast liczyć własne piksele.

## Decyzja
1. **Jedno miejsce liczy skalę** (`packages/ui/src/scale/ui-scale.ts`, czysta funkcja `uiScale`): z ustawienia, rozmiaru i orientacji ekranu oraz safe area.
   - Poniżej 1 ustawienie obowiązuje bez zmian.
   - Powyżej 1 skala rośnie tylko tak długo, jak układ ma miejsce, którego potrzebuje przy skali 1: kompaktowy (telefon, ten sam próg co media query stylów) 667x370, desktop 1024x600, po odjęciu safe area. Nigdy poniżej 1. Na 844x390 maksimum to 1,054, na 1280x720 1,2, na 1920x1080 pełne 1,4.
   - Pad rozdziela wygląd od obszaru trafienia (runda 2, decyzja użytkownika 15.11: „przyciski dotykowe też maleją ze skalą poniżej 1, ale obszar dotyku zostaje co najmniej 44 px”).
     - Warstwa pada ma skalę `touch`, nie mniejszą niż 1 (`MIN_TOUCH_SCALE`).
     - Rysunek przycisków, pierścienia drążka i podpowiedzi ma skalę `touchLook = ui / touch`, więc przy 0,8 pad wygląda tak duży jak reszta interfejsu.
     - Minimalny obszar trafienia `MIN_HIT_PX` = 44 px (ADR-0035) daje niewidoczny margines (`::after`) wokół przycisku.
     - Strefa chwytu drążka (lewa część ekranu) nie maleje. Gałka sięga do krawędzi narysowanego pierścienia.
   - Pad ściąga się w swoje rogi (runda 3, decyzja użytkownika 15.11: „Pad bliżej rogu”). Grupy pada skalują się względem swojego rogu ekranu, nie wokół środków przycisków: rząd menu, telefonu i pauzy względem prawego górnego, gromada akcji (strzał, łuk, celowanie, skok, „Użyj”, rząd „więcej”) względem prawego dolnego, podpowiedź ruchu względem lewego dolnego. Odstępy między przyciskami maleją z grupą, a odstępy od krawędzi (`--zone-top/right/bottom`) ze skalą interfejsu, nigdy pod safe area.
     - **Wyjątek od proporcji:** grupa ściąga się o `touchSpread = max(touchLook, MIN_TOUCH_SPREAD)`, a nie o samo `touchLook`. `MIN_TOUCH_SPREAD = (MIN_HIT_PX + HIT_CLEARANCE_PX) / PAD_PITCH = (44 + 2) / 50 = 0,92`. `PAD_PITCH` to najciaśniejszy rozstaw celów 44 px przy skali 1 (rząd górny i rząd „więcej”, 44 px co 6 px). Przy mocniejszym ściągnięciu obszary trafienia sąsiadów nachodziłyby na siebie. `HIT_CLEARANCE_PX` = 2 px zapasu, bo przeglądarka zaokrągla obszar trafienia przeskalowanego elementu do całych pikseli, ok. 1 px w lewo i w górę (pomiar przy 0,8 na 844x390): przy samym styku 44 px dotyk 21,5 px od środka trafiał w sąsiada. Przy 0,8 odstępy maleją więc tylko do 0,92, a przyciski w grupie są narysowane w skali `touchLook / touchSpread` (0,87), czyli na ekranie 0,8. Pozostałe pary mają zapas (łuk 48 px co 4 px potrzebuje 0,885, strzał i łuk 0,78).
     - Na skali 1 i wyżej `touchSpread` = 1: grupy nie mają własnej transformacji, układ jak dawniej.
2. **Jeden mechanizm udostępnia skalę:** `UiScaleRoot` pisze `--ui-scale`, `--ui-touch-scale` (warstwa pada), `--ui-touch-look` (rysunek pada) i `--ui-touch-spread` (ściągnięcie grup w rogi) na korzeń dokumentu; hook `useUiScale` daje tę samą wartość miejscom liczonym w skrypcie (gałka pada przelicza piksele ekranu na piksele warstwy). `--hud-scale` znika.
3. **Jedna klasa warstwy** (`scale/layers.css`, `.ui-layer`, `.ui-layer--touch`): HUD z komunikatami, pad, dialog i karta zlecenia. Wewnątrz warstwy jednostki ekranu są jednostkami warstwy: `--safe-top/right/bottom/left` zamiast `env()`, `%` warstwy zamiast `vw`.
4. **Strefy ekranu** (`scale/zones.css`) odpowiadają za układ bez nakładania na ekranie dotykowym: krawędzie pada (`--zone-top`, `--zone-right`, `--zone-bottom`) i jego rząd (`--pad-row-width`, `--pad-row-height`) są zdefiniowane raz, w pikselach pada przeliczonych na piksele danej warstwy (`--pad`). Pad i elementy HUD-u wokół niego kotwiczą się do tych zmiennych, nie do własnych liczb. Na desktopie warstwa jest jedna, więc kotwice zostają przy elementach; strefa ustala tylko kolumnę prawego górnego rogu (portfel, zegar, komunikaty).
5. **Strefa rozmowy:** koło dialogu zajmuje prawą połowę poniżej górnego pasa, napisy lewy dół aż pod cel. Komunikaty przy kole przecinały opcje także przy skali 1 (sonda: 844x390, 667x375, 1280x720). W rozmowie portfel i zegar ustępują (jak zdrowie i minimapa w G-283), a najnowszy komunikat zajmuje ich miejsce w górnym pasie jako jedna linia (tytuł bez treści). Starsze komunikaty i treść wracają po rozmowie, o ile nie wygasły.
6. **Poza zakresem:** pełnoekranowe menu (tytuł, pauza z ustawieniami, ekran postaci) i okna modalne (sklep, łup, telefon, metro, czekanie, włamanie). Zakrywają HUD, mają własne dopasowanie do telefonu sprawdzane w e2e, a suwak skali leży w menu pauzy: skalowanie panelu pod przeciąganym kciukiem przesuwałoby suwak.

## Konsekwencje
- Ustawienie 1,4 na telefonie daje ok. 1,05, a na laptopie 1280x720 1,2. Gracz dostaje największą skalę, przy której nic na siebie nie zachodzi.
- Przy 0,8 na telefonie przyciski pada są narysowane o 20% mniejsze, a pad ściąga się w rogi: odstępy między przyciskami maleją o 8% (wyjątek 44 px powyżej), odstępy od krawędzi o 20%. Cel zostaje co najmniej 44 px, a cele sąsiadów dzielą co najmniej 2 px.
- Nowy element HUD-u na telefonie, który omija pad, kotwiczy się do zmiennych stref, a nie do liczby pikseli.
- `e2e/ui-scale.spec.ts` sprawdza na telefonie (844x390, 667x375, pion 390x844) i desktopie (1280x720, 1920x1080), przy 0,8 i 1,4, że kluczowe prostokąty mieszczą się w ekranie, nie przecinają się i że każda warstwa rysuje się w skali z `uiScale`. Sprawdza też, że przy 0,8 przycisk strzału jest narysowany mniejszy niż przy 1, a strzał i menu leżą bliżej swoich rogów, że obszary trafienia (przycisk z marginesem `::after`) mają co najmniej 44 px i są rozłączne, a każdy przycisk pada łapie dotyk 21,5 px od środka. `e2e/touch-layout.spec.ts` sprawdza to samo przy 0,8 z przyciskiem „Użyj” i rozwiniętym rzędem „więcej”.
- Znane i poza tym ADR-em: karta podsumowania zlecenia zakrywa komunikaty i cel również przy skali 1, a na 1024x600 wychodzi poza ekran (zgłoszenie osobno).
