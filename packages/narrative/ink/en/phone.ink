// Seki Senshi, ADR-0029: texts from the fixers on Seki's phone, `phone_<fixer>_<situation>`.
// One or two lines each, no choices: the phone shows them as a message thread. Offers come when
// Seki walks into the fixer's district, payments and failures right after the job.
// Kaito pays for speed, Hana for clean network work, Genzō for jobs nobody saw (ADR-0028).

=== phone_kaito_offer ===
KAITO: Got a quick job. Swing by the Neon Koi before someone else grabs it.
-> END

=== phone_kaito_paid ===
KAITO: Transfer's gone through. Fast and no chatter, just how I like it.
-> END

=== phone_kaito_failed ===
KAITO: I heard. The client won't pay for nothing, so neither will I. Next time, don't torch it.
-> END

=== phone_hana_offer ===
HANA: Something's stirring on Podzamcze. If you've got a minute, come by my stall.
-> END

=== phone_hana_paid ===
HANA: Got the confirmation. You went into the network clean, I added a little extra.
-> END

=== phone_hana_failed ===
HANA: That one's a bust. Come by once you've cooled off, we'll talk about the next.
-> END

=== phone_genzo_offer ===
GENZO: The riverside needs someone who walks quiet. The container on the Bystrzyca, as usual.
-> END

=== phone_genzo_paid ===
GENZO: Nobody saw a thing, nobody heard a thing. That's what I pay best for.
-> END

=== phone_genzo_failed ===
GENZO: Tessen knows already. Stay away from the office for a few days.
-> END
