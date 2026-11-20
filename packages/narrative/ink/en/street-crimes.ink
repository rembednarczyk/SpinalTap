// Seki Senshi, ADR-0091 stage 5c: the gang's side of the street's crimes (dark jobs). One of a gang's
// crime in progress offers the player a part as the lookout; `assist_crime()` takes it, and the
// simulation runs the watch. Knots `crime_assist_<kind>` for the kinds a gang runs.

=== crime_assist_extortion ===
HEBI: Hey, got a minute? The shopkeeper's behind on his cut. Stand by the door so nobody butts in, and you get yours.
* [I'll keep watch. #tone:main]
    SEKI: Fine. I'm watching.
    ~ assist_crime()
    HEBI: Half a minute and we're done. Don't wander off.
    -> END
* [Not my business. #tone:leave]
    SEKI: Not my business.
    HEBI: Then keep walking. And keep out of it.
    -> END

=== crime_assist_deal ===
HEBI: Got a minute? Goods are changing hands. Watch the street till we're done and there's something in it for you.
* [I'm watching. #tone:main]
    SEKI: I'm watching. Make it quick.
    ~ assist_crime()
    HEBI: Eyes on the corners. Anyone comes, we were never here.
    -> END
* [Not my business. #tone:leave]
    SEKI: Not my business.
    HEBI: You saw nothing. Go.
    -> END

=== crime_assist_droneTheft ===
HEBI: Got a minute? This drone's about to change couriers. Watch for anyone coming till it's in the air.
* [I'm watching. #tone:main]
    SEKI: I'm watching. Do your thing.
    ~ assist_crime()
    HEBI: A minute and it's gone. Then you're gone too.
    -> END
* [Not my business. #tone:leave]
    SEKI: Not my business.
    HEBI: Your loss. Go.
    -> END

=== crime_assist_kidnap ===
HEBI: Got a minute? This guy owes more than he's got. Keep anyone away from the van till we're off.
* [I'll keep them away. #tone:main]
    SEKI: I'll keep them away. No screaming.
    ~ assist_crime()
    HEBI: He's done screaming. Just a bit longer.
    -> END
* [Not my business. #tone:leave]
    SEKI: Not my business.
    HEBI: Then look the other way. Everyone does.
    -> END
