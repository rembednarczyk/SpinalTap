# Backlog

Zadania zgłoszone, jeszcze niezaczęte. Kolejność to propozycja, nie zobowiązanie.

## Następne

- **Dźwięki z publicznych assetów.** Podmienić lub uzupełnić syntezowane SFX nagraniami CC0 ze
  skanu w `docs/assets-research.md` §6:
  - strzały pistoletu i SMG z The Free Firearm Sound Library (wybrane pliki, nie cała paczka);
  - trafienia i kroki z Kenney Impact Sounds;
  - UI i glitch z Kenney Interface Sounds;
  - deszcz z Rain (loopable);
  - muzyka do rozważenia: T&T Free Cyberpunk Pack 2, Mirrorshade.

  Odtwarzanie przez istniejący `AudioPort` i szyny miksu (ADR-0013). Pliki skompresowane (OGG/MP3), licencje w README katalogu.
- **Broń z publicznych assetów.** Pistolet i SMG z Quaternius Ultimate Gun Pack (CC0, FBX/OBJ, potrzebna
  konwersja do glTF) zamiast pudełek: w dłoni rigu, w kaburze, w viewmodelu FPP i u modeli
  importowanych. Zachować toon shading i outline.
- **Animacja biegania.** Osobny cykl dla sprintu w rigu proceduralnym (dłuższy krok, pochylenie
  tułowia, wyższe kolana, mocniejsza praca rąk, faza lotu), z płynnym przejściem chód → bieg.
  Działa też na modelach importowanych przez retarget, a broń w biegu trzymana nisko.

- **Plan systemu ekwipunku i uzbrojenia (dokument + ADR), przed lootem i menu.** Model przedmiotów
  (typy, rzadkość, statystyki, stackowanie, waga lub sloty), sloty uzbrojenia (broń główna,
  boczna, wręcz), amunicja i przeładowanie, modyfikacje broni, odzież i pancerz per strefa ciała
  (pod hitboxy), wszczepy a ekwipunek, tabele łupów, sklepy i ceny, zapis i migracje, kontrakty
  między core, sim, UI i rendererem (co widać na postaci), etapy wdrożenia.
- **Lootowanie wrogów.** Ciało pokonanego wroga (albo upuszczona torba) jako obiekt interakcji:
  eddies, amunicja, apteczki, części i wszczepy z tabel łupów zależnych od typu wroga. Losowanie
  przez `RandomPort`, stan zebranych łupów w zapisie.
- **Menu postaci na telefonie (i desktopie).** Ekran ekwipunku z podglądem postaci w 3D (obrót,
  aktualny wygląd z założonymi wszczepami i bronią), statystyki (HP, pancerz, celność, kryt,
  reputacja), siatka inventory z przeciąganiem lub stuknięciem, porównanie przedmiotów. Układ
  pod poziomy ekran telefonu z dużymi celami dotyku; spójny z kartą postaci i dziennikiem.

## Później

- Blend shapes twarzy (mruganie, usta w dialogu) w toon shaderze: patrz `docs/models.md`.
- Docelowy model Seki (VRoid lub grafik) zamiast modeli zastępczych.
