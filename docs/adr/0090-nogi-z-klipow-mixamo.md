# ADR-0090: Nogi z klipów Mixamo (chód, bieg i kucanie we wszystkie strony)

Status: Proponowany (17.11), do akceptacji wyglądu przez użytkownika. Dotyczy ADR-0076 (modele postaci i `HumanoidRetarget`), ADR-0089 (krok w bok strzelców), pozycji backlogu „Animacje ruchu” (12.11) i listy `docs/animacje-mixamo.md`.

## Kontekst
- Ruch postaci liczy proceduralny rig (`character-animation.ts`): biodra i kolana kołyszą się w przód i w tył, bez względu na kierunek ruchu. Wróg z ADR-0089, który idzie bokiem wokół gracza, i gracz idący w bok przesuwają się więc z nogami chodzącymi przodem („ślizg”), a w kucki postać prawie nie przestawia nóg (zgłoszenie użytkownika 12.11).
- Użytkownik dał paczki Mixamo na Dysku (`mixamo/`): „Female Locomotion Pack” (chód, bieg, chód i bieg w bok, obroty), „Basic Shooter Pack” (m.in. chód w tył), „Pistol/Handgun Locomotion Pack” (m.in. bieg w tył) i pliki karabinu (`rifle/`, m.in. chód w kucki w przód, w prawo i w tył w prawo); 17.11 prosi o chód w bok i krok w kucki.
- Licencja Mixamo: animacji wolno używać w grze, nie wolno rozpowszechniać samych plików. Decyzja z 13.11: w repo tylko dane przeniesione na nasz szkielet, nie surowe FBX.

## Decyzja
1. **Narzędzie `tools/animations`** (three.js `FBXLoader` w Node, tylko w narzędziu): `node tools/animations/src/import.ts <katalog>` czyta klipy z `manifest.json` (rozpakowane paczki pod ich nazwami, poza repo) i zapisuje `packages/engine/src/renderer/clips/leg-clips.generated.ts`. Z każdego klipu bierze tor stawów nóg (biodro, kolano, kostka, palce obu nóg) w 30 klatkach na sekundę, względem bioder, w układzie ciała rigu (+Y w górę, +Z w przód, lewa strona postaci na −X; Mixamo jest prawoskrętny, więc x zmienia znak) i w długościach nogi. Przesunięcie bioder w pętli (Mixamo nie jest „In Place”) odpada z pozycji i zostaje jako długość kroku pętli; zostaje też ruch bioder w pionie. Klip `{"file", "mirror": true}` to odbicie lewo-prawo (x na odwrót, nogi zamienione, pół pętli dalej, żeby lewa stopa ruszała jak w innych).
2. **Klipy (13):** chód i bieg w przód, w tył, w lewo i w prawo; chód w kucki w przód, w prawo i w lewo (odbicie prawego) oraz w tył po skosie w prawo i w lewo (odbicie). Postoju w kucki w paczkach nie ma (jest klęk), więc w miejscu kuca rig proceduralny. „run backwards” z paczki karabinu nie czyta się (`FBXLoader`), w tył biegnie klip z paczki pistoletu.
3. **Silnik (`clips/leg-pose.ts`):** po `animateRig` warstwa nóg miesza klipy według kierunku ruchu względem patrzenia (przód, tył, bok, pomiędzy: wagi |cos| i |sin| kierunku), według prędkości (chód do 2 m/s, bieg od 4 m/s) i według kucania (zestaw w kucki; w tył po skosie na stronę ruchu). Kierunek bierze z przesunięcia postaci między klatkami i jej obrotu, wygładzony. Faza biegnie z przebytą drogą: jedna pętla na krok zmieszanych klipów (w długościach nogi rigu, 0,86 m razy skala), więc stopy nie ślizgają się. Z torów stawów powstają obroty uda (wychylenie z pionu w dół) i kolana (w układzie uda), z odjętym pochyleniem tułowia; `HumanoidRetarget` przenosi je na model jak dotąd. Krótszy krok starszej postaci (`pace`) zbliża obrót do stania i przyspiesza kroki. Poniżej 0,3 m/s, w powietrzu, na drabinie i w śmierci zostają nogi proceduralne; do 0,9 m/s oba się mieszają.
4. **Górna część ciała zostaje proceduralna:** celowanie, broń, ręce, tułów. Strzelec idzie bokiem i dalej celuje do gracza.

## Konsekwencje
- Ruch w bok, w tył i w kucki ma kroki w swoją stronę; widać to u gracza w TPP i u wrogów z ADR-0089.
- Tablica ma ok. 50 KB w kodzie (13 pętli po 16-42 klatki), bez nowych plików do pobrania.
- Nowy klip to wpis w `manifest.json` i ponowny import; surowe FBX zostają u użytkownika.
- Test `model-background-load` porównywał kierunek uda rigu i modelu z nieprzeliczonych macierzy świata; przechodził tylko przy prawie pionowym udzie. Teraz przelicza macierze (retarget zgadza się co do cyfry).
- Dalej, osobno: obrót w miejscu (klipy obrotów są w paczce), kucanie w miejscu z klipu, skok i drabina z klipów, górna część ciała z klipów (przeładowanie, rzut), stopy (kostka) i dopasowanie stóp do gruntu.
