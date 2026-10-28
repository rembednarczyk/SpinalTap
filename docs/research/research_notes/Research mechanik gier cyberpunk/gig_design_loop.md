# Gig/contract design and core loop for open-world action RPGs and immersive sims (reference: Cyberpunk 2077 fixer gigs) — applied to Seki Senshi

Scope: side contracts ("gigs") and the money / reputation / cyberware / story loop. Target: Seki Senshi, a small browser 3D cyberpunk game. It has fixers Kaito, Hana and Genzō and template-based contracts (eliminate, protect, retrieve, escort, infiltrate, hack). Contracts are placed using sites and spawn points.

Source-quality note: many structural facts come from fan wikis and guide sites (Fextralife, PowerPyx, GamePressure, Prima). Critique comes from reviews and forum threads. Developer-intent claims come from Game Developer, GDC session pages and interviews. Several GDC Vault talks are paywalled, so only their abstracts and press coverage were available. The TechRadar article on Miles Tost's talk came back truncated when fetched, so the claims about it below come from search-result excerpts of that article.

---

## 1. Structure of Cyberpunk 2077 gigs (briefing, entry points, optional objectives, bonuses, twists, environmental storytelling, reputation, critiques)

### Takeaway
A C2077 gig is a short, self-contained job:
- a phone briefing from a district fixer, with a client and target;
- a site that can be approached in several ways;
- one main objective, plus an optional "clean" condition (non-lethal or undetected) that pays a bonus;
- payment and Street Cred handed out by the fixer at the end.

Gigs are tied to districts (one fixer per district, one or two main gangs per district) and gated by Street Cred tiers. The main critiques are interruptions (too many calls and texts), map icon clutter, and gigs feeling repetitive after the first few.

### Cited Findings
- Gigs are optional side missions handed out by fixers and clients for eddies (money). They are marked blue on the map. Some unlock only at a set Street Cred level or after other jobs. — [Fextralife: Gigs](https://cyberpunk2077.wiki.fextralife.com/Gigs)
- The base game has 89 gigs in 7 archetypes: Gun for Hire 14, Search and Recover 10, Thievery 21, Agent Saboteur 9, SOS: Merc Needed 16, Special Delivery 2, Cyberpsycho Sighting 17. This shows a small set of templates behind a lot of content. — [Fextralife: Gigs](https://cyberpunk2077.wiki.fextralife.com/Gigs)
- Gigs are split by district, each with its own fixer and main enemy faction:

  | District | Fixer | Gigs | Main faction |
  |---|---|---|---|
  | Watson | Regina Jones | 29 | Maelstrom |
  | Santo Domingo | El Capitan | 15 | 6th Street |
  | Heywood | Padre | 13 | Valentinos |
  | Badlands | Dakota | 12 | Wraiths |
  | Westbrook | Wakako | 9 | Tyger Claws |
  | City Center | Dino | 8 | corpo-hired enemies |
  | Pacifica | Mr. Hands | 3 | Animals and Voodoo Boys |

  The wiki's own counts don't fully reconcile with its Phantom Liberty list. — [Fextralife: Gigs](https://cyberpunk2077.wiki.fextralife.com/Gigs)
- Example flow, "Fixer, Merc, Soldier, Spy" (Thievery): enter the hotel, reach the penthouse, steal the datashard, leave, call Regina, deliver the shard, collect the bonus from a Drop Point. Reward: 4395 eddies and 254 XP. — [Fextralife: Fixer, Merc, Soldier, Spy](https://cyberpunk2077.wiki.fextralife.com/Fixer,+Merc,+Soldier,+Spy)
- In that gig the client says "I'll pay extra if you get in and out without a trace." The game tracks an optional "Do Not Raise The Alarm" objective. — [PowerPyx walkthrough](https://www.powerpyx.com/cyberpunk-2077-fixer-merc-soldier-spy-gig-walkthrough/), [GameRiv: all gigs](https://gameriv.com/cyberpunk-2077-all-gigs/)
- Bonus conditions follow the archetype. Gun for Hire asks you to stay non-lethal for a bonus. Agent Saboteur and SOS reward staying undetected. Not every gig has a stealth incentive; one guide says "An Inconvenient Killer" has none. Failing the condition usually costs only the bonus money, not the gig. — [GameRiv: all gigs](https://gameriv.com/cyberpunk-2077-all-gigs/), [Steam discussion](https://steamcommunity.com/app/1091500/discussions/7/4331979507653614257)
- Almost every fixer gives a unique bonus when all their gigs are done, usually tied to their story or aesthetic. One player says Regina has a legendary item for finishing all cyberpsycho gigs. — [Steam discussion](https://steamcommunity.com/app/1091500/discussions/6/3183488858483698301). These claims are user-reported and unverified.
- Gigs are the main source of Street Cred. Higher-tier gigs stay locked until Street Cred rises. Fixers call V when a gig is nearby. — [PCGamesN: Street Cred](https://www.pcgamesn.com/cyberpunk-2077/street-cred), [TechRadar Street Cred guide](https://www.techradar.com/how-to/cyberpunk-2077-level-cap-and-street-cred-guide)
- Critique (interruptions): PC Gamer says the phone constantly rings and texts arrive during driving, combat and conversations, and that fixers call in transit with boring-sounding jobs. — [PC Gamer: stop it with all the phone calls](https://pcgamer.com/seriously-cyberpunk-2077-stop-it-with-all-the-phone-calls-and-texts)
- Critique (map clutter): a review says side quests come in at a rapid clip and the map gets so crowded you forget what you were looking for. — [Worthplaying review](https://worthplaying.com/article/2020/12/29/reviews/123498-pc-review-cyberpunk-2077/)
- Players disagree about map clutter. One Steam poster wants gig icons shown only after acceptance, for less clutter and more immersion. Another blames NCPD scanner and fast-travel icons and points to map filters. — [Steam thread](https://steamcommunity.com/app/1091500/discussions/0/4033601393695918197)
- Critique (repetition): a review summary says gigs were interesting at first but soon became repetitive. The same summary praises the Dogtown (Phantom Liberty) gigs as more involved, with choices in approach. — [Zatu retail-page review excerpt](https://zatu.com/product/cyberpunk-2077-ultimate-edt-ps5/). This is a weak source and should be confirmed.
- Design self-critique from CDPR (Miles Tost, GDC 2023, "What Cyberpunk 2077 Taught Us About Non-Linear Level Design"):
  - The game always offered a "generic path" that didn't need a specialized build, so many players took the path of least resistance and their build choices felt unimportant.
  - Tost wants branching paths treated as special, as in Dishonored.
  - He names three principles, perception, exclusivity and validation, as especially good for discovery and exploration beats.
  - Source: [TechRadar](https://techradar.com/news/cyberpunk-2077s-design-had-one-key-flaw-says-developer), from search excerpts because the fetched article was truncated.

### Inferences
- **One template, three layers.** The C2077 gig is a template with three variable layers: the archetype (the verb), the site (approaches), and an optional "clean" condition paid as a bonus. That maps directly onto Seki Senshi's types:

  | Seki Senshi type | C2077 archetype |
  |---|---|
  | eliminate | Gun for Hire |
  | retrieve | Thievery / Search and Recover |
  | infiltrate / hack | Agent Saboteur |
  | protect | SOS: Merc Needed |
  | escort | Special Delivery |

  Each template should declare one default bonus condition: for example `noKills` for protect/escort, `noAlarm` for infiltrate/hack, and "target taken alive" for retrieve.
- **Fixer = district + faction + flavour.** Giving Kaito, Hana and Genzō each a home district, a main enemy faction and a "complete all my gigs" reward copies C2077's strongest structure at low cost.
- **Fixing the generic-path problem.** Each site should have one obvious path and at least one "special" path that only some builds or tools can use: a hack-gated door, a cyberware-gated climb, a social disguise. The special path needs a visible payoff (a shortcut, loot, a bonus objective) so the choice feels validated.
- **Notification discipline.** Offer gigs through a fixer inbox or terminal that the player opens. Avoid unprompted calls, or limit them to one per session or district entry. Show map icons only for accepted contracts. This avoids both PC Gamer's interruption critique and the clutter critique.

### Gaps
- I found no primary CDPR source on how gigs are authored (templates or tooling). The 2.0 patch changes to gig rewards and bonus structure were not verified.
- Environmental storytelling in gigs (shards, emails on site) is widely described anecdotally, but I didn't fetch a citable source; the walkthrough for Fixer, Merc, Soldier, Spy only mentions the stolen datashard. Treat "shards tell a twist" as a pattern to verify.
- Fixer completion bonuses: exact rewards per fixer are unverified.

---

## 2. Immersive sim mission design principles (multiple solutions, layered levels, rewarding observation)

### Takeaway
Immersive-sim missions rely on:
- non-linear spaces with several routes around every obstacle (guards, doors);
- lighting and shadow as readable stealth affordances;
- side objectives inside the main mission;
- a holistic approach in which gameplay, presentation and story are designed together.

Hitman adds a two-tier approach to information. A few deep guided "Opportunities" introduce new players, while many unguided systemic solutions reward observation.

### Cited Findings
- Stealth-focused immersive sims need non-linearity: if a guard can't be bypassed, the player needs another route. Thief 2's "First City Bank & Trust" is cited as the model later used by Deus Ex and Dishonored. Many alternative routes are inherent to stealth gameplay. — [80.lv: Five pillars of immersive sims](https://80.lv/articles/five-pillars-of-immersive-sims)
- Steve Lee (Arkane, Dishonored 2) argued at GDC 2017 for holistic level design: level designers should think about gameplay, presentation and story together. The talk covered affordances, intentionality, world building and interactive storytelling. — [Game Developer: Dishonored 2 dev on holistic level design](https://gamedeveloper.com/design/video-i-dishonored-2-i-dev-shares-tips-on-holistic-level-design), [GDC Vault abstract](https://gdcvault.com/play/1024301/Level-Design-Workshop-An-Approach)
- In Dishonored 2, lit areas expose the player and shadows help hide, and every major mission has side objectives. — from a review excerpt in the [80.lv pillars](https://80.lv/articles/five-pillars-of-immersive-sims) / search results; treat as secondary.
- Hitman Opportunities ("mission stories"):
  - IO says they are labour-intensive, so the team prefers fewer but deeper ones. Their purpose is a gentle introduction for players who don't want to explore.
  - Each map has about a dozen story-supported kill methods, plus systemic kills and environmental traps.
  - Berlin (Hitman 3) has no Opportunities and is praised for its pure puzzle feel.
  - Guided stories "breadcrumb" players and plant seeds for alternate routes.
  - Source: [TheGamer interview: the DNA of an IO game](https://www.thegamer.com/hitman-3-interview-the-dna-of-an-io-game-and-what-it-means-for-the-future-of-hitman-and-bond/)
- Hitman mission stories start when the player overhears a conversation or finds intel; the handler then guides them. — [GamesRadar: Hitman 3 mission stories](https://gamesradar.com/all-hitman-3-mission-stories-and-assassinations)
- IO (Sven Liebold) stresses replaying levels to plan more elaborate kills and learning new details from NPCs on later playthroughs. — [Shacknews](https://shacknews.com/article/91777/how-hitman-opens-different-doors-for-hits-and-where-it-fits-on-the-series-timeline)
- CDPR's GDC 2023 retrospective benchmarks against Dishonored: branching paths must feel exclusive and validated (see section 1). — [TechRadar](https://techradar.com/news/cyberpunk-2077s-design-had-one-key-flaw-says-developer)

### Inferences (template application)
- **Site schema.** Every site should define at least three entry tags: `front` (combat or social), `side/back` (needs a lock, hack or keycard), and `vertical` (roof, vent or ledge, with a cyberware or climb check). Spawn points should cover the front heavily and the alternates lightly. Lighting zones should mark stealth affordances.
- **Observation hooks.** Each template gets one or two "intel hooks" that can be found on site: an overheard NPC line, a terminal email, a shard. Reading one reveals an alternate solution, such as a guard rotation gap, a door code, or the target's habit by the bar at night. This is Hitman's Opportunity in miniature. Keep them few, as IO advises, and let them point to systemic options rather than scripted ones.
- **Verb parity.** For hack-a-terminal and infiltrate, make sure non-combat builds have a full route. For eliminate, allow a non-lethal takedown if Seki Senshi has one, matching C2077's non-lethal bonus.

### Gaps
- I didn't fetch a primary Deus Ex or Prey mission-design talk. No Level Design Book page on immersive-sim layout was retrieved (the guessed URL returned 404). Candidate pages to read: [Level Design Book: Typology](https://book.leveldesignbook.com/process/layout/typology), [Verticality](https://book.leveldesignbook.com/process/layout/flow/verticality), [Circulation](https://book.leveldesignbook.com/process/layout/flow/circulation).

---

## 3. Template and procedural missions: good and bad examples, and the variation axes that keep templates fresh

### Takeaway
Templates go stale when the verbs, locations, animations and stakes repeat with only cosmetic changes: Mafia III rackets, Assassin's Creed Odyssey boards, Mass Effect Andromeda fetch quests. They stay fresh when the variation axes change how the player plans, not just what they shoot. Examples:
- Hitman Elusive Targets: one chance, time window, different security per target, map changes.
- Shadow of Mordor Nemesis: generated named enemies with traits and memory (scars).
- Ghost of Tsushima Tales: a known system reused with a new purpose as a twist, and character stakes.

### Cited Findings
- **Mafia III (negative example).**
  - Taking control of the city is "100% formulaic" light side-mission work. — [Medium/DoubleJump](https://medium.com/doublejump/belated-mafia-iii-review-6b0150b979c2)
  - Goons respawn, often in the same positions, when you return to a site. — [PC Gamer review](https://www.pcgamer.com/mafia-3-review/)
  - Racket-boss animations are identical; only the dialogue changes. — [GameSpew](https://www.gamespew.com/2016/10/mafia-iii-review/)
  - "Smash boxes, steal cargo, eliminate targets… no creativity and no stakes." The rare capo and underboss missions are the highlights. — [Easy Allies](https://easyallies.com/review/mafia-iii)
  - A defence of the design: it makes sense in the fiction, because Lincoln must consolidate power before his main targets. — [TheSixthAxis](https://www.thesixthaxis.com/?p=276288)
- **Assassin's Creed Odyssey boards (negative example).**
  - Players call the boards time-filler with little context. — [Steam](https://steamcommunity.com/app/812140/discussions/0/2242174386387820170), [Penny Arcade forum](https://forums.penny-arcade.com/discussion/comment/40629694)
  - "Stranger" quest scenes are built from prerecorded pieces that start repeating. — [Steam](https://steamcommunity.com/app/812140/discussions/0/1741103267289861444)
  - "Always doing the same thing over and over." — [Twinfinite](https://twinfinite.net/ps4/assassins-creed-odyssey-needed-changes-perfect/2/)
  - Mostly forum evidence, which is anecdotal.
- **Mass Effect Andromeda (negative example).**
  - Good quests are buried under dull fetch quests and map icons, and rewards are minimal. — [Medium: BioWare can't patch what sucks](https://medium.com/@jaredly/bioware-cant-patch-what-sucks-about-mass-effect-andromeda-95192dc9bea4)
  - Reliance on open-world fetch quests was among the main launch complaints. — [Windows Central](https://m.windowscentral.com/bioware-pledge-address-negative-feedback-mass-effect-andromeda)
- **Hitman Elusive Targets (positive example, from the lead online designer Torben Ellert's write-up).**
  - One chance: success and failure are permanent. Restarts are allowed until the "Rubicon moment" when the player commits to the kill.
  - Sparse briefing: a photo and little else, ending with "The clock is ticking, 47."
  - Time window: 48 hours (the first version had 6).
  - Map reuse: existing maps are reused by disabling areas and rebuilding a scenario from existing assets. "The Sensation" shut off a back area, built a party, and shifted the lighting about an hour later.
  - Mastery first: targets are only released on maps players have already mastered.
  - Varied security: one bodyguard (the Forger); two guards and an assistant (Congressman Troutt); a whole locked-down region (the Cardinal). Identical twins where the wrong one must not be harmed.
  - Effect on players: they become more deliberate and treat every civilian as a witness.
  - Source: [Game Developer: Designing the Elusive Targets system](https://gamedeveloper.com/design/designing-the-elusive-targets-system-in-2016-s-i-hitman-i-)
- Elusive Targets work as a "final exam" for a map the player has already explored. — [GameCritics](https://gamecritics.com/corey-motley/hitmans-elusive-targets-finally-appear/)
- **Shadow of Mordor / Shadow of War Nemesis.**
  - Generates names, traits and ranks for orc leaders. Orcs gain scars when you fight them repeatedly, a visible history of the conflict. — [Gaming Nexus](https://gamingnexus.com/News/31689/Middle-Earth-Shadow-of-Mordor-talks-a-big-game)
  - Enemies remember the player and react to what was done to them. — [80.lv](https://80.lv/articles/nemesis-system-appeared-in-middle-earth-shadow-of-mordor-to-fight-game-reselling)
  - Inspired by multiplayer and pro sports. — [PC Gamer](https://www.pcgamer.com/shadow-of-mordors-nemesis-system-inspired-by-multiplayer-sports)
  - Per-faction morale and discipline was cut during development. — [Game Informer](https://www.gameinformer.com/b/news/archive/2015/01/20/shadow-of-mordor-s-nemesis-system-was-once-a-bit-more-complicated.aspx)
  - GDC 2018 talk by Chris Hoge: "Helping Players Hate (or Love) Their Nemesis". — [GDC Vault](https://www.gdcvault.com/play/1025150/contactUs), [Game Developer video](https://gamedeveloper.com/design/video-how-the-nemesis-system-in-i-shadow-of-war-i-was-designed)
  - Caveat: WB holds a patent on the Nemesis System, which one source says runs to 2036. — [80.lv](https://80.lv/articles/nemesis-system-appeared-in-middle-earth-shadow-of-mordor-to-fight-game-reselling). A small "NPC remembers" feature is generic, but don't clone the full patented mechanism.
- **Ghost of Tsushima Tales (positive example).**
  - Goals are revealed gradually, clue by clue, framed openly ("investigate the spirit…") rather than as a checklist.
  - Twist: a familiar follow-the-NPC system is reused, but the NPC may lead you into an ambush. This adds tension with no custom code.
  - Personal stakes for Jin.
  - Mythic Tales open by showing the reward.
  - Source: [Game Developer: Ghost of Tsushima, the art of compelling quest design](https://gamedeveloper.com/design/ghost-of-tsushima---the-art-of-compelling-quest-design)
  - Counterpoint: many Tales still turn into tracking footprints and killing a threat. — [Digital Trends review](https://digitaltrends.com/gaming/ghost-of-tsushima-review)
- **Sleeping Dogs.** Mission-end Cop and Triad points:
  - Cop points start at the maximum and are deducted for incidents such as killing civilians or causing damage. — [Prima Games](https://primagames.com/eguides/sleeping-dogs-eguide/essentials/how-to-play/street-cred-the-reputation-system), [GamesAsylum](https://www.gamesasylum.com/?p=13510)
  - Triad points come from brutal or stylish actions. — [Giant Bomb](https://giantbomb.com/wiki/Games/Sleeping_Dogs)
  - Triad XP improves melee, Police XP improves firearms, and Face XP (civilian side missions) unlocks cosmetics. — [Wikipedia](https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game))

### Inferences: variation axes for Seki Senshi templates
Each one changes planning, not just appearance.
1. **Modifier (pick 0–1 per contract):**
   - `timeWindow`: target only present at night, per NPC schedules;
   - `noAlarm`, `noKills`, or `takeAlive`;
   - `oneShot`: Elusive-style, failure is permanent and the payout is larger;
   - `wrongTargetRisk`: a twin or decoy, or a protected civilian nearby.
2. **Target with traits.** Draw 1–2 traits from a small pool: paranoid (more guards), cyber-armoured (needs a hack or a specific weapon), creature of habit (fixed schedule spot, the observation reward), has an escape vehicle (fails "eliminate" if alerted).
3. **Security profile per site.** Tiers like Hitman's: solo, small detail, lockdown. The tier scales spawn-point use and the payout.
4. **Time of day and weather.** Reuse the same site at day versus night with different spawn sets and lighting zones, like Hitman shifting lighting an hour later. This is cheap content multiplication.
5. **Twist (low probability, about 1 in 4–5 contracts, never on the first contract with a fixer):**
   - the client lies: the "retrieve" package is a bomb, or the "protect" target is the real mark;
   - an ambush at the drop point;
   - a rival merc team;
   - an intel shard reveals that the target was framed, giving a choice to spare them for reputation with a different fixer.

   Reuse existing systems, following Ghost of Tsushima's follow-NPC trick.
6. **Memory.** Spared or escaped targets and named lieutenants are stored in the save, return later with a trait such as "scarred" or "holds a grudge", and reference the player. This is a Nemesis-lite approach and avoids the patented full system.
- **Anti-patterns to avoid:** enemies respawning in identical spots on return (Mafia III); identical boss scenes; context-free board pickups (AC Odyssey). Every generated contract needs at least a one-line client motive and a fixer voice line.

### Gaps
- I found no source on Hitman Contracts mode (user-made targets) or on Assassin's Creed (Origins/Syndicate) contract design intent from Ubisoft.
- I found no Ubisoft GDC talk on side content.

---

## 4. Core loop and progression: money, reputation, cyberware, story; pacing and browser session length; onboarding

### Takeaway
C2077 uses Street Cred as a second XP track, earned mainly from gigs. It gates higher-tier gigs and vendor stock at fixed thresholds; ripperdoc cyberware such as Mantis Blades and Gorilla Arms unlocks around Street Cred 20. Money buys the cyberware, and cyberware opens new routes. For a browser game, data from the nearby mobile category suggests short, self-contained sessions (about 5–9 minutes average), a strong first 10–15 minutes, auto-save and safe quitting. One contract should therefore fit in one session.

### Cited Findings
- Street Cred is separate from character level and comes mainly from gigs. Other sources are story missions, NCPD scanner events and bounties. — [PCGamesN](https://www.pcgamesn.com/cyberpunk-2077/street-cred)
- Vendor thresholds:
  - Street Cred levels 5, 12, 14, 20, 27, 37, 45 and 50 unlock vendor items. Ripperdoc cyberware at 20 includes Mantis Blades, Monowire and Gorilla Arms.
  - Vendor weapon mods unlock at 37.
  - The maximum is 50 (the "Legend of the Afterlife" trophy).
  - Sources: [TechRadar guide](https://www.techradar.com/how-to/cyberpunk-2077-level-cap-and-street-cred-guide), [PowerPyx](https://www.powerpyx.com/cyberpunk-2077-what-is-max-street-cred-level)
  - Some details differ between guides, and patch 2.0 may have changed them.
- Higher-tier gigs unlock as Street Cred rises. — [Wccftech guide](https://wccftech.com/cyberpunk-2077-guide-street-cred-and-how-to-become-a-legend-of-night-city/)
- A player observes that gigs give more Street Cred than levels, and story quests the reverse. — [Steam discussion](https://steamcommunity.com/app/1091500/discussions/0/4029095281633110657). User-reported.
- Hitman progression: XP is earned per map (mission stories and challenges) and unlocks mastery rewards (gear, outfits, starting locations), which stay unlocked permanently. — [GamePressure: Hitman 3 masteries](https://www.gamepressure.com/hitman-iii/masteries-and-progression/zee21f)
- Short-session design:
  - A short session needs a start, a decision, feedback and an ending; it is not just a large game cut into pieces. Allow instant pause, auto-save, and no penalty for quitting. — [Melior Games: short session behaviour](https://meliorgames.com/game-development/designing-mobile-games-for-short-session-behavior/)
  - GameAnalytics 2025 mobile data: top-tier games average 8–9 minute sessions, median-tier 5–6. — [GameAnalytics benchmarks via gameindustrylibrary](https://gameindustrylibrary.com/documents/gameanalytics-mobile-gaming-benchmarks-2025/read). Mobile only.
  - Leaving a browser game costs almost nothing (no purchase, no install), so the first impression matters more. — [Albino Blacksheep: Ten minutes is enough](https://www.albinoblacksheep.com/text/playhop)
- Onboarding:
  - Hitman uses a few deep guided Opportunities as a gentle introduction and leaves later content unguided. — [TheGamer interview](https://www.thegamer.com/hitman-3-interview-the-dna-of-an-io-game-and-what-it-means-for-the-future-of-hitman-and-bond/)
  - Ghost of Tsushima shows the reward before the quest starts. — [Game Developer](https://gamedeveloper.com/design/ghost-of-tsushima---the-art-of-compelling-quest-design)

### Inferences (proposed loop for Seki Senshi)
- **Loop:** take a contract from a fixer → plan (read intel, choose time of day and entry) → execute (5–10 minutes) → debrief (rating, money, rep) → spend (ripperdoc cyberware or loot) → new routes and higher-tier contracts. Story acts I and II are gated by reputation thresholds with each fixer, not by grinding.
- **Two currencies with distinct jobs.**
  - Money is a consumable: cyberware, ammo, bribes.
  - Reputation is per fixer, never spent, and gates tiers and story. Following Sleeping Dogs, the *way* a contract is done could shift which fixer's reputation grows. For example, Genzō values clean or non-lethal work, Kaito values speed or brutality, and Hana values intel or hacks. This makes playstyle meaningful without extra content.
- **Small-game version of the vendor gate.** Three or four reputation tiers. Each tier unlocks:
  - new ripperdoc stock, chosen so it opens a site route type (wall-climb, optical camo, hack range);
  - one new contract modifier;
  - one fixer story beat.
- **Ripperdoc stock should match site design.** Each cyberware should unlock a site entry tag defined in section 2 (vertical, hack-gated, social), which turns progression into new solutions (Tost's "exclusivity and validation").
- **Onboarding.** The first three contracts, one per fixer, are authored and guided:
  1. Contract 1: a single route, with an intel hook that the handler voice explicitly points out (as in Hitman).
  2. Contract 2: shows a bonus objective.
  3. Contract 3: introduces the ripperdoc purchase that opens an alternate entry.

  After that, contracts come from templates and are unguided.
- **Session pacing.**
  - Target one contract per 5–10 minute session, with an auto-save at debrief and at contract accept.
  - Allow abandoning a contract without losing the save, at the cost of the contract only.
  - The first 10–15 minutes must reach the first payout and the first purchase.

### Gaps
- I found no data specific to session length in browser 3D action games; the figures are mobile.
- C2077 2.0 changes to the Street Cred thresholds were not verified.

---

## 5. Mission-end rating and feedback; persistent consequences (NPCs remember, world changes)

### Takeaway
Clear end-of-mission scoring tells players what the game values:
- Hitman's Silent Assassin: unnoticed, only targets killed, no bodies found;
- Sleeping Dogs' deduct-from-maximum Cop points;
- C2077's lost-bonus-only failure.

Persistent consequences that work at small scale are a world-stability meter (Dishonored Chaos: more rats and guards, a darker ending) and remembered NPCs (Nemesis). Critics warn that a hidden meter can feel like punishment for using the toybox.

### Cited Findings
- **Hitman.**
  - Silent Assassin (original rules): never noticed, no kills except targets, no bodies discovered (including stunned ones). Bonus points for challenges, speed and erasing security footage. — [GamePressure: Hitman mission summaries](https://www.gamepressure.com/hitman/mission-summaries-challenges-mastery-levels/z88880)
  - Silent Assassin is described as the ultimate goal players chase in Elusive Targets. — [Game Developer](https://gamedeveloper.com/design/designing-the-elusive-targets-system-in-2016-s-i-hitman-i-)
  - In Hitman 2 a player lost Silent Assassin after a reload because kills from the discarded attempt stayed in the score. A cautionary bug: scoring state must reset with the save. — [Steam](https://steamcommunity.com/app/863550/discussions/0/5197701062330291922)
- **Sleeping Dogs.** The mission starts with full Cop points, and incidents deduct from them. — [Prima Games](https://primagames.com/eguides/sleeping-dogs-eguide/essentials/how-to-play/street-cred-the-reputation-system)
- **C2077.** Failing a bonus condition usually just reduces the payment. — [Steam discussion](https://steamcommunity.com/app/1091500/discussions/7/4331979507653614257)
- **Dishonored Chaos.**
  - A hidden stability meter. High chaos adds rats (for example a rat-filled basement that forces another route), more and stronger guards, and changed NPC attitudes. The final mission depends on overall playthrough chaos. — [Attack of the Fanboy: Harvey Smith interview](https://attackofthefanboy.com/e3/dishonored-developer-harvey-smith-talks-chaos-system-immersive-world-dunwall/), [Dishonored Wiki: Chaos](https://dishonored.fandom.com/wiki/Chaos)
  - Rule of thumb from Bethesda's explanation: killing under 20% of a mission's characters keeps Low Chaos. Rats and some creatures don't count. — [PC Gamer: Bethesda reveals Chaos details](https://www.pcgamer.com/dishonored-chaos-guide-stealth-no-detection-explanation)
  - Design intent is stability, not morality. Critics say players who wanted to use the toybox felt punished. The system was reworked in Dishonored 2 and dropped later. — [Unwinnable](https://unwinnable.com/2021/11/12/dishonoreds-chaos-system-was-never-punishing-you/)
- **Nemesis.** Orcs remember encounters and carry scars. — [Gaming Nexus](https://gamingnexus.com/News/31689/Middle-Earth-Shadow-of-Mordor-talks-a-big-game), [80.lv](https://80.lv/articles/nemesis-system-appeared-in-middle-earth-shadow-of-mordor-to-fight-game-reselling)

### Inferences
- **Debrief screen.**
  - Show the main objective, the bonus objective (met or not), and 3–4 tracked stats: detected (y/n), kills / non-lethal, alarms raised, time.
  - Give a named rank, for example "Ghost" (unseen, no kills), "Professional" (bonus met), "Loud" (completed).
  - Payout = base × rank multiplier, plus a bonus.
  - The fixer gives a one-line reaction, matched to that fixer's preferences (section 4).
  - Hitman ranks and Sleeping Dogs deductions are easy to read, and C2077 shows that failing a bonus should only cost money.
- **Deterministic scoring.** Compute ratings from sim events (counts of `Detected`, `AlarmRaised`, `NpcKilled`) inside `sim`. Reset them on load so the Hitman 2 reload bug can't happen. This fits Seki Senshi's deterministic ECS and event ports.
- **Persistent district "heat" or stability per district** (Chaos-lite).
  - Loud contracts raise heat. High heat gives more patrols and spawn density at night in that district, and some vendors or contacts become wary.
  - Heat decays with in-game days.
  - Unlike Dishonored, make it visible in the UI and reversible, to avoid the "punishing the toybox" critique.
- **NPC memory, small scale.** Store a short list of `rememberedNpcs` in the save: spared targets, escaped targets, rescued clients. Use it to:
  - bring them back as a later contract's client, informant or target with a trait ("scarred", "owes you");
  - unlock one-off twist contracts.

  This needs a `SAVE_SCHEMA_VERSION` bump and a migration, per project rules.
- **Map and notifications.** Show only accepted contracts and fixer locations on the map. Offer new gigs in the fixer inbox, at most one proactive call per district entry. This responds to the C2077 interruption and clutter critiques.

### Gaps
- I found no primary IO source on the current Hitman (World of Assassination) scoring formula.
- No primary CDPR data on how players engaged with gig bonuses.
