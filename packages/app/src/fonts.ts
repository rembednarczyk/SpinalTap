// The game's three typefaces ship inside the build (SIL Open Font License 1.1, via Fontsource), so
// the APK and an offline page draw the same letters as before without Google Fonts (ADR-0079).
// Latin and Latin Extended (Polish) subsets only, in the weights the HUD uses; Share Tech Mono has
// no Latin Extended subset, as it had none on Google Fonts either.
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-ext-500.css";
import "@fontsource/rajdhani/latin-700.css";
import "@fontsource/rajdhani/latin-ext-700.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-ext-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/atkinson-hyperlegible/latin-ext-700.css";
