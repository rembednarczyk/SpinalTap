// Seki Senshi, ADR-0091 stage 5c: the gang's side of the street's crimes (dark jobs). One of a gang's
// crime in progress offers the player a part as the lookout; `assist_crime()` takes it, and the
// simulation runs the watch. Knots `crime_assist_<kind>` for the kinds a gang runs.

=== crime_assist_extortion ===
HEBI: Ej, masz chwilę? Sklepikarz zalega z dolą. Postój przy wejściu, żeby nikt nie przeszkadzał, to dostaniesz swoje.
* [Stoję na czatach. #tone:main]
    SEKI: Dobra. Stoję.
    ~ assist_crime()
    HEBI: Pół minuty i po sprawie. Nie odchodź daleko.
    -> END
* [Nie moja sprawa. #tone:leave]
    SEKI: Nie moja sprawa.
    HEBI: To idź, gdzie szłaś. I nie wtrącaj się.
    -> END

=== crime_assist_deal ===
HEBI: Masz chwilę? Towar zmienia właściciela. Popilnuj ulicy, aż skończymy, to coś ci odpalimy.
* [Pilnuję. #tone:main]
    SEKI: Pilnuję. Szybko.
    ~ assist_crime()
    HEBI: Patrz na rogi. Jak ktoś idzie, to nas nie ma.
    -> END
* [Nie moja sprawa. #tone:leave]
    SEKI: Nie moja sprawa.
    HEBI: Nic nie widziałaś. Idź.
    -> END

=== crime_assist_droneTheft ===
HEBI: Masz chwilę? Ten dron zaraz zmieni kuriera. Patrz, czy nikt nie idzie, dopóki nie poleci.
* [Patrzę. #tone:main]
    SEKI: Patrzę. Róbcie swoje.
    ~ assist_crime()
    HEBI: Minuta i już go nie ma. Ty też się wtedy zmyj.
    -> END
* [Nie moja sprawa. #tone:leave]
    SEKI: Nie moja sprawa.
    HEBI: Twoja strata. Idź.
    -> END

=== crime_assist_kidnap ===
HEBI: Masz chwilę? Gość jest winien więcej, niż ma. Przypilnuj, żeby nikt nie podszedł do wozu, zanim odjedziemy.
* [Przypilnuję. #tone:main]
    SEKI: Przypilnuję. Bez krzyków.
    ~ assist_crime()
    HEBI: On już nie krzyczy. Jeszcze chwila.
    -> END
* [Nie moja sprawa. #tone:leave]
    SEKI: Nie moja sprawa.
    HEBI: To patrz w drugą stronę. Wszyscy tak robią.
    -> END
