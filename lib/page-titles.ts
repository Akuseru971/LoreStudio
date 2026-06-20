const GENERIC_TITLE_BANNED_WORDS =
  /\b(trial|test|choice|awakening|discovery|omen|shadow|prophecy|pattern|shift|turning point|first sign|first blood|first flame|hidden truth|broken path|final door|last light|dark gift|price|pact|mark|seal|calling|whisper)\b/i;

const GENERIC_TITLE_BANNED_PHRASES = [
  /^the trial$/i,
  /^the test$/i,
  /^the choice$/i,
  /^the awakening$/i,
  /^the discovery$/i,
  /^the omen$/i,
  /^the shadow$/i,
  /^the prophecy$/i,
  /^the pattern$/i,
  /^the shift$/i,
  /^the turning point$/i,
  /^when the pattern broke$/i,
  /^when the pattern shifted$/i,
  /^when the door opened$/i,
  /^when the silence answered$/i,
];

const GENERIC_TITLE_BANNED_STRUCTURES = [
  /^when the .+$/i,
  /^the .+ of .+$/i,
  /^a .+ in the .+$/i,
  /^where .+ began$/i,
  /^what .+ found$/i,
];

export function isGenericPageTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 3) {
    return true;
  }

  if (normalized.split(/\s+/).length > 8) {
    return true;
  }

  if (GENERIC_TITLE_BANNED_WORDS.test(normalized)) {
    return true;
  }

  if (GENERIC_TITLE_BANNED_PHRASES.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return false;
}

export function countGenericTitleStructures(titles: string[]) {
  let whenTheCount = 0;
  let genericCount = 0;

  for (const title of titles) {
    const normalized = title.replace(/\s+/g, " ").trim();
    if (/^when the /i.test(normalized)) {
      whenTheCount += 1;
    }
    if (isGenericPageTitle(normalized) || GENERIC_TITLE_BANNED_STRUCTURES.some((pattern) => pattern.test(normalized))) {
      genericCount += 1;
    }
  }

  return { whenTheCount, genericCount };
}

export const PAGE_TITLE_PROMPT_RULES = `Page title rules (critical):
Each page must have a title in pages[].title.

Title style:
- official champion biography section headings
- specific, grounded, elegant, short, concrete
- 3 to 8 words max
- refer to a specific person, place, object, role, or event from that page
- must not sound like a generic fantasy chapter
- must not mention "Chapter"

Good examples:
- A Prince Unfit to Rule
- The Tailor's Queen
- Poison in the Marriage Chamber
- A Cartographer of Lost Wars
- The Bell-Ringer of High Silvermere
- Smoke Over the Lower Lanes
- A Letter Bearing Swain's Seal
- The Night the Bridge Fell

Banned generic titles (never use these or close variants):
- The Trial
- The Test
- The Choice
- The Awakening
- The Discovery
- The Omen
- The Shadow
- The Prophecy
- The Pattern
- The Shift
- The Turning Point
- The First Sign
- The First Blood
- The First Flame
- The Hidden Truth
- The Broken Path
- The Final Door
- The Last Light
- The Dark Gift
- The Price
- The Pact
- The Mark
- The Seal
- The Calling
- The Whisper
- When the Pattern Broke
- When the Pattern Shifted
- When the Door Opened
- When the Silence Answered

Banned title structures (overused):
- "When the X..."
- "The X of Y"
- "A X in the Y"
- "Where X Began"
- "What X Found"

Banned vague title words:
Trial, Omen, Shadow, Fate, Prophecy, Awakening, Pattern, Choice, Shift, Test, Calling, Whisper, Seal, Mark, Pact

Schema note:
- pages[].title is the only reader-facing page heading.
- pages[].chapter must exactly match pages[].title for schema compatibility.

Story text must also avoid stereotyped chapter filler phrases such as:
- "the trial began"
- "the pattern broke"
- "fate shifted"
- "the omen arrived"
- "the shadow answered"
- "the silence remembered"
- "destiny called"

Prefer concrete biography prose:
Bad: "The pattern broke when fate called her name."
Good: "The forged campaign map sent thirty wounded conscripts toward a road that no longer existed."`;

export const PAGE_TITLE_SELF_CHECK = `Before returning JSON, review all 8 pages[].title values.

Reject and rewrite any title that:
- could fit any fantasy story
- is only abstract
- sounds like a generic chapter heading
- appears more than once in "When the X..." structure across the book
- uses a banned word or banned phrase
- does not connect to the actual page event
- repeats the same rhythm as another title

Internally verify this hidden quality check (do not include in JSON):
titleQualityCheck:
- specificToPage: true
- noGenericFantasyWords: true
- variedStructure: true
- biographyStyle: true

If any check fails, rewrite the weak titles before returning JSON.`;
