import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

const chapters = [
  "The Name",
  "Origin",
  "The Wound",
  "The Sign",
  "The Trial",
  "The Enemy",
  "The Transformation",
  "The Final Prophecy",
];

export function buildFallbackLoreBook(input: BookFormInput): LoreBook {
  const region = chooseRuneterraRegion(input);
  const profile = regionalProfile(region, input.characterType);
  const legendaryTitle = `${input.name}, ${profile.title}`;
  const palette = paletteForRegion(region);
  const anchor = loreAnchorForRegion(region);
  const visualDirectionPages = chapters.map((_, index) => visualDirectionForPage(input, index, region, profile));

  return {
    title: `${input.name} and ${profile.distinctiveHook}`,
    subtitle: `An original ${region} chronicle of ${profile.socialRole}, duty, and consequence.`,
    mainRegion: region,
    storyEngine: profile.storyEngine,
    protagonistRole: profile.socialRole,
    coreConflict: profile.coreConflict,
    distinctiveHook: profile.distinctiveHook,
    narratorIntro: `${input.name} was never announced by prophecy. In ${region}, they were known first by a duty no one else wanted to carry.`,
    characterBible: {
      name: input.name,
      gender: input.gender,
      characterType: input.characterType,
      legendaryTitle,
      region,
      socialRole: profile.socialRole,
      visualIdentity: `${input.gender === "unknown" ? "enigmatic figure" : input.gender} with the bearing of a ${input.characterType}, visibly shaped by ${region}'s daily pressures`,
      clothing: clothingForRegion(region, input.characterType),
      faceAndBody: "watchful eyes, practical posture, weathered hands, and the quiet tension of someone carrying a local secret",
      aura: auraForRegion(region),
      symbolicObject: profile.distinctiveHook,
      colorPalette: palette,
      worldRules: `${anchor} This is an original Runeterran life shaped by local stakes, not a change to known champion history.`,
      runeterraLoreAnchor: anchor,
    },
    pages: chapters.map((chapter, index) => {
      const title = titles(input, index, region, profile);
      const visualDirection = visualDirectionPages[index];

      return {
        pageNumber: index + 1,
        chapter,
        title,
        text: pageText(input, index, region, profile),
        visualDirection,
        imagePrompt: buildFallbackImagePrompt(index + 1, chapter, title, visualDirection, region, input, profile, anchor),
      };
    }),
  };
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
  const profiles: Record<string, { socialRole: string; coreConflict: string; distinctiveHook: string; storyEngine: string; title: string }> = {
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

function titles(input: BookFormInput, index: number, region: string, profile: ReturnType<typeof regionalProfile>) {
  const list = [
    `The Name on the Local Ledger`,
    `A Life in ${region}`,
    `The Cost of ${profile.distinctiveHook}`,
    `The First Wrong Detail`,
    `The Duty No One Wanted`,
    `The Hand Behind the Problem`,
    `What ${input.name} Chose to Become`,
    `The Road the Archive Cannot Close`,
  ];
  return list[index];
}

function pageText(input: BookFormInput, index: number, region: string, profile: ReturnType<typeof regionalProfile>) {
  const pages = [
    `${input.name}'s name first mattered on a small record, not a prophecy. In ${region}, the ${profile.socialRole} was known by a careful hand, a practical silence, and ${profile.distinctiveHook}. People remembered the work before they remembered the face, which made the first disappearance far more troubling.`,
    `${input.name} grew inside the habits of ${region}: its arguments, tools, warnings, and narrow kindnesses. The work was ordinary until ordinary things began failing in the same pattern. A door unlatched, a route changed, a patient vanished, and the local problem found the one person trained to notice details.`,
    `The wound was not grand enough for songs. It was a preventable loss tied to ${profile.coreConflict}. ${input.name} kept replaying the hour when a different choice might have saved someone. The guilt did not make them chosen; it made them precise, stubborn, and unwilling to let the next failure become routine.`,
    `The first sign arrived as evidence. ${profile.distinctiveHook} reacted to something it should not know, pointing toward a hidden cause beneath ${region}'s familiar rules. ${input.name} followed the clue through local customs and private fears, discovering that the region itself had been warning anyone patient enough to listen.`,
    `The trial forced ${input.name} to act before certainty arrived. Crossing a place shaped by ${region}'s dangers, they used craft instead of glory: a route, a tool, a remembered name, a risky mercy. The choice exposed them to blame, but it also proved the problem could be confronted by someone overlooked.`,
    `The enemy was original, local, and painfully believable: a person, creature, cabal, accident, or hunger profiting from ${profile.coreConflict}. When ${input.name} finally saw its shape, the threat was not a throne of darkness. It was a system with hands, habits, and witnesses too frightened to speak.`,
    `${input.name} changed by accepting a harder role, not by becoming untouchable. The ${input.characterType} learned to use ${profile.distinctiveHook} as proof, tool, and promise. In ${region}, transformation meant being seen by neighbors who now understood that quiet duties can become dangerous forms of courage.`,
    `The ending stayed open because ${region} rarely rewards clean answers. ${input.name} solved one part of the trouble, but the last clue led somewhere wider than the first map allowed. The archive closes on a road, a door, or a tide still moving, with ${input.name} following because someone must.`,
  ];
  return pages[index];
}

function visualDirectionForPage(
  input: BookFormInput,
  index: number,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
): BookPage["visualDirection"] {
  const directions: BookPage["visualDirection"][] = [
    {
      sceneType: "iconic cover image",
      cameraShot: "low-angle full-body silhouette, no close-up portrait",
      characterAction: `${input.name} stands with ${profile.distinctiveHook} against a symbolic ${region} backdrop`,
      environment: `${region} landmark with local architecture, landscape, or cultural details`,
      keyObjects: [profile.distinctiveHook, "regional landmark", "subtle local record"],
      mood: "mysterious, grounded, inviting",
      lighting: "blue-gold rim light with deep atmospheric contrast",
    },
    {
      sceneType: "wide establishing shot",
      cameraShot: "wide shot with the protagonist small within the environment",
      characterAction: `${input.name} performs their everyday role before the trouble begins`,
      environment: `busy lived-in ${region} location tied to ${profile.socialRole}`,
      keyObjects: ["work tools", "local people", "regional architecture"],
      mood: "immersive, specific, observant",
      lighting: "soft regional morning or workday light",
    },
    {
      sceneType: "intimate emotional scene",
      cameraShot: "medium environmental shot focused on body language",
      characterAction: `${input.name} confronts the preventable loss tied to ${profile.coreConflict}`,
      environment: `quiet damaged place in ${region} where the cost becomes personal`,
      keyObjects: ["abandoned tool", profile.distinctiveHook, "empty threshold"],
      mood: "restrained grief, focus, guilt",
      lighting: "low side light with soft smoke and long shadows",
    },
    {
      sceneType: "discovery scene",
      cameraShot: "over-the-shoulder shot focused on evidence and clue",
      characterAction: `${input.name} notices ${profile.distinctiveHook} revealing the first wrong detail`,
      environment: `hidden corner of ${region} where local rules begin to bend`,
      keyObjects: [profile.distinctiveHook, "regional clue", "reacting environment"],
      mood: "curious, tense, uncanny",
      lighting: "thin magical glow against practical darkness",
    },
    {
      sceneType: "dynamic action scene",
      cameraShot: "medium-wide action shot with motion and diagonal perspective",
      characterAction: `${input.name} uses craft and courage to cross danger without becoming a generic warrior`,
      environment: `hazardous ${region} setting shaped by the regional conflict`,
      keyObjects: ["moving hazard", "work tool", profile.distinctiveHook],
      mood: "urgent, kinetic, practical",
      lighting: "dramatic contrast with sparks, mist, or regional flare",
    },
    {
      sceneType: "confrontation scene",
      cameraShot: "wide confrontation shot with threat and protagonist both visible",
      characterAction: `${input.name} faces the local force profiting from the problem`,
      environment: `tense ${region} location where private conflict becomes public`,
      keyObjects: ["enemy silhouette", "proof object", "dividing light"],
      mood: "suspenseful, grounded, dangerous",
      lighting: "opposing light sources and deep atmospheric separation",
    },
    {
      sceneType: "transformation scene",
      cameraShot: "medium-wide shot showing context, tools, and witnesses",
      characterAction: `${input.name} accepts a new role shaped by duty rather than destiny`,
      environment: `${region} setting reacting subtly to the protagonist's choice`,
      keyObjects: [profile.distinctiveHook, "local witnesses", "changed environment"],
      mood: "revelatory, earned, human",
      lighting: "warm breakthrough light with mysterious blue undertone",
    },
    {
      sceneType: "cinematic final scene",
      cameraShot: "epic wide shot from behind or distant side angle",
      characterAction: `${input.name} follows the final clue beyond the solved local problem`,
      environment: `open road, portal, tide, ruin, bridge, mountain path, or hidden route in ${region}`,
      keyObjects: ["unresolved clue", profile.distinctiveHook, "distant threshold"],
      mood: "open-ended, mysterious, onward-moving",
      lighting: "twilight horizon glow and soft magical haze",
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
) {
  return [
    `Full-page illustrated story scene for Page ${pageNumber}: ${chapter} - ${title}.`,
    `Scene type: ${visualDirection.sceneType}.`,
    `Camera shot: ${visualDirection.cameraShot}.`,
    `Character action: ${visualDirection.characterAction}.`,
    `Environment: ${visualDirection.environment}.`,
    `Key objects: ${visualDirection.keyObjects.join(", ")}.`,
    `Mood: ${visualDirection.mood}.`,
    `Lighting: ${visualDirection.lighting}.`,
    `Consistent original protagonist: ${input.name}, ${input.gender}, ${input.characterType}, social role: ${profile.socialRole}, symbolic object: ${profile.distinctiveHook}.`,
    `Runeterra region: ${region}. Lore-compatible regional anchor: ${anchor}.`,
    `${IMAGE_STYLE_LOCK} Runeterra atmosphere, coherent character design, no repeated portrait composition, no generic cloaked standing figure.`,
    IMAGE_STYLE_AVOIDANCES,
  ].join(" ");
}
