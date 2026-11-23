// Seki Senshi, ADR-0032: observation hooks, `hook_<kind>_<n>`, for the hook table in the sim content.
// Each one is an overheard guard line (bark), a mail on a terminal or the contents of a shard.
// One or two lines, no choices. Each reveals a systemic way through: a gap in a rotation, a code,
// a habit of the target. Mails and shards are narration, so they carry no speaker prefix.

// eliminate: Kaito's sites on Krakowskie Przedmieście and under the Grodzka footbridge in Stare Miasto.
// The bark plays at every one of the five sites (`carrier: { post: 1 }`), so it names none of them.
=== hook_eliminate_1 ===
HEBI: Every hour the boss steps round the corner alone. Says he's calling his mother, comes back smelling of sake.
-> END

=== hook_eliminate_2 ===
Shard, voice memo: "Guard change at two. Whoever's on the street side goes for ramen then, and for ten minutes the boss is left with one kid."
-> END

// delivery: Kaito's cold modules for Hana.
=== hook_delivery_1 ===
Mail on a terminal. From: Neon Koi cold room. Subject: modules. "The package holds its temperature in the shade. The shortest way to Alchemia is through Plac Łokietka and down Lubartowska. Stare Miasto is a detour, and the Hebi stand under the footbridge on Grodzka."
-> END

=== hook_delivery_2 ===
HEBI: We grab couriers under the footbridge on Grodzka, not here. By Hana's cart we only watch, because Kenji doesn't like witnesses.
-> END

// retrieve: Hana's crate at the Hebi stash in the air-raid shelter under Alchemia's lower square.
=== hook_retrieve_1 ===
HEBI: Two of us watch the crate, but after midnight Daisuke goes to Fumiko's for ramen. Back in fifteen, if there's no line.
-> END

=== hook_retrieve_2 ===
HEBI: Two, two, zero, seven. Two-two-oh-seven. Forget the shelter gate code one more time and Daisuke locks me in with the robots.
-> END

// protect: Hebi coming for Oyaji's shop in the food hall on P3. Both raids climb a core of the gallery (ADR-0093 O3,
// market.ts): _1 fits either, _2 tells the cores' doors on P2 and the last escalator.
=== hook_protect_1 ===
HEBI: We hit the old man up the core stairs, same as always. Why change what works.
-> END

=== hook_protect_2 ===
Mail on Hana's terminal. From: unknown. Subject: Oyaji. "The Hebi will come up through the gallery: in by the stair cores on the second floor, then the last escalator to the food hall. From the roof garden you can see the whole atrium, and they never look up."
-> END

// escort: Mika's way from the yard to the boat.
=== hook_escort_1 ===
STRAZNIK: When the bookkeeper heads for the riverside, we wait by the office. Orders are nobody stands on the pier, they can see us from the water there.
-> END

=== hook_escort_2 ===
Mail on the Tessen security terminal. Subject: night roster. "East alley of the container yard unmanned between 1:00 and 3:00, patrol moved to the office."
-> END

// infiltrate: the manifests on the desk in the Tessen office.
=== hook_infiltrate_1 ===
Mail on a terminal. From: Nabrzeże administration. Subject: office door. "Code for the side door on the hall side changed to 4177. Please do not write it on sticky notes." The code is written on a sticky note.
-> END

=== hook_infiltrate_2 ===
STRAZNIK: The guy on the office door goes for a smoke in the gap between the tower and the hall every half hour. Thinks the camera doesn't reach there. He's right.
-> END

// hack: holding the Tessen terminal on the quay by the pier against the wave and the sniper on row N's roof.
=== hook_hack_1 ===
Shard, rifle service report: "The shooter on the hall roof swaps the cell after the third shot. Four seconds without the laser."
-> END

=== hook_hack_2 ===
STRAZNIK: From the hall roof you can't see a thing under the tower's stair. If someone hides there, the sniper can only look.
-> END

=== hook_sabotage_1 ===
STRAZNIK: The hall round only goes down the north corridor to the server room every other lap. The rest of the time it just walks past the door.
-> END

=== hook_sabotage_2 ===
TECHNIK: New on nights? Take locker fourteen in the basement, it's nobody's. The lock's been broken since spring.
-> END
