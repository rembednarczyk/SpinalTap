# Stealth, hacking, crowd reactions, wanted levels and sandbox contracts: design references for Seki Senshi

Scope: mechanics from cyberpunk and open-world/immersive-sim games that a small browser game (Babylon.js, ECS sim, few streamed districts, single player) could adopt. Seki Senshi already has guard vision cones, a suspicion bar, fixer contracts, NPC schedules, a day/night cycle and factions. It has no police, no device hacking and no crowd reactions. Everything under "Cited Findings" has a URL. Anything from general design knowledge, or anything I could not verify, is under "Inferences" or "Gaps".

Reliability note: primary developer sources (Game Developer deep dives, interviews) are marked as such. Many numeric parameters come only from fan wikis and guides, and I flag those.

## 1. Stealth and detection (Deus Ex HR/MD, Hitman WoA, Dishonored/Prey, Cyberpunk 2077)

### Takeaway
The most transferable stealth patterns are these:
- Deus Ex: detection built on line of sight and sound rather than light and shadow, plus a visible last-known-position (LKP) marker and a search phase that ends with guards returning to patrol on changed routes.
- Hitman: per-role disguise rules, where a few "enforcers" see through a disguise.
- Dishonored: interconnected, plausible routes toward a visible goal.

All of these are cheap in an ECS that already has vision cones and a suspicion bar.

### Cited Findings
- **Deus Ex HR built detection on sightline and sound, not light and shadow.** The reason was that they needed a stealth system that works in every map, not just some. — [PC Gamer interview with DX:HR designers](https://www.pcgamer.com/deus-ex-human-revolutions-game-director-speaks/4)
- **DX:HR search behaviour.** Enemies lose your track and then go back to patrolling. If the player hides long enough, they patrol on different patterns. — [GameBanshee DX:HR interview](https://gamebanshee.com/33k)
- **Last Known Position as a concept.** A marker shows where enemies last saw the player. Enemies investigate that spot, which lets the player flank them. DX:HR is listed as an example. — [Giant Bomb: Last Known Position](https://giantbomb.com/wiki/Concepts/Last_Known_Position)
- **Mankind Divided "Stealth Avatar".** It shows the player's last known location to hostiles. In MD it is a separate augmentation. In HR it was an upgrade of another augmentation. — [Deus Ex Wiki: Stealth Avatar](https://deusex.fandom.com/wiki/Stealth_Avatar)
- **Hitman (2016+) enforcers.** Some NPCs, called "Enforcers", see through 47's disguises. — [Wikipedia: Hitman (2016)](https://en.wikipedia.org/wiki/Hitman_(2016_video_game))
- **Hitman disguise logic is per role.** A producer said that in a guard outfit, guard characters will have an easy time seeing through the disguise. — [PCGamesN](https://www.pcgamesn.com/hitman-2/ai-detect-mirrors)
- **Hitman NPCs have different resting suspicion states.** — [PC Gamer: Trying to break the largest level in Hitman history](https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history)
- **Hitman 2's AI can spot your reflection in mirrors.** — [PCGamesN](https://www.pcgamesn.com/hitman-2/ai-detect-mirrors)
- **Hitman: Absolution shows what goes wrong without per-role rules.** Its disguise detection was criticised because a policeman could identify a bogus cop from halfway across a room. IO said it was looking at how to tweak detection with disguises. The later per-role and enforcer model is the fix. — [PC Invasion](https://www.pcinvasion.com/?p=28935)
- **Absolution AI GDC talk (for reference).** IOI's Mika Vehkala gave "Creating the AI for the Living, Breathing World of Hitman: Absolution" at GDC Europe 2013. It covers the rationale and the layers of AI and animation. Its content is behind a GDC Vault login. — [GDC Vault](https://gdcvault.com/play/1019353/Creating-the-AI-for-the)
- **Dishonored routes must be plausible.** Harvey Smith: "we look at every place to see if it's plausible". The team rejected a guard route that made a guard walk a mile and up ten flights of steps. — [Game Developer: Harvey Smith, player choice is paramount](https://www.gamedeveloper.com/design/-i-dishonored-i-s-harvey-smith-player-choice-is-paramount-in-design)
- **Dishonored routes are interconnected around a visible goal.** Smith: "you see the tower you need to get to, but your path will be different to mine". Dishonored 2 missions were "mini-open worlds", with strengths and weaknesses. — [SiliconAngle interview](https://siliconangle.com/2015/07/10/dishonored-2-director-talks-player-choice-and-creating-realistic-environments); [PC Gamer: Harvey Smith on chaos, open worlds](https://pcgamer.com/harvey-smith-talks-chaos-open-worlds-and-the-differences-between-dishonored-2-and-prey)
- **Cyberpunk 2077 (2.0) links stealth to police.** Being detected in NCPD restricted areas is one of the crimes that raises the wanted level. — [GamerGuides: police and wanted levels in 2.0](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)

### Inferences
These are scale-down proposals for Seki Senshi.
- **Show the last known position (LKP).** When suspicion reaches "alerted", store `lastKnownPos` and `lastSeenTick` on the guard component. Run a state machine: Investigate (walk to LKP), Search (random points in a radius around LKP for N seconds), Return.
  - On Return, pick a different patrol variant, as DX:HR does. This makes hiding feel like it changed something.
  - Show a ghost silhouette marker at the LKP. In Deus Ex it is gated behind an augment, which fits the cyberware system: an "optical analyzer" implant.
  - Cost: one component, one system, one HUD marker.
- **Use sightline plus noise, not lighting.** This matches the DX:HR reasoning. NPR/toon lighting makes light-based stealth hard to read anyway, so drive detection from vision cones and noise events (gunshots, sprinting, fall damage) with radii.
  - The day/night cycle can still scale vision cone length, for example by 0.6 at night, without per-pixel light sampling.
- **Use Hitman-style role disguises.** Tag each zone with allowed factions/roles. A disguise item sets `apparentRole`.
  - Each NPC has `seesThroughRoles`. Enforcers are a subset, for example the zone's chief guard or same-unit guards. The suspicion bar fills only for enforcers, or for others when the player does something illegal (trespassing, holding a weapon, running).
  - Show enforcers with a small icon over their head. Hitman's Instinct mode does this, from general knowledge not verified here.
  - The Absolution feedback is the warning: if every same-role NPC detects you from far away, disguises feel pointless.
- **Design routes on the Dishonored principle.** Put the contract objective in sight, offering three entries (front with a disguise, vertical via mantle/ladder/roof, technical via a hacked door or lift), and make guard routes plausible to the NPC's schedule. The existing vertical movement makes the rooftop route nearly free.

### Gaps
- I could not access exact DX:HR/MD detection-meter fill rates or Hitman suspicion thresholds. The GDC Vault is behind a login and the Hitman fandom wiki returned 402. No numbers are given here for those.
- I found no primary source on Cyberpunk 2077's stealth detection parameters, or on Prey's stealth.

## 2. Hacking (Watch Dogs 2, Deus Ex, Shadowrun, Ghostrunner, The Ascent, Cyberpunk breach protocol)

### Takeaway
- **Disliked:** puzzle-style minigames that interrupt play, such as Cyberpunk's Breach Protocol. Players wrote autosolvers for it because they found it boring.
- **Liked:** short hacks that are part of the world and act on the scene (WD2: hack, NPC reacts, scene escalates).
- **Liked:** risk/reward graphs where pressure builds over time (DX:HR's trace timer, Shadowrun Hong Kong's sight cones and alarm).
- **Liked:** progression gates on hack level (The Ascent).

### Cited Findings
- **Cyberpunk Breach Protocol is widely called tedious.** Reviewers describe it as tedious, complicated and barely explained. Players wrote screenshot-based autosolvers and companion apps such as Cyberpwned. — [The Loadout](https://www.theloadout.com/cyberpunk-2077/hack-mini-game); [GGRecon](https://www.ggrecon.com/articles/cyberpunk-2077-players-hacking/)
- **One player's design proposal for Breach Protocol.** Allow auto-solve at high skill, but grant only one of the three reward tiers. Manual solving still unlocks all three. This is a community opinion, not official. — [Tildes thread](https://tildes.net/~games/1icz/cyberpunk_2077_breach_protocol_autosolver)
- **DX:HR hacking structure (developer interview).**
  - The player enters a network at an I/O port and routes toward a registry.
  - Each captured node carries a probability of detection.
  - On detection, a trace runs back toward the entry point and the player must reach the registry first.
  - Hacking augments can prevent detection entirely.
  - Source: [PC Gamer DX:HR interview](https://pcgamer.com/deus-ex-human-revolutions-game-director-speaks)
- **DX:HR hacking parameters (pre-release, may differ from the final game).** One preview reports a base detection chance of about 60% per node, depending on node difficulty and Capture upgrades, and about 30 s to capture the remaining registry nodes after an alert. — [GameBanshee preview](https://gamebanshee.com/9w6q)
- **DX:HR node types (fan guide).**
  - Directory nodes are conduits.
  - Datastore nodes are optional and hold loot (viruses, XP, credits).
  - Clearance nodes lower the security of all datastores by 1.
  - Soften nodes lower the security of adjacent nodes by 1.
  - Source: [Hooked Gamers hacking guide](https://www.hookedgamers.com/features/2011/09/15/deus_ex_human_revolution_hacking_guide-2.html)
- **DX:HR player complaint (anecdotal).** The first node often seemed to trigger detection right away, so hacking felt like a race against the trace. — [Steam discussion (Mankind Divided)](https://steamcommunity.com/app/337000/discussions/0/352792037310823543)
- **Watch Dogs 2 Invasion of Privacy missions (primary source, Ubisoft Toronto programmer Christopher Dragert).**
  - **Scene setup:** the player hacks a junction box to get a camera view, profiles characters and objects, and switches cameras.
  - **Branching by hack:** hacking a phone alone leads to a different outcome than hacking a laptop for evidence first.
  - **NPC escalation:** each hack raises emotional intensity. The base loop is React, Restore, Resume.
  - **Stateful actions:** these were the biggest cost. Mitigations: every path leads to the same state, keep stateful actions brief and unbranching, or have NPCs ignore stimuli during a state change.
  - **Dialogue:** each block has a Point of No Return placed within about 1.5 s of its start. If a hack interrupts before it, the block repeats. If after, the rest is skipped. Generic rejoin lines smooth the return.
  - **Coordination:** a simple blackboard tracks scene state such as escalation level.
  - Source: [Game Developer: Game Design Deep Dive, WD2 Invasion of Privacy missions](https://www.gamedeveloper.com/design/game-design-deep-dive-i-watch-dogs-2-i-s-invasion-of-privacy-missions)
- **WD2 profiler.** The profiler turns NPCs into people you have to make choices about (series writer). WD2's hacking gives "more ways to mess with NPCs than ever", and the profiler is "no longer an almighty, agency-stripping tool". — [GamesBeat interview](https://gamesbeat.com/ubisoft-writer-finally-gets-to-spill-some-secrets-of-the-watch-dogs-story-interview/2); [PC Gamer on WD2's San Francisco](https://www.pcgamer.com/watch-dogs-2-made-san-francisco-much-more-than-just-a-playground)
- **The Ascent cyberdeck.**
  - Early on it analyses terminals to open locked doors and counter-hacks enemies.
  - Upgrades unlock higher-security doors and chests, and let you hack turrets to fight for you.
  - The developer says some doors and chests are deliberately too high-security until you find upgrades.
  - Source: [Fandom: Everything about The Ascent](https://www.fandom.com/articles/everything-about-the-ascent); [Gamepressure hacking guide](https://www.gamepressure.com/ascent/hacking/zaeb1b)
- **Shadowrun: Hong Kong Matrix.**
  - It was rebuilt as a stealth layer: ICE defence programs follow patterns with sight cones, and being spotted starts combat and raises an alarm meter that brings heavier defences.
  - Reviewers called it still the weakest part, but better than before. Reflex-based changes were controversial with fans but made stealth deckers viable.
  - During the Kickstarter, the team said it wanted the Matrix to feel like travelling through a digital world.
  - Source: [RPGamer review](https://rpgamer.com/review/shadowrun-hong-kong-review/); [Hardcore Gamer review](https://hardcoregamer.com/reviews/review-shadowrun-hong-kong/163437/)

### Inferences
These are scale-down proposals.
- **Skip a separate puzzle screen. Use quickhack-style "device actions".** Each `Hackable` component (camera, door, turret, lift, vending machine, a guard's commlink, a street speaker) exposes 1–3 actions. Each action has a RAM/energy cost, a 1–3 s channel time in-world, a range, and a noise or trace value. Examples:
  - camera: loop for 20 s
  - door: unlock
  - lift: call or stop
  - speaker: distraction noise event at a position, which feeds the stealth noise system
  - turret: switch faction
  - NPC: "ping" to reveal nearby guards
  - This is the WD2/Ascent model: hacks act on the scene.
- **Optional mini-map hack only on high-value targets.** If you want one minigame, use a tiny DX:HR-style graph (5–8 nodes) for the "hack a terminal while holding off a wave" contract. Each capture rolls detection from a seeded `RandomPort`. On detection, a trace timer (about 20–30 s) runs, and optional datastore nodes give loot.
  - Keep it skippable: cyberware level N auto-solves with reduced reward, as in the Tildes proposal. This avoids the Breach Protocol trap.
- **Gate by tier.** Doors, chests and turrets have `securityLevel` 1–3 and the cyberdeck has a level, as in The Ascent. That gives exploration goals in streamed districts at low content cost.
- **Use WD2's React, Restore, Resume loop for NPC hack reactions.** It fits ECS behaviour states. Place an ink "point of no return" near the start of bark lines so a hack interruption either replays the line or skips it.

### Gaps
- I did not find primary sources on Ghostrunner's hacking powers in this pass. From general knowledge they are short-range "mind control/blink" abilities, which is unverified, so I am not treating it as a claim.
- I found no developer statement from CD Projekt Red on Breach Protocol criticism, and no WD2 police or drone parameters.

## 3. Crowd reactions and living city (GTA V, Sleeping Dogs, WD2 profiler, Cloudpunk, Yakuza)

### Takeaway
Small, dense cities with layered vertical interiors and many short human side-stories (Yakuza) give more "living city" per asset than large sparse maps. A per-NPC profile line (WD2) and consumable street buffs (Sleeping Dogs) are cheap ways to make bystanders matter.

### Cited Findings
- **Yakuza density comes from vertical, multi-tenant buildings.** RGG's Eiji Hamatsu credits "zakkyo" multi-tenant buildings: in Kamurocho, crossing one wall or climbing one flight of stairs can create a completely different scene. He argues that Western cities need more spread-out space because shops are usually on the ground floor. — [inkl / GamesRadar-sourced interview](https://inkl.com/news/a-unique-aspect-of-japanese-architecture-turned-out-to-be-a-key-reason-the-like-a-dragon-games-can-reuse-assets-so-effectively-and-deliver-more-compact-memorable-open-worlds-than-western-cities); see also [Game Developer: How the Yakuza devs choose and craft locales](https://www.gamedeveloper.com/design/how-the-i-yakuza-i-devs-choose-and-craft-the-series-iconic-japanese-locales)
- **Yakuza substories are a core strength, not filler.** The people you meet on the street are the series' greatest strength. — [TheSixthAxis](https://www.thesixthaxis.com/2018/10/16/the-yakuza-series-greatest-strength-is-the-people-you-meet-on-the-street/)
- **Substory counts.** Yakuza 3 (2009) had 119 substories. Its remake Kiwami 3 has 31. — [GosuGamers Kiwami 3 interview](https://www.gosugamers.net/entertainment/news/78045-interview-yakuza-kiwami-3-director-ryosuke-horii-talks-cut-content-future-of-the-kiwami-series)
- **Sleeping Dogs Face meter.**
  - It fills with each opponent defeated, and faster with varied moves in quick succession and environmental attacks.
  - When full, Wei Shen gets health regeneration and more damage.
  - Face XP from civilian side jobs unlocks cosmetics and vendor discounts.
  - Police XP is a separate track, gained by minimising civilian casualties and property damage.
  - Source: [Wikipedia: Sleeping Dogs](https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game)); [Prima eGuide: Street Cred](https://primagames.com/eguides/sleeping-dogs-eguide/essentials/how-to-play/street-cred-the-reputation-system)
- **Sleeping Dogs street food.** Food and drink from stalls and vending machines restore health and give buffs such as health regeneration or more damage, scaled by Face upgrades. Outfit sets can modify XP, damage and police heat. A review notes the buffs never felt necessary. — [Wikipedia](https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game)); [Engadget review](https://www.engadget.com/2012/08/14/sleeping-dogs-review/)
- **WD2 profiler.** It gives each passer-by a profile and makes them "people" (see section 2). — [GamesBeat](https://gamesbeat.com/ubisoft-writer-finally-gets-to-spill-some-secrets-of-the-watch-dogs-story-interview/2)
- **Small worlds as a deliberate choice.** An essay argues that RGG's compact worlds show what miniature worlds can achieve. — [Medium / SuperJump](https://medium.com/super-jump/small-video-game-worlds-are-underrated-c5263a539e92)

### Inferences
These are scale-down proposals.
- **Crowd panic as a cheap ECS system.** A `Disturbance` event (gunshot, body found, melee, explosion) has a position, radius and severity. Bystanders inside the radius with line of sight do one of three things:
  - **Flee:** run to the nearest exit or interior and despawn when out of view.
  - **Cower:** crouch in place.
  - **Witness:** a percentage with a phone "call it in" after a 3–6 s delay. Interrupting them stops the report.
  - The witness-call delay is the key tension knob. It ties directly into the wanted system (section 4). It is a design proposal, not a sourced parameter.
- **Profile line on aim or scan.** Generate it from seeded tables: name, occupation, one quirk, and optionally a "has data" flag that makes the NPC hackable for cash or a contract lead. This is WD2's profiler at 1% of the cost, and it works with `RandomPort` for determinism.
- **Street food stalls as consumable timed buffs.** Examples: noodles +regen for 120 s, a synth-coffee boost to ability cooldown. This reuses the existing shops and loot, and it gives a reason to visit vendors in each district. The Sleeping Dogs review is a warning that the buffs must matter, so tune them to be noticeable in fights.
- **Yakuza-style "street encounters" and short substories**, triggered by NPC schedule and time of day. Three to five per district, each a 1–3 beat ink scene, give more life than raising crowd density. Vertical interiors (lifts, ladders) mirror RGG's zakkyo approach and suit chunk streaming.

### Gaps
- I found no reliable source on GTA V crowd panic parameters (flee radius, witness-call time) or on Sleeping Dogs ambient events.
- Cloudpunk was not covered in this pass. Its delivery-driven exploration (courier jobs as a reason to traverse districts) is general knowledge and needs sourcing.

## 4. Wanted / heat systems (GTA stars, Sleeping Dogs heat, Watch Dogs police, Cyberpunk 2.0 NCPD)

### Takeaway
The clearest small-scale design is GTA V's: stars that escalate response type, with escape by staying outside every officer's visible search cone until the meter decays. Cyberpunk 2.0's version is similar: 1–5 stars, one star at a time, stars dim when you are out of sight, flash just before the search ends, and police search near the last sighting. Both reuse the stealth vision-cone system, which Seki Senshi already has.

### Cited Findings
- **GTA IV vs. GTA V evasion.**
  - In GTA IV you escaped by leaving a circular search area centred on your last sighting.
  - In GTA V each officer projects a vision cone on the mini-map, and the meter decays only while you stay outside every cone.
  - This made cover, alleys, swapping vehicles and changing clothes into evasion tactics.
  - Source: [Police AI and wanted system evolution across mainline GTA (fan analysis site)](https://rockstar-files.pages.dev/reports/16_legacy_series/1056_police_ai_wanted_system_evolution.html); [Orcz: GTA V Wanted Level](https://orcz.com/GTA_V:_Wanted_Level)
  - Caveat: these are fan-analysis sources, and the cone angles there are not verified.
- **GTA V helicopters.** The helicopter is the hardest unit to shake because its view is far larger. It can be evaded in tunnels, parking garages or dense tree cover. — [Orcz: GTA V Wanted Level](https://orcz.com/GTA_V:_Wanted_Level)
- **Cyberpunk 2.0 triggers.** Harming civilians or NCPD, being detected in NCPD restricted areas, and stealing police vehicles. The level starts at 1 star and climbs one star at a time to 5. — [GamerGuides 2.0](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- **Cyberpunk 2.0 escalation by star.**
  - 1 star: cops who spot you attack.
  - 2 stars: patrol cars with two officers head to the last known location.
  - 3 stars: squads of four, robots, armoured tactical officers and snipers.
  - 4 stars: netrunners and APCs.
  - 5 stars: MaxTac operators by dropship, and netrunners disable your vehicle.
  - Source: [GamerGuides 2.0](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- **Cyberpunk 2.0 escape.** Break line of sight. The stars dim when you are unseen and flash when the search is about to end. Police search mainly near the last sighting and do not check every nook. Rooftops, crates and pillars are enough cover. — [GamerGuides 2.0](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- **Cyberpunk 2.0 has no surrender or bribe.** Per a 2026 guide, the NCPD accepts neither, and gangs can pursue you after certain gig actions (2.1+). — [PlayNews guide](https://www.playnews.gg/en/guides/cyberpunk-2077-how-the-police-work-in-2026-shaking-off-the-ncpd-and-surviving-maxtac)
- **Cyberpunk escape timers.** A third-party mod describes a countdown that starts when police lose you and resets on any new sighting. It is not vanilla. — [Nexus Mods](https://www.nexusmods.com/cyberpunk2077/mods/10135)
- **Sleeping Dogs heat.** Crimes raise a "heat" meter on the HUD that shows the current wanted level. Outfit sets can modify police heat. — [Wikipedia: Sleeping Dogs](https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game))

### Inferences
This is a scale-down proposal for Seki Senshi.
- **Use 3 levels, not 5.** A few districts cannot fit APCs and dropships.
  - **1, "Patrol alerted":** nearby patrol officers attack on sight.
  - **2, "Pursuit":** units spawn at chunk edges and converge on the LKP. Drones are the "helicopter" equivalent, with a wide downward cone.
  - **3, "Corp security/MaxTac equivalent":** an elite squad with cyberware. The player cannot outfight it cheaply, only escape.
- **Reuse the stealth stack for evasion.** Each pursuer has a cone. The heat meter dims while the player is outside all cones and drops a level after T seconds unseen, for example 15/25/40 s by level. A new sighting resets the timer, as in the Cyberpunk mod description.
  - Interiors, lifts and rooftops become the escape routes, as alleys and garages are in GTA V.
  - Clothing swaps or cyberware "face change" can drop one level, mirroring GTA V clothing evasion and Sleeping Dogs outfit heat modifiers.
- **Crimes need a witness.** Crimes become heat only through witnesses: a police officer, a camera, or a civilian completing the phone call from section 3. This is what makes a stealth kill different from a public shooting, and it gives hacking cameras a purpose.
  - Cyberpunk's "detected in restricted area" trigger maps directly to contract zones.
- **Make jurisdiction faction-based.** Each district's security belongs to a faction. Heat with corp security can raise that faction's hostility, which ties into existing reputation. A paid "fixer cleanup" in a shop clears heat, which is the reverse of Cyberpunk's no-bribe stance and a cheap gold sink.

### Gaps
- Official Rockstar or CDPR numbers (cone angles, decay timers, spawn counts) were not found. Fan and mod figures are flagged above.
- Watch Dogs 2 police behaviour was not covered by any source I fetched.

## 5. Sandbox contracts (Hitman contracts/escalation, Shadowrun runs, Sleeping Dogs side jobs, The Ascent side quests; ratings)

### Takeaway
The most reusable patterns are these:
- **Silent Assassin-style rating:** a short binary checklist that fails if any one item is broken.
- **Optional, discoverable "opportunities":** scripted routes to the target.
- **Mission stories as guided paths** for new players.
- **Separate reputation tracks:** a "clean" track and a "brutal" track, as Sleeping Dogs splits Police XP and Face.

### Cited Findings
- **Hitman 3 Silent Assassin requirements.** Only the targets killed, no non-target deaths, never spotted, no witnesses, no bodies found, and no camera footage (recorder destroyed or never seen). Failing any one of them loses the rating. — [DBLTAP: Hitman 3 Silent Assassin requirements](https://dbltap.com/posts/hitman-3-silent-assassin-requirements-01exd43krjht)
- **What counts as "spotted".** A "close encounter" is an NPC drawing a gun on you. Being spotted by an unarmed NPC does not by itself void the rating, though that NPC may alert others (community answer). — [Hitman Forum](https://hitmanforum.com/t/silent-assassin-requirements/682)
- **Older Hitman ratings.** Absolution used points with difficulty multipliers (Expert +100%, Purist higher). Blood Money let you remove guards through staged "accidents", and no body could be left in sight. — [SegmentNext](https://segmentnext.com/hitman-absolution-silent-assassin-guide-how-to-get-silent-assassin-rating); [Gamepressure Blood Money](https://www.gamepressure.com/hitmanbloodmoney/silent-assassin-rank-how/zbbcc3)
- **IOI's design philosophy for Hitman (2016).** Give players flexible tools and let them choose ("isn't afraid to empower the player"), with a "living game" that changes as players play. — [GamingBolt interview with Christian Elverdam](https://gamingbolt.com/hitman-interview-how-io-interactive-has-bought-back-agent-47-with-a-bang)
- **Episodic structure.** Season 1's episodic "mark of the week" pacing encouraged prolonged investigation of a single level. — [GamingTrend review](https://gamingtrend.com/feature/reviews/coup-de-grace-hitman-the-complete-first-season-review/)
- **Further reading on how IO made the trilogy.** — [PC Gamer: How IO made the Hitman trilogy](https://pcgamer.com/how-io-made-the-hitman-trilogy-its-stealth-masterpiece)
- **Sleeping Dogs splits reputation tracks.** Police XP rewards low civilian casualties and property damage. Face rewards civilian side jobs and brutal combat style. Two tracks reward two playstyles. — [Wikipedia: Sleeping Dogs](https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game))
- **WD2 IOP missions show branching contracts on a budget.** Every path leads to the same state, plus a narrow set of hack-driven branches. — [Game Developer deep dive](https://www.gamedeveloper.com/design/game-design-deep-dive-i-watch-dogs-2-i-s-invasion-of-privacy-missions)
- **Dishonored ties outcomes to playstyle.** Chaos and multiple pathways are core features, and Arkane avoids scripted ability unlock schedules so players' paths differ. — [PC Gamer: Harvey Smith on chaos](https://pcgamer.com/harvey-smith-talks-chaos-open-worlds-and-the-differences-between-dishonored-2-and-prey); [Game Developer: Harvey Smith](https://www.gamedeveloper.com/design/-i-dishonored-i-s-harvey-smith-player-choice-is-paramount-in-design)

### Inferences
These are scale-down proposals.
- **End-of-contract card.** Show 4–6 binary badges computed from sim events already logged:
  - Ghost: never alerted, meaning suspicion never reached max.
  - No Witnesses: no civilian call completed.
  - Clean: no non-target deaths.
  - Bodies Hidden.
  - Cameras Clear: the camera was looped or hacked, or the recorder wiped.
  - Pacifist: no kills, using non-lethal takedowns.
  - "Silent Assassin" equivalent: all of the above except Pacifist.
  - Badges pay bonus eddies and fixer reputation. This is deterministic and testable in `sim`.
- **"Opportunities" as data-driven hints.** Each contract defines 1–3 opportunities, each a short chain: overhear an ink bark, then get an item or disguise, then reach a target position. For example: the target's lift is serviced at 22:00 per its schedule, so hack the lift. They are optional and shown as a tracker once discovered. This leverages existing NPC schedules and day/night.
- **Escalation contracts (a Hitman mode, from general knowledge, not sourced here).** Replay the same contract with one extra constraint per level: weapon restriction, more guards, a timed objective. This gives cheap replay content from a single map chunk.
- **Optional objectives on top of the existing types.** For example, "retrieve, and also copy the data shard", or "escort without alerting". These give the rating card more texture.
- **Two reputation tracks per faction.** A "professional" track (clean ratings) and a "street" or "fear" track (loud play) unlock different perks or vendors, so neither playstyle is punished. This follows the Sleeping Dogs model.

### Gaps
- I found no primary IOI source on how Opportunities or Mission Stories were designed, or on Escalation scoring numbers. The GDC Vault is gated and the fandom wiki was blocked.
- I found no reliable source on Shadowrun mission structure (pre-run briefing, legwork, run, extraction), Sleeping Dogs side-job structure, or The Ascent side quests beyond the cyberdeck gating. These still need research if the report writer needs them.
