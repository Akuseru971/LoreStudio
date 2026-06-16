import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import type { BookFormInput, BookPage, ChampionConnection, LoreBook } from "@/lib/types";

const PAGE_COUNT = 8;

export function buildFallbackLoreBook(input: BookFormInput): LoreBook {
  const region = chooseRuneterraRegion(input);
  const profile = regionalProfile(region, input.characterType);
  const championConnection = championConnectionForRegion(region, input);
  const legendaryTitle = `${input.name}, ${profile.title}`;
  const palette = paletteForRegion(region);
  const anchor = loreAnchorForRegion(region);
  const visualDirectionPages = Array.from({ length: PAGE_COUNT }, (_, index) =>
    visualDirectionForPage(input, index, region, profile, championConnection),
  );
  const pageLabels = storyPageLabels(input, region, profile, championConnection);

  return {
    title: `${input.name} and ${profile.distinctiveHook}`,
    subtitle: `An original ${region} chronicle of ${profile.socialRole}, duty, and consequence.`,
    mainRegion: region,
    storyEngine: profile.storyEngine,
    protagonistRole: profile.socialRole,
    coreConflict: profile.coreConflict,
    distinctiveHook: profile.distinctiveHook,
    narratorIntro: `${input.name} was never announced by prophecy. In ${region}, they were known first by a duty no one else wanted to carry.`,
    championConnection,
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
    pages: pageLabels.map((label, index) => {
      const visualDirection = visualDirectionPages[index];

      return {
        pageNumber: index + 1,
        chapter: label.chapter,
        title: label.title,
        text: pageText(input, index, region, profile, championConnection),
        visualDirection,
        imagePrompt: buildFallbackImagePrompt(
          index + 1,
          label.chapter,
          label.title,
          visualDirection,
          region,
          input,
          profile,
          anchor,
          championConnection,
        ),
      };
    }),
  };
}

function championConnectionForRegion(region: string, input: BookFormInput): ChampionConnection {
  const connections: Record<string, ChampionConnection> = {
    Demacia: {
      championName: "Lux",
      connectionType: "inspired_by",
      connectionSummary: `${input.name} grew up hearing how Luxanna Crownguard's forbidden light changed what Demacia feared, and learned to hide any glow beneath their own skin.`,
      canonSafetyNote: "The protagonist is inspired by public rumor and regional fear of magic; they never meet Lux or alter her canon story.",
    },
    Noxus: {
      championName: "Darius",
      connectionType: "faction_shadow",
      connectionSummary: `${input.name}'s village still counts the banners lost to Darius's campaigns, shaping every oath they swear to survive Noxian service.`,
      canonSafetyNote: "The connection is regional consequence and reputation only; the protagonist does not fight or replace Darius.",
    },
    Ionia: {
      championName: "Irelia",
      connectionType: "indirectly_affected",
      connectionSummary: `A border village near ${input.name}'s home still bears scars from the wars Irelia fought, and children learn her name before they learn their own trade.`,
      canonSafetyNote: "The protagonist lives in aftermath and memory of Ionian conflict without participating in canon battles.",
    },
    Piltover: {
      championName: "Jayce",
      connectionType: "inspired_by",
      connectionSummary: `Workshop apprentices in ${input.name}'s district argue over whether Jayce's hammer represents protection or the arrogance of progress.`,
      canonSafetyNote: "The connection is ideological and cultural influence only.",
    },
    Zaun: {
      championName: "Ekko",
      connectionType: "survived_event",
      connectionSummary: `${input.name} once survived a sump collapse because stolen seconds from Ekko's intervention gave them time to crawl through a broken pipe.`,
      canonSafetyNote: "Ekko never knows the protagonist; the rescue is indirect and minor.",
    },
    Shurima: {
      championName: "Azir",
      connectionType: "object_link",
      connectionSummary: `${input.name} found sun-etched stone in ruins stirred by Azir's restored empire, and kept a shard that still warms at dawn.`,
      canonSafetyNote: "The relic is ambient regional aftermath, not a direct meeting with Azir.",
    },
    Freljord: {
      championName: "Ashe",
      connectionType: "rumor",
      connectionSummary: `Winter tales in ${input.name}'s clan always return to Ashe's ice-laced bow and the choice between unity and starvation.`,
      canonSafetyNote: "The connection is oral history and regional myth, not kinship or direct contact.",
    },
    Bilgewater: {
      championName: "Miss Fortune",
      connectionType: "rumor",
      connectionSummary: `In Bilgewater, ${input.name} once carried a sealed warning meant for enemies who feared Miss Fortune's name more than the tide.`,
      canonSafetyNote: "The protagonist handles a message in the criminal economy without meeting Miss Fortune.",
    },
    Targon: {
      championName: "Leona",
      connectionType: "witnessed",
      connectionSummary: `${input.name} witnessed Solari procession light split the mountain mist once, and never forgot the discipline in Leona's stillness.`,
      canonSafetyNote: "The sighting is distant and ceremonial; the protagonist is not chosen by Targon.",
    },
    Ixtal: {
      championName: "Qiyana",
      connectionType: "faction_shadow",
      connectionSummary: `Hidden Ixtali borders near ${input.name}'s home punish trespass harshly, and travelers whisper Qiyana's name like a warning carved in stone.`,
      canonSafetyNote: "The connection is regional fear and politics, not apprenticeship under Qiyana.",
    },
    "Shadow Isles": {
      championName: "Thresh",
      connectionType: "indirectly_affected",
      connectionSummary: `A relative of ${input.name} vanished after following lantern light on the coast, leaving only a chain hook mark on the dock boards.`,
      canonSafetyNote: "The loss is implied aftermath of Shadow Isles horror without rewriting Thresh's canon.",
    },
    "Bandle City": {
      championName: "Lulu",
      connectionType: "witnessed",
      connectionSummary: `${input.name} once saw impossible colors bend through a hedge that should not exist, and blamed yordle mischief ever after.`,
      canonSafetyNote: "The encounter is brief, unexplained, and leaves no lasting canon change.",
    },
    "The Void": {
      championName: "Kai'Sa",
      connectionType: "inspired_by",
      connectionSummary: `Survivors near the rift-touched wastes speak of Kai'Sa as proof that humanity can endure corruption without surrender.`,
      canonSafetyNote: "The protagonist is inspired by survivor stories and never joins Kai'Sa's canon path.",
    },
  };

  return (
    connections[region] || {
      championName: "Ezreal",
      connectionType: "rumor",
      connectionSummary: `${input.name} grew up on expedition stories about Ezreal's discoveries, learning to chase truth where maps ended.`,
      canonSafetyNote: "The connection is inspirational rumor only and does not place the protagonist on Ezreal's adventures.",
    }
  );
}

function storyPageLabels(
  input: BookFormInput,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
  champion: ChampionConnection,
) {
  return [
    {
      chapter: `The Ledger Name of ${input.name}`,
      title: `A ${region} Life Begins`,
    },
    {
      chapter: `Habits of ${region}`,
      title: profile.socialRole,
    },
    {
      chapter: `The Shadow of ${champion.championName}`,
      title: "A Legend Touches the Ordinary",
    },
    {
      chapter: "The Wrong Detail",
      title: profile.distinctiveHook,
    },
    {
      chapter: "What the Archive Refused to Say",
      title: "The Last Free Page",
    },
    {
      chapter: "After the Door Moved",
      title: "Consequence",
    },
    {
      chapter: `What ${input.name} Chose`,
      title: "A Harder Role",
    },
    {
      chapter: "The Road Still Open",
      title: "An Unfinished Fate",
    },
  ];
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

function pageText(
  input: BookFormInput,
  index: number,
  region: string,
  profile: ReturnType<typeof regionalProfile>,
  champion: ChampionConnection,
) {
  const pages = [
    `${input.name}'s name first mattered on a small record, not a prophecy. In ${region}, the ${profile.socialRole} was known by a careful hand, a practical silence, and ${profile.distinctiveHook}. People remembered the work before they remembered the face, which made the first disappearance far more troubling.`,
    `${input.name} grew inside the habits of ${region}: its arguments, tools, warnings, and narrow kindnesses. The work was ordinary until ordinary things began failing in the same pattern. A door unlatched, a route changed, a patient vanished, and the local problem found the one person trained to notice details.`,
    `${champion.connectionSummary} ${input.name} never expected that distant legend to matter until ${profile.distinctiveHook} reacted to the same fear the region had been carrying for years. The connection did not make them chosen. It made the world feel larger, older, and far less safe.`,
    `The conflict stopped being abstract when ${profile.coreConflict} reached ${input.name}'s own threshold. Neighbors looked away, records changed, and every practical skill the ${input.characterType} possessed suddenly became evidence that someone had been hiding the truth for too long.`,
    `${input.name} followed the last honest clue through a place ${region} preferred to forget. The answer should have been small. Instead, the sealed archive door shuddered from the other side, and the name scratched into the dust was one ${input.name} had never spoken aloud.`,
    `Whatever moved behind the door did not finish its work. ${input.name} ran with half a truth, a ruined proof, and the sick certainty that the cliffhanger had only been the beginning. In ${region}, consequences arrive faster than explanations.`,
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
  champion: ChampionConnection,
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
      sceneType: "champion connection scene",
      cameraShot: "medium environmental shot with indirect lore details",
      characterAction: `${input.name} reacts to the distant influence of ${champion.championName} through rumor, symbol, or regional memory`,
      environment: `lived-in ${region} location marked by local history and champion-linked aftermath`,
      keyObjects: ["faction symbol", champion.championName, profile.distinctiveHook],
      mood: "weighted, lore-rooted, intimate",
      lighting: "regional light with a subtle heroic or ominous echo",
    },
    {
      sceneType: "rising conflict scene",
      cameraShot: "medium-wide shot focused on mounting stakes",
      characterAction: `${input.name} realizes ${profile.coreConflict} has become personal and unavoidable`,
      environment: `charged ${region} setting where private truth begins to surface`,
      keyObjects: [profile.distinctiveHook, "altered record", "witness shadow"],
      mood: "tense, inevitable, focused",
      lighting: "closing shadows with one sharp point of light",
    },
    {
      sceneType: "cliffhanger suspense scene",
      cameraShot: "dramatic medium-wide shot frozen at the revelation",
      characterAction: `${input.name} reaches the shocking moment as a sealed door moves and an impossible name appears`,
      environment: `forgotten archive threshold in ${region}, visually locked on the cliffhanger beat`,
      keyObjects: ["moving sealed door", "name in dust", profile.distinctiveHook],
      mood: "breathless, suspended, urgent",
      lighting: "hard suspense contrast at the final frozen beat",
    },
    {
      sceneType: "consequence scene",
      cameraShot: "wide aftermath shot showing immediate fallout",
      characterAction: `${input.name} flees or confronts the immediate consequence of the cliffhanger`,
      environment: `${region} location altered by what was revealed on the previous page`,
      keyObjects: ["ruined proof", "new threat", "escape route"],
      mood: "volatile, exposed, consequential",
      lighting: "unstable light with strong directional contrast",
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
  champion: ChampionConnection,
) {
  const championNote =
    pageNumber <= 3
      ? `Indirect champion influence only: ${champion.championName} via ${champion.connectionType}. ${champion.connectionSummary}`
      : pageNumber === 5
        ? `Cliffhanger page. Visual must dramatize the suspense ending and make the viewer want the next page.`
        : "";

  return [
    `Full-page illustrated story scene for Page ${pageNumber}: ${chapter} - ${title}.`,
    championNote,
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
