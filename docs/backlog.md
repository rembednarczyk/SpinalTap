# Backlog

Zadania zgłoszone, jeszcze niezaczęte. Kolejność to propozycja, nie zobowiązanie.

## Następne

- **[gotowe] Dźwięki z publicznych assetów.** Podmienić lub uzupełnić syntezowane SFX nagraniami CC0 ze
  skanu w `docs/assets-research.md` §6:
  - strzały pistoletu i SMG z The Free Firearm Sound Library (wybrane pliki, nie cała paczka);
  - trafienia i kroki z Kenney Impact Sounds;
  - UI i glitch z Kenney Interface Sounds;
  - deszcz z Rain (loopable);
  - muzyka do rozważenia: T&T Free Cyberpunk Pack 2, Mirrorshade.

  Odtwarzanie przez istniejący `AudioPort` i szyny miksu (ADR-0013). Pliki skompresowane (OGG/MP3), licencje w README katalogu.
- **[gotowe] Broń z publicznych assetów.** (`packages/app/public/weapons`, `WeaponMounts`) Pistolet i SMG z Quaternius Ultimate Gun Pack (CC0) zamiast pudełek: w dłoni rigu, w kaburze, w viewmodelu FPP i u modeli
  importowanych. Zachować toon shading i outline.
- **[gotowe] Animacja biegania.** Osobny cykl dla sprintu w rigu proceduralnym (dłuższy krok, pochylenie
  tułowia, wyższe kolana, mocniejsza praca rąk, faza lotu), z płynnym przejściem chód → bieg.
  Działa też na modelach importowanych przez retarget, a broń w biegu trzymana nisko.

- **[gotowe] Plan systemu ekwipunku i uzbrojenia (dokument + ADR), przed lootem i menu.** Model przedmiotów
  (typy, rzadkość, statystyki, stackowanie, waga lub sloty), sloty uzbrojenia (broń główna,
  boczna, wręcz), amunicja i przeładowanie, modyfikacje broni, odzież i pancerz per strefa ciała
  (pod hitboxy), wszczepy a ekwipunek, tabele łupów, sklepy i ceny, zapis i migracje, kontrakty
  między core, sim, UI i rendererem (co widać na postaci), etapy wdrożenia.
  Plan: [`docs/ekwipunek-i-uzbrojenie.md`](ekwipunek-i-uzbrojenie.md), decyzje w
  [ADR-0015](adr/0015-ekwipunek-uzbrojenie-loot.md).
- **[gotowe] Lootowanie wrogów.** Ciało pokonanego wroga (albo upuszczona torba) jako obiekt interakcji:
  eddies, amunicja, apteczki, części i wszczepy z tabel łupów zależnych od typu wroga. Losowanie
  przez `RandomPort`, stan zebranych łupów w zapisie. Wdrożone jako etapy E0 do E6 planu ekwipunku
  (sloty broni, amunicja, przeładowanie, pancerz per strefa, torby z łupem, minimalny panel łupu);
  wygląd torby i postaci (E7: broń w dłoni, kaburze i na plecach, dodatki odzieży, torba z paskiem
  w kolorze rzadkości, animacja przeładowania) gotowy; menu postaci (E8 i E9) w toku.
- **[gotowe] Menu postaci na telefonie (i desktopie).** Ekran ekwipunku z podglądem postaci w 3D (obrót,
  aktualny wygląd z założonymi wszczepami i bronią), statystyki (HP, pancerz, celność, kryt,
  reputacja), siatka inventory z przeciąganiem lub stuknięciem, porównanie przedmiotów. Układ
  pod poziomy ekran telefonu z dużymi celami dotyku; spójny z kartą postaci i dziennikiem.
- **[gotowe] Celowanie prawym przyciskiem myszy (ADS).** ([ADR-0019](adr/0019-celowanie-ads-i-bron-biala.md)) PPM przytrzymany: zbliżenie widoku (FOV) i broń
  podniesiona do oka w FPP, w TPP kamera przez ramię. Parametry per broń w katalogu: zoom (pistolet
  małe, SMG średnie, karabin duże), czas wejścia w celowanie, mniejszy rozrzut i wolniejszy ruch
  podczas celowania, czułość myszy skalowana zoomem. Celownik zwęża się jak przy kucaniu. Na
  telefonie przycisk celowania (przytrzymaj lub przełącz, w ustawieniach). Wejście jako pole
  `aim` w `InputFrame`, stan w sim, deterministycznie. Wdrożone: PPM, LT na padzie, przycisk ◎ na
  dotyku, ustawienie przytrzymaj lub przełącz.
- **[gotowe] Broń biała.** ([ADR-0019](adr/0019-celowanie-ads-i-bron-biala.md)) Pałka i ostrze z katalogu jako pełnoprawne bronie slotu „wręcz”: atak lekki (LPM)
  z krótkim combo, trafienie łukiem przed postacią w zasięgu broni, obrażenia per strefa ciała,
  odrzut i przerwanie akcji trafionego. PPM przy broni białej to blok: zmniejsza obrażenia z
  przodu, kosztuje wytrzymałość lub ma limit, blok w dobrym momencie (parry) ogłusza
  przeciwnika wręcz. Animacje zamachu i bloku w rigu (i retarget na modele), dźwięki uderzeń.
  AI: wrogowie z bronią białą skracają dystans, gracz może ich blokować. Wdrożone: combo trzech
  ciosów, łuk i strefy, ogłuszenie z odrzutem, blok i parowanie z cooldownem (bez wytrzymałości),
  brawler Hebi z pałką (co trzeci ganger fali zlecenia) z telegrafowanym zamachem. Później: blok
  u NPC, ciężki atak, ostrze w sklepie (pałkę sprzedaje Oyaji).

- **[gotowe] Ruch w pionie: schody, windy, mosty.** ([ADR-0020](adr/0020-poziomy-schody-windy-mosty.md))
  Bryły są podłogą (wejście na stopień do 0,45 m, schodzenie bez spadania, grawitacja przy
  zejściu z krawędzi), schody i poręcze jako rampy, promienie strzałów i linia wzroku liczą
  nachylenie, interakcja nie sięga przez strop. Treść: estakada nad targiem jako chodnik z
  poręczami, schody od zachodu i winda towarowa z bramką na górze; kładka nad ulicą Kanałową.

- **[gotowe] Ruch w pionie, dalej: skok, upadki, drabiny, AI między poziomami.** ([ADR-0021](adr/0021-skok-upadki-drabiny-nawigacja.md))
  Skok (Spacja, A na padzie, przycisk na dotyku) z coyote time, buforem i ograniczoną kontrolą
  w powietrzu, bez podwójnego skoku. Obrażenia od upadku powyżej 4 m przez zwykłą ścieżkę
  obrażeń, twarde lądowanie spowalnia, dźwięki skoku i lądowania. Drabiny jako stan ruchu.
  Treść na targu: schody przeciwpożarowe z balkonem i trzema drabinami na dwa dachy, skrytka
  Hebi na dachu. Gangerzy gonią gracza schodami przez graf punktów przejścia (estakada, kładka),
  strzelcy szukają pozycji do strzału, windy i drabiny zostają dla gracza. Pozy skoku, lądowania
  i wspinaczki w rigu (też na modelach VRoid). Minimapa całego miasta z piętrami, ikonami
  schodów, windy i drabin i wysokością gracza.
- **[gotowe] Poprawki linii dialogowych.** Przegląd wszystkich rozmów w `packages/narrative/ink`: wybory
  gracza to kwestie Seki (u Kaito wybór brzmiał jak jego własna rada o doktorze Mori), odpowiedzi
  od właściwego mówcy, bez powtórzeń po pytaniach pobocznych, spójność z wątkiem głównym (liczba
  prób nadpisania, co Seki wie o Renie). Pilnuje tego `packages/narrative/test/dialogue-roles.test.ts`,
  który przechodzi każdą osiągalną ścieżkę wyborów.
- **[gotowe] Mimika postaci VRoid.** Mruganie co 2–6 s i ruch ust podczas kwestii rozmówcy przez
  morph targety VRM (`blink`, `a`, `i`, `u`, `e`, `o`) w shaderze toon; opis w `docs/models.md`.
- **[gotowe] Odzież na modelach VRoid i w podglądzie menu.** ([ADR-0015](adr/0015-ekwipunek-uzbrojenie-loot.md), dopisek E7)
  Hełm, wizjer i płyta kamizelki na kościach głowy i klatki ubranego modelu (na rigu
  proceduralnym bez modelu), kolor kurtki i spodni jako przebarwienie materiałów „Tops” i
  „Bottoms”, podgląd w menu przez te same `Loadouts` co świat.
- **[gotowe] Kabury i wszczepy na modelach.** Kabury i pas na plecach przesuwają się o stosunek
  wzrostu modelu do rigu (pistolet zostaje przy biodrze modelu); widoczne wszczepy z deskryptora:
  optyka jako świecące paski przy kącikach oczu, cyberramię jako miedziane pierścienie na prawym
  przedramieniu, na modelu i na rigu.

- **[gotowe] Budynki i dekoracje z assetów, dostrojone do cyberpunku.** (ADR-0022, `packages/app/public/city`) Zamiast gołych brył: fasady, sklepy,
  bary i wieżowce z paczek CC0 z przeglądu (`docs/assets-research.md`): Neon Town (neony, bar,
  sklepy), Kenney City Kit Commercial (budynki, wieżowce w tle) i Roads (chodniki, latarnie,
  kontenery, kable), Car Kit (zaparkowane auta). Inne stylistyki przemalowane na noc, teal i
  magentę przez toon shader, z dołożonymi neonami, kablami i klimatyzatorami. Kolizje zostają
  bryłami w sim; budżety draw calli i migawka NPR pilnują wydajności i looku.
- **[gotowe] Przeskok na krawędź (mantle).** Skok przy murku do ok. 2,5 m kończy się podciągnięciem
  na jego wierzch w pół sekundy (dopisek w ADR-0021); bez strzału i skoku w trakcie.

## Później

- Wygląd ekwipunku, dalej: hełm i kamizelka jako modele GLB zamiast brył, przebarwienie na rigu
  proceduralnym, wszczepy szkieletu i układu nerwowego (dziś widać tylko optykę i ramię).

- Ruch w pionie, jeszcze dalej: dachy i balkony w Shinsekai 7 (scena referencyjna NPR, zmiana
  wymaga nowej migawki), sniper Hebi na dachu targu, NPC na drabinach i w windzie (dziś
  świadomie nie, ADR-0021).

- Własne modele postaci (VRoid lub grafik) po MVP. Decyzja: obsada z próbek VRoid (CC0 / VRoid Hub license v1)
  zostaje w MVP gry.
