// Seki Senshi, ADR-0032: street encounters on Krakowskie Przedmieście (district id shinsekai-7, ADR-0042). `ENCOUNTERS` in the sim content
// says where and when each one starts; the sim plays each knot once. A choice leaves a flag
// `enc_<district>_<name>_<outcome>` (the reward or the memory of it) and sometimes a reputation change.

// Nobu bet his cyber arm at the PACHINKO parlour and lost it to the machine.
=== enc_s7_pachinko ===
On a bench outside PACHINKO, by the promenade, sits an older guy with an empty sleeve. Cables stick out of his shoulder.
NOBU: Miss, you look like someone who talks to machines.
NOBU: I bet my arm. The right one, salvaged. The machine won it and keeps it in the tray, like a trophy.
-> ask

= ask
* [How do you lose your own arm? #tone:optional]
    SEKI: How do you lose your own arm?
    NOBU: I was on a roll. A whole hour I was on a roll. Then I wasn't, and the arm was already on the table.
    -> ask
* [I'll try to get it out. #tone:hack]
    SEKI: I'll try to get it out of the machine.
    You slip a finger into the service port. The machine squeals, plays a fanfare and spits out the hand, followed by a fistful of tokens.
    ~ set_flag("enc_s7_pachinko_hand")
    ~ change_rep("civilians", 2)
    NOBU: It moves! The thumb moves! The tokens are yours, the Neon Koi takes them instead of change.
    -> END
* [Leave it. Maybe it's a sign to quit. #tone:main]
    SEKI: Leave it there. Maybe it's a sign to quit.
    ~ set_flag("enc_s7_pachinko_left")
    NOBU: The sign was last week, when I lost a leg. I won it back. Left-handed.
    -> END

// A salaryman asleep on the pavement at four in the morning, tie and briefcase still on.
=== enc_s7_salaryman ===
A guy in a suit is asleep on the pavement. Briefcase under his head, tie knotted like it's picture day. His optics blink red: twelve missed calls from "Boss".
-> look

= look
* [Hey. Up, before someone robs you. #tone:main]
    SEKI: Hey. Get up before someone picks you clean.
    SARARIMAN: Dean? The report for UMCS Corp will be ready by nine, I swear.
    SARARIMAN: Oh. You're not the dean. Good. The dean would fire me on the spot.
    ~ set_flag("enc_s7_salaryman_woken")
    ~ change_rep("civilians", 2)
    SARARIMAN: Thank you. All I've got is a ramen card, but please take it. Better someone uses it.
    -> END
* [You reach for his wallet. #tone:aggressive]
    The wallet is thin. Inside, a ramen card for Fumiko's and a photo of a kid in a school uniform.
    ~ set_flag("enc_s7_salaryman_robbed")
    ~ change_rep("civilians", -3)
    SARARIMAN: Mmm. Mom, five more minutes.
    -> END
* [You leave him. Everyone deserves sleep. #tone:leave]
    You walk off. Behind you, you hear his phone ring for the thirteenth time.
    -> END

// Hina lost her robot cat. It went to the car wash, because the car wash is warm.
=== enc_s7_neko ===
A little girl in a yellow cape is peering under every bench and every car along the promenade.
HINA: Have you seen a cat? Silver, battery-powered. Purrs like a fridge.
-> ask

= ask
* [What's its name? #tone:optional]
    SEKI: What's its name?
    HINA: Mister Cat. Dad says it's a dumb name, but Dad named me Hina, so he doesn't get a vote.
    -> ask
* [I'll check the car wash. It's warm. #tone:main]
    SEKI: I'll check the car wash. It's warm in there.
    Under the car wash brushes lies a silver cat, purring at the dryer. When it sees you, it stops and stares as if waiting for an explanation.
    HINA: Is he there? Tell me he's there!
    -> found
* [It'll come back when the battery dies. #tone:leave]
    SEKI: A battery cat will come back when it runs out of juice.
    HINA: When it runs out of juice it won't go anywhere. Grown-ups are really dumb sometimes.
    -> END

= found
* [You give the cat back to Hina. #tone:main]
    HINA: Mister Cat! Where were you? Don't answer, I know, at the car wash.
    ~ set_flag("enc_s7_neko_returned")
    ~ change_rep("civilians", 3)
    HINA: Here. I found this yesterday under the wreck. It's shiny, so it's probably worth something.
    -> END
* [You pull the battery for parts. #tone:aggressive]
    The battery comes out with a quiet click. The cat freezes mid-purr.
    ~ set_flag("enc_s7_neko_battery")
    ~ change_rep("civilians", -4)
    HINA: Why isn't he moving? Miss? Why isn't he moving?
    -> END

// Shiro sold the memories of his wife to Kagami. Now he writes poems about a woman he cannot see.
=== enc_s7_poet ===
Under a streetlamp on Plac Litewski stands a thin man with a sheet of paper. He reads aloud, though nobody is listening.
SHIRO: "She had an umbrella the color of something I don't remember. She laughed at something I don't remember."
SHIRO: I sold her to Kagami. The memories of my wife, the whole package, with a bonus for the wedding. I kept the poems.
-> ask

= ask
* [How much did they pay you? #tone:optional]
    SEKI: How much did they pay you for her?
    SHIRO: Enough to pay for her treatment. Not enough for her to get better. I don't remember that either, but I have the bills.
    -> ask
* [Read it again. I'm listening. #tone:main]
    SEKI: Read it again. I'm listening.
    SHIRO: "She had an umbrella." That's all I have left. Thank you for letting someone hear it twice.
    ~ set_flag("enc_s7_poet_listened")
    ~ change_rep("civilians", 1)
    { has_memory("operating_table"):
        Something in you twitches. A table, a light, someone counting down from ten. You push it away.
    }
    -> END
* [Is Kagami still buying? #tone:main]
    SEKI: Is Kagami still buying?
    SHIRO: Always. The buying point's behind the clinic, no sign. The line forms before dawn.
    ~ set_flag("enc_s7_poet_kagami")
    SHIRO: Don't go there. Or go, but write down who you are first.
    -> END
