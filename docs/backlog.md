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
- **Menu postaci na telefonie (i desktopie).** Ekran ekwipunku z podglądem postaci w 3D (obrót,
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

## Później

- Blend shapes twarzy (mruganie, usta w dialogu) w toon shaderze: patrz `docs/models.md`.
- Docelowy model Seki (VRoid lub grafik) zamiast modeli zastępczych.
