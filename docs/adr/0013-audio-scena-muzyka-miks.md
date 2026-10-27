# ADR-0013: Scena audio: muzyka warstwowa, ambient pozycyjny, miks

## Kontekst
ADR-0009 dał jednorazowe cue i zapętlony szum deszczu. Do „wysycenia” dźwięku potrzebny jest stan ciągły: nastrój muzyki (eksploracja, walka, overdrive, dialog), pozycja słuchacza (buczenie neonów, para z włazów, kroki zależne od prędkości) i głośności szyn do ustawień. Nadal bez plików audio.

## Decyzja
- `core` dostaje drugi port, `AudioScenePort` (`setMood`, `setListener`, `setVolume`, `getVolume`), oraz typy `MusicMood`, `AudioBus`, `AudioListenerPose`. `AudioPort` zostaje bez zmian, więc istniejące fake'i i `sim` nie zmieniają się (złoty hash bez zmian).
- `SynthAudio` implementuje oba porty. Logika jest czysta i testowana bez WebAudio: `MusicDirector` (nastrój i miks warstw), `MusicSequencer` (proceduralna pętla w a-moll, i–VI–III–VII, 4 takty, 92 BPM), `VoicePool` (limit głosów z priorytetem i kradzieżą najstarszego), `MixState` (głośności i ducking), `emitterMix` (spadek z odległością i panorama względem słuchacza).
- Walka i overdrive są też wykrywane z samych cue (`shot`, `hurt`, `overdrive` …), więc muzyka reaguje, zanim aplikacja zacznie wołać `setMood`. Dialog ustawia aplikacja (`setMood("dialog")`), co ścisza muzykę (ducking).
- Graf: szyny `music`, `sfx`, `ambience` → `master` → kompresor → wyjście. Ogon pogłosu zaułka to splot z generowanej odpowiedzi impulsowej; memory-glitch idzie przez bitcrusher (WaveShaper ze schodkową krzywą) z modulacją wysokości. Węzły stałe (szyny, pogłos, crusher, pętle ambientu) powstają raz przy `unlock()`; w klatce tylko zmiany parametrów. Pozycja jest liczona ręcznie (spadek odwrotny do odległości + `StereoPanner`), bez `PannerNode` na każde źródło.
- Kontekst powstaje dopiero w `unlock()` (pierwszy gest). Brak `AudioContext` lub błąd konstrukcji wyłącza dźwięk bez wyjątku.

## Konsekwencje
Aplikacja (Infra) podpina później: `setListener` w każdej klatce renderu, `setMood("dialog"/"explore")` przy otwieraniu i zamykaniu dialogu, `setVolume` w ustawieniach. Do tego czasu działa ambient, muzyka z wykrywaniem walki i nowe SFX.

## Dopisek: nagrania CC0 obok syntezy
- `SynthAudio` przyjmuje opcjonalny `AudioSampleManifest` (cue → zestaw wariantów, kroki, pętla deszczu). Manifest z URL-ami buduje aplikacja (`packages/app/src/audio-manifest.ts`, pliki w `packages/app/public/audio` z README licencji); engine nie zna ścieżek. `?audio=off` zostawia samą syntezę.
- `SampleBank` pobiera i dekoduje (`fetch` + `decodeAudioData`) każdy URL raz, leniwie po `unlock()`, z cache. Nagranie gra przez tę samą pulę głosów, szynę, panoramę i wysyłkę pogłosu co synteza; wariant losowany bez powtórzenia poprzedniego, wysokość 1 ± `pitch`. Zestaw może mieć `layerSynth`, wtedy synteza gra pod nagraniem.
- Dopóki nagranie się nie zdekoduje, albo gdy plik jest niedostępny lub nie do zdekodowania (np. Vorbis w starym Safari), cue i kroki są syntezowane. Zapętlone nagranie deszczu wchodzi na szynę `ambience` z narastaniem, a syntetyczny szum deszczu zostaje pod nim ciszej (`synthLevel`).
- Typ `AudioCue` bez zmian, więc `sim` i złoty hash nie są dotknięte.
