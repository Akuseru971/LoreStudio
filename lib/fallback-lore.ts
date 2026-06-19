import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

const fallbackChapterLabels = [
  "A Name in the Ledger",
  "The Work and the Ward",
  "The Day the Pattern Broke",
  "A Champion's Shadow",
  "The Door That Would Not Stay Shut",
  "What the Silence Left Behind",
  "The Person They Had to Become",
  "Where the Road Ends Now",
];

export function buildFallbackLoreBook(input: BookFormInput): LoreBook {
  const region = chooseRuneterraRegion(input);
  const profile = regionalProfile(region, input.characterType);
  const champion = championForRegion(region);
  const legendaryTitle = `${input.name}, ${profile.title}`;
  const palette = paletteForRegion(region);
  const anchor = loreAnchorForRegion(region);
  const visualDirectionPages = fallbackChapterLabels.map((_, index) =>
    visualDirectionForPage(input, index, region, profile, champion),
  );
  const pageTexts = buildPageTexts(input, region, profile, champion);

  return {
    title: `${input.name} and ${profile.distinctiveHook}`,
    subtitle: `A clear ${region} biography of ${profile.socialRole}.`,
    mainRegion: region,
    storyEngine: profile.storyEngine,
    protagonistRole: profile.socialRole,
    coreConflict: profile.coreConflict,
    distinctiveHook: profile.distinctiveHook,
    narratorIntro: `This is the life of ${input.name}, told in order: where they began in ${region}, what changed them, and why the lower lanes still speak of that name.`,
    biographyArc: {
      startingSituation: `${input.name} works as ${profile.socialRole} in ${region}.`,
      incitingEvent: profile.coreConflict,
      championConnectionPage4: champion.summary,
      page5Cliffhanger: champion.cliffhanger,
      finalState: `${input.name} survives the immediate crisis but must follow evidence that points beyond one solved problem.`,
    },
    championConnection: {
      championName: champion.name,
      connectionType: champion.connectionType,
      connectionSummary: champion.summary,
      canonSafetyNote: champion.canonNote,
    },
    originalityProfile: {
      specificRole: profile.socialRole,
      dailyReality: `ordinary ${region} work before the first failure`,
      regionalPressure: profile.coreConflict,
      unusualStoryElement: profile.distinctiveHook,
      repetitionAvoided: ["chosen one", "prophecy arc", "generic warrior"],
    },
    characterBible: {
      name: input.name,
      gender: input.gender,
      characterType: input.characterType,
      legendaryTitle,
      region,
      socialRole: profile.socialRole,
      visualIdentity: `${input.gender === "unknown" ? "an observant figure" : input.gender} with the bearing of a ${input.characterType}, visibly shaped by ${region}'s daily pressures`,
      clothing: clothingForRegion(region, input.characterType),
      faceAndBody: "watchful eyes, practical posture, weathered hands, and the tension of someone responsible for local details",
      aura: auraForRegion(region),
      symbolicObject: profile.distinctiveHook,
      colorPalette: palette,
      worldRules: `${anchor} This is an original Runeterran life shaped by local stakes, not a change to known champion history.`,
      runeterraLoreAnchor: anchor,
    },
    pages: fallbackChapterLabels.map((chapter, index) => {
      const title = titles(input, index, region, profile, champion);
      const visualDirection = visualDirectionPages[index];

      return {
        pageNumber: index + 1,
        chapter,
        title,
        text: pageTexts[index],
        continuityNote: continuityNoteForPage(index, input.name),
        visualDirection,
        imagePrompt: buildFallbackImagePrompt(
          index + 1,
          chapter,
          title,
          visualDirection,
          region,
          input,
          profile,
          anchor,
          champion,
        ),
      };
    }),
  };
}

function championForRegion(region: string) {
  const champions: Record<
    string,
    { name: string; connectionType: string; summary: string; canonNote: string; cliffhanger: string }
  > = {
    Zaun: {
      name: "Ekko",
      connectionType: "indirect rescue and rumor",
      summary:
        "Workers whisper that Ekko once delayed a sump collapse long enough for three repair crews to escape, and the protagonist finds his scratched time-gear mark on a sealed tunnel wall.",
      canonNote: "Ekko is referenced through aftermath and rumor only; the protagonist does not meet him directly.",
      cliffhanger: "A chemtech relay begins repeating the protagonist's name in Ekko's cadence.",
    },
    Demacia: {
      name: "Lux",
      connectionType: "fear of forbidden light",
      summary:
        "After border bells ring for hidden magic, the protagonist finds old pamphlets describing Lux's forbidden light and realizes neighbors now suspect anyone with a similar gift.",
      canonNote: "Lux is referenced through public fear and documents, not a direct meeting.",
      cliffhanger: "A petricite seal cracks when the protagonist speaks, and someone outside calls for the mageseekers.",
    },
    Noxus: {
      name: "Swain",
      connectionType: "political restructuring",
      summary:
        "A reassigned officer leaves orders signed with Swain's crow-mark, proving the protagonist's unit will be sent to hold a useless pass no map previously showed.",
      canonNote: "Swain influences the plot through military orders already known to affect Noxian ranks.",
      cliffhanger: "The new orders arrive before the messenger who was supposed to carry them.",
    },
    Ionia: {
      name: "Irelia",
      connectionType: "regional memory",
      summary:
        "Village elders still tell how Irelia's blades once defended a nearby crossing, and the protagonist finds a cloth banner from that day hidden beneath their shrine floor.",
      canonNote: "Irelia appears only through memory, banner, and regional history.",
      cliffhanger: "Footsteps cross the shrine roof at the hour the old defense story says Irelia once stood there.",
    },
    Piltover: {
      name: "Vi",
      connectionType: "enforcer aftermath",
      summary:
        "A busted workshop lock bears Enforcer markings linked to Vi's patrol route, and the missing inventor the protagonist was hired to find left a note about paying 'the gauntleted woman.'",
      canonNote: "Vi is referenced through enforcement traces, not a direct confrontation.",
      cliffhanger: "The note's ink is still wet, though the inventor vanished two days ago.",
    },
    Shurima: {
      name: "Azir",
      connectionType: "restored empire rumor",
      summary:
        "Caravan leaders argue over whether Azir's restored sun disc changed the meaning of a nearby ruin, and the protagonist uncovers trade records showing the oasis was hidden after his return.",
      canonNote: "Azir's influence is historical and political, not a personal encounter.",
      cliffhanger: "Sand slides away from a sealed door that should still be buried.",
    },
    Freljord: {
      name: "Ashe",
      connectionType: "tribal diplomacy",
      summary:
        "A frost-message wrapped in Ashe's crest arrives asking the protagonist's tribe to choose peace before winter, proving the Avarosan leader knows their scout route by name.",
      canonNote: "Ashe appears through diplomacy and message, not direct dialogue in this story.",
      cliffhanger: "The message is warm, as if it were written minutes ago in a heated tent.",
    },
    Bilgewater: {
      name: "Miss Fortune",
      connectionType: "dock war aftermath",
      summary:
        "Dock workers credit Miss Fortune's war against Gangplank with reopening a pier the protagonist depends on, but also left a crate of unclaimed guns under their loading berth.",
      canonNote: "Miss Fortune shapes the environment through known dock conflict, not a personal alliance.",
      cliffhanger: "One crate ticks softly when the tide turns.",
    },
    Targon: {
      name: "Leona",
      connectionType: "faith tension",
      summary:
        "A pilgrim guide shows the protagonist a sun-scorched prayer cloth said to have touched Leona's shield, reigniting old arguments between Solari and Lunari travelers on their path.",
      canonNote: "Leona is referenced through relic and faith conflict only.",
      cliffhanger: "Moonlight hits the cloth and reveals a second symbol beneath the sun.",
    },
    Ixtal: {
      name: "Qiyana",
      connectionType: "border authority",
      summary:
        "A border marker carved with Yun Tal imagery and a note about Qiyana's decree proves the jungle path the protagonist uses will be closed to outsiders within a week.",
      canonNote: "Qiyana affects the plot through regional authority, not a direct duel.",
      cliffhanger: "The marker has already been moved one mile closer to the village.",
    },
    "Shadow Isles": {
      name: "Thresh",
      connectionType: "mist fear",
      summary:
        "An old lantern keeper warns that chains like Thresh's were heard near the protagonist's relic shed after the last mist surge, and one name inside their ledger has been scratched out.",
      canonNote: "Thresh is feared through mist lore and missing names, not a direct capture.",
      cliffhanger: "The scratched name reappears, written in fresh soot on the lantern glass.",
    },
    "Bandle City": {
      name: "Lulu",
      connectionType: "impossible path",
      summary:
        "A letter delivered through a door that was not there yesterday bears playful writing travelers associate with Lulu, warning the protagonist not to take the left path twice.",
      canonNote: "Lulu is referenced through yordle mischief and impossible delivery.",
      cliffhanger: "Both paths now look exactly the same.",
    },
    "The Void": {
      name: "Kai'Sa",
      connectionType: "frontier warning",
      summary:
        "A survivor's charcoal sketch of Kai'Sa's shell is pinned beside the protagonist's specimen wall, matching a scratch pattern now appearing on their own jars.",
      canonNote: "Kai'Sa is referenced through survivor testimony and evidence, not a direct meeting.",
      cliffhanger: "One jar scratches back from the inside.",
    },
  };

  return (
    champions[region] || {
      name: "A regional champion",
      connectionType: "indirect influence",
      summary: "A known champion's actions changed the place where the protagonist lives and works.",
      canonNote: "The champion is referenced through local consequences only.",
      cliffhanger: "A clue tied to that champion appears where it should not be.",
    }
  );
}

function buildPageTexts(
  input: BookFormInput,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
  champion: ReturnType<typeof championForRegion>,
) {
  return [
    `${input.name} was known in ${region} as ${profile.socialRole}, not as a hero. They kept local records, carried ${profile.distinctiveHook}, and lived inside ordinary duties until one missing detail made neighbors look at them for answers.`,
    `Every day followed the same practical rhythm: work, routes, repairs, and the small favors that hold a community together. ${input.name} knew which doors stuck, which elders lied about their health, and which warnings people preferred not to hear. That knowledge made the first real problem impossible to ignore.`,
    `The change began with ${profile.coreConflict}. Something failed that should have been preventable, and ${input.name} was the one person close enough to see the pattern before others admitted there was one. From that hour onward, ordinary days were over.`,
    `Following the evidence led to ${champion.name}. ${champion.summary} For ${input.name}, the connection was not fame but consequence: a known champion's world had already touched theirs, and the proof was now in their hands.`,
    `${input.name} traced the clue to a place no worker was meant to enter alone. The deeper they went, the more the broken valve, the green residue, and ${champion.name}'s name all pointed to the same impossible answer. Then ${champion.cliffhanger}`,
    `The immediate aftermath left no time for poetry. People shouted, doors slammed, and the problem ${input.name} had uncovered could no longer stay private. Whatever happened in the sealed place, the community would demand an explanation before nightfall.`,
    `${input.name} changed by acting with clearer purpose. The ${input.characterType} stopped waiting for permission and started using ${profile.distinctiveHook} as proof, guide, and responsibility. Neighbors who once saw only a local worker now saw someone willing to name the truth.`,
    `Today ${input.name} stands at the edge of a solved crisis and a larger unanswered one. ${region} is safer than it was, but the last clue points beyond one street, one tunnel, one ledger. The work is not finished; the road ahead still waits.`,
  ];
}

function continuityNoteForPage(index: number, name: string) {
  const notes = [
    "Opening introduction.",
    `Continues from ${name}'s established role and community position.`,
    "Follows the daily routine established previously.",
    "Results directly from the inciting event.",
    "Builds on the champion connection.",
    "Immediate consequence of the cliffhanger.",
    "Shows how the fallout changes the protagonist.",
    "Resolves the arc while leaving the future open.",
  ];
  return notes[index];
}

function chooseRuneterraRegion(input: BookFormInput) {
  if (input.runeterraRegion !== "Auto") return input.runeterraRegion;

  const type = input.characterType.toLowerCase();
  if (type.includes("chemtech")) return "Zaun";
  if (type.includes("void")) return "The Void";
  if (type.includes("ascended")) return "Shurima";
  if (type.includes("vastaya") || type.includes("spirit")) return "Ionia";
  if (type.includes("pirate")) return "Bilgewater";
  if (type.includes("inventor")) return "Piltover";
  if (type.includes("soldier")) return "Noxus";
  if (type.includes("noble") || type.includes("guardian")) return "Demacia";
  if (type.includes("oracle")) return "Targon";
  if (type.includes("monster")) return "The Void";
  if (type.includes("healer")) return "Ionia";
  if (type.includes("hunter")) return "Freljord";
  if (type.includes("scholar")) return "Ixtal";
  if (type.includes("thief") || type.includes("assassin")) return "Bilgewater";
  return "Shurima";
}

function regionalProfile(region: string, characterType: string) {
  const profiles: Record<
    string,
    { socialRole: string; coreConflict: string; distinctiveHook: string; storyEngine: string; title: string }
  > = {
    Demacia: {
      socialRole: `${characterType} serving as a bellkeeper and quiet courier between border villages`,
      coreConflict: "petricite bells begin ringing for children with hidden magic, forcing a choice between law and mercy",
      distinctiveHook: "a cracked bell hammer wrapped in blue ribbon",
      storyEngine: "A local messenger must decide which warnings to deliver and which lives to protect from fear.",
      title: "Keeper of the Unrung Bell",
    },
    Noxus: {
      socialRole: `${characterType} working as a battlefield cartographer for a minor Noxian host`,
      coreConflict: "a campaign map is being falsified to send wounded conscripts into a useless victory",
      distinctiveHook: "a blood-stained map that changes when someone lies",
      storyEngine: "A record keeper learns that lines on a map can kill more efficiently than blades.",
      title: "Cartographer of Unwon Wars",
    },
    Ionia: {
      socialRole: `${characterType} tending a small shrine near a wounded river path`,
      coreConflict: "angry local spirits block refugees from crossing sacred water after old damage is ignored",
      distinctiveHook: "a reed flute carved with names that spirits still answer",
      storyEngine: "A shrine keeper negotiates peace between living fear and a land that remembers pain.",
      title: "Listener at the River Shrine",
    },
    Piltover: {
      socialRole: `${characterType} apprenticed to a modest civic workshop below an academy bridge`,
      coreConflict: "a small hextech device predicts accidents that wealthy patrons would rather conceal",
      distinctiveHook: "a brass accident-clock that ticks faster near preventable harm",
      storyEngine: "An apprentice must decide whether invention belongs to profit or public duty.",
      title: "Keeper of the Accident Clock",
    },
    Zaun: {
      socialRole: `${characterType} surviving as a chemtech salvage diver in the lower sump`,
      coreConflict: "a clinic's unstable medicine is being stolen before it can save workers poisoned by a factory leak",
      distinctiveHook: "a breathing mask patched with clinic thread",
      storyEngine: "A salvage diver follows stolen medicine through pipes, debts, and bodies nobody counts.",
      title: "Diver of the Green Sump",
    },
    Shurima: {
      socialRole: `${characterType} guiding caravans between buried wells and half-remembered ruins`,
      coreConflict: "a moving map reveals an oasis village that powerful relic hunters want erased",
      distinctiveHook: "a sand-glass compass that points toward hidden water",
      storyEngine: "A dune guide protects a place that survives only because maps keep forgetting it.",
      title: "Guide of the Vanishing Oasis",
    },
    Freljord: {
      socialRole: `${characterType} scouting for a small tribe before winter negotiations`,
      coreConflict: "a warning from the ice could prevent war, but only if the scout lies to proud elders",
      distinctiveHook: "a fishbone charm frozen around a whispered warning",
      storyEngine: "A scout must choose between truth, diplomacy, and the lives a tribe will lose to pride.",
      title: "Bearer of the Frost-Lie",
    },
    Bilgewater: {
      socialRole: `${characterType} navigating debts, docks, and dangerous cargo in the slaughter docks`,
      coreConflict: "a sea monster egg stolen from the wrong shrine could bring ruin on an entire pier",
      distinctiveHook: "a salt-black egg case warm beneath wet cloth",
      storyEngine: "A dockside survivor tries to return stolen life before debt collectors turn it into profit.",
      title: "Keeper of the Warm Egg",
    },
    Targon: {
      socialRole: `${characterType} guiding pilgrims who cannot survive the mountain alone`,
      coreConflict: "a climber who should not ascend carries a message between Solari daylight and Lunari shadow",
      distinctiveHook: "a sun-bleached scarf that glows only under moonlight",
      storyEngine: "A mountain guide escorts a forbidden message through faiths that refuse to share the sky.",
      title: "Guide of the Divided Path",
    },
    Ixtal: {
      socialRole: `${characterType} shaping living stone along a guarded jungle border`,
      coreConflict: "one sculpture remembers a history the local masters prefer sealed",
      distinctiveHook: "a living-stone chisel that hums near buried truth",
      storyEngine: "An artisan follows the memory of stone into a conflict between protection and erasure.",
      title: "Carver of Remembering Stone",
    },
    "Shadow Isles": {
      socialRole: `${characterType} preserving relics and names from the reach of the Black Mist`,
      coreConflict: "a lantern of remembered names can save only one memory before the mist returns",
      distinctiveHook: "a tarnished lantern polished with salt and tears",
      storyEngine: "A relic keeper chooses which lost memory deserves one more dawn.",
      title: "Polisher of the Last Lantern",
    },
    "Bandle City": {
      socialRole: `${characterType} carrying impossible mail through paths that answer moods instead of maps`,
      coreConflict: "one wrong door has trapped a village's laughter in a place no road can find",
      distinctiveHook: "a satchel of letters addressed to feelings",
      storyEngine: "A traveler delivers messages to impossible destinations before the wrong door becomes permanent.",
      title: "Courier of the Untrue Road",
    },
    "The Void": {
      socialRole: `${characterType} cataloguing tiny impossible changes along a frontier no one believes is threatened`,
      coreConflict: "a first breach is small enough to ignore and strange enough to doom a village",
      distinctiveHook: "a glass specimen jar that scratches from the inside",
      storyEngine: "A witness documents impossible life until the evidence begins documenting them back.",
      title: "Witness of the First Breach",
    },
  };
  return profiles[region] || profiles.Shurima;
}

function paletteForRegion(region: string) {
  const palettes: Record<string, string> = {
    Demacia: "white stone, royal blue, silver steel, restrained gold",
    Noxus: "black iron, crimson banners, ash gray, war-tarnished bronze",
    Ionia: "spirit blossom pink, jade green, dusk violet, soft gold",
    Piltover: "polished brass, academy blue, cream stone, hextech cyan",
    Zaun: "chemtech green, rusted copper, sump black, toxic amber",
    Shurima: "sun gold, desert ochre, turquoise relic light, ancient sandstone",
    Freljord: "glacial blue, bone white, storm gray, ember orange",
    Bilgewater: "sea black, lantern orange, weathered teal, salt-stained brass",
    Targon: "star silver, midnight blue, cosmic violet, solar gold",
    Ixtal: "jungle emerald, elemental turquoise, obsidian, sunlit gold",
    "Shadow Isles": "spectral green, grave black, ruined silver, cold mist",
    "Bandle City": "dreamlike violet, warm amber, moss green, impossible starlight",
    "The Void": "void purple, abyss black, sickly magenta, alien blue",
  };
  return palettes[region] || "Runeterran gold, deep navy, ancient stone, twilight blue";
}

function loreAnchorForRegion(region: string) {
  const anchors: Record<string, string> = {
    Demacia: "Demacia's petricite traditions, fear of magic, noble houses, and borderland duties shape the plot.",
    Noxus: "Noxian ambition, military record keeping, conquest politics, and ruthless merit shape the plot.",
    Ionia: "Ionian spirits, living land, refugee paths, and wounds left by invasion shape the plot.",
    Piltover: "Piltover's civic engineering, academy prestige, Hextech ambition, and class pressure shape the plot.",
    Zaun: "Zaunite survival, Chemtech risk, clinics, sump labor, and factory exploitation shape the plot.",
    Shurima: "Shuriman ruins, caravan routes, hidden water, relic hunters, and ancient empire echoes shape the plot.",
    Freljord: "Freljordian tribes, winter diplomacy, scouts, and old warnings from the ice shape the plot.",
    Bilgewater: "Bilgewater's docks, debt, sea shrines, monster trade, and pirate codes shape the plot.",
    Targon: "Targon's mountain trials, Solari and Lunari tensions, pilgrim routes, and celestial faith shape the plot.",
    Ixtal: "Ixtal's elemental craft, guarded borders, living stone, and protected histories shape the plot.",
    "Shadow Isles": "The Black Mist, relic preservation, lost names, and resistance against oblivion shape the plot.",
    "Bandle City": "Bandle City's portals, yordle logic, impossible paths, and emotional geography shape the plot.",
    "The Void": "Void breaches, frontier disbelief, biological impossibility, and survival against corruption shape the plot.",
  };
  return anchors[region] || "Runeterra's regional pressures and old powers shape the plot.";
}

function clothingForRegion(region: string, characterType: string) {
  return `${region}-specific practical clothing adapted for a ${characterType}, with worn tools, local materials, and one distinctive personal detail`;
}

function auraForRegion(region: string) {
  const auras: Record<string, string> = {
    Demacia: "a restrained petricite-blue shimmer",
    Noxus: "a low crimson pressure like a banner before rain",
    Ionia: "a soft spirit-light moving like water through reeds",
    Piltover: "a precise hextech glimmer hidden beneath polished restraint",
    Zaun: "a faint chemtech haze with stubborn warmth beneath it",
    Shurima: "a dry sunlit radiance carrying dust and memory",
    Freljord: "a frostwind aura warmed by ember resolve",
    Bilgewater: "a lantern-smoke aura salted by storm air",
    Targon: "a quiet celestial gleam divided between sun and moon",
    Ixtal: "an elemental pulse felt more than seen",
    "Shadow Isles": "a pale mist-glow resisted by living breath",
    "Bandle City": "a flicker of impossible color at the edge of sight",
    "The Void": "a violet distortion held back by human will",
  };
  return auras[region] || "a subtle Runeterran aura";
}

function titles(
  input: BookFormInput,
  index: number,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
  champion: ReturnType<typeof championForRegion>,
) {
  const list = [
    `The Name on the Local Ledger`,
    `A Life in ${region}`,
    `When the Pattern Broke`,
    `What ${champion.name} Left Behind`,
    `Before the Door Opened`,
    `The First Hour After`,
    `What ${input.name} Chose to Do`,
    `The Road Still Open`,
  ];
  return list[index] || profile.title;
}

function visualDirectionForPage(
  input: BookFormInput,
  index: number,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
  champion: ReturnType<typeof championForRegion>,
): BookPage["visualDirection"] {
  const directions: BookPage["visualDirection"][] = [
    {
      sceneType: "biography introduction scene",
      cameraShot: "medium-wide shot showing role and place",
      characterAction: `${input.name} is shown in their everyday role with ${profile.distinctiveHook}`,
      environment: `a recognizable workplace or community location in ${region}`,
      keyObjects: [profile.distinctiveHook, "local records", "regional architecture"],
      mood: "clear, grounded, introductory",
      lighting: "readable natural light",
    },
    {
      sceneType: "early life establishing scene",
      cameraShot: "wide shot with the protagonist within daily life",
      characterAction: `${input.name} performs routine work before the trouble begins`,
      environment: `busy lived-in ${region} location tied to ${profile.socialRole}`,
      keyObjects: ["work tools", "local people", "daily routes"],
      mood: "specific, observant, lived-in",
      lighting: "soft workday light",
    },
    {
      sceneType: "inciting event scene",
      cameraShot: "medium-wide shot focused on the incident",
      characterAction: `${input.name} discovers the first major problem tied to ${profile.coreConflict}`,
      environment: `concrete location in ${region} where the pattern breaks`,
      keyObjects: ["broken evidence", profile.distinctiveHook, "witness detail"],
      mood: "alert, consequential",
      lighting: "contrasty incident light",
    },
    {
      sceneType: "champion connection scene",
      cameraShot: "over-the-shoulder shot focused on evidence tied to ${champion.name}",
      characterAction: `${input.name} finds proof linking their problem to ${champion.name}'s known influence`,
      environment: `${region} location affected by ${champion.name}'s history or faction`,
      keyObjects: ["document", "symbol", "aftermath detail", "distant banner"],
      mood: "revealing, grounded",
      lighting: "clear focal light on the clue",
    },
    {
      sceneType: "cliffhanger scene",
      cameraShot: "dramatic medium-wide shot on the suspense beat",
      characterAction: `${input.name} reaches the moment of suspense: ${champion.cliffhanger}`,
      environment: `sealed or dangerous place in ${region}`,
      keyObjects: ["activating clue", "opened threshold", "reacting object"],
      mood: "suspenseful, unresolved",
      lighting: "high contrast on the cliffhanger detail",
    },
    {
      sceneType: "immediate consequence scene",
      cameraShot: "medium-wide shot showing fallout",
      characterAction: `${input.name} faces the direct aftermath of the cliffhanger`,
      environment: `${region} location now changed by the event`,
      keyObjects: ["crowd reaction", "damaged evidence", profile.distinctiveHook],
      mood: "urgent, reactive",
      lighting: "unstable aftermath light",
    },
    {
      sceneType: "personal change scene",
      cameraShot: "medium-wide shot showing action and witnesses",
      characterAction: `${input.name} acts with new resolve using ${profile.distinctiveHook}`,
      environment: `${region} community space responding to the truth`,
      keyObjects: ["proof object", "local witnesses", "changed role"],
      mood: "earned, resolute",
      lighting: "warmer decisive light",
    },
    {
      sceneType: "current fate scene",
      cameraShot: "wide cinematic shot toward an open road",
      characterAction: `${input.name} follows the last clue beyond the solved local crisis`,
      environment: `open route, harbor, shrine, or threshold in ${region}`,
      keyObjects: ["unfinished clue", profile.distinctiveHook, "distant path"],
      mood: "open-ended, clear",
      lighting: "horizon glow with readable atmosphere",
    },
  ];
  return directions[index];
}

function buildFallbackImagePrompt(
  pageNumber: number,
  chapter: string,
  title: string,
  visualDirection: BookPage["visualDirection"],
  region: string,
  input: BookFormInput,
  profile: ReturnType<typeof regionalProfile>,
  anchor: string,
  champion: ReturnType<typeof championForRegion>,
) {
  const championHint =
    pageNumber === 4 ? `Indirect champion reference: ${champion.name}. ${champion.summary}` : "";
  const cliffhangerHint = pageNumber === 5 ? `Cliffhanger focus: ${champion.cliffhanger}` : "";

  return [
    `Full-page illustrated story scene for Page ${pageNumber}: ${chapter} - ${title}.`,
    `Scene type: ${visualDirection.sceneType}.`,
    `Camera shot: ${visualDirection.cameraShot}.`,
    `Character action: ${visualDirection.characterAction}.`,
    `Environment: ${visualDirection.environment}.`,
    `Key objects: ${visualDirection.keyObjects.join(", ")}.`,
    `Mood: ${visualDirection.mood}.`,
    `Lighting: ${visualDirection.lighting}.`,
    championHint,
    cliffhangerHint,
    `Consistent original protagonist: ${input.name}, ${input.gender}, ${input.characterType}, social role: ${profile.socialRole}, symbolic object: ${profile.distinctiveHook}.`,
    `Runeterra region: ${region}. Lore-compatible regional anchor: ${anchor}.`,
    `${IMAGE_STYLE_LOCK} Runeterra atmosphere, coherent character design, concrete biography moment, no repeated portrait composition.`,
    IMAGE_STYLE_AVOIDANCES,
  ]
    .filter(Boolean)
    .join(" ");
}
